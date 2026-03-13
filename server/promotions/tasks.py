"""
Background tasks for promotion campaigns
"""

import logging
from django.utils import timezone
from .models import PromotionCampaign
from .services import PromotionService

logger = logging.getLogger(__name__)


def send_campaign_async(campaign_id):
    """
    Send promotion campaign asynchronously
    This function can be called as a background task
    """
    try:
        campaign = PromotionCampaign.objects.get(id=campaign_id)
        
        # Update status to indicate sending is in progress
        campaign.status = 'sending'
        campaign.save()
        
        # Send the campaign
        result = PromotionService.send_campaign(campaign)
        
        if result['success']:
            # Update campaign status and metrics
            campaign.status = 'sent'
            campaign.sent_at = timezone.now()
            campaign.sent_count = result.get('sent_count', 0)
            campaign.delivered_count = result.get('delivered_count', 0)
            campaign.save()
            
            logger.info(f"Campaign {campaign_id} sent successfully to {result.get('sent_count', 0)} users")
        else:
            # Mark as failed
            campaign.status = 'failed'
            campaign.save()
            
            logger.error(f"Campaign {campaign_id} failed to send: {result.get('error', 'Unknown error')}")
        
        return result
        
    except PromotionCampaign.DoesNotExist:
        logger.error(f"Campaign {campaign_id} not found")
        return {'success': False, 'error': 'Campaign not found'}
    
    except Exception as e:
        logger.error(f"Error sending campaign {campaign_id}: {str(e)}")
        
        # Update campaign status to failed
        try:
            campaign = PromotionCampaign.objects.get(id=campaign_id)
            campaign.status = 'failed'
            campaign.save()
        except:
            pass
        
        return {'success': False, 'error': str(e)}


def send_campaign_batch_async(campaign_id, batch_size=10):
    """
    Send promotion campaign in batches to avoid overwhelming the email server
    """
    try:
        campaign = PromotionCampaign.objects.get(id=campaign_id)
        
        # Update status to indicate sending is in progress
        campaign.status = 'sending'
        campaign.save()
        
        # Get target users
        target_users = PromotionService.get_target_audience(campaign)
        total_users = target_users.count()
        
        if total_users == 0:
            campaign.status = 'sent'
            campaign.sent_at = timezone.now()
            campaign.save()
            return {'success': True, 'sent_count': 0, 'delivered_count': 0}
        
        # Send in batches
        sent_count = 0
        delivered_count = 0
        
        for i in range(0, total_users, batch_size):
            batch_users = target_users[i:i + batch_size]
            
            for user in batch_users:
                try:
                    # Create or get recipient record
                    from .models import PromotionRecipient
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
                    
                except Exception as e:
                    logger.error(f"Error sending to user {user.id}: {str(e)}")
                    continue
            
            # Update progress
            campaign.sent_count = sent_count
            campaign.delivered_count = delivered_count
            campaign.save()
            
            logger.info(f"Campaign {campaign_id}: Sent batch {i//batch_size + 1}, total sent: {sent_count}")
        
        # Mark as completed
        campaign.status = 'sent'
        campaign.sent_at = timezone.now()
        campaign.sent_count = sent_count
        campaign.delivered_count = delivered_count
        campaign.save()
        
        # Create analytics record
        PromotionService._create_analytics_record(campaign, sent_count, delivered_count)
        
        logger.info(f"Campaign {campaign_id} completed successfully. Sent: {sent_count}, Delivered: {delivered_count}")
        
        return {
            'success': True,
            'sent_count': sent_count,
            'delivered_count': delivered_count
        }
        
    except Exception as e:
        logger.error(f"Error in batch sending for campaign {campaign_id}: {str(e)}")
        
        # Update campaign status to failed
        try:
            campaign = PromotionCampaign.objects.get(id=campaign_id)
            campaign.status = 'failed'
            campaign.save()
        except:
            pass
        
        return {'success': False, 'error': str(e)}