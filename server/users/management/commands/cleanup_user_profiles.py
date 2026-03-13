from django.core.management.base import BaseCommand
from django.db import transaction
from django.db import models
from users.models import CustomUser, CustomerProfile, SellerProfile


class Command(BaseCommand):
    help = 'Clean up user profiles and fix any inconsistencies'

    def handle(self, *args, **options):
        self.stdout.write('Cleaning up user profiles...')
        
        with transaction.atomic():
            # Remove orphaned CustomerProfiles (profiles without users)
            orphaned_customer_profiles = CustomerProfile.objects.filter(user__isnull=True)
            orphaned_count = orphaned_customer_profiles.count()
            if orphaned_count > 0:
                orphaned_customer_profiles.delete()
                self.stdout.write(f'Removed {orphaned_count} orphaned customer profiles')
            
            # Remove orphaned SellerProfiles
            orphaned_seller_profiles = SellerProfile.objects.filter(user__isnull=True)
            orphaned_seller_count = orphaned_seller_profiles.count()
            if orphaned_seller_count > 0:
                orphaned_seller_profiles.delete()
                self.stdout.write(f'Removed {orphaned_seller_count} orphaned seller profiles')
            
            # Create missing profiles for existing users
            customers_without_profiles = CustomUser.objects.filter(
                role='Customer'
            ).exclude(
                id__in=CustomerProfile.objects.values_list('user_id', flat=True)
            )
            
            created_customer_profiles = 0
            for user in customers_without_profiles:
                CustomerProfile.objects.get_or_create(user=user)
                created_customer_profiles += 1
                self.stdout.write(f'Created CustomerProfile for {user.email}')
            
            sellers_without_profiles = CustomUser.objects.filter(
                role='Seller'
            ).exclude(
                id__in=SellerProfile.objects.values_list('user_id', flat=True)
            )
            
            created_seller_profiles = 0
            for user in sellers_without_profiles:
                SellerProfile.objects.get_or_create(user=user)
                created_seller_profiles += 1
                self.stdout.write(f'Created SellerProfile for {user.email}')
            
            # Check for duplicate profiles (shouldn't happen but just in case)
            duplicate_customer_profiles = CustomerProfile.objects.values('user_id').annotate(
                count=models.Count('user_id')
            ).filter(count__gt=1)
            
            if duplicate_customer_profiles.exists():
                self.stdout.write(self.style.WARNING('Found duplicate customer profiles:'))
                for dup in duplicate_customer_profiles:
                    user_id = dup['user_id']
                    profiles = CustomerProfile.objects.filter(user_id=user_id).order_by('id')
                    # Keep the first one, delete the rest
                    profiles_to_delete = profiles[1:]
                    for profile in profiles_to_delete:
                        profile.delete()
                        self.stdout.write(f'Removed duplicate CustomerProfile for user {user_id}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Cleanup completed: '
                f'Created {created_customer_profiles} customer profiles, '
                f'{created_seller_profiles} seller profiles, '
                f'Removed {orphaned_count} orphaned customer profiles, '
                f'{orphaned_seller_count} orphaned seller profiles'
            )
        )