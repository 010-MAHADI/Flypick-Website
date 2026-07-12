from django.contrib.auth import get_user_model
from django.test import override_settings
from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase, APIRequestFactory

from orders.models import Order, OrderItem
from orders.serializers import OrderCreateSerializer
from products.models import Product, Shop
from seller.models import PaymentMethodSetting


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class PaymentMethodIntegrationTest(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="pass1234",
            role="Admin",
        )
        self.seller_user = User.objects.create_user(
            username="seller",
            email="seller@example.com",
            password="pass1234",
            role="Seller",
        )
        self.customer_user = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="pass1234",
            role="Customer",
        )

    def test_customer_checkout_payment_methods_use_admin_setting(self):
        PaymentMethodSetting.objects.create(
            seller=self.seller_user,
            cash_on_delivery=True,
            bkash=True,
            nagad=True,
            credit_card=True,
        )
        PaymentMethodSetting.objects.create(
            seller=self.admin_user,
            cash_on_delivery=False,
            bkash=True,
            nagad=True,
            credit_card=True,
        )

        self.client.force_authenticate(user=self.customer_user)
        response = self.client.get("/api/orders/payment-methods/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["cash_on_delivery"])
        self.assertTrue(response.data["bkash"])
        self.assertTrue(response.data["nagad"])
        self.assertTrue(response.data["credit_card"])

    def test_disabled_payment_method_is_rejected_by_order_serializer(self):
        PaymentMethodSetting.objects.create(
            seller=self.admin_user,
            cash_on_delivery=False,
            bkash=True,
            nagad=True,
            credit_card=True,
        )

        serializer = OrderCreateSerializer(
            data={
                "shipping_full_name": "Test User",
                "shipping_phone": "01700000000",
                "shipping_street": "Road 1",
                "shipping_city": "Dhaka",
                "shipping_state": "",
                "shipping_zip_code": "1200",
                "shipping_country": "Bangladesh",
                "payment_method": "cod",
                "items": [
                    {
                        "product_id": 1,
                        "quantity": 1,
                        "color": "",
                        "size": "",
                    }
                ],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("payment_method", serializer.errors)


@override_settings(SECURE_SSL_REDIRECT=False)
class SellerOrderIsolationTest(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="customer2",
            email="customer2@example.com",
            password="pass1234",
            role="Customer",
        )
        self.seller_one = User.objects.create_user(
            username="seller_one",
            email="seller1@example.com",
            password="pass1234",
            role="Seller",
        )
        self.seller_two = User.objects.create_user(
            username="seller_two",
            email="seller2@example.com",
            password="pass1234",
            role="Seller",
        )

        self.shop_one = Shop.objects.create(
            seller=self.seller_one,
            name="Shop One",
            category="General",
        )
        self.shop_two = Shop.objects.create(
            seller=self.seller_two,
            name="Shop Two",
            category="General",
        )

        self.product_one = Product.objects.create(
            shop=self.shop_one,
            title="Seller One Product",
            price=Decimal("100.00"),
        )
        self.product_two = Product.objects.create(
            shop=self.shop_two,
            title="Seller Two Product",
            price=Decimal("50.00"),
        )

    def test_each_seller_only_sees_own_order_items(self):
        order = Order.objects.create(
            customer=self.customer,
            order_id="FPTESTSHOP001",
            subtotal=Decimal("250.00"),
            total_amount=Decimal("250.00"),
            status="pending",
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_one,
            product_title=self.product_one.title,
            quantity=2,
            price=Decimal("100.00"),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_two,
            product_title=self.product_two.title,
            quantity=1,
            price=Decimal("50.00"),
        )

        self.client.force_authenticate(user=self.seller_one)
        response_one = self.client.get("/api/orders/orders/")
        self.assertEqual(response_one.status_code, status.HTTP_200_OK)
        data_one = response_one.data.get("results", response_one.data)
        self.assertEqual(len(data_one), 1)
        self.assertEqual(len(data_one[0]["items"]), 1)
        self.assertEqual(data_one[0]["items"][0]["product_title"], "Seller One Product")
        self.assertEqual(Decimal(data_one[0]["total_amount"]), Decimal("200.00"))

        self.client.force_authenticate(user=self.seller_two)
        response_two = self.client.get("/api/orders/orders/")
        self.assertEqual(response_two.status_code, status.HTTP_200_OK)
        data_two = response_two.data.get("results", response_two.data)
        self.assertEqual(len(data_two), 1)
        self.assertEqual(len(data_two[0]["items"]), 1)
        self.assertEqual(data_two[0]["items"][0]["product_title"], "Seller Two Product")
        self.assertEqual(Decimal(data_two[0]["total_amount"]), Decimal("50.00"))

    def test_admin_shop_scope_only_shows_items_for_selected_shop(self):
        admin_user = User.objects.create_user(
            username="admin_scope",
            email="admin_scope@example.com",
            password="pass1234",
            role="Admin",
        )
        admin_shop = Shop.objects.create(
            seller=admin_user,
            name="Admin Shop",
            category="General",
        )
        admin_product = Product.objects.create(
            shop=admin_shop,
            title="Admin Shop Product",
            price=Decimal("75.00"),
        )

        order = Order.objects.create(
            customer=self.customer,
            order_id="FPTESTSHOPADMIN001",
            subtotal=Decimal("125.00"),
            total_amount=Decimal("125.00"),
            status="pending",
        )
        OrderItem.objects.create(
            order=order,
            product=admin_product,
            product_title=admin_product.title,
            quantity=1,
            price=Decimal("75.00"),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_two,
            product_title=self.product_two.title,
            quantity=1,
            price=Decimal("50.00"),
        )

        self.client.force_authenticate(user=admin_user)
        response = self.client.get(f"/api/orders/orders/?shop={admin_shop.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get("results", response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(len(data[0]["items"]), 1)
        self.assertEqual(data[0]["items"][0]["product_title"], "Admin Shop Product")
        self.assertEqual(Decimal(data[0]["total_amount"]), Decimal("75.00"))


@override_settings(SECURE_SSL_REDIRECT=False)
class OrderCreationSignalRegressionTest(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.customer = User.objects.create_user(
            username="signal_customer",
            email="signal_customer@example.com",
            password="pass1234",
            role="Customer",
        )
        self.seller = User.objects.create_user(
            username="signal_seller",
            email="signal_seller@example.com",
            password="pass1234",
            role="Seller",
        )
        self.shop = Shop.objects.create(
            seller=self.seller,
            name="Signal Shop",
            category="General",
        )
        self.product = Product.objects.create(
            shop=self.shop,
            title="Signal Product",
            price=Decimal("99.00"),
        )

    def test_order_create_serializer_is_not_broken_by_promotion_signal(self):
        request = self.factory.post("/api/orders/orders/")
        request.user = self.customer

        serializer = OrderCreateSerializer(
            data={
                "shipping_full_name": "Signal Customer",
                "shipping_phone": "01700000000",
                "shipping_street": "Road 1",
                "shipping_city": "Dhaka",
                "shipping_state": "",
                "shipping_zip_code": "1200",
                "shipping_country": "Bangladesh",
                "payment_method": "cod",
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": 1,
                        "color": "",
                        "size": "",
                    }
                ],
            },
            context={"request": request},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        order = serializer.save()

        self.assertEqual(order.customer, self.customer)
        self.assertEqual(order.items.count(), 1)


class OrderLifecycleTests(APITestCase):
    """New OMS: transitions, audit history, cancellation, refunds, wallet."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(username='oms_admin', email='oa@t.com', password='x')
        self.seller = User.objects.create_user(username='oms_seller', email='os@t.com', password='x')
        self.seller.role = 'Seller'
        self.seller.save()
        self.customer = User.objects.create_user(username='oms_customer', email='oc@t.com', password='x')
        self.customer.role = 'Customer'
        self.customer.save()
        self.shop = Shop.objects.create(seller=self.seller, name='OMS Shop', category='Tech')
        self.product = Product.objects.create(
            shop=self.shop, title='OMS Product', price=Decimal('100'),
            originalPrice=Decimal('80'), stock=10, status='Active')

    def _place_order(self, **extra):
        self.client.force_authenticate(self.customer)
        payload = {
            'shipping_full_name': 'Test Buyer', 'shipping_phone': '017000',
            'shipping_street': 'Street 1', 'shipping_city': 'Dhaka',
            'payment_method': 'cod',
            'items': [{'product_id': self.product.id, 'quantity': 2}],
        }
        payload.update(extra)
        response = self.client.post('/api/orders/orders/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        return Order.objects.get(order_id=response.data['order_id'])

    def test_order_create_logs_history_decrements_stock_and_stores_notes(self):
        order = self._place_order(order_notes='Gift wrap please',
                                  delivery_instructions='Call before delivery')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)
        self.assertEqual(order.order_notes, 'Gift wrap please')
        self.assertEqual(order.delivery_instructions, 'Call before delivery')
        history = order.status_history.all()
        self.assertEqual(history.count(), 1)
        self.assertEqual(history[0].to_status, 'pending')

    def test_stock_validation_blocks_overselling(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/orders/orders/', {
            'shipping_full_name': 'B', 'shipping_phone': '1', 'shipping_street': 'S',
            'shipping_city': 'Dhaka', 'payment_method': 'cod',
            'items': [{'product_id': self.product.id, 'quantity': 999}],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_seller_moves_order_through_lifecycle_with_tracking(self):
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        for step in ['confirmed', 'processing', 'packed']:
            r = self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                                 {'status': step}, format='json')
            self.assertEqual(r.status_code, 200, r.content)
        r = self.client.post(f'/api/orders/orders/{order.id}/update_status/', {
            'status': 'shipped', 'tracking_number': 'TRK123',
            'courier_name': 'Pathao', 'note': 'Handed to courier',
        }, format='json')
        self.assertEqual(r.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.tracking_number, 'TRK123')
        self.assertEqual(order.status_history.count(), 5)  # pending + 4 moves

    def test_backwards_transition_rejected(self):
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                         {'status': 'shipped'}, format='json')
        r = self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                             {'status': 'pending'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_customer_cannot_update_status_and_cannot_cancel_shipped(self):
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                         {'status': 'shipped'}, format='json')
        self.client.force_authenticate(self.customer)
        r = self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                             {'status': 'delivered'}, format='json')
        self.assertEqual(r.status_code, 403)
        r = self.client.patch(f'/api/orders/orders/{order.id}/cancel/',
                              {'reason': 'Changed my mind'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cancel_restocks_and_records_reason(self):
        order = self._place_order()
        self.client.force_authenticate(self.customer)
        r = self.client.patch(f'/api/orders/orders/{order.id}/cancel/',
                              {'reason': 'Ordered by mistake'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status, 'cancelled')
        self.assertEqual(order.cancellation_reason, 'Ordered by mistake')
        self.assertEqual(self.product.stock, 10)  # restocked

    def test_cancel_paid_order_opens_refund_case(self):
        order = self._place_order()
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        self.client.force_authenticate(self.customer)
        r = self.client.patch(f'/api/orders/orders/{order.id}/cancel/',
                              {'reason': 'Too slow', 'refund_method': 'original'}, format='json')
        self.assertEqual(r.status_code, 200)
        refund = order.refunds.get()
        # Original-method cancellation refund is opened 'approved', awaiting the
        # settler (COD -> seller, online -> admin). This COD order -> seller.
        self.assertEqual(refund.status, 'approved')
        self.assertEqual(refund.origin, 'cancellation')
        self.assertEqual(refund.settlement_owner, 'seller')
        self.assertEqual(refund.amount, order.total_amount)

    def test_cancel_only_while_pending(self):
        """A processing order can no longer be cancelled by the customer."""
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                         {'status': 'processing'}, format='json')
        self.client.force_authenticate(self.customer)
        r = self.client.patch(f'/api/orders/orders/{order.id}/cancel/',
                              {'reason': 'changed mind'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cancel_store_credit_instant_refund(self):
        from finance import services as finance_services
        order = self._place_order()  # COD, subtotal 160
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        # Seller must have balance to fund a COD store-credit refund.
        finance_services.seller_deposit(self.seller, order.total_amount, actor=self.admin)
        self.client.force_authenticate(self.customer)
        r = self.client.patch(f'/api/orders/orders/{order.id}/cancel/',
                              {'reason': 'Too slow', 'refund_method': 'store_credit'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        refund = order.refunds.get()
        self.assertEqual(refund.status, 'completed')  # instant
        from .lifecycle import wallet_balance
        self.assertEqual(wallet_balance(self.customer), order.total_amount)

    def test_refund_workflow_to_store_credit_credits_wallet(self):
        from finance import services as finance_services
        from .lifecycle import create_refund, transition_refund, wallet_balance
        order = self._place_order()
        order.payment_status = 'paid'
        order.status = 'delivered'
        order.save(update_fields=['payment_status', 'status'])

        # COD order: the seller keeps the cash, so their Marketplace Balance
        # funds the refund — they must have deposited enough (limit is -100).
        finance_services.seller_deposit(self.seller, order.total_amount, actor=self.admin)

        refund = create_refund(order, order.total_amount, method='store_credit',
                               reason='Damaged item', requested_by=self.customer)
        transition_refund(refund, 'under_review', actor=self.admin)
        transition_refund(refund, 'approved', actor=self.admin)
        transition_refund(refund, 'processing', actor=self.admin)
        transition_refund(refund, 'completed', actor=self.admin)

        self.assertEqual(wallet_balance(self.customer), order.total_amount)
        self.assertEqual(refund.events.count(), 5)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'refunded')
        self.assertEqual(order.status, 'refunded')
        self.assertEqual(
            finance_services.seller_balances(self.seller)['marketplace_balance'],
            Decimal('0.00'))

    def test_illegal_refund_transition_rejected(self):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        from .lifecycle import create_refund, transition_refund
        order = self._place_order()
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        refund = create_refund(order, order.total_amount, requested_by=self.customer)
        with self.assertRaises(DRFValidationError):
            transition_refund(refund, 'completed', actor=self.admin)  # must be approved first

    def test_partial_refund_amount_rejected(self):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        from .lifecycle import create_refund
        order = self._place_order()
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        with self.assertRaises(DRFValidationError):
            create_refund(order, Decimal('10'), requested_by=self.customer)

    def test_store_credit_redeemed_at_checkout(self):
        from finance import services as finance_services
        from .lifecycle import credit_wallet, wallet_balance
        finance_services.admin_deposit(Decimal('50'), actor=self.admin)
        credit_wallet(self.customer, Decimal('50'), note='Test credit')
        # Store credit is online-payment only, so pay via bkash (not COD).
        order = self._place_order(use_store_credit=True, payment_method='bkash')
        # The order total is goods - store credit; no charge is stored on it.
        goods = order.subtotal + order.shipping_cost - order.discount
        self.assertEqual(order.store_credit_used, Decimal('50.00'))
        self.assertEqual(order.platform_charge, Decimal('0.00'))
        self.assertEqual(order.total_amount, goods - Decimal('50.00'))
        self.assertEqual(wallet_balance(self.customer), Decimal('0.00'))

    def test_store_credit_blocked_for_cod(self):
        from finance import services as finance_services
        from .lifecycle import credit_wallet
        finance_services.admin_deposit(Decimal('50'), actor=self.admin)
        credit_wallet(self.customer, Decimal('50'), note='Test credit')
        self.client.force_authenticate(self.customer)
        r = self.client.post('/api/orders/orders/', {
            'shipping_full_name': 'B', 'shipping_phone': '1', 'shipping_street': 'S',
            'shipping_city': 'Dhaka', 'payment_method': 'cod',
            'use_store_credit': True,
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(r.status_code, 400)

    def test_wallet_endpoint_returns_balance_and_history(self):
        from finance import services as finance_services
        from .lifecycle import credit_wallet
        finance_services.admin_deposit(Decimal('25'), actor=self.admin)
        credit_wallet(self.customer, Decimal('25'), note='Promo credit')
        self.client.force_authenticate(self.customer)
        r = self.client.get('/api/orders/wallet/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['balance'], '25.00')
        self.assertEqual(len(r.data['transactions']), 1)

    def test_timeline_endpoint_for_customer(self):
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                         {'status': 'confirmed', 'note': 'Seller confirmed'}, format='json')
        self.client.force_authenticate(self.customer)
        r = self.client.get(f'/api/orders/orders/{order.id}/timeline/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['status'], 'confirmed')
        self.assertEqual(len(r.data['history']), 2)
        self.assertEqual(r.data['allowed_next_statuses'], [])  # customers get none

    def test_legacy_patch_status_goes_through_lifecycle(self):
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        r = self.client.patch(f'/api/orders/orders/{order.id}/', {'status': 'confirmed'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        order.refresh_from_db()
        self.assertEqual(order.status, 'confirmed')
        self.assertEqual(order.status_history.count(), 2)

    def test_mark_paid_is_admin_only(self):
        """Sellers can no longer mark orders paid — admin only."""
        order = self._place_order()
        # Seller is now forbidden from recording payment.
        self.client.force_authenticate(self.seller)
        r = self.client.post(f'/api/orders/orders/{order.id}/mark_paid/',
                             {'payment_method': 'bkash'}, format='json')
        self.assertEqual(r.status_code, 403)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'pending')

        # Admin can record the payment.
        self.client.force_authenticate(self.admin)
        r = self.client.post(f'/api/orders/orders/{order.id}/mark_paid/',
                             {'payment_method': 'bkash', 'note': 'TrxID ABC123'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'paid')
        self.assertEqual(order.payment_method, 'bkash')
        note_entry = order.status_history.last()
        self.assertIn('Payment recorded by admin via bkash', note_entry.note)
        # double-marking is rejected
        r = self.client.post(f'/api/orders/orders/{order.id}/mark_paid/', {}, format='json')
        self.assertEqual(r.status_code, 400)
        # customers cannot mark paid
        self.client.force_authenticate(self.customer)
        order2 = self._place_order()
        r = self.client.post(f'/api/orders/orders/{order2.id}/mark_paid/', {}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_seller_cannot_patch_payment_fields(self):
        """A seller PATCHing payment fields is rejected."""
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        r = self.client.patch(f'/api/orders/orders/{order.id}/',
                              {'payment_status': 'paid'}, format='json')
        self.assertEqual(r.status_code, 403)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'pending')

    def test_note_only_update_records_history_without_transition(self):
        order = self._place_order()
        self.client.force_authenticate(self.seller)
        r = self.client.post(f'/api/orders/orders/{order.id}/update_status/',
                             {'status': 'pending', 'note': 'Waiting for stock confirmation'},
                             format='json')
        self.assertEqual(r.status_code, 200, r.content)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')
        self.assertEqual(order.status_history.count(), 2)
        self.assertEqual(order.status_history.last().note, 'Waiting for stock confirmation')

    def test_seller_processes_full_refund_directly(self):
        from finance import services as finance_services
        from .lifecycle import wallet_balance
        order = self._place_order()
        order.payment_status = 'paid'
        order.status = 'delivered'
        order.save(update_fields=['payment_status', 'status'])
        finance_services.seller_deposit(self.seller, order.total_amount, actor=self.admin)

        self.client.force_authenticate(self.seller)
        r = self.client.post('/api/orders/refunds/', {
            'order_id': order.order_id, 'reason': 'Item damaged in transit',
            'method': 'store_credit',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data['status'], 'completed')
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'refunded')
        self.assertEqual(wallet_balance(self.customer), order.total_amount)

    def test_seller_partial_refund_rejected(self):
        """Spec: one refund per order, no partial refunds."""
        order = self._place_order()
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        self.client.force_authenticate(self.seller)
        # over-refund rejected
        r = self.client.post('/api/orders/refunds/', {
            'order_id': order.order_id, 'reason': 'x', 'amount': '99999',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        # partial refund rejected
        r = self.client.post('/api/orders/refunds/', {
            'order_id': order.order_id, 'reason': 'One item missing',
            'amount': '50', 'method': 'store_credit',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'paid')

    def test_return_request_stores_customer_refund_method(self):
        from .models import ReturnRequest
        order = self._place_order()
        order.status = 'delivered'
        order.save(update_fields=['status'])
        item = order.items.first()
        self.client.force_authenticate(self.customer)
        r = self.client.post('/api/orders/returns/', {
            'order_id': order.order_id, 'reason': 'Wrong item',
            'refund_method': 'store_credit',
            'items': [{'order_item_id': item.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        rr = ReturnRequest.objects.get(order=order)
        self.assertEqual(rr.refund_method, 'store_credit')

        # Approving uses the customer's chosen method; the refund is always
        # for the full paid amount (no partial refunds).
        from finance import services as finance_services
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        finance_services.seller_deposit(self.seller, order.total_amount, actor=self.admin)
        self.client.force_authenticate(self.seller)
        r = self.client.patch(f'/api/orders/returns/{rr.id}/update_status/',
                              {'status': 'approved'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        refund = rr.refunds.get()
        self.assertEqual(refund.method, 'store_credit')
        self.assertEqual(refund.amount, order.total_amount)

    def test_return_approved_store_credit_completes_instantly(self):
        """Approving a store-credit return refunds the wallet immediately."""
        from finance import services as finance_services
        from .models import ReturnRequest
        order = self._place_order()
        order.payment_status = 'paid'
        order.status = 'delivered'
        order.save(update_fields=['payment_status', 'status'])
        finance_services.seller_deposit(self.seller, order.total_amount, actor=self.admin)
        return_request = ReturnRequest.objects.create(
            order=order, return_id='RETTEST0001', reason='Damaged',
            refund_method='store_credit', status='pending')

        self.client.force_authenticate(self.seller)
        r = self.client.patch(f'/api/orders/returns/{return_request.id}/update_status/', {
            'status': 'approved',
        }, format='json')
        self.assertEqual(r.status_code, 200, r.content)

        refund = return_request.refunds.get()
        self.assertEqual(refund.status, 'completed')
        self.assertEqual(refund.method, 'store_credit')
        return_request.refresh_from_db()
        self.assertEqual(return_request.status, 'refunded')
        from .lifecycle import wallet_balance
        self.assertEqual(wallet_balance(self.customer), order.total_amount)

    def test_return_cod_original_seller_settles(self):
        """COD return, original method: seller settles with a transaction id."""
        from .models import ReturnRequest, Refund
        order = self._place_order()  # COD
        order.payment_status = 'paid'
        order.status = 'delivered'
        order.save(update_fields=['payment_status', 'status'])
        return_request = ReturnRequest.objects.create(
            order=order, return_id='RETTEST0002', reason='Damaged',
            refund_method='original', status='pending')

        self.client.force_authenticate(self.seller)
        r = self.client.patch(f'/api/orders/returns/{return_request.id}/update_status/',
                              {'status': 'approved'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        refund = return_request.refunds.get()
        self.assertEqual(refund.status, 'approved')       # awaits seller settlement
        self.assertEqual(refund.settlement_owner, 'seller')

        # Seller settles with a transaction id -> completed.
        r = self.client.post(f'/api/orders/refunds/{refund.id}/settle/',
                             {'transaction_id': 'BKASH-TXN-1', 'note': 'refunded via bkash'},
                             format='json')
        self.assertEqual(r.status_code, 200, r.content)
        refund.refresh_from_db()
        self.assertEqual(refund.status, 'completed')
        self.assertEqual(refund.settlement_transaction_id, 'BKASH-TXN-1')
