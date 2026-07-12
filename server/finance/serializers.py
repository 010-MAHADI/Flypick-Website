from rest_framework import serializers

from products.models import Category, Product
from users.models import CustomUser

from .models import (
    AdminCoupon, AdminCouponRedemption, FinanceAuditLog,
    LedgerEntry, LedgerTransaction, WithdrawalRequest,
)


class LedgerEntrySerializer(serializers.ModelSerializer):
    account_type = serializers.CharField(source='account.account_type', read_only=True)
    account_owner = serializers.CharField(source='account.user.email', read_only=True, default=None)

    class Meta:
        model = LedgerEntry
        fields = ['id', 'account_type', 'account_owner', 'debit', 'credit',
                  'balance_before', 'balance_after', 'created_at']


class AccountHistoryEntrySerializer(serializers.ModelSerializer):
    """A full audit row for one balance movement — used by the admin's
    clickable balance history (Seller Payable / Platform / Reserve / Wallet)."""
    transaction_id = serializers.UUIDField(source='transaction.transaction_id', read_only=True)
    txn_type = serializers.CharField(source='transaction.txn_type', read_only=True)
    txn_type_display = serializers.CharField(source='transaction.get_txn_type_display', read_only=True)
    account_type = serializers.CharField(source='account.account_type', read_only=True)
    account_owner = serializers.CharField(source='account.user.email', read_only=True, default=None)
    order_id = serializers.CharField(source='transaction.order.order_id', read_only=True, default=None)
    customer_email = serializers.CharField(source='transaction.customer.email', read_only=True, default=None)
    seller_email = serializers.SerializerMethodField()
    product = serializers.SerializerMethodField()
    amount = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()
    notes = serializers.CharField(source='transaction.notes', read_only=True)

    class Meta:
        model = LedgerEntry
        fields = ['id', 'transaction_id', 'txn_type', 'txn_type_display',
                  'account_type', 'account_owner', 'order_id', 'product',
                  'customer_email', 'seller_email', 'amount', 'direction',
                  'debit', 'credit', 'balance_before', 'balance_after',
                  'notes', 'created_at']

    def get_seller_email(self, obj):
        # Prefer the account owner if it is a seller account, else the txn seller.
        acc = obj.account
        if acc.account_type in ('seller_marketplace', 'seller_locked', 'seller_paid_out') and acc.user:
            return acc.user.email
        seller = obj.transaction.seller
        return seller.email if seller else None

    def get_product(self, obj):
        order = obj.transaction.order
        if not order:
            return None
        items = list(order.items.all()[:3])
        if not items:
            return None
        names = [i.product_title for i in items]
        total_items = order.items.count()
        label = ', '.join(names)
        if total_items > len(names):
            label += f' +{total_items - len(names)} more'
        return label

    def get_amount(self, obj):
        return str(obj.debit if obj.debit else obj.credit)

    def get_direction(self, obj):
        return 'debit' if obj.debit else 'credit'


class LedgerTransactionSerializer(serializers.ModelSerializer):
    entries = LedgerEntrySerializer(many=True, read_only=True)
    order_id = serializers.CharField(source='order.order_id', read_only=True, default=None)
    refund_id = serializers.CharField(source='refund.refund_id', read_only=True, default=None)
    withdrawal_id = serializers.CharField(source='withdrawal.request_id', read_only=True, default=None)
    coupon_code = serializers.CharField(source='coupon.code', read_only=True, default=None)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, default=None)

    class Meta:
        model = LedgerTransaction
        fields = ['transaction_id', 'reference', 'txn_type', 'status',
                  'order_id', 'refund_id', 'withdrawal_id', 'coupon_code',
                  'created_by_email', 'notes', 'created_at', 'entries']


class SellerLedgerEntrySerializer(serializers.ModelSerializer):
    """A seller-facing view of one ledger line on their own accounts."""
    account_type = serializers.CharField(source='account.account_type', read_only=True)
    txn_type = serializers.CharField(source='transaction.txn_type', read_only=True)
    order_id = serializers.CharField(source='transaction.order.order_id', read_only=True, default=None)
    withdrawal_id = serializers.CharField(source='transaction.withdrawal.request_id',
                                          read_only=True, default=None)
    notes = serializers.CharField(source='transaction.notes', read_only=True)

    class Meta:
        model = LedgerEntry
        fields = ['id', 'account_type', 'txn_type', 'order_id', 'withdrawal_id',
                  'debit', 'credit', 'balance_after', 'notes', 'created_at']


