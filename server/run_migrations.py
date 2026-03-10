#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Run migrations
from django.core.management import call_command

print("Creating migrations for orders app...")
call_command('makemigrations', 'orders')

print("\nApplying migrations...")
call_command('migrate')

print("\nMigrations completed successfully!")
