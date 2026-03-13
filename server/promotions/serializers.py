from rest_framework import serializers
from django.contrib.auth.models import User
from .models import PromotionCampaign, PromotionRecipient, PromotionTemplate, PromotionAnalytics
from products.serializers import ProductSerializer
from products.models import Shop


class PromotionCampaignSerializer(serializers.ModelSerializer):
    products = ProductSerializer(many=True, read_only=True)
    product_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    
    # Computed fields
    open_rate = serializers.ReadOnlyField()
    click_rate = serializers.ReadOnlyField()
    
    # Display fields
    shop_name = serializers.CharField(source='shop.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = PromotionCampaign
        fields = [
            'id', 'title', 'message', 'email_subject', 'channel', 'status', 
            'audience', 'products', 'product_ids', 'shop', 'shop_name',
            'created_by', 'created_by_name', 'scheduled_at', 'sent_at',
            'sent_count', 'delivered_count', 'opened_count', 'clicked_count',
            'open_rate', 'click_rate', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'shop', 'sent_at', 'sent_count', 
                           'delivered_count', 'opened_count', 'clicked_count', 
                           'created_at', 'updated_at']
    
    def create(self, validated_data):
        product_ids = validated_data.pop('product_ids', [])
        campaign = PromotionCampaign.objects.create(**validated_data)
        
        if product_ids:
            campaign.products.set(product_ids)
        
        return campaign
    
    def update(self, instance, validated_data):
        product_ids = validated_data.pop('product_ids', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if product_ids is not None:
            instance.products.set(product_ids)
        
        return instance


class PromotionCampaignListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing campaigns"""
    products = ProductSerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()
    shop_name = serializers.CharField(source='shop.name', read_only=True)
    open_rate = serializers.ReadOnlyField()
    click_rate = serializers.ReadOnlyField()
    
    class Meta:
        model = PromotionCampaign
        fields = [
            'id', 'title', 'message', 'channel', 'status', 'audience',
            'products', 'product_count', 'shop_name', 'scheduled_at', 'sent_at',
            'sent_count', 'delivered_count', 'open_rate', 'click_rate',
            'created_at', 'updated_at'
        ]
    
    def get_product_count(self, obj):
        return obj.products.count()


class PromotionRecipientSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = PromotionRecipient
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'email_sent', 'email_delivered', 'email_opened', 'email_clicked',
            'notification_sent', 'notification_delivered', 'notification_clicked',
            'sent_at', 'opened_at', 'clicked_at', 'created_at'
        ]


class PromotionTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = PromotionTemplate
        fields = [
            'id', 'name', 'title_template', 'message_template', 
            'email_subject_template', 'channel', 'audience',
            'template_variables', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class PromotionAnalyticsSerializer(serializers.ModelSerializer):
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    
    class Meta:
        model = PromotionAnalytics
        fields = [
            'id', 'campaign', 'campaign_title', 'date',
            'emails_sent', 'emails_delivered', 'emails_opened', 'emails_clicked',
            'notifications_sent', 'notifications_delivered', 'notifications_clicked',
            'revenue_generated', 'orders_generated', 'created_at'
        ]


class PromotionStatsSerializer(serializers.Serializer):
    """Serializer for promotion statistics"""
    total_campaigns = serializers.IntegerField()
    sent_campaigns = serializers.IntegerField()
    scheduled_campaigns = serializers.IntegerField()
    draft_campaigns = serializers.IntegerField()
    avg_open_rate = serializers.FloatField()
    avg_click_rate = serializers.FloatField()
    total_sent = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)


class SendPromotionSerializer(serializers.Serializer):
    """Serializer for sending promotion campaigns"""
    send_immediately = serializers.BooleanField(default=True)
    scheduled_at = serializers.DateTimeField(required=False)
    test_email = serializers.EmailField(required=False)
    
    def validate(self, data):
        if not data.get('send_immediately') and not data.get('scheduled_at'):
            raise serializers.ValidationError(
                "Either send_immediately must be True or scheduled_at must be provided"
            )
        return data