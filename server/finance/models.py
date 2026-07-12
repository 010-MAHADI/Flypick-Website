"""
Marketplace financial architecture — ledger-first, double-entry.

The ledger (LedgerTransaction + LedgerEntry) is the single source of truth.
Account balances on LedgerAccount are snapshots derived from ledger entries
and are only ever written by finance.services.post() inside the same DB
transaction that creates the entries.

Never update balances directly. Never edit or delete ledger entries —
corrections are posted as reversing transactions.
"""
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


# Seller Marketplace Balance may go negative only down to this limit.
SELLER_NEGATIVE_LIMIT = Decimal('-100')


class ImmutableModelMixin:
    """Rows may be inserted but never updated or deleted."""

    _immutable_exempt_fields = ()

    def save(self, *args, **kwargs):
        if self.pk is not None:
            update_fields = kwargs.get('update_fields')
            allowed = set(self._immutable_exempt_fields)
            if not update_fields or not set(update_fields).issubset(allowed):
                raise RuntimeError(
                    f'{self.__class__.__name__} records are immutable and cannot be edited. '
                    'Post a reversing transaction instead.'
                )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError(
            f'{self.__class__.__name__} records are immutable and cannot be deleted. '
            'Post a reversing transaction instead.'
        )


class LedgerAccount(models.Model):
    """A financial account whose balance is a snapshot of its ledger entries.

    Account kinds follow standard accounting:
      - debit_normal  (asset-like):     balance += debit - credit
      - credit_normal (liability-like): balance += credit - debit
    """

    # Marketplace-level accounts (no owner)
    ESCROW = 'escrow'                    # cumulative online-payment money received
    PLATFORM_BALANCE = 'platform_balance'
    WALLET_HOLDS = 'wallet_holds'        # store credit held against unpaid orders
    OPENING_BALANCE = 'opening_balance'  # contra account for migrated balances
    COD_CLEARING = 'cod_clearing'        # contra for COD cash that flows seller<->courier off-book
    # Per-user accounts
    CUSTOMER_WALLET = 'customer_wallet'
    SELLER_MARKETPLACE = 'seller_marketplace'
    SELLER_LOCKED = 'seller_locked'
    SELLER_PAID_OUT = 'seller_paid_out'
    # Per-admin-coupon accounts
    COUPON_RESERVE = 'coupon_reserve'

    TYPE_CHOICES = (
        (ESCROW, 'Admin Escrow'),
        (PLATFORM_BALANCE, 'Platform Balance'),
        (WALLET_HOLDS, 'Wallet Holds'),
        (OPENING_BALANCE, 'Opening Balance'),
        (COD_CLEARING, 'COD Clearing'),
        (CUSTOMER_WALLET, 'Customer Wallet'),
        (SELLER_MARKETPLACE, 'Seller Marketplace Balance'),
        (SELLER_LOCKED, 'Seller Locked Balance'),
        (SELLER_PAID_OUT, 'Seller Paid Out'),
        (COUPON_RESERVE, 'Admin Coupon Reserve'),
    )

    DEBIT_NORMAL_TYPES = {ESCROW, OPENING_BALANCE, COD_CLEARING}

    account_type = models.CharField(max_length=30, choices=TYPE_CHOICES, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                             null=True, blank=True, related_name='ledger_accounts')
    coupon = models.ForeignKey('finance.AdminCoupon', on_delete=models.PROTECT,
                               null=True, blank=True, related_name='reserve_accounts')
    # Snapshot — derived from ledger entries, written only by finance.services.
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    is_frozen = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['account_type', 'user'],
                condition=models.Q(coupon__isnull=True),
                name='uniq_account_per_user_type',
            ),
            models.UniqueConstraint(
                fields=['account_type', 'coupon'],
                condition=models.Q(user__isnull=True),
                name='uniq_account_per_coupon_type',
            ),
        ]
        indexes = [models.Index(fields=['account_type', 'user'])]

    @property
    def is_debit_normal(self):
        return self.account_type in self.DEBIT_NORMAL_TYPES

    def __str__(self):
        owner = self.user_id or (f'coupon:{self.coupon_id}' if self.coupon_id else 'marketplace')
        return f'{self.account_type} [{owner}] = {self.balance}'


