from rest_framework import serializers
from .models import EmailPreference, EmailLog, EmailTemplate

class EmailPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailPreference
        fields = [
            'welcome_emails',
            'order_confirmations', 
            'order_updates',
            'promotional_emails',
            'new_order_alerts',
            'stock_alerts',
            'low_stock_threshold'
        ]

class EmailLogSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True)
    product_name = serializers.CharField(source='product.title', read_only=True)
    
    class Meta:
        model = EmailLog
        fields = [
            'id',
            'recipient_email',
            'template_type',
            'subject',
            'status',
            'error_message',
            'order_id',
            'product_name',
            'sent_at'
        ]

class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            'id',
            'name',
            'template_type',
            'subject',
            'html_content',
            'text_content',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']