#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from orders.models import Order

print("Checking for existing orders...")
order_count = Order.objects.count()
print(f"Found {order_count} existing orders")

if order_count > 0:
    print("\nDeleting existing test orders to allow clean migration...")
    Order.objects.all().delete()
    print("Orders deleted successfully!")

# Now run migrations
from django.core.management import call_command

print("\nCreating migrations for orders app...")
call_command('makemigrations', 'orders')

print("\nApplying migrations...")
call_command('migrate')

print("\n✅ Migrations completed successfully!")
print("\nYou can now:")
print("1. Start the Django server: python manage.py runserver")
print("2. Test the checkout and payment methods integration")
