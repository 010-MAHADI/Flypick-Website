from django.contrib import admin
from .models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'notification_type', 'priority', 'is_read', 'created_at']
    list_filter = ['notification_type', 'priority', 'is_read', 'created_at']
    search_fields = ['title', 'message', 'user__username', 'user__email']
    readonly_fields = ['created_at', 'read_at']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'title', 'message', 'notification_type', 'priority')
        }),
        ('Related Objects', {
            'fields': ('order_id', 'product_id', 'coupon_code'),
            'classes': ('collapse',)
        }),
        ('Action', {
            'fields': ('action_url', 'action_text'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('is_read', 'is_deleted', 'created_at', 'read_at')
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
    )


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'email_order_updates', 'app_order_updates', 'push_enabled']
    list_filter = ['email_order_updates', 'app_order_updates', 'push_enabled']
    search_fields = ['user__username', 'user__email']