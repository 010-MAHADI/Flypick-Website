"""
UddoktaPay Payment Gateway Integration
Handles payment initiation, IPN verification, and redirect callbacks.

Endpoints:
  POST /api/orders/payments/initiate/   — Create order then redirect to UddoktaPay
  POST /api/orders/payments/retry/      — Get a fresh payment URL for an existing pending order
  POST /api/orders/payments/ipn/        — IPN webhook from UddoktaPay (no auth required)
  GET  /api/orders/payments/success/    — Browser redirect after successful payment
  GET  /api/orders/payments/cancel/     — Browser redirect after cancelled payment
"""

import logging
import requests
from decimal import Decimal

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order
from .serializers import OrderCreateSerializer, OrderSerializer

logger = logging.getLogger(__name__)

UDDOKTAPAY_BASE_URL = getattr(settings, 'UDDOKTAPAY_BASE_URL', 'https://mahadi.paymently.io/api')
UDDOKTAPAY_API_KEY = getattr(settings, 'UDDOKTAPAY_API_KEY', '')
CHECKOUT_URL = f"{UDDOKTAPAY_BASE_URL}/checkout-v2"
VERIFY_URL = f"{UDDOKTAPAY_BASE_URL}/verify-payment"

# Payment & service charge (2% + 0.5%) added ONLY at the payment gateway so the
# customer pays exactly what the checkout page shows. It is never stored on the
# order or recorded in the ledger — the order value stays the goods total.
SERVICE_CHARGE_RATE = Decimal('0.025')


def gateway_charge_amount(order):
    """The amount to charge at the gateway = order total + 2.5% service charge."""
    total = Decimal(str(order.total_amount or 0))
    return (total + (total * SERVICE_CHARGE_RATE)).quantize(Decimal('0.01'))


def _send_order_notifications_safe(order):
    """Send order emails — called only after payment is confirmed. Safe to call once."""
    try:
        from .serializers import OrderCreateSerializer
        serializer = OrderCreateSerializer()
        serializer._send_order_notifications(order)
        logger.info("Post-payment notifications sent for order %s", order.order_id)
    except Exception as exc:
        logger.error("Failed to send post-payment notifications for order %s: %s", order.order_id, exc)


def _record_payment_callback(*, invoice_id, order_id, kind, reported_status, payload):
    """Append-only record of gateway callbacks (payment_callbacks table)."""
    try:
        from finance.models import PaymentCallback, PaymentRecord
        PaymentCallback.objects.create(
            gateway='uddoktapay', invoice_id=invoice_id or '', order_id=order_id or '',
            kind=kind, reported_status=(reported_status or '')[:40],
            payload=payload if isinstance(payload, dict) else {},
        )
        if invoice_id and reported_status:
            status_map = {'completed': 'paid', 'success': 'paid',
                          'cancelled': 'failed', 'failed': 'failed', 'refunded': 'refunded'}
            mapped = status_map.get(reported_status)
            if mapped:
                from django.utils import timezone
                record = PaymentRecord.objects.filter(invoice_id=invoice_id).first()
                if record and record.status not in ('paid', 'refunded'):
                    record.status = mapped
                    if mapped == 'paid':
                        record.verified_at = timezone.now()
                    record.raw_response = payload if isinstance(payload, dict) else {}
                    record.save(update_fields=['status', 'verified_at', 'raw_response', 'updated_at'])
    except Exception:
        logger.exception("Failed to record payment callback for invoice %s", invoice_id)


def _frontend_url(path: str) -> str:
    base = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    return f"{base}{path}"


