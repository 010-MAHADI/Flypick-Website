from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count, Avg, Sum
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta
import threading
import logging
from .models import PromotionCampaign, PromotionRecipient, PromotionTemplate, PromotionAnalytics

logger = logging.getLogger(__name__)
from .serializers import (
    PromotionCampaignSerializer, PromotionCampaignListSerializer,
    PromotionRecipientSerializer, PromotionTemplateSerializer,
    PromotionAnalyticsSerializer, PromotionStatsSerializer,
    SendPromotionSerializer
)
from .services import PromotionService
from .tasks import send_campaign_batch_async
from products.models import Shop


class PromotionCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = PromotionCampaignSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Filter by user's shops
        user_shops = Shop.objects.filter(seller=self.request.user)
        return PromotionCampaign.objects.filter(shop__in=user_shops).prefetch_related('products')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return PromotionCampaignListSerializer
        return PromotionCampaignSerializer
    
    def perform_create(self, serializer):
        # Get the user's active shop
        shop = Shop.objects.filter(seller=self.request.user, status='active').first()
        if not shop:
            # If no active shop, get any shop
            shop = Shop.objects.filter(seller=self.request.user).first()
        
        if not shop:
            raise ValueError("User must have a shop to create promotions")
        
        serializer.save(created_by=self.request.user, shop=shop)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get promotion statistics for the user's shops"""
        user_shops = Shop.objects.filter(seller=request.user)
        campaigns = PromotionCampaign.objects.filter(shop__in=user_shops)
        
        stats = {
            'total_campaigns': campaigns.count(),
            'sent_campaigns': campaigns.filter(status='sent').count(),
            'scheduled_campaigns': campaigns.filter(status='scheduled').count(),
            'draft_campaigns': campaigns.filter(status='draft').count(),
            'avg_open_rate': campaigns.aggregate(
                avg_rate=Avg('opened_count') / Avg('delivered_count') * 100
            )['avg_rate'] or 0,
            'avg_click_rate': campaigns.aggregate(
                avg_rate=Avg('clicked_count') / Avg('delivered_count') * 100
            )['avg_rate'] or 0,
            'total_sent': campaigns.aggregate(total=Sum('sent_count'))['total'] or 0,
            'total_revenue': PromotionAnalytics.objects.filter(
                campaign__shop__in=user_shops
            ).aggregate(total=Sum('revenue_generated'))['total'] or 0
        }
        
        serializer = PromotionStatsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send or schedule a promotion campaign"""
        campaign = self.get_object()
        
        if campaign.status not in ['draft', 'scheduled']:
            return Response(
                {'error': 'Only draft or scheduled campaigns can be sent'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = SendPromotionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            if data.get('test_email'):
                # Send test email
                result = PromotionService.send_test_campaign(campaign, data['test_email'])
                return Response({'message': 'Test email sent successfully', 'result': result})
            
            elif data.get('send_immediately', True):
                # Update status immediately and return fast response
                campaign.status = 'sending'
                campaign.save()
                
                # Start background task immediately after response
                def send_in_background():
                    try:
                        send_campaign_batch_async(campaign.id, batch_size=5)
                    except Exception as e:
                        logger.error(f"Background sending failed for campaign {campaign.id}: {e}")
                
                thread = threading.Thread(target=send_in_background)
                thread.daemon = True
                thread.start()
                
                return Response({
                    'message': 'Campaign is being sent in the background',
                    'status': 'sending',
                    'campaign_id': campaign.id
                })
            
            else:
                # Schedule for later
                campaign.scheduled_at = data['scheduled_at']
                campaign.status = 'scheduled'
                campaign.save()
                
                return Response({
                    'message': 'Campaign scheduled successfully',
                    'scheduled_at': campaign.scheduled_at
                })
        
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get current status of a campaign"""
        campaign = self.get_object()
        
        return Response({
            'id': campaign.id,
            'status': campaign.status,
            'sent_count': campaign.sent_count,
            'delivered_count': campaign.delivered_count,
            'sent_at': campaign.sent_at,
            'updated_at': campaign.updated_at
        })
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a promotion campaign"""
        original = self.get_object()
        
        # Create a copy
        campaign_copy = PromotionCampaign.objects.create(
            title=f"{original.title} (Copy)",
            message=original.message,
            email_subject=original.email_subject,
            channel=original.channel,
            audience=original.audience,
            shop=original.shop,
            created_by=request.user,
            status='draft'
        )
        
        # Copy products
        campaign_copy.products.set(original.products.all())
        
        serializer = self.get_serializer(campaign_copy)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def recipients(self, request, pk=None):
        """Get recipients for a campaign"""
        campaign = self.get_object()
        recipients = PromotionRecipient.objects.filter(campaign=campaign)
        
        serializer = PromotionRecipientSerializer(recipients, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get analytics for a campaign"""
        campaign = self.get_object()
        analytics = PromotionAnalytics.objects.filter(campaign=campaign)
        
        serializer = PromotionAnalyticsSerializer(analytics, many=True)
        return Response(serializer.data)


class PromotionTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = PromotionTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return PromotionTemplate.objects.filter(created_by=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PromotionAnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PromotionAnalyticsSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user_shops = Shop.objects.filter(seller=self.request.user)
        return PromotionAnalytics.objects.filter(campaign__shop__in=user_shops)
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get dashboard analytics"""
        user_shops = Shop.objects.filter(seller=request.user)
        
        # Get date range from query params
        days = int(request.query_params.get('days', 30))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        analytics = PromotionAnalytics.objects.filter(
            campaign__shop__in=user_shops,
            date__range=[start_date, end_date]
        )
        
        # Aggregate data by date
        daily_stats = {}
        for analytic in analytics:
            date_str = analytic.date.strftime('%Y-%m-%d')
            if date_str not in daily_stats:
                daily_stats[date_str] = {
                    'date': date_str,
                    'emails_sent': 0,
                    'emails_opened': 0,
                    'emails_clicked': 0,
                    'notifications_sent': 0,
                    'notifications_clicked': 0,
                    'revenue': 0,
                    'orders': 0
                }
            
            daily_stats[date_str]['emails_sent'] += analytic.emails_sent
            daily_stats[date_str]['emails_opened'] += analytic.emails_opened
            daily_stats[date_str]['emails_clicked'] += analytic.emails_clicked
            daily_stats[date_str]['notifications_sent'] += analytic.notifications_sent
            daily_stats[date_str]['notifications_clicked'] += analytic.notifications_clicked
            daily_stats[date_str]['revenue'] += float(analytic.revenue_generated)
            daily_stats[date_str]['orders'] += analytic.orders_generated
        
        return Response({
            'daily_stats': list(daily_stats.values()),
            'summary': {
                'total_emails_sent': sum(s['emails_sent'] for s in daily_stats.values()),
                'total_emails_opened': sum(s['emails_opened'] for s in daily_stats.values()),
                'total_emails_clicked': sum(s['emails_clicked'] for s in daily_stats.values()),
                'total_notifications_sent': sum(s['notifications_sent'] for s in daily_stats.values()),
                'total_notifications_clicked': sum(s['notifications_clicked'] for s in daily_stats.values()),
                'total_revenue': sum(s['revenue'] for s in daily_stats.values()),
                'total_orders': sum(s['orders'] for s in daily_stats.values()),
            }
        })