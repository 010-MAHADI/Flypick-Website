from django.core.management.base import BaseCommand
from django.db import transaction
from users.models import CustomUser


class Command(BaseCommand):
    help = 'Clean up test users (DEVELOPMENT ONLY)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm deletion of test users',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    'This will delete test users. Use --confirm to proceed.'
                )
            )
            return

        self.stdout.write('Cleaning up test users...')
        
        # Define test email patterns
        test_patterns = [
            'test@',
            '@test.com',
            '@example.com',
            'admin_test@',
            'integration@',
            'unique123@',
            'admin_verification@',
            'test_conflict_'
        ]
        
        with transaction.atomic():
            deleted_count = 0
            
            for pattern in test_patterns:
                if '@' in pattern and pattern.startswith('@'):
                    # Domain pattern
                    users = CustomUser.objects.filter(email__endswith=pattern)
                elif pattern.endswith('@'):
                    # Prefix pattern
                    users = CustomUser.objects.filter(email__startswith=pattern)
                else:
                    # Contains pattern
                    users = CustomUser.objects.filter(email__contains=pattern)
                
                for user in users:
                    # Don't delete admin users or important accounts
                    if user.is_superuser or user.email == 'admin@flypick.com':
                        continue
                    
                    self.stdout.write(f'Deleting test user: {user.email}')
                    user.delete()
                    deleted_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully deleted {deleted_count} test users')
        )
        
        # Show remaining users
        remaining_users = CustomUser.objects.all().count()
        self.stdout.write(f'Remaining users: {remaining_users}')