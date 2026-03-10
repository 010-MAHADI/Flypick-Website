from django.contrib import admin
from .models import EmailTemplate, EmailLog, EmailPreference

@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'template_type', 'subject', 'is_active', 'created_at']
    list_filter = ['template_type', 'is_active', 'created_at']
    search_fields = ['name', 'subject', 'template_type']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'template_type', 'subject', 'is_active')
        }),
        ('Content', {
            'fields': ('html_content', 'text_content')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['recipient_email', 'template_type', 'subject', 'status', 'sent_at']
    list_filter = ['status', 'template_type', 'sent_at']
    search_fields = ['recipient_email', 'subject', 'template_type']
    readonly_fields = ['sent_at']
    
    fieldsets = (
        ('Email Details', {
            'fields': ('recipient_email', 'recipient_user', 'template_type', 'subject', 'status')
        }),
        ('Related Objects', {
            'fields': ('order', 'product'),
            'classes': ('collapse',)
        }),
        ('Error Information', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('sent_at',)
        }),
    )
    
    def has_add_permission(self, request):
        return False  # Prevent manual creation of email logs

@admin.register(EmailPreference)
class EmailPreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'welcome_emails', 'order_confirmations', 'order_updates', 'new_order_alerts', 'stock_alerts']
    list_filter = ['welcome_emails', 'order_confirmations', 'order_updates', 'new_order_alerts', 'stock_alerts']
    search_fields = ['user__email', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Customer Notifications', {
            'fields': ('welcome_emails', 'order_confirmations', 'order_updates', 'promotional_emails')
        }),
        ('Seller Notifications', {
            'fields': ('new_order_alerts', 'stock_alerts', 'low_stock_threshold')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )