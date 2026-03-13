from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CustomUser, CustomerProfile, SellerProfile


@receiver(post_save, sender=CustomUser)
def create_user_profile(sender, instance, created, **kwargs):
    """Create appropriate profile when a new user is created"""
    if created:
        if instance.role == 'Customer':
            # Create CustomerProfile for new customers
            CustomerProfile.objects.get_or_create(user=instance)
        elif instance.role == 'Seller':
            # Create SellerProfile for new sellers
            SellerProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=CustomUser)
def save_user_profile(sender, instance, **kwargs):
    """Ensure profile exists when user is saved"""
    if instance.role == 'Customer':
        if not hasattr(instance, 'customer_profile'):
            CustomerProfile.objects.get_or_create(user=instance)
    elif instance.role == 'Seller':
        if not hasattr(instance, 'seller_profile'):
            SellerProfile.objects.get_or_create(user=instance)