#!/usr/bin/env python3

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from products.models import Product
from products.serializers import ProductSerializer

def test_actual_cost_serializer():
    """Test if actualCost field works with the serializer"""
    
    # Get first product
    product = Product.objects.first()
    if not product:
        print("❌ No products found")
        return
    
    print(f"📦 Testing with product: {product.title}")
    print(f"🔍 Current actualCost: {product.actualCost}")
    
    # Test serializer update
    test_cost = 555.77
    data = {'actualCost': test_cost}
    
    serializer = ProductSerializer(product, data=data, partial=True)
    
    print(f"\n📝 Testing serializer update with actualCost: {test_cost}")
    print(f"✅ Serializer is valid: {serializer.is_valid()}")
    
    if not serializer.is_valid():
        print(f"❌ Serializer errors: {serializer.errors}")
        return False
    
    # Save the update
    serializer.save()
    
    # Refresh from database
    product.refresh_from_db()
    
    print(f"💾 Updated actualCost in database: {product.actualCost}")
    
    # Test serialization (reading)
    read_serializer = ProductSerializer(product)
    serialized_cost = read_serializer.data.get('actualCost')
    
    print(f"📖 Serialized actualCost: {serialized_cost}")
    
    success = str(product.actualCost) == str(test_cost) and str(serialized_cost) == str(test_cost)
    
    if success:
        print("✅ SUCCESS: actualCost field is working correctly with serializer!")
    else:
        print(f"❌ FAILED: Expected {test_cost}, got DB: {product.actualCost}, Serialized: {serialized_cost}")
    
    return success

if __name__ == "__main__":
    test_actual_cost_serializer()