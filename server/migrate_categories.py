#!/usr/bin/env python
"""
Migration script to convert Product and Shop category from CharField to ForeignKey
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from products.models import Product, Shop, Category
from django.utils.text import slugify

def migrate_categories():
    print("Starting category migration...")
    
    # Step 1: Get all unique category strings from products and shops
    products = Product.objects.exclude(category__isnull=True).exclude(category='')
    shops = Shop.objects.exclude(category__isnull=True).exclude(category='')
    unique_categories = set()
    
    for product in products:
        if hasattr(product.category, 'name'):
            # Already migrated
            continue
        if product.category:
            unique_categories.add(str(product.category))
    
    for shop in shops:
        if hasattr(shop.category, 'name'):
            # Already migrated
            continue
        if shop.category:
            unique_categories.add(str(shop.category))
    
    print(f"Found {len(unique_categories)} unique categories")
    
    # Step 2: Create Category objects
    category_map = {}
    for cat_name in unique_categories:
        cat_name = cat_name.strip()
        if not cat_name:
            continue
        
        slug = slugify(cat_name)
        category, created = Category.objects.get_or_create(
            name=cat_name,
            defaults={'slug': slug, 'is_active': True}
        )
        category_map[cat_name] = category
        if created:
            print(f"Created category: {cat_name}")
    
    # Step 3: Update products with category_fk
    products_updated = 0
    for product in products:
        if hasattr(product.category, 'name'):
            continue
        if product.category and str(product.category) in category_map:
            product.category_fk = category_map[str(product.category)]
            product.save(update_fields=['category_fk'])
            products_updated += 1
    
    # Step 4: Update shops with category_fk
    shops_updated = 0
    for shop in shops:
        if hasattr(shop.category, 'name'):
            continue
        if shop.category and str(shop.category) in category_map:
            shop.category_fk = category_map[str(shop.category)]
            shop.save(update_fields=['category_fk'])
            shops_updated += 1
    
    print(f"\nCreated/found {len(category_map)} categories")
    print(f"Updated {products_updated} products")
    print(f"Updated {shops_updated} shops")
    print("\nMigration complete!")
    print("Categories are now managed from Django admin and available via API")

if __name__ == '__main__':
    migrate_categories()
