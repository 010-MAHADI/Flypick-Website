from django.conf import settings
from django.db import models


class ProductSource(models.Model):
    """Permanent link between one of our products and its external source
    page(s). Admin-only data — it is never exposed through the public
    product API. One product can have a primary source plus alternatives;
    the primary source drives automatic stock synchronization."""

    SYNC_STATUS_CHOICES = (
        ('never', 'Never synced'),
        ('ok', 'OK'),
        ('stock_changed', 'Stock changed'),
        ('price_changed', 'Price changed'),
        ('unavailable', 'Source unavailable'),
        ('removed', 'Product removed'),
        ('error', 'Error'),
    )

    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='sources')
    url = models.URLField(max_length=2000)
    source_site = models.CharField(max_length=100, blank=True)
    is_primary = models.BooleanField(default=False)
    label = models.CharField(max_length=100, blank=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='added_product_sources')

    # sync bookkeeping
    sync_enabled = models.BooleanField(default=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='never')
    last_result = models.CharField(max_length=255, blank=True)
    last_seen_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    last_seen_stock_status = models.CharField(max_length=20, blank=True)
    consecutive_failures = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', 'id']
        constraints = [
            models.UniqueConstraint(fields=['product', 'url'], name='unique_product_source_url'),
        ]

    def __str__(self):
        prefix = 'primary' if self.is_primary else 'alt'
        return f'[{prefix}] {self.source_site or "?"} for product {self.product_id}'


class ImportJob(models.Model):
    """Audit log for every import attempt (preview and save)."""

    STATUS_CHOICES = (
        ('started', 'Started'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    )
    STAGE_CHOICES = (
        ('preview', 'Preview'),
        ('save', 'Save'),
    )

    url = models.URLField(max_length=2000)
    source_site = models.CharField(max_length=50, blank=True)
    stage = models.CharField(max_length=10, choices=STAGE_CHOICES, default='preview')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='started')
    error_code = models.CharField(max_length=50, blank=True)
    error_message = models.TextField(blank=True)
    result_summary = models.JSONField(blank=True, null=True)
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='import_jobs')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='import_jobs')
    duration_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.status}] {self.source_site or "unknown"} — {self.url[:60]}'
