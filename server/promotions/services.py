from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q
from django.template.loader import render_to_string
from django.conf import settings
from emails.services import NotificationService as EmailNotificationService
from notifications.services import NotificationService
from .models import PromotionCampaign, PromotionRecipient, PromotionAnalytics
from orders.models import Order
from datetime import datetime, timedelta
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class PromotionService:
    """Service for handling promotion campaigns"""
    
    @staticmethod
    def get_target_audience(campaign):
        """Get target users based on campaign audience settings"""
        if campaign.audience == 'all':
            return User.objects.filter(is_active=True, email__isnull=False).exclude(email='')
        
        elif campaign.audience == 'returning':
            # Users who have made at least one order
            return User.objects.filter(
                is_active=True,
                email__isnull=False,
                orders__isnull=False
            ).exclude(email='').distinct()
        
        elif campaign.audience == 'new':
            # Users who haven't made any orders
            return User.objects.filter(
                is_active=True,
                email__isnull=False
            ).exclude(email='').exclude(orders__isnull=False).distinct()
        
        elif campaign.audience == 'inactive':
            # Users who haven't made orders in the last 90 days
            cutoff_date = timezone.now() - timedelta(days=90)
            return User.objects.filter(
                is_active=True,
                email__isnull=False
            ).exclude(email='').exclude(
                orders__created_at__gte=cutoff_date
            ).distinct()
        
        elif campaign.audience == 'high_value':
            # Users with orders totaling more than $500
            return User.objects.filter(
                is_active=True,
                email__isnull=False,
                orders__total_amount__gte=500
            ).exclude(email='').distinct()
        
        else:
            return User.objects.none()
    
    @staticmethod
    def send_campaign(campaign):
        """Send a promotion campaign to target audience"""
        try:
            # Get target users
            target_users = PromotionService.get_target_audience(campaign)
            
            sent_count = 0
            delivered_count = 0
            
            for user in target_users:
                # Create or get recipient record
                recipient, created = PromotionRecipient.objects.get_or_create(
                    campaign=campaign,
                    user=user,
                    defaults={'sent_at': timezone.now()}
                )
                
                if not created and recipient.email_sent:
                    continue  # Skip if already sent
                
                success = False
                
                # Send email if required
                if campaign.channel in ['email', 'both']:
                    email_success = PromotionService._send_promotion_email(campaign, user)
                    if email_success:
                        recipient.email_sent = True
                        recipient.email_delivered = True
                        delivered_count += 1
                        success = True
                
                # Send notification if required
                if campaign.channel in ['notification', 'both']:
                    notification_success = PromotionService._send_promotion_notification(campaign, user)
                    if notification_success:
                        recipient.notification_sent = True
                        recipient.notification_delivered = True
                        success = True
                
                if success:
                    sent_count += 1
                    if not recipient.sent_at:
                        recipient.sent_at = timezone.now()
                
                recipient.save()
            
            # Update campaign metrics
            campaign.sent_count = sent_count
            campaign.delivered_count = delivered_count
            campaign.save()
            
            # Create analytics record
            PromotionService._create_analytics_record(campaign, sent_count, delivered_count)
            
            return {
                'success': True,
                'sent_count': sent_count,
                'delivered_count': delivered_count
            }
        
        except Exception as e:
            logger.error(f"Error sending campaign {campaign.id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def send_test_campaign(campaign, test_email):
        """Send a test version of the campaign to a specific email"""
        try:
            # Create a test user object (don't save to database)
            test_user = User(email=test_email, first_name="Test", last_name="User")
            
            success = False
            
            if campaign.channel in ['email', 'both']:
                # For test emails, don't pass the user object to avoid save issues
                test_context = {
                    'user': {'email': test_email, 'first_name': 'Test'},
                    'campaign': campaign,
                    'products': campaign.products.all(),
                    'shop': campaign.shop,
                    'unsubscribe_url': f"{settings.FRONTEND_URL}/unsubscribe?token=dummy",
                    'is_test': True
                }
                success = EmailNotificationService.send_promotion_email(
                    to_email=test_email,
                    subject=f"[TEST] {campaign.email_subject or campaign.title}",
                    context=test_context
                )
            
            if campaign.channel in ['notification', 'both']:
                # For test notifications, we'll just return success
                # since we can't send push notifications to arbitrary emails
                success = True
            
            return {
                'success': success,
                'message': 'Test sent successfully' if success else 'Failed to send test'
            }
        
        except Exception as e:
            logger.error(f"Error sending test campaign {campaign.id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def _send_promotion_email(campaign, user, is_test=False):
        """Send promotion email to a user"""
        try:
            # Prepare email context
            context = {
                'user': user,
                'campaign': campaign,
                'products': campaign.products.all(),
                'shop': campaign.shop,
                'unsubscribe_url': f"{settings.FRONTEND_URL}/unsubscribe?token=dummy",
                'is_test': is_test
            }
            
            # Use email subject or fallback to campaign title
            subject = campaign.email_subject or campaign.title
            if is_test:
                subject = f"[TEST] {subject}"
            
            # Send email using the existing email service
            return EmailNotificationService.send_promotion_email(
                to_email=user.email,
                subject=subject,
                context=context
            )
        
        except Exception as e:
            logger.error(f"Error sending promotion email to {user.email}: {str(e)}")
            return False
    
    @staticmethod
    def _send_promotion_notification(campaign, user):
        """Send promotion notification to a user"""
        try:
            # Send notification using the existing notification service
            return NotificationService.create_notification(
                user=user,
                title=campaign.title,
                message=campaign.message,
                notification_type='promotion',
                priority='medium',
                action_url=f"/search?shop={campaign.shop.id}",
                action_text="Shop Now",
                metadata={
                    'campaign_id': campaign.id,
                    'shop_id': campaign.shop.id,
                    'products': [p.id for p in campaign.products.all()]
                }
            )
        
        except Exception as e:
            logger.error(f"Error sending promotion notification to {user.id}: {str(e)}")
            return False
    
    @staticmethod
    def _create_analytics_record(campaign, sent_count, delivered_count):
        """Create daily analytics record for the campaign"""
        today = timezone.now().date()
        
        analytics, created = PromotionAnalytics.objects.get_or_create(
            campaign=campaign,
            date=today,
            defaults={
                'emails_sent': sent_count if campaign.channel in ['email', 'both'] else 0,
                'emails_delivered': delivered_count if campaign.channel in ['email', 'both'] else 0,
                'notifications_sent': sent_count if campaign.channel in ['notification', 'both'] else 0,
                'notifications_delivered': delivered_count if campaign.channel in ['notification', 'both'] else 0,
            }
        )
        
        if not created:
            # Update existing record
            if campaign.channel in ['email', 'both']:
                analytics.emails_sent += sent_count
                analytics.emails_delivered += delivered_count
            
            if campaign.channel in ['notification', 'both']:
                analytics.notifications_sent += sent_count
                analytics.notifications_delivered += delivered_count
            
            analytics.save()
    
    @staticmethod
    def track_email_open(campaign_id, user_id):
        """Track when a user opens a promotion email"""
        try:
            recipient = PromotionRecipient.objects.get(
                campaign_id=campaign_id,
                user_id=user_id
            )
            
            if not recipient.email_opened:
                recipient.email_opened = True
                recipient.opened_at = timezone.now()
                recipient.save()
                
                # Update campaign metrics
                campaign = recipient.campaign
                campaign.opened_count += 1
                campaign.save()
                
                # Update analytics
                today = timezone.now().date()
                analytics, created = PromotionAnalytics.objects.get_or_create(
                    campaign=campaign,
                    date=today
                )
                analytics.emails_opened += 1
                analytics.save()
            
            return True
        
        except PromotionRecipient.DoesNotExist:
            return False
    
    @staticmethod
    def track_email_click(campaign_id, user_id):
        """Track when a user clicks a link in a promotion email"""
        try:
            recipient = PromotionRecipient.objects.get(
                campaign_id=campaign_id,
                user_id=user_id
            )
            
            if not recipient.email_clicked:
                recipient.email_clicked = True
                recipient.clicked_at = timezone.now()
                recipient.save()
                
                # Update campaign metrics
                campaign = recipient.campaign
                campaign.clicked_count += 1
                campaign.save()
                
                # Update analytics
                today = timezone.now().date()
                analytics, created = PromotionAnalytics.objects.get_or_create(
                    campaign=campaign,
                    date=today
                )
                analytics.emails_clicked += 1
                analytics.save()
            
            return True
        
        except PromotionRecipient.DoesNotExist:
            return False
    
    @staticmethod
    def track_notification_click(campaign_id, user_id):
        """Track when a user clicks a promotion notification"""
        try:
            recipient = PromotionRecipient.objects.get(
                campaign_id=campaign_id,
                user_id=user_id
            )
            
            if not recipient.notification_clicked:
                recipient.notification_clicked = True
                if not recipient.clicked_at:
                    recipient.clicked_at = timezone.now()
                recipient.save()
                
                # Update analytics
                today = timezone.now().date()
                analytics, created = PromotionAnalytics.objects.get_or_create(
                    campaign=recipient.campaign,
                    date=today
                )
                analytics.notifications_clicked += 1
                analytics.save()
            
            return True
        
        except PromotionRecipient.DoesNotExist:
            return False