class LedgerTransaction(models.Model):
    """Header grouping the balanced debit/credit lines of one financial event."""

    # Transaction types (spec Part 3 §5)
    TYPE_CHOICES = (
        ('online_payment', 'Online Payment'),
        ('cod_confirmation', 'COD Confirmation'),
        ('cod_earning', 'COD Earning (delivered)'),
        ('platform_charge', 'Platform Charge'),
        ('store_credit_added', 'Store Credit Added'),
        ('wallet_credit_used', 'Wallet Credit Used'),
        ('wallet_hold', 'Wallet Hold'),
        ('wallet_hold_release', 'Wallet Hold Release'),
        ('refund', 'Refund'),
        ('withdrawal_requested', 'Withdrawal Requested'),
        ('withdrawal_approved', 'Withdrawal Approved'),
        ('withdrawal_rejected', 'Withdrawal Rejected'),
        ('settlement', 'Settlement'),
        ('coupon_reserve', 'Coupon Reserve'),
        ('coupon_release', 'Coupon Release'),
        ('coupon_redemption', 'Coupon Redemption'),
        ('manual_adjustment', 'Manual Adjustment'),
        ('admin_deposit', 'Admin Deposit'),
        ('seller_deposit', 'Seller Deposit'),
        ('migration_opening', 'Migrated Opening Balance'),
        ('reversal', 'Reversal'),
        ('snapshot_rebuild', 'Snapshot Rebuild'),
    )
    STATUS_CHOICES = (
        ('posted', 'Posted'),
        ('reversed', 'Reversed'),
    )

    transaction_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    # Idempotency key — a second post() with the same reference is a no-op.
    reference = models.CharField(max_length=120, unique=True, null=True, blank=True, db_index=True)
    txn_type = models.CharField(max_length=30, choices=TYPE_CHOICES, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='posted')

    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, null=True, blank=True,
                              related_name='ledger_transactions')
    refund = models.ForeignKey('orders.Refund', on_delete=models.PROTECT, null=True, blank=True,
                               related_name='ledger_transactions')
    withdrawal = models.ForeignKey('finance.WithdrawalRequest', on_delete=models.PROTECT,
                                   null=True, blank=True, related_name='ledger_transactions')
    coupon = models.ForeignKey('finance.AdminCoupon', on_delete=models.PROTECT,
                               null=True, blank=True, related_name='ledger_transactions')
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                 null=True, blank=True, related_name='customer_ledger_transactions')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                               null=True, blank=True, related_name='seller_ledger_transactions')

    reversal_of = models.OneToOneField('self', on_delete=models.PROTECT, null=True, blank=True,
                                       related_name='reversed_by')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   null=True, blank=True, related_name='created_ledger_transactions')
    notes = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # 'status' may flip posted -> reversed when a reversal is posted; nothing else changes.
    _immutable_exempt_fields = ('status',)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['txn_type', 'created_at']),
            models.Index(fields=['order']),
            models.Index(fields=['customer']),
            models.Index(fields=['seller']),
        ]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            update_fields = kwargs.get('update_fields')
            if not update_fields or not set(update_fields).issubset({'status'}):
                raise RuntimeError('LedgerTransaction records are immutable. '
                                   'Post a reversing transaction instead.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError('LedgerTransaction records are immutable and cannot be deleted.')

    def __str__(self):
        return f'{self.txn_type} {self.transaction_id}'


class LedgerEntry(ImmutableModelMixin, models.Model):
    """One immutable debit or credit line. Sum(debit) == Sum(credit) per transaction."""

    transaction = models.ForeignKey(LedgerTransaction, on_delete=models.PROTECT, related_name='entries')
    account = models.ForeignKey(LedgerAccount, on_delete=models.PROTECT, related_name='entries')
    debit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    balance_before = models.DecimalField(max_digits=14, decimal_places=2)
    balance_after = models.DecimalField(max_digits=14, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['id']
        indexes = [models.Index(fields=['account', 'created_at'])]
        constraints = [
            models.CheckConstraint(
                check=(models.Q(debit__gt=0, credit=0) | models.Q(credit__gt=0, debit=0)),
                name='entry_is_debit_xor_credit',
            ),
        ]
        verbose_name_plural = 'Ledger entries'

    def __str__(self):
        side = f'Dr {self.debit}' if self.debit else f'Cr {self.credit}'
        return f'{self.account} {side}'


class WithdrawalRequest(models.Model):
    """Seller withdrawal: Marketplace Balance -> Locked -> Approved (Paid Out) | Rejected."""

    STATUS_CHOICES = (
        ('requested', 'Requested'),   # amount already moved to Locked Balance
        ('approved', 'Approved'),     # manually paid by admin; Locked -> Paid Out
        ('rejected', 'Rejected'),     # Locked -> Marketplace Balance
    )

    request_id = models.CharField(max_length=50, unique=True, db_index=True)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                               related_name='withdrawal_requests')
    shop = models.ForeignKey('products.Shop', on_delete=models.SET_NULL, null=True, blank=True,
                             related_name='withdrawal_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    # Snapshot of how the seller wants to be paid (from shop payout settings)
    payout_method = models.CharField(max_length=80, blank=True, default='')
    payout_details = models.TextField(blank=True, default='')
    seller_note = models.CharField(max_length=500, blank=True, default='')

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='requested', db_index=True)

    # Settlement details entered by the admin on approval
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='processed_withdrawals')
    payment_transaction_id = models.CharField(max_length=120, blank=True, default='')
    payment_method = models.CharField(max_length=80, blank=True, default='')
    payment_proof = models.FileField(upload_to='withdrawal_proofs/', null=True, blank=True)
    admin_note = models.CharField(max_length=500, blank=True, default='')
    processed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['seller', 'status'])]

    def __str__(self):
        return f'{self.request_id} {self.seller_id} {self.amount} ({self.status})'


