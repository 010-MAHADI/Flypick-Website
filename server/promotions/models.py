from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from products.models import Product, Shop


class PromotionCampaign(models.Model):
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('notification', 'Notification'),
        ('both', 'Email & Notification'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    AUDIENCE_CHOICES = [
        ('all', 'All Customers'),
        ('returning', 'Returning Customers'),
        ('new', 'New Customers'),
        ('inactive', 'Inactive Customers'),
        ('high_value', 'High Value Customers'),
    ]

    # Basic Information
    title = models.CharField(max_length=200)
    message = models.TextField()
    email_subject = models.CharField(max_length=200, blank=True, null=True)
    
    # Campaign Settings
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='email')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='all')
    
    # Relationships
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='promotions')
    products = models.ManyToManyField(Product, related_name='promotions')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_promotions')
    
    # Scheduling
    scheduled_at = models.DateTimeField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    
    # Metrics
    sent_count = models.IntegerField(default=0)
    delivered_count = models.IntegerField(default=0)
    opened_count = models.IntegerField(default=0)
    clicked_count = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} - {self.shop.name}"
    
    @property
    def open_rate(self):
        if self.delivered_count > 0:
            return round((self.opened_count / self.delivered_count) * 100, 1)
        return 0.0
    
    @property
    def click_rate(self):
        if self.delivered_count > 0:
            return round((self.clicked_count / self.delivered_count) * 100, 1)
        return 0.0


class PromotionRecipient(models.Model):
    """Track individual recipients of promotion campaigns"""
    campaign = models.ForeignKey(PromotionCampaign, on_delete=models.CASCADE, related_name='recipients')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    # Email tracking
    email_sent = models.BooleanField(default=False)
    email_delivered = models.BooleanField(default=False)
    email_opened = models.BooleanField(default=False)
    email_clicked = models.BooleanField(default=False)
    
    # Notification tracking
    notification_sent = models.BooleanField(default=False)
    notification_delivered = models.BooleanField(default=False)
    notification_clicked = models.BooleanField(default=False)
    
    # Timestamps
    sent_at = models.DateTimeField(blank=True, null=True)
    opened_at = models.DateTimeField(blank=True, null=True)
    clicked_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['campaign', 'user']
        
    def __str__(self):
        return f"{self.campaign.title} -> {self.user.email}"


class PromotionTemplate(models.Model):
    """Reusable promotion templates"""
    name = models.CharField(max_length=200)
    title_template = models.CharField(max_length=200)
    message_template = models.TextField()
    email_subject_template = models.CharField(max_length=200, blank=True, null=True)
    
    channel = models.CharField(max_length=20, choices=PromotionCampaign.CHANNEL_CHOICES)
    audience = models.CharField(max_length=20, choices=PromotionCampaign.AUDIENCE_CHOICES)
    
    # Template variables (JSON field for dynamic content)
    template_variables = models.JSONField(default=dict, blank=True)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name


class PromotionAnalytics(models.Model):
    """Daily analytics for promotion campaigns"""
    campaign = models.ForeignKey(PromotionCampaign, on_delete=models.CASCADE, related_name='analytics')
    date = models.DateField()
    
    # Daily metrics
    emails_sent = models.IntegerField(default=0)
    emails_delivered = models.IntegerField(default=0)
    emails_opened = models.IntegerField(default=0)
    emails_clicked = models.IntegerField(default=0)
    
    notifications_sent = models.IntegerField(default=0)
    notifications_delivered = models.IntegerField(default=0)
    notifications_clicked = models.IntegerField(default=0)
    
    # Revenue tracking
    revenue_generated = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    orders_generated = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['campaign', 'date']
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.campaign.title} - {self.date}"