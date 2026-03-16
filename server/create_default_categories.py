#!/usr/bin/env python3
"""
Script to create default categories for shops
"""
import os
import sys
import django

# Add the server directory to Python path
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from products.models import Category
from django.utils.text import slugify

DEFAULT_CATEGORIES = [
    "Electronics",
    "Clothing & Fashion", 
    "Home & Garden",
    "Sports & Outdoors",
    "Beauty & Personal Care",
    "Books & Media",
    "Toys & Games",
    "Food & Beverages",
    "Health & Wellness",
    "Automotive",
]

def create_default_categories():
    print("Creating default categories...")
    
    created_count = 0
    for category_name in DEFAULT_CATEGORIES:
        slug = slugify(category_name)
        category, created = Category.objects.get_or_create(
            name=category_name,
            defaults={
                'slug': slug,
                'description': f'Products related to {category_name}',
                'is_active': True,
                'sort_order': DEFAULT_CATEGORIES.index(category_name)
            }
        )
        
        if created:
            print(f"✓ Created category: {category_name}")
            created_count += 1
        else:
            print(f"- Category already exists: {category_name}")
    
    print(f"\nCreated {created_count} new categories")
    print(f"Total categories: {Category.objects.count()}")

if __name__ == '__main__':
    create_default_categories()