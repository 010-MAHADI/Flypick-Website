#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command

print("Creating migration for product category field...")
call_command('makemigrations', 'products', '--name', 'add_product_category')
print("\nMigration created successfully!")
print("\nTo apply the migration, run:")
print("python manage.py migrate")
