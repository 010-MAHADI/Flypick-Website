from django.db import models
from django.conf import settings
from orders.models import Order
from products.models import Product

class EmailTemplate(models.Model):
    """Email template model for storing reusable email templates"""
    TEMPLATE_TYPES = (
        ('welcome', 'Welcome Email'),
        ('order_confirmation', 'Order Confirmation'),
        ('order_status_update', 'Order Status Update'),
        ('new_order_seller', 'New Order (Seller)'),
        ('out_of_stock_alert', 'Out of Stock Alert'),
        ('low_stock_alert', 'Low Stock Alert'),
    )
    
    name = models.CharField(max_length=100)
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPES, unique=True)
    subject = models.CharField(max_length=255)
    html_content = models.TextField()
    text_content = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.template_type})"


class EmailLog(models.Model):
    """Log all sent emails for tracking and debugging"""
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('bounced', 'Bounced'),
    )
    
    recipient_email = models.EmailField()
    recipient_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='email_logs'
    )
    template_type = models.CharField(max_length=50)
    subject = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    
    # Related objects for context
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    
    sent_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-sent_at']
    
    def __str__(self):
        return f"{self.template_type} to {self.recipient_email} - {self.status}"


class EmailPreference(models.Model):
    """User email notification preferences"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='email_preferences'
    )
    
    # User notifications
    welcome_emails = models.BooleanField(default=True)
    order_confirmations = models.BooleanField(default=True)
    order_updates = models.BooleanField(default=True)
    promotional_emails = models.BooleanField(default=True)
    
    # Seller notifications
    new_order_alerts = models.BooleanField(default=True)
    stock_alerts = models.BooleanField(default=True)
    low_stock_threshold = models.IntegerField(default=5)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Email preferences for {self.user.email}"