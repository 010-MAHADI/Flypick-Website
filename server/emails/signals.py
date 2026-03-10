from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from orders.models import Order
from products.models import Product
from .services import NotificationService
from .models import EmailPreference
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

# Initialize notification service
notification_service = NotificationService()

@receiver(post_save, sender=User)
def send_welcome_email(sender, instance, created, **kwargs):
    """Send welcome email when new user is created"""
    if created:
        try:
            # Create default email preferences
            EmailPreference.objects.get_or_create(user=instance)
            
            # Send welcome email
            notification_service.send_welcome_email(instance)
            logger.info(f"Welcome email sent to {instance.email}")
        except Exception as e:
            logger.error(f"Failed to send welcome email to {instance.email}: {str(e)}")

@receiver(post_save, sender=Order)
def handle_order_notifications(sender, instance, created, **kwargs):
    """Handle order-related email notifications"""
    try:
        if created:
            # Send order confirmation to customer
            notification_service.send_order_confirmation(instance)
            logger.info(f"Order confirmation sent for order {instance.order_id}")
            
            # Send new order notification to seller(s)
            notification_service.send_new_order_notification_to_seller(instance)
            logger.info(f"New order notification sent to sellers for order {instance.order_id}")
        else:
            # Check if status changed
            if hasattr(instance, '_original_status'):
                old_status = instance._original_status
                if old_status != instance.status:
                    notification_service.send_order_status_update(instance, old_status)
                    logger.info(f"Order status update sent for order {instance.order_id}: {old_status} -> {instance.status}")
    except Exception as e:
        logger.error(f"Failed to send order notifications for order {instance.order_id}: {str(e)}")

@receiver(pre_save, sender=Order)
def track_order_status_change(sender, instance, **kwargs):
    """Track original status before save to detect changes"""
    if instance.pk:
        try:
            original = Order.objects.get(pk=instance.pk)
            instance._original_status = original.status
        except Order.DoesNotExist:
            instance._original_status = None

@receiver(post_save, sender=Product)
def handle_stock_alerts(sender, instance, created, **kwargs):
    """Handle stock alert notifications"""
    if not created:  # Only for updates, not new products
        try:
            # Get user's low stock threshold
            try:
                preferences = EmailPreference.objects.get(user=instance.shop.seller)
                threshold = preferences.low_stock_threshold
            except EmailPreference.DoesNotExist:
                threshold = 5
            
            # Check for out of stock
            if instance.stock == 0:
                notification_service.send_stock_alert(instance, 'out_of_stock')
                logger.info(f"Out of stock alert sent for product {instance.title}")
            
            # Check for low stock
            elif instance.stock <= threshold and instance.stock > 0:
                notification_service.send_stock_alert(instance, 'low_stock')
                logger.info(f"Low stock alert sent for product {instance.title}")
                
        except Exception as e:
            logger.error(f"Failed to send stock alerts for product {instance.title}: {str(e)}")

@receiver(pre_save, sender=Product)
def track_stock_change(sender, instance, **kwargs):
    """Track original stock before save to detect changes"""
    if instance.pk:
        try:
            original = Product.objects.get(pk=instance.pk)
            instance._original_stock = original.stock
        except Product.DoesNotExist:
            instance._original_stock = None