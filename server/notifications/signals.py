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
                # Map every lifecycle status onto the notification types the
                # preference system knows, with a message that matches the step.
                status_map = {
                    'confirmed': ('order_confirmed',
                                  f'Your order #{instance.order_id} has been confirmed by the seller.'),
                    'processing': ('order_confirmed',
                                   f'Your order #{instance.order_id} is now being processed.'),
                    'packed': ('order_confirmed',
                               f'Your order #{instance.order_id} has been packed and is ready to ship.'),
                    'shipped': ('order_shipped', None),
                    'out_for_delivery': ('order_shipped',
                                         f'Your order #{instance.order_id} is out for delivery — it arrives today!'),
                    'delivered': ('order_delivered', None),
                    'completed': ('order_delivered',
                                  f'Your order #{instance.order_id} is complete. Thanks for shopping with Flypick!'),
                    'cancelled': ('order_cancelled', None),
                    'failed': ('order_cancelled',
                               f'Your order #{instance.order_id} could not be fulfilled. Any payment will be refunded.'),
                    'returned': ('order_cancelled',
                                 f'Your return for order #{instance.order_id} has been received.'),
                    'refunded': ('order_cancelled',
                                 f'Your order #{instance.order_id} has been refunded.'),
                }

                mapped = status_map.get(new_status)
                if mapped:
                    notification_type, custom_message = mapped
                    NotificationService.create_order_notification(
                        user=instance.customer,
                        order=instance,
                        notification_type=notification_type,
                        custom_message=custom_message
                    )