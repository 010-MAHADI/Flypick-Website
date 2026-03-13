from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from orders.models import Order
from .services import NotificationService

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_notification_preferences(sender, instance, created, **kwargs):
    """Create default notification preferences for new users"""
    if created:
        from .models import NotificationPreference
        NotificationPreference.objects.get_or_create(user=instance)
        
        # Create welcome notification
        NotificationService.create_welcome_notification(instance)


@receiver(post_save, sender=Order)
def create_order_notifications(sender, instance, created, **kwargs):
    """Create notifications when order status changes"""
    if created:
        # Order confirmed notification
        NotificationService.create_order_notification(
            user=instance.customer,
            order=instance,
            notification_type='order_confirmed'
        )
    else:
        # Check if status changed
        if hasattr(instance, '_original_status'):
            old_status = instance._original_status
            new_status = instance.status
            
            if old_status != new_status:
                notification_type = None
                
                if new_status == 'shipped':
                    notification_type = 'order_shipped'
                elif new_status == 'delivered':
                    notification_type = 'order_delivered'
                elif new_status == 'cancelled':
                    notification_type = 'order_cancelled'
                
                if notification_type:
                    NotificationService.create_order_notification(
                        user=instance.customer,
                        order=instance,
                        notification_type=notification_type
                    )