class AdminCoupon(models.Model):
    """Marketplace coupon funded exclusively by Platform Balance.

    Lifecycle: Draft -> Active -> Paused -> Expired (or Disabled).
    Budget is reserved from Platform Balance on activation; redemptions
    consume the reserve; the unused reserve returns on expiry/disable.
    """

    SCOPE_CHOICES = (
        ('marketplace', 'Entire Marketplace'),
        ('category', 'Selected Categories'),
        ('seller', 'Selected Sellers'),
        ('product', 'Selected Products'),
    )
    DISCOUNT_TYPE_CHOICES = (
        ('percent', 'Percent'),
        ('fixed', 'Fixed Amount'),
    )
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('expired', 'Expired'),
        ('disabled', 'Disabled'),
    )

    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=120, blank=True, default='')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='marketplace')
    categories = models.ManyToManyField('products.Category', blank=True, related_name='admin_coupons')
    sellers = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='admin_coupons')
    products = models.ManyToManyField('products.Product', blank=True, related_name='admin_coupons')

    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES, default='percent')
    discount_value = models.DecimalField(max_digits=12, decimal_places=2)
    max_discount_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    min_order_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    budget = models.DecimalField(max_digits=14, decimal_places=2)
    max_uses = models.PositiveIntegerField(default=0)  # 0 = unlimited (budget still caps)
    uses = models.PositiveIntegerField(default=0)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft', db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='created_admin_coupons')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.code} ({self.status})'


class AdminCouponRedemption(models.Model):
    """One coupon application on one order, split per participating seller."""

    STATUS_CHOICES = (
        ('pending', 'Pending'),    # order created, not yet paid
        ('redeemed', 'Redeemed'),  # order paid, reserve consumed via ledger
        ('voided', 'Voided'),      # order cancelled before payment
    )

    coupon = models.ForeignKey(AdminCoupon, on_delete=models.PROTECT, related_name='redemptions')
    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, related_name='admin_coupon_redemptions')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                               related_name='admin_coupon_redemptions')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['coupon', 'status'])]

    def __str__(self):
        return f'{self.coupon.code} on {self.order.order_id}: {self.amount} ({self.status})'


class PaymentRecord(models.Model):
    """One gateway payment attempt for an order (payments table)."""

    STATUS_CHOICES = (
        ('created', 'Created'),
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, related_name='payment_records')
    gateway = models.CharField(max_length=40, default='uddoktapay')
    invoice_id = models.CharField(max_length=120, blank=True, default='', db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='created', db_index=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.gateway} {self.invoice_id or "-"} for {self.order.order_id} ({self.status})'


class PaymentCallback(ImmutableModelMixin, models.Model):
    """Raw record of every gateway callback (IPN/redirect verify) — duplicate-safe."""

    gateway = models.CharField(max_length=40, default='uddoktapay')
    invoice_id = models.CharField(max_length=120, blank=True, default='', db_index=True)
    order_id = models.CharField(max_length=50, blank=True, default='', db_index=True)
    kind = models.CharField(max_length=20, default='ipn')  # ipn | verify | redirect
    reported_status = models.CharField(max_length=40, blank=True, default='')
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.kind} {self.invoice_id} ({self.reported_status})'


class FinanceAuditLog(ImmutableModelMixin, models.Model):
    """Append-only audit trail for every financial action."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                             null=True, blank=True, related_name='finance_audit_logs')
    role = models.CharField(max_length=20, blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    action = models.CharField(max_length=60, db_index=True)
    resource = models.CharField(max_length=120, blank=True, default='')
    transaction = models.ForeignKey(LedgerTransaction, on_delete=models.PROTECT,
                                    null=True, blank=True, related_name='audit_logs')
    previous_state = models.JSONField(default=dict, blank=True)
    new_state = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} by {self.user_id or "system"} at {self.created_at}'
