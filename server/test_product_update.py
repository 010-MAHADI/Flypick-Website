#!/usr/bin/env python
"""Test script to verify product update functionality"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from products.models import Product
from products.serializers import ProductSerializer

# Get the first product
product = Product.objects.first()
if not product:
    print("No products found in database")
    exit(1)

print(f"\n=== BEFORE UPDATE ===")
print(f"ID: {product.id}")
print(f"Title: {product.title}")
print(f"SKU: {product.sku}")
print(f"Brand: {product.brand}")
print(f"Barcode: {product.barcode}")
print(f"Description: {product.description}")
print(f"Stock: {product.stock}")
print(f"Status: {product.status}")
print(f"Weight: {product.weight}")
print(f"Return Policy: {product.return_policy}")
print(f"Warranty: {product.warranty}")

# Update the product
update_data = {
    'title': 'Updated Product Title',
    'sku': 'TEST-SKU-123',
    'brand': 'Test Brand',
    'barcode': '9876543210',
    'description': 'This is an updated description',
    'short_description': 'Updated short description',
    'stock': 50,
    'status': 'Active',
    'weight': 2.5,
    'weight_unit': 'kg',
    'return_policy': '30-day',
    'warranty': '2 Years',
    'price': 99.99,
    'originalPrice': 79.99,
}

serializer = ProductSerializer(product, data=update_data, partial=True)
if serializer.is_valid():
    serializer.save()
    print(f"\n=== UPDATE SUCCESSFUL ===")
else:
    print(f"\n=== UPDATE FAILED ===")
    print(f"Errors: {serializer.errors}")
    exit(1)

# Refresh from database
product.refresh_from_db()

print(f"\n=== AFTER UPDATE ===")
print(f"ID: {product.id}")
print(f"Title: {product.title}")
print(f"SKU: {product.sku}")
print(f"Brand: {product.brand}")
print(f"Barcode: {product.barcode}")
print(f"Description: {product.description}")
print(f"Stock: {product.stock}")
print(f"Status: {product.status}")
print(f"Weight: {product.weight}")
print(f"Return Policy: {product.return_policy}")
print(f"Warranty: {product.warranty}")

# Verify changes
if product.title == 'Updated Product Title':
    print("\n✅ Title updated successfully")
else:
    print(f"\n❌ Title NOT updated (expected 'Updated Product Title', got '{product.title}')")

if product.sku == 'TEST-SKU-123':
    print("✅ SKU updated successfully")
else:
    print(f"❌ SKU NOT updated (expected 'TEST-SKU-123', got '{product.sku}')")

if product.brand == 'Test Brand':
    print("✅ Brand updated successfully")
else:
    print(f"❌ Brand NOT updated (expected 'Test Brand', got '{product.brand}')")

if product.stock == 50:
    print("✅ Stock updated successfully")
else:
    print(f"❌ Stock NOT updated (expected 50, got {product.stock})")

if product.status == 'Active':
    print("✅ Status updated successfully")
else:
    print(f"❌ Status NOT updated (expected 'Active', got '{product.status}')")

print("\n=== TEST COMPLETE ===")
