from django.contrib import admin
from .models import Order, OrderItem, PaymentMethod, ReturnRequest, ReturnItem

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['product_title', 'product_image', 'color', 'size', 'quantity', 'price', 'total_price']

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_id', 'customer', 'total_amount', 'payment_method', 'status', 'created_at']
    list_filter = ['status', 'payment_method', 'payment_status', 'created_at']
    search_fields = ['order_id', 'customer__email', 'customer__username', 'shipping_full_name']
    readonly_fields = ['order_id', 'created_at', 'updated_at']
    inlines = [OrderItemInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order_id', 'customer', 'status', 'created_at', 'updated_at')
        }),
        ('Shipping Address', {
            'fields': ('shipping_full_name', 'shipping_phone', 'shipping_street', 'shipping_city', 'shipping_state', 'shipping_zip_code', 'shipping_country')
        }),
        ('Payment', {
            'fields': ('payment_method', 'payment_status')
        }),
        ('Pricing', {
            'fields': ('subtotal', 'shipping_cost', 'discount', 'coupon_code', 'total_amount')
        }),
    )

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'product_title', 'quantity', 'price', 'total_price']
    list_filter = ['order__status', 'order__created_at']
    search_fields = ['product_title', 'order__order_id']

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['shop', 'cash_on_delivery', 'bkash', 'nagad', 'credit_card', 'updated_at']
    list_filter = ['cash_on_delivery', 'bkash', 'nagad', 'credit_card']


class ReturnItemInline(admin.TabularInline):
    model = ReturnItem
    extra = 0
    readonly_fields = ['order_item', 'quantity', 'reason']

@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = ['return_id', 'order', 'status', 'refund_amount', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['return_id', 'order__order_id', 'reason']
    readonly_fields = ['return_id', 'created_at', 'updated_at']
    inlines = [ReturnItemInline]
    
    fieldsets = (
        ('Return Information', {
            'fields': ('return_id', 'order', 'status', 'created_at', 'updated_at')
        }),
        ('Details', {
            'fields': ('reason', 'description', 'refund_amount', 'admin_note')
        }),
    )

@admin.register(ReturnItem)
class ReturnItemAdmin(admin.ModelAdmin):
    list_display = ['return_request', 'order_item', 'quantity']
    search_fields = ['return_request__return_id', 'order_item__product_title']
