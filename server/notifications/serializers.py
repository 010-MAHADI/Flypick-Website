from rest_framework import serializers
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type', 'priority',
            'order_id', 'product_id', 'coupon_code', 'is_read', 'is_deleted',
            'action_url', 'action_text', 'metadata', 'created_at', 'read_at',
            'time_ago'
        ]
        read_only_fields = ['id', 'created_at', 'read_at', 'time_ago']

    def get_time_ago(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            minutes = int(diff.total_seconds() / 60)
            return f"{minutes}m ago"
        elif diff < timedelta(days=1):
            hours = int(diff.total_seconds() / 3600)
            return f"{hours}h ago"
        elif diff < timedelta(days=7):
            days = diff.days
            return f"{days}d ago"
        else:
            return obj.created_at.strftime("%b %d")


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'email_order_updates', 'email_promotions', 'email_price_alerts', 'email_stock_alerts',
            'app_order_updates', 'app_promotions', 'app_price_alerts', 'app_stock_alerts',
            'push_enabled', 'push_order_updates', 'push_promotions'
        ]


class NotificationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'title', 'message', 'notification_type', 'priority',
            'order_id', 'product_id', 'coupon_code',
            'action_url', 'action_text', 'metadata'
        ]