def _backend_url(path: str, request=None) -> str:
    if request:
        return request.build_absolute_uri(path)
    base = getattr(settings, 'BACKEND_PUBLIC_URL', getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')).rstrip('/')
    return f"{base}{path}"


class InitiatePaymentView(APIView):
    """
    POST /api/orders/payments/initiate/

    1. Creates the order (same payload as /api/orders/orders/)
    2. If payment_method == 'uddoktapay': calls UddoktaPay checkout API and
       returns { order_id, payment_url } so the frontend can redirect the user.
    3. If payment_method == 'cod' or others: creates the order and returns
       the order data directly (existing flow).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = OrderCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        if order.payment_method == 'uddoktapay':
            try:
                # frontend_url can be sent by the client so the redirect always
                # points to the correct origin (important in dev with dynamic Vite ports).
                frontend_url = request.data.get('frontend_url', '').strip() or None
                payment_url = self._initiate_uddoktapay(order, request, frontend_url=frontend_url)
                return Response({
                    'requires_redirect': True,
                    'order_id': order.order_id,
                    'payment_url': payment_url,
                }, status=status.HTTP_201_CREATED)
            except Exception as exc:
                # If payment initiation fails, cancel the order rather than
                # leaving it in an ambiguous state.
                logger.error(
                    "UddoktaPay initiation failed for order %s: %s",
                    order.order_id, exc
                )
                order.payment_status = 'failed'
                order.status = 'cancelled'
                order.save(update_fields=['payment_status', 'status'])
                return Response(
                    {'detail': 'Payment gateway error. Please try again.'},
                    status=status.HTTP_502_BAD_GATEWAY
                )

        # Non-UddoktaPay flow (COD / bKash manual / Nagad manual)
        output = OrderSerializer(order, context={'request': request})
        return Response(output.data, status=status.HTTP_201_CREATED)

    def _initiate_uddoktapay(self, order: Order, request, frontend_url: str = None) -> str:
        """Call UddoktaPay checkout-v2 and return the hosted payment URL."""
        customer = order.customer

        # Use frontend_url from request if provided (handles dynamic Vite ports in dev).
        # Falls back to FRONTEND_URL from Django settings.
        base = (frontend_url or _frontend_url('')).rstrip('/')

        # Build callback URLs
        ipn_url = _backend_url('/api/orders/payments/ipn/', request)
        redirect_url = f"{base}/payment/success?order_id={order.order_id}"
        cancel_url = f"{base}/payment/cancel?order_id={order.order_id}"

        # Charge the goods total plus the 2.5% payment & service charge, so the
        # customer pays exactly what the checkout page showed. The order itself
        # still records only the goods total.
        charge_amount = gateway_charge_amount(order)

        payload = {
            'full_name': order.shipping_full_name or customer.get_full_name() or customer.username,
            'email': customer.email,
            'amount': str(charge_amount),
            'metadata': {
                'order_id': order.order_id,
                'customer_id': str(customer.id),
            },
            'redirect_url': redirect_url,
            'cancel_url': cancel_url,
            'webhook_url': ipn_url,
        }

        headers = {
            'RT-UDDOKTAPAY-API-KEY': UDDOKTAPAY_API_KEY,
            'Content-Type': 'application/json',
            'accept': 'application/json',
        }

        logger.info("Initiating UddoktaPay for order %s, amount=%s (goods %s + 2.5%% service charge)",
                    order.order_id, charge_amount, order.total_amount)

        resp = requests.post(CHECKOUT_URL, json=payload, headers=headers, timeout=30)

        if resp.status_code != 200:
            logger.error(
                "UddoktaPay checkout failed [%s]: %s",
                resp.status_code, resp.text
            )
            raise RuntimeError(f"UddoktaPay returned HTTP {resp.status_code}")

        data = resp.json()
        payment_url = data.get('payment_url')
        if not payment_url:
            raise RuntimeError(f"No payment_url in UddoktaPay response: {data}")

        # Record the payment attempt (payments table — spec Part 3 §4)
        try:
            from finance.models import PaymentRecord
            PaymentRecord.objects.create(
                order=order,
                gateway='uddoktapay',
                invoice_id=data.get('invoice_id') or data.get('id') or '',
                amount=order.total_amount,
                status='pending',
                raw_response={'payment_url': payment_url},
            )
        except Exception:
            logger.exception("Failed to create PaymentRecord for order %s", order.order_id)

        logger.info(
            "UddoktaPay payment_url obtained for order %s: %s",
            order.order_id, payment_url
        )
        return payment_url


class VerifyPaymentView(APIView):
    """
    POST /api/orders/payments/verify/
    Body: { "invoice_id": "...", "order_id": "..." }

    Called by the frontend success page when the browser redirect includes
    invoice_id (which UddoktaPay appends to the redirect URL).
    This is the fallback for local dev where the IPN webhook cannot reach
    localhost. In production the IPN does the same job, but this endpoint
    is idempotent so both can run safely.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        invoice_id = request.data.get('invoice_id', '').strip()
        order_id = request.data.get('order_id', '').strip()

        if not invoice_id or not order_id:
            return Response(
                {'detail': 'invoice_id and order_id are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify ownership
        try:
            order = Order.objects.get(order_id=order_id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.payment_method != 'uddoktapay':
            return Response({'detail': 'Not an online payment order.'}, status=status.HTTP_400_BAD_REQUEST)

        # Already confirmed — return early (idempotent)
        if order.payment_status == 'paid':
            serializer = OrderSerializer(order, context={'request': request})
            return Response({'status': 'already_paid', 'order': serializer.data})

        # Verify with UddoktaPay
        try:
            ipn_view = UddoktaPayIPNView()
            verification = ipn_view._verify_payment(invoice_id)
        except Exception as exc:
            logger.error("Verify endpoint: UddoktaPay verification failed for invoice %s: %s", invoice_id, exc)
            return Response(
                {'detail': 'Could not verify payment with gateway. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY
            )

        payment_status_raw = verification.get('status', '').lower()
        logger.info("Verify endpoint: invoice=%s status=%s order=%s", invoice_id, payment_status_raw, order_id)
        _record_payment_callback(
            invoice_id=invoice_id, order_id=order_id, kind='verify',
            reported_status=payment_status_raw, payload=verification)

        if payment_status_raw in ('completed', 'success'):
            was_already_paid = order.payment_status == 'paid'
            order.payment_status = 'paid'
            # Keep the order Pending after payment: it becomes visible to the
            # seller (who works it from the Pending tab) and stays customer-
            # cancellable until the seller starts processing it.
            order.save(update_fields=['payment_status'])

            if not was_already_paid:
                _send_order_notifications_safe(order)

            serializer = OrderSerializer(order, context={'request': request})
            return Response({'status': 'paid', 'order': serializer.data})

        elif payment_status_raw in ('cancelled', 'failed'):
            order.payment_status = 'failed'
            order.status = 'cancelled'
            order.save(update_fields=['payment_status', 'status'])
            serializer = OrderSerializer(order, context={'request': request})
            return Response({'status': 'failed', 'order': serializer.data})

        # Still pending — return current state
        serializer = OrderSerializer(order, context={'request': request})
        return Response({'status': payment_status_raw or 'pending', 'order': serializer.data})


class RetryPaymentView(APIView):
    """
    POST /api/orders/payments/retry/
    Body: { "order_id": "FP..." }

    Called when the user wants to complete payment for an existing pending
    UddoktaPay order (e.g. they closed the tab before paying).
    Returns a fresh { payment_url } so the frontend can redirect them again.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        order_id = request.data.get('order_id', '').strip()
        if not order_id:
            return Response({'detail': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.get(order_id=order_id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Only allow retry for uddoktapay orders that are still unpaid
        if order.payment_method != 'uddoktapay':
            return Response({'detail': 'This order does not use online payment.'}, status=status.HTTP_400_BAD_REQUEST)

        if order.payment_status == 'paid':
            return Response({'detail': 'This order is already paid.'}, status=status.HTTP_400_BAD_REQUEST)

        if order.status == 'cancelled':
            return Response({'detail': 'This order has been cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            view = InitiatePaymentView()
            frontend_url = request.data.get('frontend_url', '').strip() or None
            payment_url = view._initiate_uddoktapay(order, request, frontend_url=frontend_url)
            return Response({'payment_url': payment_url}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.error("UddoktaPay retry failed for order %s: %s", order.order_id, exc)
            return Response({'detail': 'Payment gateway error. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)


@method_decorator(csrf_exempt, name='dispatch')
class UddoktaPayIPNView(APIView):
    """
    POST /api/orders/payments/ipn/

    Instant Payment Notification from UddoktaPay.
    UddoktaPay posts here after a payment is completed. We verify it by
    calling the verify-payment endpoint and then update the order.

    No authentication required — UddoktaPay calls this from their server.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # Bypass JWT for webhook

    def post(self, request, *args, **kwargs):
        invoice_id = (
            request.data.get('invoice_id')
            or request.data.get('payment_id')
            or request.POST.get('invoice_id')
            or request.POST.get('payment_id')
        )

        if not invoice_id:
            logger.warning("UddoktaPay IPN received without invoice_id: %s", request.data)
            return Response({'status': 'error', 'message': 'No invoice_id'}, status=400)

        # Verify payment with UddoktaPay
        try:
            verification = self._verify_payment(invoice_id)
        except Exception as exc:
            logger.error("UddoktaPay verification failed for invoice %s: %s", invoice_id, exc)
            return Response({'status': 'error', 'message': 'Verification error'}, status=502)

        payment_status_raw = verification.get('status', '').lower()
        metadata = verification.get('metadata', {})
        order_id = (
            metadata.get('order_id')
            or request.data.get('order_id')
            or request.POST.get('order_id')
        )

        # Store every callback for the audit trail / duplicate analysis
        _record_payment_callback(
            invoice_id=invoice_id, order_id=order_id or '', kind='ipn',
            reported_status=payment_status_raw, payload=verification)

        if not order_id:
            logger.error("Cannot determine order_id from IPN. invoice=%s data=%s", invoice_id, request.data)
            return Response({'status': 'error', 'message': 'No order_id'}, status=400)

        try:
            order = Order.objects.get(order_id=order_id)
        except Order.DoesNotExist:
            logger.error("IPN order not found: %s", order_id)
            return Response({'status': 'error', 'message': 'Order not found'}, status=404)

        # Map UddoktaPay status to our payment_status
        if payment_status_raw in ('completed', 'success'):
            was_already_paid = order.payment_status == 'paid'
            order.payment_status = 'paid'
            # Keep the order Pending after payment (see VerifyPaymentView).
            order.save(update_fields=['payment_status'])
            logger.info("Order %s payment confirmed via IPN.", order_id)

            # Only send notifications once — skip if already paid (duplicate IPN)
            if not was_already_paid:
                _send_order_notifications_safe(order)

        elif payment_status_raw in ('cancelled', 'failed', 'refunded'):
            order.payment_status = payment_status_raw if payment_status_raw in ('failed', 'refunded') else 'failed'
            order.status = 'cancelled'
            order.save(update_fields=['payment_status', 'status'])
            logger.info("Order %s payment %s via IPN.", order_id, payment_status_raw)
        else:
            logger.warning("Unrecognised UddoktaPay status '%s' for order %s", payment_status_raw, order_id)

        return Response({'status': 'ok'})

    def _verify_payment(self, invoice_id: str) -> dict:
        headers = {
            'RT-UDDOKTAPAY-API-KEY': UDDOKTAPAY_API_KEY,
            'Content-Type': 'application/json',
            'accept': 'application/json',
        }
        resp = requests.post(
            VERIFY_URL,
            json={'invoice_id': invoice_id},
            headers=headers,
            timeout=30
        )
        if resp.status_code != 200:
            raise RuntimeError(f"UddoktaPay verify returned HTTP {resp.status_code}: {resp.text}")
        return resp.json()


class PaymentSuccessView(APIView):
    """
    GET /api/orders/payments/success/?invoice_id=...&order_id=...

    UddoktaPay redirects the customer browser here after payment.
    We verify the payment and redirect the browser to the frontend
    confirmation page.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        from django.http import HttpResponseRedirect

        invoice_id = request.query_params.get('invoice_id') or request.query_params.get('payment_id')
        order_id = request.query_params.get('order_id')

        if not order_id:
            return HttpResponseRedirect(_frontend_url('/orders'))

        # Try to verify if invoice_id present; otherwise trust IPN already handled it
        if invoice_id:
            try:
                ipn_view = UddoktaPayIPNView()
                verification = ipn_view._verify_payment(invoice_id)
                payment_status_raw = verification.get('status', '').lower()

                try:
                    order = Order.objects.get(order_id=order_id)
                    if payment_status_raw in ('completed', 'success'):
                        was_already_paid = order.payment_status == 'paid'
                        order.payment_status = 'paid'
                        # Keep the order Pending after payment (see above).
                        order.save(update_fields=['payment_status'])
                        # Send notifications if not already done by IPN
                        if not was_already_paid:
                            _send_order_notifications_safe(order)
                except Order.DoesNotExist:
                    pass
            except Exception as exc:
                logger.warning("Success redirect verification failed for order %s: %s", order_id, exc)

        return HttpResponseRedirect(_frontend_url(f'/payment/success?order_id={order_id}'))


class PaymentCancelView(APIView):
    """
    GET /api/orders/payments/cancel/?order_id=...

    UddoktaPay redirects here when user cancels the payment.
    We mark the order as failed and redirect to the frontend cancel page.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        from django.http import HttpResponseRedirect

        order_id = request.query_params.get('order_id')
        if order_id:
            try:
                order = Order.objects.get(order_id=order_id)
                if order.payment_status == 'pending':
                    order.payment_status = 'failed'
                    order.status = 'cancelled'
                    order.save(update_fields=['payment_status', 'status'])
            except Order.DoesNotExist:
                pass

        return HttpResponseRedirect(
            _frontend_url(f'/payment/cancel?order_id={order_id}' if order_id else '/cart')
        )
