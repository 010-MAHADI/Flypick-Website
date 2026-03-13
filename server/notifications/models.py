from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('order_confirmed', 'Order Confirmed'),
        ('order_shipped', 'Order Shipped'),
        ('order_delivered', 'Order Delivered'),
        ('order_cancelled', 'Order Cancelled'),
        ('payment_success', 'Payment Successful'),
        ('payment_failed', 'Payment Failed'),
        ('coupon_available', 'New Coupon Available'),
        ('product_back_in_stock', 'Product Back in Stock'),
        ('price_drop', 'Price Drop Alert'),
        ('welcome', 'Welcome Message'),
        ('system', 'System Notification'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default='system')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    
    # Optional related objects
    order_id = models.CharField(max_length=100, blank=True, null=True)
    product_id = models.IntegerField(blank=True, null=True)
    coupon_code = models.CharField(max_length=50, blank=True, null=True)
    
    # Notification state
    is_read = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    
    # Action URL (optional)
    action_url = models.URLField(blank=True, null=True)
    action_text = models.CharField(max_length=50, blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['notification_type']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.title}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def mark_as_unread(self):
        self.is_read = False
        self.read_at = None
        self.save(update_fields=['is_read', 'read_at'])


class NotificationPreference(models.Model):
    """User preferences for different types of notifications"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')
    
    # Email notifications
    email_order_updates = models.BooleanField(default=True)
    email_promotions = models.BooleanField(default=True)
    email_price_alerts = models.BooleanField(default=True)
    email_stock_alerts = models.BooleanField(default=True)
    
    # In-app notifications
    app_order_updates = models.BooleanField(default=True)
    app_promotions = models.BooleanField(default=True)
    app_price_alerts = models.BooleanField(default=True)
    app_stock_alerts = models.BooleanField(default=True)
    
    # Push notifications (for future implementation)
    push_enabled = models.BooleanField(default=False)
    push_order_updates = models.BooleanField(default=True)
    push_promotions = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Notification preferences for {self.user.username}"