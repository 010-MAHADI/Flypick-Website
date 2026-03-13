from django.contrib import admin
from .models import PromotionCampaign, PromotionRecipient, PromotionTemplate, PromotionAnalytics


@admin.register(PromotionCampaign)
class PromotionCampaignAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'shop', 'channel', 'status', 'audience',
        'sent_count', 'open_rate', 'click_rate', 'created_at'
    ]
    list_filter = ['channel', 'status', 'audience', 'created_at', 'shop']
    search_fields = ['title', 'message', 'shop__name']
    readonly_fields = [
        'sent_count', 'delivered_count', 'opened_count', 'clicked_count',
        'open_rate', 'click_rate', 'created_at', 'updated_at'
    ]
    filter_horizontal = ['products']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'message', 'email_subject')
        }),
        ('Campaign Settings', {
            'fields': ('channel', 'status', 'audience', 'shop', 'created_by')
        }),
        ('Products', {
            'fields': ('products',)
        }),
        ('Scheduling', {
            'fields': ('scheduled_at', 'sent_at')
        }),
        ('Metrics', {
            'fields': (
                'sent_count', 'delivered_count', 'opened_count', 'clicked_count',
                'open_rate', 'click_rate'
            ),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PromotionRecipient)
class PromotionRecipientAdmin(admin.ModelAdmin):
    list_display = [
        'campaign', 'user', 'email_sent', 'email_opened', 'email_clicked',
        'notification_sent', 'notification_clicked', 'sent_at'
    ]
    list_filter = [
        'email_sent', 'email_opened', 'email_clicked',
        'notification_sent', 'notification_clicked', 'sent_at'
    ]
    search_fields = ['campaign__title', 'user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['created_at']


@admin.register(PromotionTemplate)
class PromotionTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'channel', 'audience', 'created_by', 'created_at']
    list_filter = ['channel', 'audience', 'created_at']
    search_fields = ['name', 'title_template', 'message_template']
    readonly_fields = ['created_at']


@admin.register(PromotionAnalytics)
class PromotionAnalyticsAdmin(admin.ModelAdmin):
    list_display = [
        'campaign', 'date', 'emails_sent', 'emails_opened', 'emails_clicked',
        'notifications_sent', 'notifications_clicked', 'revenue_generated'
    ]
    list_filter = ['date', 'campaign__shop']
    search_fields = ['campaign__title']
    readonly_fields = ['created_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('campaign')