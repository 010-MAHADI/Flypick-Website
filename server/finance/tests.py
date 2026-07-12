"""
Financial invariants test suite.

Covers the production checklist items that can run without a live gateway:
online payment split, COD, wallet credit holds, refunds (store credit and
original), the -100 seller limit, withdrawal lifecycle, coupon reserve
lifecycle, idempotency / duplicate protection, and ledger replay.
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from orders.lifecycle import create_refund, transition_refund, wallet_balance
from orders.models import Order, OrderItem
from products.models import Product, Shop
from users.models import CustomUser

from . import services
from .models import (
    AdminCoupon, AdminCouponRedemption, LedgerAccount, LedgerEntry,
    LedgerTransaction, WithdrawalRequest,
)


def make_order(customer, product, *, qty=1, payment_method='uddoktapay',
               store_credit=Decimal('0'), paid=False):
    price = Decimal(str(product.originalPrice or product.price))
    subtotal = price * qty
    total = subtotal - store_credit
    order = Order.objects.create(
        customer=customer,
        order_id=f'FPTEST{Order.objects.count() + 1:06d}',
        payment_method=payment_method,
        payment_status='pending',
        subtotal=subtotal,
        shipping_cost=Decimal('0'),
        discount=Decimal('0'),
        store_credit_used=store_credit,
        total_amount=total,
    )
    OrderItem.objects.create(
        order=order, product=product, product_title=product.title,
        quantity=qty, price=price,
    )
    if paid:
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
    return order


class FinanceBaseTest(TestCase):
    def setUp(self):
        self.customer = CustomUser.objects.create_user(
            username='cust', email='cust@test.local', password='x', role='Customer')
        self.seller = CustomUser.objects.create_user(
            username='sell', email='sell@test.local', password='x', role='Seller')
        self.admin = CustomUser.objects.create_user(
            username='adm', email='adm@test.local', password='x', role='Admin')
        self.shop = Shop.objects.create(
            seller=self.seller, name='Test Shop', category='General',
            commission=Decimal('10.00'))
        self.product = Product.objects.create(
            shop=self.shop, title='Widget', price=Decimal('1200'),
            originalPrice=Decimal('1000'), stock=100)

    def assert_all_balanced(self):
        """Every transaction must have debits == credits, and every snapshot
        must equal its ledger replay."""
        for txn in LedgerTransaction.objects.all():
            sums = txn.entries.aggregate(d=Sum('debit'), c=Sum('credit'))
            self.assertEqual(sums['d'], sums['c'],
                             f'Unbalanced transaction {txn.txn_type} {txn.transaction_id}')
        for account in LedgerAccount.objects.all():
            self.assertEqual(account.balance, services.replay_balance(account),
                             f'Snapshot mismatch for {account}')


class CheckoutChargesTests(FinanceBaseTest):
    """Online orders carry a hidden 0.5% platform charge and 2% online charge;
    COD orders carry neither and stay out of the marketplace ledger."""

    def setUp(self):
        super().setUp()
        # Deterministic zero-shipping setup so charge maths is exact: no global
        # shipping methods, product carries a single free shipping option.
        from products.models import ShippingMethod
        ShippingMethod.objects.all().delete()
        self.product.variants = {'shippingOptions': [
            {'type': 'Standard', 'price': 0, 'enabled': True,
             'estimatedDelivery': '3-5 days'}]}
        self.product.save(update_fields=['variants'])

    def _place_online_order(self, use_store_credit=False):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(self.customer)
        payload = {
            'shipping_full_name': 'Buyer', 'shipping_phone': '017',
            'shipping_street': 'St', 'shipping_city': 'Dhaka',
            'payment_method': 'bkash',
            'use_store_credit': use_store_credit,
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }
        resp = client.post('/api/orders/orders/', payload, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        return Order.objects.get(order_id=resp.data['order_id'])

    def test_online_order_total_is_goods_only(self):
        order = self._place_online_order()
        # The order records the goods total only — no charge is added or stored.
        self.assertEqual(order.subtotal, Decimal('1000.00'))
        self.assertEqual(order.platform_charge, Decimal('0.00'))
        self.assertEqual(order.total_amount, Decimal('1000.00'))

    def test_gateway_amount_adds_service_charge(self):
        from orders.payment_views import gateway_charge_amount
        order = self._place_online_order()
        # The customer is charged goods + 2.5% at the gateway (1000 -> 1025),
        # but the order value stays 1000.
        self.assertEqual(gateway_charge_amount(order), Decimal('1025.00'))
        self.assertEqual(order.total_amount, Decimal('1000.00'))

    def test_charges_not_exposed_in_order_api(self):
        from rest_framework.test import APIClient
        order = self._place_online_order()
        client = APIClient()
        client.force_authenticate(self.customer)
        resp = client.get(f'/api/orders/orders/{order.id}/')
        # platform_charge must never appear in any order serializer.
        self.assertNotIn('platform_charge', resp.data)
        self.assertNotIn('online_charge', resp.data)

    def test_online_payment_service_charge_to_platform_not_seller(self):
        order = self._place_online_order()
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        # Goods 1000. Seller keeps full net 900 (10% commission) — NO deduction.
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('900.00'))
        # Platform = commission 100 + 0.5% service charge 5 = 105.
        self.assertEqual(services.platform_account().balance, Decimal('105.00'))
        # Escrow = goods 1000 + the 0.5% service charge the gateway remitted.
        self.assertEqual(services.escrow_account().balance, Decimal('1005.00'))
        # The 0.5% service charge is its own Platform Balance transaction.
        self.assertTrue(LedgerTransaction.objects.filter(
            txn_type='platform_charge', order=order).exists())
        self.assert_all_balanced()

    def test_cod_order_has_no_charges(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(self.customer)
        resp = client.post('/api/orders/orders/', {
            'shipping_full_name': 'Buyer', 'shipping_phone': '017',
            'shipping_street': 'St', 'shipping_city': 'Dhaka',
            'payment_method': 'cod',
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        order = Order.objects.get(order_id=resp.data['order_id'])
        self.assertEqual(order.platform_charge, Decimal('0.00'))
        self.assertEqual(order.total_amount, Decimal('1000.00'))


class CodDeliveryTests(FinanceBaseTest):
    def test_cod_delivered_auto_marks_paid_and_records_earning(self):
        from orders.lifecycle import transition_order
        order = make_order(self.customer, self.product, payment_method='cod')
        for step in ('confirmed', 'processing', 'packed', 'shipped',
                     'out_for_delivery', 'delivered'):
            transition_order(order, step, actor=self.seller)
        order.refresh_from_db()
        # Delivery auto-marks COD paid — no manual confirmation.
        self.assertEqual(order.payment_status, 'paid')
        balances = services.seller_balances(self.seller)
        self.assertEqual(balances['marketplace_balance'], Decimal('0.00'))
        self.assertEqual(balances['paid_out_balance'], Decimal('1000.00'))
        self.assert_all_balanced()


class FinancialInvariantsTests(FinanceBaseTest):
    """The mandatory synchronization invariants must always hold."""

    def _sum(self, account_type):
        return LedgerAccount.objects.filter(account_type=account_type).aggregate(
            t=Sum('balance'))['t'] or Decimal('0.00')

    def _assert_invariants(self):
        summary = services.admin_summary()
        # 1. Seller Payable == Σ every seller Marketplace Balance.
        self.assertEqual(Decimal(summary['seller_payable']),
                         self._sum(LedgerAccount.SELLER_MARKETPLACE))
        # 2. Customer Wallets == Σ every customer wallet balance.
        self.assertEqual(Decimal(summary['customer_wallet_total']),
                         self._sum(LedgerAccount.CUSTOMER_WALLET))
        # 3. Platform Balance == the platform_balance account only (no seller/
        #    customer/escrow money mixed in).
        self.assertEqual(Decimal(summary['platform_balance']),
                         self._sum(LedgerAccount.PLATFORM_BALANCE))
        # 5. Zero mismatch: every snapshot equals its ledger replay.
        self.assert_all_balanced()

    def test_invariants_hold_across_operations(self):
        from orders.lifecycle import create_refund, transition_refund
        # Empty state.
        self._assert_invariants()

        # Online payment: seller gets net, platform gets commission + 0.5%.
        o1 = make_order(self.customer, self.product, paid=True)  # goods 1000
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('900.00'))
        self.assertEqual(services.platform_account().balance, Decimal('105.00'))
        self._assert_invariants()

        # Manual customer credit funded by platform.
        services.admin_deposit(Decimal('200'), actor=self.admin)
        services.credit_customer_wallet(self.customer, Decimal('50'), actor=self.admin)
        self._assert_invariants()

        # Withdrawal locks part of the seller's marketplace balance: Seller
        # Payable (= Σ marketplace) drops by the locked amount, and stays exact.
        services.create_withdrawal_request(self.seller, Decimal('300'), actor=self.seller)
        summary = services.admin_summary()
        self.assertEqual(Decimal(summary['seller_payable']), Decimal('600.00'))
        self.assertEqual(Decimal(summary['seller_locked_total']), Decimal('300.00'))
        self._assert_invariants()

        # A refund moves money seller -> customer wallet; invariants still hold.
        o2 = make_order(self.customer, self.product, paid=True)
        refund = create_refund(o2, Decimal('1000'), method='store_credit',
                               initial_status='approved', requested_by=self.customer)
        refund.refresh_from_db()
        self.assertEqual(refund.status, 'completed')
        self._assert_invariants()

    def test_platform_balance_excludes_seller_and_customer_money(self):
        # After a payment + a customer credit, the platform account must not
        # contain any seller marketplace or customer wallet money.
        services.admin_deposit(Decimal('100'), actor=self.admin)
        services.credit_customer_wallet(self.customer, Decimal('40'), actor=self.admin)
        make_order(self.customer, self.product, paid=True)
        platform = services.platform_account().balance
        # Platform = commission (100) + service charge (5) + deposit remainder
        # (100 - 40 credited to customer = 60) = 165. It equals ONLY the
        # platform_balance account, never seller/customer balances.
        self.assertEqual(platform,
                         self._sum(LedgerAccount.PLATFORM_BALANCE))
        self.assertNotEqual(self._sum(LedgerAccount.SELLER_MARKETPLACE), Decimal('0'))
        self.assertEqual(Decimal(services.admin_summary()['platform_balance']),
                         platform.quantize(Decimal('0.01')))


class LedgerCoreTests(FinanceBaseTest):
    def test_post_rejects_unbalanced(self):
        with self.assertRaises(ValidationError):
            services.post('manual_adjustment', [
                (services.platform_account(), 'credit', Decimal('10')),
            ])

    def test_post_is_idempotent(self):
        deposit = [(services.escrow_account(), 'debit', Decimal('50')),
                   (services.platform_account(), 'credit', Decimal('50'))]
        t1 = services.post('admin_deposit', deposit, reference='dup-test')
        t2 = services.post('admin_deposit', deposit, reference='dup-test')
        self.assertEqual(t1.pk, t2.pk)
        self.assertEqual(services.platform_account().balance, Decimal('50.00'))
        self.assert_all_balanced()

    def test_ledger_entries_are_immutable(self):
        services.admin_deposit(Decimal('10'), actor=self.admin)
        entry = LedgerEntry.objects.first()
        entry.debit = Decimal('999')
        with self.assertRaises(RuntimeError):
            entry.save()
        with self.assertRaises(RuntimeError):
            entry.delete()

    def test_reversal_restores_balances(self):
        txn = services.admin_deposit(Decimal('75'), actor=self.admin)
        services.reverse_transaction(txn, actor=self.admin)
        self.assertEqual(services.platform_account().balance, Decimal('0.00'))
        self.assert_all_balanced()


class PaymentTests(FinanceBaseTest):
    def test_online_payment_splits_commission(self):
        order = make_order(self.customer, self.product, paid=True)
        # 1000 goods, 10% commission -> seller 900. Platform = commission 100 +
        # 0.5% service charge 5 = 105. Escrow = goods 1000 + service 5 = 1005.
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('900.00'))
        self.assertEqual(services.platform_account().balance, Decimal('105.00'))
        self.assertEqual(services.escrow_account().balance, Decimal('1005.00'))
        self.assert_all_balanced()

    def test_duplicate_payment_confirmation_posts_once(self):
        order = make_order(self.customer, self.product, paid=True)
        order.save()  # duplicate IPN / verify path saves again
        services.post_order_payment(order)
        self.assertEqual(
            LedgerTransaction.objects.filter(reference=f'order-paid-{order.order_id}').count(), 1)
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('900.00'))
        self.assert_all_balanced()

    def test_cod_records_paid_out_not_marketplace(self):
        """COD stays out of the marketplace financial system: the seller's
        earnings are recorded to Paid Out (lifetime) only — no marketplace
        balance, no payable, no escrow, no platform balance."""
        order = make_order(self.customer, self.product, payment_method='cod', paid=True)
        balances = services.seller_balances(self.seller)
        self.assertEqual(balances['marketplace_balance'], Decimal('0.00'))
        self.assertEqual(balances['locked_balance'], Decimal('0.00'))
        # Full order value recorded as lifetime earnings (no commission on COD).
        self.assertEqual(balances['paid_out_balance'], Decimal('1000.00'))
        self.assertEqual(services.escrow_account().balance, Decimal('0.00'))
        self.assertEqual(services.platform_account().balance, Decimal('0.00'))
        txn = LedgerTransaction.objects.get(reference=f'order-paid-{order.order_id}')
        self.assertEqual(txn.txn_type, 'cod_earning')
        self.assert_all_balanced()

    def test_wallet_hold_and_capture(self):
        # Manual customer credits are funded by the Platform Balance.
        services.admin_deposit(Decimal('300'), actor=self.admin)
        services.credit_customer_wallet(self.customer, Decimal('300'), actor=self.admin,
                                        note='Seed credit')
        self.assertEqual(services.platform_account().balance, Decimal('0.00'))
        order = make_order(self.customer, self.product, store_credit=Decimal('300'))
        services.hold_wallet_credit(order, Decimal('300'), actor=self.customer)
        self.assertEqual(wallet_balance(self.customer), Decimal('0.00'))
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])
        # gateway 700 + wallet 300 = 1000 goods -> seller 900 (no deduction).
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('900.00'))
        # escrow: 300 deposit + 700 gateway goods + 0.5% of 700 service (3.50).
        self.assertEqual(services.escrow_account().balance, Decimal('1003.50'))
        self.assert_all_balanced()

    def test_wallet_hold_released_on_cancel(self):
        services.admin_deposit(Decimal('200'), actor=self.admin)
        services.credit_customer_wallet(self.customer, Decimal('200'), actor=self.admin)
        order = make_order(self.customer, self.product, store_credit=Decimal('200'))
        services.hold_wallet_credit(order, Decimal('200'), actor=self.customer)
        self.assertEqual(wallet_balance(self.customer), Decimal('0.00'))
        order.status = 'cancelled'
        order.save(update_fields=['status'])
        self.assertEqual(wallet_balance(self.customer), Decimal('200.00'))
        self.assert_all_balanced()


class RefundTests(FinanceBaseTest):
    def test_store_credit_refund_moves_seller_to_customer(self):
        order = make_order(self.customer, self.product, paid=True)
        # Store-credit refunds complete instantly on approval (no settle step).
        refund = create_refund(order, Decimal('1000'), method='store_credit',
                               initial_status='approved', requested_by=self.customer)
        refund.refresh_from_db()
        self.assertEqual(refund.status, 'completed')
        # Seller returns 900, platform returns its 100 commission; the platform
        # keeps the non-refundable 0.5% service charge (5).
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('0.00'))
        self.assertEqual(services.platform_account().balance, Decimal('5.00'))
        self.assertEqual(wallet_balance(self.customer), Decimal('1000.00'))
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'refunded')
        self.assert_all_balanced()

    def test_one_refund_per_order(self):
        order = make_order(self.customer, self.product, paid=True)
        create_refund(order, Decimal('1000'), method='store_credit',
                      initial_status='approved', requested_by=self.customer)
        with self.assertRaises(ValidationError):
            create_refund(order, Decimal('1000'), method='store_credit',
                          requested_by=self.customer)

    def test_partial_refund_rejected(self):
        order = make_order(self.customer, self.product, paid=True)
        with self.assertRaises(ValidationError):
            create_refund(order, Decimal('500'), requested_by=self.customer)

    def test_cod_store_credit_refund_hits_negative_limit(self):
        # COD order: marketplace never held the cash, so the seller balance
        # funds the refund and may only go to -100.
        order = make_order(self.customer, self.product, payment_method='cod', paid=True)
        with self.assertRaises(ValidationError):
            create_refund(order, Decimal('1000'), method='store_credit',
                          initial_status='approved', requested_by=self.customer)
        # After a seller deposit, it works (and completes instantly).
        services.seller_deposit(self.seller, Decimal('900'), actor=self.admin)
        refund = create_refund(order, Decimal('1000'), method='store_credit',
                               initial_status='approved', requested_by=self.customer)
        refund.refresh_from_db()
        self.assertEqual(refund.status, 'completed')
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('-100.00'))
        self.assertEqual(wallet_balance(self.customer), Decimal('1000.00'))
        self.assert_all_balanced()

    def test_cod_original_refund_has_no_ledger(self):
        order = make_order(self.customer, self.product, payment_method='cod', paid=True)
        refund = create_refund(order, Decimal('1000'), method='original',
                               initial_status='approved', requested_by=self.customer)
        transition_refund(refund, 'completed', actor=self.admin)
        self.assertFalse(LedgerTransaction.objects.filter(refund=refund).exists())

    def test_original_refund_returns_money_via_escrow(self):
        order = make_order(self.customer, self.product, paid=True)
        refund = create_refund(order, Decimal('1000'), method='original',
                               initial_status='approved', requested_by=self.customer)
        transition_refund(refund, 'completed', actor=self.admin)
        # Goods 1000 refunded to the customer via escrow; the non-refundable
        # 0.5% service charge (5) stays with the platform (residual in escrow).
        self.assertEqual(services.escrow_account().balance, Decimal('5.00'))
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('0.00'))
        self.assertEqual(services.platform_account().balance, Decimal('5.00'))
        self.assert_all_balanced()


class WithdrawalTests(FinanceBaseTest):
    def _fund_seller(self, amount=Decimal('900')):
        make_order(self.customer, self.product, paid=True)  # seller +900

    def test_request_locks_balance(self):
        self._fund_seller()
        wd = services.create_withdrawal_request(self.seller, Decimal('500'), actor=self.seller)
        balances = services.seller_balances(self.seller)
        self.assertEqual(balances['marketplace_balance'], Decimal('400.00'))
        self.assertEqual(balances['locked_balance'], Decimal('500.00'))
        self.assert_all_balanced()

    def test_cannot_withdraw_more_than_balance(self):
        self._fund_seller()
        with self.assertRaises(ValidationError):
            services.create_withdrawal_request(self.seller, Decimal('901'), actor=self.seller)

    def test_approve_moves_to_paid_out(self):
        self._fund_seller()
        wd = services.create_withdrawal_request(self.seller, Decimal('500'), actor=self.seller)
        services.approve_withdrawal(wd, actor=self.admin,
                                    payment_transaction_id='BANKTX1',
                                    payment_method='bank')
        balances = services.seller_balances(self.seller)
        self.assertEqual(balances['locked_balance'], Decimal('0.00'))
        self.assertEqual(balances['paid_out_balance'], Decimal('500.00'))
        wd.refresh_from_db()
        self.assertEqual(wd.status, 'approved')
        # double approval is rejected
        with self.assertRaises(ValidationError):
            services.approve_withdrawal(wd, actor=self.admin,
                                        payment_transaction_id='BANKTX2',
                                        payment_method='bank')
        self.assert_all_balanced()

    def test_reject_returns_funds(self):
        self._fund_seller()
        wd = services.create_withdrawal_request(self.seller, Decimal('500'), actor=self.seller)
        services.reject_withdrawal(wd, actor=self.admin, admin_note='wrong account')
        balances = services.seller_balances(self.seller)
        self.assertEqual(balances['marketplace_balance'], Decimal('900.00'))
        self.assertEqual(balances['locked_balance'], Decimal('0.00'))
        self.assert_all_balanced()

    def test_locked_balance_cannot_fund_refund(self):
        self._fund_seller()
        services.create_withdrawal_request(self.seller, Decimal('900'), actor=self.seller)
        order = Order.objects.first()
        # Seller balance is now 0 (all locked); refunding 1000 would need -1000.
        with self.assertRaises(ValidationError):
            create_refund(order, Decimal('1000'), method='store_credit',
                          initial_status='approved', requested_by=self.customer)


class AdminCouponTests(FinanceBaseTest):
    def _make_coupon(self, budget=Decimal('500')):
        return AdminCoupon.objects.create(
            code='SAVE100', scope='marketplace',
            discount_type='fixed', discount_value=Decimal('100'),
            budget=budget, expires_at=timezone.now() + timedelta(days=7),
            created_by=self.admin)

    def test_activation_requires_platform_funds(self):
        coupon = self._make_coupon()
        with self.assertRaises(ValidationError):
            services.activate_admin_coupon(coupon, actor=self.admin)
        services.admin_deposit(Decimal('500'), actor=self.admin)
        services.activate_admin_coupon(coupon, actor=self.admin)
        self.assertEqual(services.platform_account().balance, Decimal('0.00'))
        reserve = LedgerAccount.objects.get(account_type='coupon_reserve', coupon=coupon)
        self.assertEqual(reserve.balance, Decimal('500.00'))
        self.assert_all_balanced()

    def test_redemption_compensates_seller_from_reserve(self):
        services.admin_deposit(Decimal('500'), actor=self.admin)
        coupon = self._make_coupon()
        services.activate_admin_coupon(coupon, actor=self.admin)

        order = make_order(self.customer, self.product)
        order.admin_coupon_discount = Decimal('100')
        order.discount = Decimal('100')
        order.total_amount = Decimal('900')
        order.save(update_fields=['admin_coupon_discount', 'discount', 'total_amount'])
        AdminCouponRedemption.objects.create(
            coupon=coupon, order=order, seller=self.seller,
            amount=Decimal('100'), status='pending')
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status'])

        # Seller receives full 1000 minus 100 commission; reserve paid 100.
        self.assertEqual(services.seller_balances(self.seller)['marketplace_balance'],
                         Decimal('900.00'))
        reserve = LedgerAccount.objects.get(account_type='coupon_reserve', coupon=coupon)
        self.assertEqual(reserve.balance, Decimal('400.00'))
        # escrow: 500 deposit + 900 gateway goods + 0.5% of 900 service (4.50).
        self.assertEqual(services.escrow_account().balance, Decimal('1404.50'))
        red = AdminCouponRedemption.objects.get(order=order)
        self.assertEqual(red.status, 'redeemed')
        self.assert_all_balanced()

    def test_expiry_returns_unused_reserve(self):
        services.admin_deposit(Decimal('500'), actor=self.admin)
        coupon = self._make_coupon()
        services.activate_admin_coupon(coupon, actor=self.admin)
        services.close_admin_coupon(coupon, actor=self.admin, new_status='expired')
        self.assertEqual(services.platform_account().balance, Decimal('500.00'))
        coupon.refresh_from_db()
        self.assertEqual(coupon.status, 'expired')
        self.assert_all_balanced()

    def test_paused_keeps_reserve(self):
        services.admin_deposit(Decimal('500'), actor=self.admin)
        coupon = self._make_coupon()
        services.activate_admin_coupon(coupon, actor=self.admin)
        services.pause_admin_coupon(coupon, actor=self.admin)
        self.assertEqual(services.platform_account().balance, Decimal('0.00'))
        # reactivating does not double-reserve
        services.activate_admin_coupon(coupon, actor=self.admin)
        reserve = LedgerAccount.objects.get(account_type='coupon_reserve', coupon=coupon)
        self.assertEqual(reserve.balance, Decimal('500.00'))
        self.assert_all_balanced()


class SnapshotTests(FinanceBaseTest):
    def test_rebuild_fixes_tampered_snapshot(self):
        services.admin_deposit(Decimal('100'), actor=self.admin)
        account = services.platform_account()
        LedgerAccount.objects.filter(pk=account.pk).update(balance=Decimal('999'))
        account.refresh_from_db()
        self.assertFalse(services.verify_snapshot(account))
        services.rebuild_snapshot(account, actor=self.admin)
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('100.00'))
