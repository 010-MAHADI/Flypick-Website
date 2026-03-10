import os
from django.core.management.base import BaseCommand
from django.conf import settings
from emails.models import EmailTemplate

class Command(BaseCommand):
    help = 'Setup default email templates'

    def handle(self, *args, **options):
        templates_dir = os.path.join(settings.BASE_DIR, 'emails', 'templates', 'email_templates')
        
        templates = [
            {
                'name': 'Welcome Email',
                'template_type': 'welcome',
                'subject': 'Welcome to {{ site_name }}!',
                'file': 'welcome.html'
            },
            {
                'name': 'Order Confirmation',
                'template_type': 'order_confirmation',
                'subject': 'Your Order Has Been Placed Successfully - {{ order_id }}',
                'file': 'order_confirmation.html'
            },
            {
                'name': 'Order Status Update',
                'template_type': 'order_status_update',
                'subject': 'Order Update: {{ order_id }} - {{ new_status }}',
                'file': 'order_status_update.html'
            },
            {
                'name': 'New Order (Seller)',
                'template_type': 'new_order_seller',
                'subject': 'New Order Received - {{ order_id }}',
                'file': 'new_order_seller.html'
            },
            {
                'name': 'Out of Stock Alert',
                'template_type': 'out_of_stock_alert',
                'subject': 'Product Out of Stock Alert - {{ product_name }}',
                'file': 'out_of_stock_alert.html'
            },
            {
                'name': 'Low Stock Warning',
                'template_type': 'low_stock_alert',
                'subject': 'Low Stock Warning - {{ product_name }}',
                'file': 'low_stock_alert.html'
            }
        ]
        
        for template_data in templates:
            template_file = os.path.join(templates_dir, template_data['file'])
            
            if os.path.exists(template_file):
                with open(template_file, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                
                template, created = EmailTemplate.objects.get_or_create(
                    template_type=template_data['template_type'],
                    defaults={
                        'name': template_data['name'],
                        'subject': template_data['subject'],
                        'html_content': html_content,
                        'is_active': True
                    }
                )
                
                if created:
                    self.stdout.write(
                        self.style.SUCCESS(f'Created template: {template_data["name"]}')
                    )
                else:
                    # Update existing template
                    template.name = template_data['name']
                    template.subject = template_data['subject']
                    template.html_content = html_content
                    template.save()
                    self.stdout.write(
                        self.style.WARNING(f'Updated template: {template_data["name"]}')
                    )
            else:
                self.stdout.write(
                    self.style.ERROR(f'Template file not found: {template_file}')
                )
        
        self.stdout.write(
            self.style.SUCCESS('Email templates setup completed!')
        )