class WithdrawalRequestSerializer(serializers.ModelSerializer):
    seller_email = serializers.CharField(source='seller.email', read_only=True)
    seller_name = serializers.SerializerMethodField()
    shop_name = serializers.CharField(source='shop.name', read_only=True, default=None)
    payment_proof_url = serializers.SerializerMethodField()

    class Meta:
        model = WithdrawalRequest
        fields = ['id', 'request_id', 'seller_email', 'seller_name', 'shop_name',
                  'amount', 'payout_method', 'payout_details', 'seller_note',
                  'status', 'payment_transaction_id', 'payment_method',
                  'payment_proof_url', 'admin_note', 'processed_at',
                  'created_at', 'updated_at']
        read_only_fields = fields

    def get_seller_name(self, obj):
        return obj.seller.get_full_name() or obj.seller.username

    def get_payment_proof_url(self, obj):
        if not obj.payment_proof:
            return None
        request = self.context.get('request')
        url = obj.payment_proof.url
        return request.build_absolute_uri(url) if request else url


class AdminCouponSerializer(serializers.ModelSerializer):
    reserve_remaining = serializers.SerializerMethodField()
    redeemed_total = serializers.SerializerMethodField()
    category_ids = serializers.PrimaryKeyRelatedField(
        source='categories', many=True, required=False,
        queryset=Category.objects.all())
    seller_ids = serializers.PrimaryKeyRelatedField(
        source='sellers', many=True, required=False,
        queryset=CustomUser.objects.filter(role='Seller'))
    product_ids = serializers.PrimaryKeyRelatedField(
        source='products', many=True, required=False,
        queryset=Product.objects.all())

    class Meta:
        model = AdminCoupon
        fields = ['id', 'code', 'name', 'scope', 'category_ids', 'seller_ids', 'product_ids',
                  'discount_type', 'discount_value', 'max_discount_amount', 'min_order_amount',
                  'budget', 'max_uses', 'uses', 'status', 'starts_at', 'expires_at',
                  'reserve_remaining', 'redeemed_total', 'created_at', 'updated_at']
        read_only_fields = ['id', 'uses', 'status', 'created_at', 'updated_at']

    def get_reserve_remaining(self, obj):
        account = obj.reserve_accounts.first()
        return str(account.balance) if account else '0.00'

    def get_redeemed_total(self, obj):
        from django.db.models import Sum
        total = obj.redemptions.filter(status='redeemed').aggregate(t=Sum('amount'))['t']
        return str(total or '0.00')

    def validate(self, attrs):
        scope = attrs.get('scope', getattr(self.instance, 'scope', 'marketplace'))
        for field, needed in (('categories', 'category'), ('sellers', 'seller'), ('products', 'product')):
            values = attrs.get(field)
            if scope == needed and not (values or (self.instance and getattr(self.instance, field).exists())):
                raise serializers.ValidationError(
                    {f'{needed}_ids': f'Scope "{needed}" requires at least one {needed}.'})
        budget = attrs.get('budget', getattr(self.instance, 'budget', None))
        if budget is not None and budget <= 0:
            raise serializers.ValidationError({'budget': 'Budget must be positive.'})
        value = attrs.get('discount_value', getattr(self.instance, 'discount_value', None))
        dtype = attrs.get('discount_type', getattr(self.instance, 'discount_type', 'percent'))
        if value is not None and value <= 0:
            raise serializers.ValidationError({'discount_value': 'Discount must be positive.'})
        if dtype == 'percent' and value is not None and value > 100:
            raise serializers.ValidationError({'discount_value': 'Percent discount cannot exceed 100.'})
        return attrs


class AdminCouponRedemptionSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True)
    seller_email = serializers.CharField(source='seller.email', read_only=True)
    coupon_code = serializers.CharField(source='coupon.code', read_only=True)

    class Meta:
        model = AdminCouponRedemption
        fields = ['id', 'coupon_code', 'order_id', 'seller_email', 'amount', 'status', 'created_at']


class FinanceAuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True, default=None)

    class Meta:
        model = FinanceAuditLog
        fields = ['id', 'user_email', 'role', 'ip_address', 'action', 'resource',
                  'previous_state', 'new_state', 'created_at']
