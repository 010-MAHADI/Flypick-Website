from django.db import models
from django.conf import settings
from products.models import Product, Shop

class PaymentMethod(models.Model):
    """Global payment method configuration"""
    shop = models.OneToOneField(Shop, on_delete=models.CASCADE, related_name='payment_methods', null=True, blank=True)
    # If shop is null, these are global/default settings
    
    cash_on_delivery = models.BooleanField(default=True)
    bkash = models.BooleanField(default=True)
    nagad = models.BooleanField(default=True)
    credit_card = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Payment Method Configuration'
        verbose_name_plural = 'Payment Method Configurations'
    
    def __str__(self):
        if self.shop:
            return f"Payment Methods for {self.shop.name}"
        return "Global Payment Methods"


class Order(models.Model):
    # Full fulfilment lifecycle. Old orders keep their existing values —
    # every previous status is still a valid choice.
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('processing', 'Processing'),
        ('packed', 'Packed'),
        ('shipped', 'Shipped'),
        ('out_for_delivery', 'Out for Delivery'),
        ('delivered', 'Delivered'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
        ('returned', 'Returned'),
        ('refunded', 'Refunded'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    order_id = models.CharField(max_length=50, unique=True, db_index=True)
    
    # Address information
    shipping_full_name = models.CharField(max_length=200, blank=True, null=True)
    shipping_phone = models.CharField(max_length=20, blank=True, null=True)
    shipping_street = models.TextField(blank=True, null=True)
    shipping_city = models.CharField(max_length=100, blank=True, null=True)
    shipping_state = models.CharField(max_length=100, blank=True, null=True)
    shipping_zip_code = models.CharField(max_length=20, blank=True, null=True)
    shipping_country = models.CharField(max_length=100, default='Bangladesh')
    
    # Payment information
    payment_method = models.CharField(max_length=50, default='cod')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    
    # Pricing
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    coupon_code = models.CharField(max_length=50, blank=True, null=True)
    store_credit_used = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Customer messages captured at checkout
    order_notes = models.TextField(blank=True, null=True)
    delivery_instructions = models.TextField(blank=True, null=True)

    # Shipment tracking (maintained by seller/admin)
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    courier_name = models.CharField(max_length=100, blank=True, null=True)
    estimated_delivery_date = models.DateField(blank=True, null=True)

    # Cancellation audit
    cancellation_reason = models.CharField(max_length=255, blank=True, null=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='cancelled_orders')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Store original status for change detection
        self._original_status = self.status
    
    def save(self, *args, **kwargs):
        # Update original status after save
        super().save(*args, **kwargs)
        self._original_status = self.status
    
    def __str__(self):
        return f"Order {self.order_id} by {self.customer.username}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, related_name='order_items')
    
    # Product snapshot (in case product is deleted/changed)
    product_title = models.CharField(max_length=500)
    product_image = models.TextField(blank=True, null=True)
    
    # Variant information
    color = models.CharField(max_length=50, blank=True, null=True)
    size = models.CharField(max_length=50, blank=True, null=True)
    shipping_type = models.CharField(max_length=100, blank=True, null=True)
    
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    def __str__(self):
        return f"{self.quantity} x {self.product_title}"
    
    @property
    def total_price(self):
        return self.price * self.quantity


class OrderStatusHistory(models.Model):
    """Audit log — one row for every status change an order goes through."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    note = models.CharField(max_length=500, blank=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='order_status_changes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['order', 'created_at'])]
        verbose_name_plural = 'Order status histories'

    def __str__(self):
        return f'{self.order.order_id}: {self.from_status or "—"} → {self.to_status}'


class ReturnRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('info_requested', 'More Info Requested'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('refunded', 'Refunded'),
    )

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='return_requests')
    return_id = models.CharField(max_length=50, unique=True, db_index=True)

    reason = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    # Media evidence uploaded by the customer (paths under MEDIA_ROOT)
    images = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    admin_note = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Return {self.return_id} for Order {self.order.order_id}"


class ReturnItem(models.Model):
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, related_name='items')
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE)

    quantity = models.PositiveIntegerField(default=1)
    reason = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return f"{self.quantity} x {self.order_item.product_title}"


class Refund(models.Model):
    """A refund case with a reviewed workflow and full audit history."""

    STATUS_CHOICES = (
        ('requested', 'Requested'),
        ('under_review', 'Under Review'),
        ('approved', 'Approved'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    )
    TYPE_CHOICES = (
        ('full', 'Full Refund'),
        ('partial', 'Partial Refund'),
    )
    METHOD_CHOICES = (
        ('original', 'Original Payment Method'),
        ('store_credit', 'Store Credit'),
        ('manual', 'Manual / Offline'),
    )

    refund_id = models.CharField(max_length=50, unique=True, db_index=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='refunds')
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='refunds')

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    refund_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='full')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='original')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    reason = models.CharField(max_length=255, blank=True)

    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='requested_refunds')
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='processed_refunds')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['order', 'status'])]

    def __str__(self):
        return f'Refund {self.refund_id} ({self.status}) for {self.order.order_id}'


class RefundEvent(models.Model):
    """Audit log — every refund status change is recorded here."""
    refund = models.ForeignKey(Refund, on_delete=models.CASCADE, related_name='events')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    note = models.CharField(max_length=500, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                              null=True, blank=True, related_name='refund_events')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.refund.refund_id}: {self.from_status or "—"} → {self.to_status}'


class WalletTransaction(models.Model):
    """Store-credit ledger. A user's balance is the sum of signed amounts;
    every credit/debit keeps a snapshot in ``balance_after`` for auditing."""

    SOURCE_CHOICES = (
        ('refund', 'Refund'),
        ('order', 'Order Payment'),
        ('adjustment', 'Manual Adjustment'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='wallet_transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # positive = credit, negative = debit
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='adjustment')
    note = models.CharField(max_length=255, blank=True)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name='wallet_transactions')
    refund = models.ForeignKey(Refund, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='wallet_transactions')
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'created_at'])]

    def __str__(self):
        sign = '+' if self.amount >= 0 else ''
        return f'{self.user.username}: {sign}{self.amount} ({self.source})'
