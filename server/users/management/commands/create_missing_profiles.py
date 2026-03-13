from django.core.management.base import BaseCommand
from users.models import CustomUser, CustomerProfile, SellerProfile


class Command(BaseCommand):
    help = 'Create missing profiles for existing users'

    def handle(self, *args, **options):
        self.stdout.write('Creating missing user profiles...')
        
        # Fix customers without profiles
        customers_without_profiles = CustomUser.objects.filter(
            role='Customer'
        ).exclude(
            id__in=CustomerProfile.objects.values_list('user_id', flat=True)
        )
        
        created_customer_profiles = 0
        for user in customers_without_profiles:
            CustomerProfile.objects.create(user=user)
            created_customer_profiles += 1
            self.stdout.write(f'Created CustomerProfile for {user.email}')
        
        # Fix sellers without profiles
        sellers_without_profiles = CustomUser.objects.filter(
            role='Seller'
        ).exclude(
            id__in=SellerProfile.objects.values_list('user_id', flat=True)
        )
        
        created_seller_profiles = 0
        for user in sellers_without_profiles:
            SellerProfile.objects.create(user=user)
            created_seller_profiles += 1
            self.stdout.write(f'Created SellerProfile for {user.email}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {created_customer_profiles} customer profiles '
                f'and {created_seller_profiles} seller profiles'
            )
        )