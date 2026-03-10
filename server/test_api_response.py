#!/usr/bin/env python
"""Test script to verify API response after update"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from products.models import Product
from products.serializers import ProductSerializer
from rest_framework.test import APIRequestFactory

# Get the first product
product = Product.objects.first()
if not product:
    print("No products found in database")
    exit(1)

# Create a mock request for the serializer context
factory = APIRequestFactory()
request = factory.get('/')

# Serialize the product
serializer = ProductSerializer(product, context={'request': request})
data = serializer.data

print("\n=== API RESPONSE DATA ===")
import json
print(json.dumps(data, indent=2, default=str))

print("\n=== FIELD VERIFICATION ===")
print(f"Title: {data.get('title')}")
print(f"SKU: {data.get('sku')}")
print(f"Brand: {data.get('brand')}")
print(f"Barcode: {data.get('barcode')}")
print(f"Description: {data.get('description')}")
print(f"Short Description: {data.get('short_description')}")
print(f"Stock: {data.get('stock')}")
print(f"Status: {data.get('status')}")
print(f"Weight: {data.get('weight')}")
print(f"Weight Unit: {data.get('weight_unit')}")
print(f"Return Policy: {data.get('return_policy')}")
print(f"Warranty: {data.get('warranty')}")
print(f"Meta Title: {data.get('meta_title')}")
print(f"Meta Description: {data.get('meta_description')}")
print(f"Is Featured: {data.get('is_featured')}")
