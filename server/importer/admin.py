from django.contrib import admin

from .models import ImportJob, ProductSource


@admin.register(ProductSource)
class ProductSourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'product', 'source_site', 'is_primary', 'sync_enabled',
                    'sync_status', 'last_checked_at', 'last_seen_price', 'last_seen_stock_status')
    list_filter = ('sync_status', 'sync_enabled', 'is_primary', 'source_site')
    search_fields = ('url', 'product__title')
    raw_id_fields = ('product', 'added_by')


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'source_site', 'stage', 'status', 'error_code', 'duration_ms', 'requested_by', 'created_at')
    list_filter = ('status', 'stage', 'source_site')
    search_fields = ('url', 'error_message')
    readonly_fields = [field.name for field in ImportJob._meta.fields]
