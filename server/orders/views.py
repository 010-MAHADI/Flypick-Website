from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from django.db.models import F
from .models import Order, PaymentMethod, Refund
from .serializers import (
    OrderSerializer, OrderCreateSerializer, OrderStatusHistorySerializer,
    PaymentMethodSerializer, RefundSerializer, WalletTransactionSerializer,
)
from .lifecycle import (
    allowed_next_statuses, create_refund, customer_cancellable_statuses,
    record_status, transition_order, transition_refund, wallet_balance,
)
from users.roles import is_admin_user


def _seller_can_manage_order(user, order):
    """A seller may act on an order when it contains items from their shops."""
    shop_ids = set(user.shops.values_list('id', flat=True))
    return any(
        item.product and item.product.shop_id in shop_ids
        for item in order.items.all()
    )


def _can_manage_order(user, order):
    return is_admin_user(user) or (
        getattr(user, 'role', '') == 'Seller' and _seller_can_manage_order(user, order)
    )

class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action == 'product_coupons':
            # Allow public access to product coupons
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        shop_id = self.request.query_params.get('shop')

        if is_admin_user(user):
            queryset = Order.objects.all().prefetch_related('items', 'items__product', 'items__product__shop')
        elif user.role == 'Seller':
            # Sellers see orders that contain items from their shops
            shop_ids = user.shops.values_list('id', flat=True)
            queryset = Order.objects.filter(items__product__shop_id__in=shop_ids).distinct().prefetch_related('items', 'items__product', 'items__product__shop')
            # Online (prepaid) orders are hidden from the seller until payment
            # succeeds — the seller must never see or act on an unpaid online
            # order. COD orders appear immediately (payment is collected on
            # delivery). Applies to every seller list.
            cod_methods = ['cod', 'cash_on_delivery']
            queryset = queryset.filter(
                Q(payment_method__in=cod_methods) | Q(payment_status='paid')
            )
        else:
            queryset = Order.objects.filter(customer=user).prefetch_related('items', 'items__product', 'items__product__shop')

        # Filter by specific shop if provided
        if shop_id:
            queryset = queryset.filter(items__product__shop_id=shop_id).distinct()

        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        return OrderSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        
        # Return the created order with full details
        output_serializer = OrderSerializer(order, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def validate_coupon(self, request):
        """Validate a coupon code for the current user and cart items.

        Uses the exact same rules as checkout (OrderCreateSerializer):
        seller coupons apply per-seller to products or shipping only,
        admin coupons apply to product prices funded by Platform Balance.
        """
        from decimal import Decimal
        from django.utils import timezone
        from rest_framework.exceptions import ValidationError as DRFError
        from seller.models import Coupon
        from finance.models import AdminCoupon
        from products.models import Product
        from .serializers import OrderCreateSerializer

        coupon_code = request.data.get('coupon_code', '').strip().upper()
        cart_items = request.data.get('cart_items', [])  # List of {product_id, quantity}

        if not coupon_code:
            return Response({'valid': False, 'error': 'Coupon code is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not cart_items:
            return Response({'valid': False, 'error': 'Cart items are required'},
                            status=status.HTTP_400_BAD_REQUEST)

        helper = OrderCreateSerializer()

        def error_text(exc):
            detail = exc.detail
            if isinstance(detail, dict):
                detail = next(iter(detail.values()))
            if isinstance(detail, (list, tuple)):
                detail = detail[0]
            return str(detail)

        # Build the same item structures the checkout uses.
        order_items = []
        item_shipping_by_index = {}
        subtotal = Decimal('0')
        for item in cart_items:
            try:
                product = Product.objects.select_related('shop__seller').get(id=item['product_id'])
            except Product.DoesNotExist:
                continue
            quantity = int(item.get('quantity', 1))
            price = Decimal(str(product.originalPrice if product.originalPrice is not None else product.price))
            subtotal += price * quantity

            try:
                shipping_snapshot = helper._select_shipping_option(product, item.get('shipping_type', ''))
                item_shipping = shipping_snapshot['charge']
            except DRFError as exc:
                return Response({'valid': False, 'error': error_text(exc)})
            item_shipping_by_index[len(order_items)] = item_shipping
            order_items.append({'product': product, 'price': price, 'quantity': quantity})

        if not order_items:
            return Response({'valid': False, 'error': 'No valid products in cart'})

        try:
            seller_coupon = Coupon.objects.filter(
                code=coupon_code, is_active=True,
                expires_at__gte=timezone.now().date()).select_related('seller').first()
            if seller_coupon:
                try:
                    product_discount, shipping_discount = helper._apply_seller_coupon(
                        seller_coupon, request.user, order_items, item_shipping_by_index)
                except DRFError as exc:
                    return Response({'valid': False, 'error': error_text(exc)})
                return Response({
                    'valid': True,
                    'coupon': {
                        'code': seller_coupon.code,
                        'discount_type': seller_coupon.discount_type,
                        'discount_value': float(seller_coupon.discount_value),
                        'discount_amount': float(product_discount + shipping_discount),
                        'coupon_type': seller_coupon.coupon_type,
                        'source': 'seller',
                    }
                })

            admin_coupon = AdminCoupon.objects.filter(code=coupon_code).first()
            if admin_coupon:
                try:
                    split = helper._apply_admin_coupon(
                        admin_coupon, request.user, order_items, subtotal)
                except DRFError as exc:
                    return Response({'valid': False, 'error': error_text(exc)})
                total_discount = sum(split.values(), Decimal('0'))
                return Response({
                    'valid': True,
                    'coupon': {
                        'code': admin_coupon.code,
                        'discount_type': admin_coupon.discount_type,
                        'discount_value': float(admin_coupon.discount_value),
                        'discount_amount': float(total_discount),
                        'coupon_type': admin_coupon.scope,
                        'source': 'admin',
                    }
                })

            return Response({'valid': False, 'error': 'Invalid coupon code'})
        except Exception:
            import logging
            logging.getLogger(__name__).exception('Coupon validation failed for %s', coupon_code)
            return Response({
                'valid': False,
                'error': 'An error occurred while validating the coupon'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def product_coupons(self, request):
        """Get available coupons for a specific product"""
        from django.utils import timezone
        from seller.models import Coupon
        from products.models import Product
        
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({
                'error': 'Product ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({
                'error': 'Product not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all active coupons that are applicable to this product
        applicable_coupons = []
        
        # Get all active coupons
        active_coupons = Coupon.objects.filter(
            is_active=True,
            expires_at__gte=timezone.now().date(),
            uses__lt=F('max_uses')
        ).select_related('category').prefetch_related('coupon_products')
        
        for coupon in active_coupons:
            is_applicable = False
            
            if coupon.coupon_type == 'all_products':
                is_applicable = True
            elif coupon.coupon_type == 'first_order':
                # Show to all users, but will be validated at checkout
                is_applicable = True
            elif coupon.coupon_type == 'category':
                if coupon.category:
                    # Check if product belongs to this category
                    if (product.category_fk == coupon.category or 
                        (product.category and product.category.lower() == coupon.category.name.lower())):
                        is_applicable = True
            elif coupon.coupon_type == 'specific_products':
                # Check if this product is in the coupon's specific products
                if coupon.coupon_products.filter(product=product).exists():
                    is_applicable = True
            
            if is_applicable:
                # Calculate potential discount for display
                discount_text = ""
                if coupon.discount_type == 'percent':
                    discount_text = f"{coupon.discount_value}% OFF"
                elif coupon.discount_type == 'fixed':
                    discount_text = f"৳{coupon.discount_value} OFF"
                elif coupon.discount_type == 'shipping':
                    discount_text = "FREE SHIPPING"
                
                applicable_coupons.append({
                    'id': coupon.id,
                    'code': coupon.code,
                    'discount_type': coupon.discount_type,
                    'discount_value': float(coupon.discount_value),
                    'discount_text': discount_text,
                    'coupon_type': coupon.coupon_type,
                    'min_order_amount': float(coupon.min_order_amount),
                    'expires_at': coupon.expires_at.isoformat(),
                    'uses': coupon.uses,
                    'max_uses': coupon.max_uses,
                    'remaining_uses': coupon.max_uses - coupon.uses
                })
        
        return Response({
            'coupons': applicable_coupons,
            'count': len(applicable_coupons)
        })

    # Payment-related fields may only be changed by an admin (spec: sellers
    # have no authority over payment management; the customer's choice at
    # checkout is final).
    PAYMENT_FIELDS = {'payment_status', 'payment_method', 'total_amount',
                      'subtotal', 'discount', 'store_credit_used', 'platform_charge'}

    def partial_update(self, request, *args, **kwargs):
        # Status changes always go through the lifecycle service so the
        # legacy seller UI (bare PATCH {status}) gets validation + audit too.
        if not is_admin_user(request.user):
            attempted = self.PAYMENT_FIELDS.intersection(request.data.keys())
            if attempted:
                return Response(
                    {'detail': 'Only an administrator can modify payment information.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        new_status = request.data.get('status')
        if new_status:
            order = self.get_object()
            if new_status != order.status:
                if not _can_manage_order(request.user, order):
                    return Response(
                        {'detail': 'Only sellers and admins can update order status.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                transition_order(order, new_status, actor=request.user,
                                 note=request.data.get('note', ''))
            remaining = {k: v for k, v in request.data.items() if k not in ('status', 'note')}
            if not remaining:
                return Response(OrderSerializer(order, context={'request': request}).data)
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['patch'])
    def cancel(self, request, pk=None):
        """Customer cancellation. Allowed ONLY while the order is Pending.

        The customer supplies a reason and a refund method:
          - store_credit: the refund completes instantly (money moves from the
            seller's Marketplace Balance / Seller Payable to the Customer Wallet).
          - original: a refund request is opened for the Admin to process through
            the original payment method. The seller takes no action.
        Unpaid orders (COD, or online not yet paid) simply cancel and any held
        store credit is released automatically.
        """
        order = self.get_object()

        if order.customer != request.user and not is_admin_user(request.user):
            return Response(
                {'detail': 'You can only cancel your own orders.'},
                status=status.HTTP_403_FORBIDDEN
            )

        cancellable = customer_cancellable_statuses()
        if order.status not in cancellable and not is_admin_user(request.user):
            return Response(
                {'detail': f'Cannot cancel an order that is already "{order.get_status_display()}". '
                           'You can only cancel while the order is pending; after that, '
                           'please request a return once it is delivered.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = (request.data.get('reason') or 'Cancelled by customer').strip()
        refund_method = (request.data.get('refund_method') or 'original').strip()
        if refund_method not in ('store_credit', 'original'):
            refund_method = 'original'

        from .lifecycle import full_refund_amount
        needs_refund = order.payment_status == 'paid' and full_refund_amount(order) > 0

        transition_order(order, 'cancelled', actor=request.user, note=reason)

        refund = None
        if needs_refund:
            # store_credit -> instant; original -> opened 'approved' awaiting the
            # admin to settle it via the original payment method.
            refund = create_refund(
                order, full_refund_amount(order),
                method=refund_method, refund_type='full',
                reason=f'Order cancelled: {reason}'[:255],
                requested_by=request.user,
                initial_status='approved',
                origin='cancellation',
                note='Opened on cancellation of a paid order',
            )

        serializer = OrderSerializer(order, context={'request': request})
        data = serializer.data
        if refund:
            data['refund_id'] = refund.refund_id
            data['refund_status'] = refund.status
            data['refund_method'] = refund.method
        return Response(data)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Seller/admin fulfilment workflow: move an order forward through
        the lifecycle, optionally attaching tracking details."""
        order = self.get_object()
        if not _can_manage_order(request.user, order):
            return Response(
                {'detail': 'Only sellers and admins can update order status.'},
                status=status.HTTP_403_FORBIDDEN
            )

        new_status = request.data.get('status')
        note = request.data.get('note', '')
        if not new_status:
            return Response({'detail': 'status is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Same status + a note = a tracking note on the timeline, not a
        # transition. Lets sellers post updates without changing the status.
        if new_status == order.status:
            if not note:
                return Response({'detail': 'Add a note or pick a different status.'},
                                status=status.HTTP_400_BAD_REQUEST)
            tracking_number = request.data.get('tracking_number')
            if tracking_number:
                order.tracking_number = tracking_number[:100]
                order.save(update_fields=['tracking_number', 'updated_at'])
            record_status(order, order.status, order.status, actor=request.user, note=note)
            return Response(OrderSerializer(order, context={'request': request}).data)

        estimated = request.data.get('estimated_delivery_date') or None
        transition_order(
            order, new_status, actor=request.user,
            note=note,
            tracking_number=request.data.get('tracking_number'),
            courier_name=request.data.get('courier_name'),
            estimated_delivery_date=estimated,
        )
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Admin-only: record/correct a payment.

        Sellers can no longer mark orders paid — the payment method is fixed at
        checkout, and COD orders are marked paid automatically on delivery.
        This remains available to admins for corrections from the Admin Orders
        page. The finance ledger is posted via the Order post_save signal.
        """
        order = self.get_object()
        if not is_admin_user(request.user):
            return Response({'detail': 'Only an administrator can record or change payments.'},
                            status=status.HTTP_403_FORBIDDEN)
        if order.payment_status == 'paid':
            return Response({'detail': 'This order is already marked as paid.'},
                            status=status.HTTP_400_BAD_REQUEST)

        method = (request.data.get('payment_method') or order.payment_method or 'cod').strip()
        note = (request.data.get('note') or '').strip()
        order.payment_status = 'paid'
        order.payment_method = method[:50]
        order.save(update_fields=['payment_status', 'payment_method', 'updated_at'])
        record_status(
            order, order.status, order.status, actor=request.user,
            note=f'Payment recorded by admin via {method}' + (f' — {note}' if note else ''),
        )
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def admin_search(self, request):
        """Admin Orders page: look an order up by its Order ID and return the
        full order plus its complete financial (ledger) history. Admin only."""
        if not is_admin_user(request.user):
            return Response({'detail': 'Administrators only.'}, status=status.HTTP_403_FORBIDDEN)

        order_id = (request.query_params.get('order_id') or '').strip()
        if not order_id:
            return Response({'detail': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        order = (Order.objects
                 .filter(order_id__iexact=order_id)
                 .prefetch_related('items', 'items__product', 'items__product__shop').first())
        if not order:
            return Response({'detail': f'No order found with ID "{order_id}".'},
                            status=status.HTTP_404_NOT_FOUND)

        data = OrderSerializer(order, context={'request': request}).data
        data.update(self._order_audit(order, request, full=True))
        return Response(data)

    @staticmethod
    def _order_audit(order, request, *, full):
        """Assemble the full audit view of an order: every timeline, history
        and operation log. ``full`` includes real actor identities (admin);
        otherwise identities are role-masked for the seller view."""
        from .serializers import RefundSerializer

        history = list(order.status_history.select_related('changed_by').all())

        def actor_label(user):
            if not user:
                return 'System'
            role = getattr(user, 'role', '')
            if full:
                return f'{user.get_full_name() or user.username} ({role or "user"})'
            # Seller view: mask customer/admin identities.
            if role in ('Admin',) or user.is_superuser:
                return 'Flypick'
            if role == 'Seller':
                return 'You'
            return 'Customer'

        def is_seller_actor(user):
            return bool(user and getattr(user, 'role', '') == 'Seller')

        def is_admin_actor(user):
            return bool(user and (getattr(user, 'role', '') == 'Admin' or user.is_superuser))

        status_events = [{
            'from_status': h.from_status,
            'to_status': h.to_status,
            'note': h.note,
            'actor': actor_label(h.changed_by),
            'actor_role': getattr(h.changed_by, 'role', '') if h.changed_by else '',
            'created_at': h.created_at,
        } for h in history]

        # Tracking / shipping timeline: the fulfilment-related status steps.
        tracking_steps = {'confirmed', 'processing', 'packed', 'shipped',
                          'out_for_delivery', 'delivered'}
        tracking_timeline = [e for e in status_events if e['to_status'] in tracking_steps]

        # Payment timeline: ledger events + payment-related status notes.
        payment_timeline = []
        from finance.models import LedgerTransaction
        for txn in (LedgerTransaction.objects.filter(order=order)
                    .order_by('created_at')):
            payment_timeline.append({
                'event': txn.get_txn_type_display(),
                'txn_type': txn.txn_type,
                'note': txn.notes,
                'created_at': txn.created_at,
            })
        for e in status_events:
            if 'payment' in (e['note'] or '').lower():
                payment_timeline.append({
                    'event': 'Payment note', 'txn_type': 'note',
                    'note': e['note'], 'created_at': e['created_at']})
        payment_timeline.sort(key=lambda x: x['created_at'])

        audit = {
            'status_history': status_events,
            'tracking_timeline': tracking_timeline,
            'payment_timeline': payment_timeline,
            'seller_activities': [e for e in status_events
                                  if e['actor_role'] == 'Seller'],
            'shipping': {
                'method': order.shipping_method,
                'estimated_delivery': order.shipping_estimated_delivery,
                'courier_name': order.courier_name,
                'tracking_number': order.tracking_number,
            },
            'refunds': RefundSerializer(
                order.refunds.all(), many=True, context={'request': request}).data,
        }
        if full:
            audit['financial_history'] = OrderViewSet._order_financial_history(order)
            # Operation logs: every recorded change with actor + note.
            audit['operation_logs'] = [{
                'action': f'{e["from_status"] or "—"} → {e["to_status"]}',
                'note': e['note'], 'actor': e['actor'], 'created_at': e['created_at'],
            } for e in status_events]
            # Seller (shop owner) identity for the order.
            shops = {i.product.shop for i in order.items.all()
                     if i.product and i.product.shop}
            audit['sellers'] = [{
                'shop': s.name, 'seller_email': s.seller.email,
                'seller_name': s.seller.get_full_name() or s.seller.username,
            } for s in shops]
        return audit

    @action(detail=True, methods=['get'])
    def seller_detail(self, request, pk=None):
        """Rich order view for the seller: timelines and histories with
        customer/admin identities masked. Sellers and admins only."""
        order = self.get_object()
        if not _can_manage_order(request.user, order):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        data = OrderSerializer(order, context={'request': request}).data
        data.update(self._order_audit(order, request, full=False))
        return Response(data)

    @action(detail=True, methods=['get'])
    def financial_history(self, request, pk=None):
        """Admin-only ledger history for a single order."""
        if not is_admin_user(request.user):
            return Response({'detail': 'Administrators only.'}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        return Response({'financial_history': self._order_financial_history(order)})

    @staticmethod
    def _order_financial_history(order):
        from finance.models import LedgerTransaction
        from finance.serializers import LedgerTransactionSerializer
        txns = (LedgerTransaction.objects.filter(order=order)
                .select_related('order', 'refund', 'withdrawal', 'coupon', 'created_by')
                .prefetch_related('entries__account__user')
                .order_by('-created_at'))
        return LedgerTransactionSerializer(txns, many=True).data

    @action(detail=True, methods=['post'])
    def admin_payment_action(self, request, pk=None):
        """Admin-only: set an order's payment status/method for corrections.

        Setting status to 'paid' triggers the finance ledger via the Order
        post_save signal. Sellers have no access to this.
        """
        if not is_admin_user(request.user):
            return Response({'detail': 'Only an administrator can manage payments.'},
                            status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        new_status = (request.data.get('payment_status') or '').strip()
        new_method = (request.data.get('payment_method') or '').strip()
        note = (request.data.get('note') or '').strip()

        valid = dict(Order.PAYMENT_STATUS_CHOICES)
        if new_status and new_status not in valid:
            return Response({'detail': f'Invalid payment status "{new_status}".'},
                            status=status.HTTP_400_BAD_REQUEST)

        update_fields = ['updated_at']
        changes = []
        if new_method and new_method != order.payment_method:
            changes.append(f'method {order.payment_method}→{new_method}')
            order.payment_method = new_method[:50]
            update_fields.append('payment_method')
        if new_status and new_status != order.payment_status:
            changes.append(f'status {order.payment_status}→{new_status}')
            order.payment_status = new_status
            update_fields.append('payment_status')

        if not changes:
            return Response({'detail': 'No payment changes provided.'},
                            status=status.HTTP_400_BAD_REQUEST)

        order.save(update_fields=update_fields)  # signal posts ledger when paid
        record_status(order, order.status, order.status, actor=request.user,
                      note=f'Admin payment update: {"; ".join(changes)}'
                           + (f' — {note}' if note else ''))
        data = OrderSerializer(order, context={'request': request}).data
        data['financial_history'] = self._order_financial_history(order)
        return Response(data)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Full tracking view: status history + shipment info + next steps."""
        order = self.get_object()
        if order.customer != request.user and not _can_manage_order(request.user, order):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

        history = OrderStatusHistorySerializer(order.status_history.all(), many=True).data
        return Response({
            'order_id': order.order_id,
            'status': order.status,
            'tracking_number': order.tracking_number,
            'courier_name': order.courier_name,
            'estimated_delivery_date': order.estimated_delivery_date,
            'history': history,
            'allowed_next_statuses': sorted(allowed_next_statuses(order.status))
                if _can_manage_order(request.user, order) else [],
        })


class PaymentMethodViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_customer_payment_setting(self):
        from django.db.models import Q
        from seller.models import PaymentMethodSetting

        # Prefer admin-level settings for checkout visibility.
        admin_setting = (
            PaymentMethodSetting.objects
            .filter(Q(seller__role='Admin') | Q(seller__is_superuser=True))
            .order_by('-updated_at', '-id')
            .first()
        )
        if admin_setting:
            return admin_setting

        # Fallback to latest available seller setting.
        return PaymentMethodSetting.objects.order_by('-updated_at', '-id').first()
    
    def get_queryset(self):
        user = self.request.user
        
        if is_admin_user(user):
            # Admin sees global payment methods
            return PaymentMethod.objects.filter(shop__isnull=True)
        elif user.role == 'Seller':
            # Sellers see their shop's payment methods
            shop_ids = user.shops.values_list('id', flat=True)
            return PaymentMethod.objects.filter(shop_id__in=shop_ids)
        else:
            # Customers see global payment methods (read-only)
            return PaymentMethod.objects.filter(shop__isnull=True)
    
    def list(self, request, *args, **kwargs):
        """Get payment methods configuration"""
        from seller.models import PaymentMethodSetting
        from seller.serializers import PaymentMethodSettingSerializer
        from users.models import CustomUser
        
        # Admin reads/writes its own global setting.
        if is_admin_user(request.user):
            payment_methods, created = PaymentMethodSetting.objects.get_or_create(
                seller=request.user,
                defaults={
                    'cash_on_delivery': True,
                    'bkash': True,
                    'nagad': True,
                    'credit_card': True,
                }
            )
            serializer = PaymentMethodSettingSerializer(payment_methods)
            return Response(serializer.data)

        # Customers get the global checkout setting (admin-preferred).
        if request.user.role == 'Customer':
            payment_methods = self._get_customer_payment_setting()
            if not payment_methods:
                admin_user = CustomUser.objects.filter(role='Admin').order_by('id').first()
                seller_user = CustomUser.objects.filter(role='Seller').order_by('id').first()
                owner = admin_user or seller_user
                if owner:
                    payment_methods, created = PaymentMethodSetting.objects.get_or_create(
                        seller=owner,
                        defaults={
                            'cash_on_delivery': True,
                            'bkash': True,
                            'nagad': True,
                            'credit_card': True,
                        }
                    )
                else:
                    # Return default if no sellers/admins exist yet.
                    return Response({
                        'cash_on_delivery': True,
                        'bkash': True,
                        'nagad': True,
                        'credit_card': True,
                    })

            serializer = PaymentMethodSettingSerializer(payment_methods)
            return Response(serializer.data)
        
        # For sellers, return their payment methods
        payment_methods, created = PaymentMethodSetting.objects.get_or_create(
            seller=request.user,
            defaults={
                'cash_on_delivery': True,
                'bkash': True,
                'nagad': True,
                'credit_card': True,
            }
        )
        serializer = PaymentMethodSettingSerializer(payment_methods)
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """Update payment methods configuration"""
        user = request.user
        
        # Only sellers and admins can update
        if user.role == 'Customer':
            return Response(
                {'detail': 'You do not have permission to update payment methods.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get or create payment methods
        if is_admin_user(user):
            payment_methods, created = PaymentMethod.objects.get_or_create(shop__isnull=True)
        elif user.role == 'Seller':
            # Get the first shop for this seller
            shop = user.shops.first()
            if not shop:
                return Response(
                    {'detail': 'No shop found for this seller.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            payment_methods, created = PaymentMethod.objects.get_or_create(shop=shop)
        else:
            return Response(
                {'detail': 'Invalid user role.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(payment_methods, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def toggle(self, request):
        """Toggle a specific payment method on/off"""
        from seller.models import PaymentMethodSetting
        
        user = request.user
        
        # Check if user is authenticated
        if not user.is_authenticated:
            return Response(
                {'detail': 'Authentication required.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Only sellers and admins can toggle
        user_role = getattr(user, 'role', None)
        if not (is_admin_user(user) or user_role == 'Seller'):
            return Response(
                {'detail': f'You do not have permission to update payment methods. Role: {user_role}'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get or create payment method settings for this seller/admin
        payment_methods, created = PaymentMethodSetting.objects.get_or_create(seller=user)
        
        # Update the specific field
        for key, value in request.data.items():
            if hasattr(payment_methods, key):
                setattr(payment_methods, key, value)
        
        payment_methods.save()
        
        from seller.serializers import PaymentMethodSettingSerializer
        serializer = PaymentMethodSettingSerializer(payment_methods)
        return Response(serializer.data)



class ReturnRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        from .models import ReturnRequest
        user = self.request.user
        shop_id = self.request.query_params.get('shop')
        
        if is_admin_user(user):
            queryset = ReturnRequest.objects.all().select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
        elif user.role == 'Seller':
            # Sellers see return requests for orders containing their products
            shop_ids = list(user.shops.values_list('id', flat=True))
            
            if shop_id:
                # Filter by specific shop
                queryset = ReturnRequest.objects.filter(
                    order__items__product__shop_id=shop_id
                ).distinct().select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
            elif shop_ids:
                # Show all return requests for orders with seller's products
                queryset = ReturnRequest.objects.filter(
                    order__items__product__shop_id__in=shop_ids
                ).distinct().select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
            else:
                # No shops, return empty queryset
                queryset = ReturnRequest.objects.none()
        else:
            # Customers see their own return requests
            queryset = ReturnRequest.objects.filter(
                order__customer=user
            ).select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
        
        return queryset
    
    def get_serializer_class(self):
        from .serializers import ReturnRequestSerializer, ReturnRequestCreateSerializer
        if self.action == 'create':
            return ReturnRequestCreateSerializer
        return ReturnRequestSerializer
    
    def create(self, request, *args, **kwargs):
        from .serializers import ReturnRequestSerializer
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return_request = serializer.save()
        
        # Return the created return request with full details
        output_serializer = ReturnRequestSerializer(return_request, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Review a return request (seller/admin): approve, reject or ask the
        customer for more information. Approval opens a refund case."""
        from .serializers import ReturnRequestSerializer
        from notifications.services import NotificationService

        if request.user.role not in ['Seller', 'Admin'] and not is_admin_user(request.user):
            return Response(
                {'detail': 'Only sellers and admins can update return request status.'},
                status=status.HTTP_403_FORBIDDEN
            )

        from decimal import Decimal, InvalidOperation

        return_request = self.get_object()
        new_status = request.data.get('status')
        admin_note = request.data.get('admin_note', '')
        refund_amount = request.data.get('refund_amount')
        if refund_amount is not None:
            try:
                refund_amount = Decimal(str(refund_amount))
            except InvalidOperation:
                return Response({'detail': 'Invalid refund amount.'}, status=status.HTTP_400_BAD_REQUEST)
        # Prefer the method the customer chose when filing the return
        refund_method = request.data.get('refund_method') or return_request.refund_method or 'original'

        # 'refunded' is reached automatically when the linked refund completes
        # (store-credit instantly, or COD/online once settled) — it is not a
        # status the seller sets directly.
        if new_status not in ['pending', 'info_requested', 'approved', 'rejected']:
            return Response(
                {'detail': 'Invalid status value.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        previous_status = return_request.status
        return_request.status = new_status
        if admin_note:
            return_request.admin_note = admin_note
        if refund_amount is not None:
            return_request.refund_amount = refund_amount
        return_request.save()

        refund = None
        if new_status == 'approved' and previous_status != 'approved':
            # Approving a return opens the refund case (full paid amount only).
            # How it completes depends on the method and payment type:
            #   - store_credit: completes INSTANTLY (create_refund auto-finishes).
            #   - original + COD: the SELLER settles it (txn id + optional proof).
            #   - original + online: forwarded to the ADMIN to settle.
            from .lifecycle import full_refund_amount
            order = return_request.order
            amount = full_refund_amount(order)
            if order.payment_status != 'paid':
                return Response(
                    {'detail': 'This order is not paid, so there is nothing to refund.'},
                    status=status.HTTP_400_BAD_REQUEST)
            if not return_request.refunds.exclude(status='rejected').exists():
                refund = create_refund(
                    order, amount,
                    method=refund_method if refund_method in ('original', 'store_credit') else 'original',
                    refund_type='full',
                    reason=f'Return {return_request.return_id} approved',
                    requested_by=order.customer,
                    return_request=return_request,
                    initial_status='approved',
                    origin='return',
                    note=admin_note or 'Return approved',
                )
            try:
                transition_order(order, 'returned', actor=request.user,
                                 note=f'Return {return_request.return_id} approved')
            except DRFValidationError:
                pass  # order may not be in a returnable status anymore

        if new_status == 'rejected' and previous_status != 'rejected':
            # Reject any open refund tied to this return.
            for open_refund in return_request.refunds.exclude(status__in=['completed', 'rejected']):
                try:
                    transition_refund(open_refund, 'rejected', actor=request.user,
                                      note=admin_note or 'Return rejected')
                except DRFValidationError:
                    pass

        # Notify the customer about the review outcome
        try:
            messages = {
                'info_requested': ('More information needed',
                                   f'We need more details about your return {return_request.return_id}. '
                                   + (admin_note or 'Please contact support.')),
                'approved': ('Return approved',
                             f'Your return {return_request.return_id} was approved. A refund is being processed.'),
                'rejected': ('Return rejected',
                             f'Your return {return_request.return_id} was rejected. '
                             + (admin_note or 'Contact support for details.')),
            }
            if new_status in messages and new_status != previous_status:
                title, message = messages[new_status]
                NotificationService.create_notification(
                    user=return_request.order.customer,
                    title=title, message=message,
                    notification_type='system', priority='high',
                    order_id=return_request.order.order_id,
                    action_url='/returns', action_text='View Returns',
                )
        except Exception:
            pass

        serializer = ReturnRequestSerializer(return_request, context={'request': request})
        data = serializer.data
        if refund:
            data['refund_id'] = refund.refund_id
        return Response(data)


class RefundViewSet(viewsets.ReadOnlyModelViewSet):
    """Refund cases: customers see their own, sellers see their shops',
    admins see everything. Status moves via the ``transition`` action."""
    serializer_class = RefundSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = (Refund.objects.select_related('order', 'return_request', 'settled_by')
                .prefetch_related('events'))
        if is_admin_user(user):
            qs = base
        elif getattr(user, 'role', '') == 'Seller':
            shop_ids = user.shops.values_list('id', flat=True)
            qs = base.filter(order__items__product__shop_id__in=shop_ids).distinct()
        else:
            qs = base.filter(order__customer=user)

        # Optional status filter (e.g. ?status=approved for pending queues).
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        # queue=awaiting_settlement returns the refunds this user must settle:
        # admins settle online refunds, sellers settle their COD refunds.
        queue = self.request.query_params.get('queue')
        if queue == 'awaiting_settlement':
            cod_methods = ['cod', 'cash_on_delivery']
            qs = qs.filter(status='approved').exclude(method='store_credit')
            if is_admin_user(user):
                qs = qs.exclude(order__payment_method__in=cod_methods)
            else:
                qs = qs.filter(order__payment_method__in=cod_methods)
        return qs

    def create(self, request, *args, **kwargs):
        """Create a refund.

        - Customers: opens a refund *request* for their own paid order
          (reviewed by the seller before any money moves).
        - Sellers/admins: processes a refund directly (full or partial) —
          the case is created, approved and completed in one step, moving
          store credit / marking the order refunded immediately.
        """
        from decimal import Decimal, InvalidOperation

        order_id = request.data.get('order_id')
        reason = (request.data.get('reason') or '').strip()
        method = request.data.get('method', 'original')
        if method not in ('original', 'store_credit', 'manual'):
            method = 'original'
        is_manager = is_admin_user(request.user) or getattr(request.user, 'role', '') == 'Seller'

        if not reason:
            return Response({'detail': 'Please provide a reason for the refund.'},
                            status=status.HTTP_400_BAD_REQUEST)

        from .lifecycle import full_refund_amount

        # ---------- seller / admin: process a refund now ----------
        if is_manager:
            order = Order.objects.filter(order_id=order_id).first()
            if not order or not _can_manage_order(request.user, order):
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

            # One refund per order, always the full paid amount (no partials).
            amount = full_refund_amount(order)
            requested = request.data.get('amount')
            if requested is not None:
                try:
                    if Decimal(str(requested)) != amount:
                        return Response(
                            {'detail': f'Partial refunds are not supported. The refund must be '
                                       f'the full paid amount of {amount}.'},
                            status=status.HTTP_400_BAD_REQUEST)
                except InvalidOperation:
                    return Response({'detail': 'Invalid refund amount.'}, status=status.HTTP_400_BAD_REQUEST)

            # store_credit completes instantly; original refunds are opened in
            # 'approved' and must be settled (seller for COD, admin for online).
            refund = create_refund(
                order, amount, method=method, refund_type='full',
                reason=reason, requested_by=request.user,
                initial_status='approved', origin='manual',
                note=f'Initiated by {"admin" if is_admin_user(request.user) else "seller"}',
            )
            return Response(RefundSerializer(refund, context={'request': request}).data,
                            status=status.HTTP_201_CREATED)

        # ---------- customer: open a refund request ----------
        try:
            order = Order.objects.get(order_id=order_id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.payment_status != 'paid':
            return Response({'detail': 'Refunds can only be requested for paid orders.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if order.refunds.exclude(status='rejected').exists():
            return Response({'detail': 'A refund for this order is already in progress.'},
                            status=status.HTTP_400_BAD_REQUEST)

        refund = create_refund(
            order, full_refund_amount(order),
            method=method if method in ('original', 'store_credit') else 'original',
            refund_type='full', reason=reason, requested_by=request.user,
        )
        return Response(RefundSerializer(refund).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        """Move a refund through its workflow (seller/admin only)."""
        if request.user.role not in ['Seller', 'Admin'] and not is_admin_user(request.user):
            return Response({'detail': 'Only sellers and admins can process refunds.'},
                            status=status.HTTP_403_FORBIDDEN)
        refund = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response({'detail': 'status is required.'}, status=status.HTTP_400_BAD_REQUEST)
        transition_refund(refund, new_status, actor=request.user,
                          note=request.data.get('note', ''))
        return Response(RefundSerializer(refund, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def settle(self, request, pk=None):
        """Complete an approved original-payment-method refund.

        The seller settles COD refunds; the admin settles online refunds. The
        settler records the transaction ID (required) and an optional proof.
        Store-credit refunds never reach here — they complete instantly.
        """
        from .lifecycle import settle_refund

        refund = self.get_object()
        owner = refund.settlement_owner
        is_admin = is_admin_user(request.user)
        is_seller = getattr(request.user, 'role', '') == 'Seller' and _can_manage_order(request.user, refund.order)

        if owner == 'admin' and not is_admin:
            return Response({'detail': 'Only an administrator can settle an online refund.'},
                            status=status.HTTP_403_FORBIDDEN)
        if owner == 'seller' and not (is_seller or is_admin):
            return Response({'detail': 'Only the seller can settle this COD refund.'},
                            status=status.HTTP_403_FORBIDDEN)
        if owner == 'none':
            return Response({'detail': 'Store-credit refunds complete automatically.'},
                            status=status.HTTP_400_BAD_REQUEST)

        settle_refund(
            refund, actor=request.user,
            transaction_id=(request.data.get('transaction_id') or '').strip(),
            proof=request.FILES.get('proof'),
            note=(request.data.get('note') or '').strip(),
        )
        return Response(RefundSerializer(refund, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def wallet_view(request):
    """The customer's store-credit balance and full transaction history."""
    transactions = request.user.wallet_transactions.select_related('order', 'refund')[:50]
    return Response({
        'balance': str(wallet_balance(request.user)),
        'transactions': WalletTransactionSerializer(transactions, many=True).data,
    })
