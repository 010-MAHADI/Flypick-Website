from django.contrib import admin

from .models import (
    AdminCoupon, AdminCouponRedemption, FinanceAuditLog,
    LedgerAccount, LedgerEntry, LedgerTransaction,
    PaymentCallback, PaymentRecord, WithdrawalRequest,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    """Financial history is immutable — view only in Django admin."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LedgerAccount)
class LedgerAccountAdmin(ReadOnlyAdmin):
    list_display = ('id', 'account_type', 'user', 'coupon', 'balance', 'is_frozen', 'updated_at')
    list_filter = ('account_type', 'is_frozen')
    search_fields = ('user__email',)


class LedgerEntryInline(admin.TabularInline):
    model = LedgerEntry
    extra = 0
    can_delete = False
    readonly_fields = ('account', 'debit', 'credit', 'balance_before', 'balance_after', 'created_at')


@admin.register(LedgerTransaction)
class LedgerTransactionAdmin(ReadOnlyAdmin):
    list_display = ('transaction_id', 'txn_type', 'status', 'order', 'customer', 'seller', 'created_at')
    list_filter = ('txn_type', 'status')
    search_fields = ('transaction_id', 'reference', 'order__order_id')
    inlines = [LedgerEntryInline]


@admin.register(LedgerEntry)
class LedgerEntryAdmin(ReadOnlyAdmin):
    list_display = ('id', 'transaction', 'account', 'debit', 'credit', 'balance_after', 'created_at')


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(ReadOnlyAdmin):
    list_display = ('request_id', 'seller', 'amount', 'status', 'created_at', 'processed_at')
    list_filter = ('status',)
    search_fields = ('request_id', 'seller__email')


@admin.register(AdminCoupon)
class AdminCouponAdmin(ReadOnlyAdmin):
    list_display = ('code', 'scope', 'discount_type', 'discount_value', 'budget', 'status', 'expires_at')
    list_filter = ('status', 'scope')
    search_fields = ('code',)


@admin.register(AdminCouponRedemption)
class AdminCouponRedemptionAdmin(ReadOnlyAdmin):
    list_display = ('coupon', 'order', 'seller', 'amount', 'status', 'created_at')
    list_filter = ('status',)


@admin.register(PaymentRecord)
class PaymentRecordAdmin(ReadOnlyAdmin):
    list_display = ('order', 'gateway', 'invoice_id', 'amount', 'status', 'created_at')
    list_filter = ('status', 'gateway')
    search_fields = ('invoice_id', 'order__order_id')


@admin.register(PaymentCallback)
class PaymentCallbackAdmin(ReadOnlyAdmin):
    list_display = ('gateway', 'kind', 'invoice_id', 'order_id', 'reported_status', 'created_at')
    search_fields = ('invoice_id', 'order_id')


@admin.register(FinanceAuditLog)
class FinanceAuditLogAdmin(ReadOnlyAdmin):
    list_display = ('action', 'user', 'role', 'resource', 'created_at')
    list_filter = ('action',)
    search_fields = ('resource',)
