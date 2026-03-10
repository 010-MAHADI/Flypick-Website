#!/usr/bin/env python
"""
Run cart migrations
"""
import os
import sys
import django

# Add the project directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command

if __name__ == '__main__':
    print("Running cart migrations...")
    try:
        call_command('makemigrations', 'cart')
        call_command('migrate', 'cart')
        print("\n✅ Cart migrations completed successfully!")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
