from django.contrib.auth import get_user_model
from .models import Notification, NotificationPreference

User = get_user_model()


class NotificationService:
    """Service for creating and managing notifications"""
    
    @staticmethod
    def create_notification(
        user, 
        title, 
        message, 
        notification_type='system',
        priority='medium',
        order_id=None,
        product_id=None,
        coupon_code=None,
        action_url=None,
        action_text=None,
        metadata=None
    ):
        """Create a new notification for a user"""
        
        # Check user preferences
        try:
            preferences = user.notification_preferences
            
            # Check if user wants this type of notification
            if notification_type in ['order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled']:
                if not preferences.app_order_updates:
                    return None
            elif notification_type in ['coupon_available', 'promotion']:
                if not preferences.app_promotions:
                    return None
            elif notification_type in ['price_drop']:
                if not preferences.app_price_alerts:
                    return None
            elif notification_type in ['product_back_in_stock']:
                if not preferences.app_stock_alerts:
                    return None
                    
        except NotificationPreference.DoesNotExist:
            # Create default preferences if they don't exist
            NotificationPreference.objects.create(user=user)
        
        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            order_id=order_id,
            product_id=product_id,
            coupon_code=coupon_code,
            action_url=action_url,
            action_text=action_text,
            metadata=metadata or {}
        )
        
        return notification
    
    @staticmethod
    def create_order_notification(user, order, notification_type, custom_message=None):
        """Create order-related notifications"""
        
        type_messages = {
            'order_confirmed': {
                'title': f'Order #{order.order_id} Confirmed',
                'message': custom_message or f'Your order for ৳{order.total_amount} has been confirmed and is being processed.',
                'action_url': f'/orders/{order.order_id}',
                'action_text': 'View Order'
            },
            'order_shipped': {
                'title': f'Order #{order.order_id} Shipped',
                'message': custom_message or f'Your order has been shipped and is on its way to you.',
                'action_url': f'/track-order/{order.order_id}',
                'action_text': 'Track Order'
            },
            'order_delivered': {
                'title': f'Order #{order.order_id} Delivered',
                'message': custom_message or f'Your order has been delivered successfully. Thank you for shopping with us!',
                'action_url': f'/orders/{order.order_id}',
                'action_text': 'View Order'
            },
            'order_cancelled': {
                'title': f'Order #{order.order_id} Cancelled',
                'message': custom_message or f'Your order has been cancelled. If you have any questions, please contact support.',
                'action_url': f'/orders/{order.order_id}',
                'action_text': 'View Details'
            }
        }
        
        if notification_type not in type_messages:
            return None
        
        config = type_messages[notification_type]
        
        return NotificationService.create_notification(
            user=user,
            title=config['title'],
            message=config['message'],
            notification_type=notification_type,
            priority='high' if notification_type in ['order_confirmed', 'order_delivered'] else 'medium',
            order_id=order.order_id,
            action_url=config['action_url'],
            action_text=config['action_text'],
            metadata={
                'order_total': str(order.total_amount),
                'order_status': order.status
            }
        )
    
    @staticmethod
    def create_welcome_notification(user):
        """Create welcome notification for new users"""
        return NotificationService.create_notification(
            user=user,
            title='Welcome to Flypick!',
            message='Thank you for joining Flypick! Explore our products and enjoy exclusive deals.',
            notification_type='welcome',
            priority='medium',
            action_url='/',
            action_text='Start Shopping'
        )
    
    @staticmethod
    def create_coupon_notification(user, coupon):
        """Create coupon availability notification"""
        return NotificationService.create_notification(
            user=user,
            title='New Coupon Available!',
            message=f'Use code {coupon.code} to get {coupon.discount_text} off your next order.',
            notification_type='coupon_available',
            priority='medium',
            coupon_code=coupon.code,
            action_url='/search',
            action_text='Shop Now',
            metadata={
                'discount_value': coupon.discount_value,
                'discount_type': coupon.discount_type,
                'min_order_amount': coupon.min_order_amount
            }
        )
    
    @staticmethod
    def create_price_drop_notification(user, product, old_price, new_price):
        """Create price drop notification"""
        discount_percent = int(((old_price - new_price) / old_price) * 100)
        
        return NotificationService.create_notification(
            user=user,
            title=f'Price Drop Alert!',
            message=f'{product.title} is now ৳{new_price} (was ৳{old_price}). Save {discount_percent}%!',
            notification_type='price_drop',
            priority='medium',
            product_id=product.id,
            action_url=f'/product/{product.id}',
            action_text='View Product',
            metadata={
                'old_price': str(old_price),
                'new_price': str(new_price),
                'discount_percent': discount_percent
            }
        )
    
    @staticmethod
    def get_unread_count(user):
        """Get count of unread notifications for a user"""
        return Notification.objects.filter(
            user=user, 
            is_read=False, 
            is_deleted=False
        ).count()
    
    @staticmethod
    def mark_all_read(user):
        """Mark all notifications as read for a user"""
        from django.utils import timezone
        
        return Notification.objects.filter(
            user=user, 
            is_read=False, 
            is_deleted=False
        ).update(is_read=True, read_at=timezone.now())