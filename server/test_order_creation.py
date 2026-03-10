#!/usr/bin/env python
"""
Test order creation
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from products.models import Product
from orders.serializers import OrderCreateSerializer
from rest_framework.test import APIRequestFactory

User = get_user_model()

def test_order_creation():
    print("=== Testing Order Creation ===\n")
    
    # Get or create test user
    user = User.objects.filter(username='testuser').first()
    if not user:
        user = User.objects.filter(role='Customer').first()
    
    if not user:
        print("❌ No customer user found. Please create a customer user first.")
        return
    
    print(f"✅ Using user: {user.username}")
    
    # Get first product
    product = Product.objects.first()
    if not product:
        print("❌ No products found. Please create products first.")
        return
    
    print(f"✅ Using product: {product.title} (ID: {product.id})")
    
    # Prepare order data
    order_data = {
        'shipping_full_name': 'Test User',
        'shipping_phone': '01712345678',
        'shipping_street': '123 Test Street',
        'shipping_city': 'Dhaka',
        'shipping_state': 'Dhaka',
        'shipping_zip_code': '1200',
        'shipping_country': 'Bangladesh',
        'payment_method': 'cod',
        'coupon_code': '',
        'items': [
            {
                'product_id': product.id,
                'quantity': 2,
                'color': 'Red',
                'size': 'M',
            }
        ]
    }
    
    print(f"\n📦 Order data:")
    print(f"   Items: {len(order_data['items'])}")
    print(f"   Payment: {order_data['payment_method']}")
    print(f"   Address: {order_data['shipping_city']}, {order_data['shipping_country']}")
    
    # Create mock request
    factory = APIRequestFactory()
    request = factory.post('/api/orders/')
    request.user = user
    
    # Test serializer
    try:
        serializer = OrderCreateSerializer(data=order_data, context={'request': request})
        
        if serializer.is_valid():
            print("\n✅ Serializer validation passed")
            
            # Create order
            order = serializer.save()
            print(f"\n✅ Order created successfully!")
            print(f"   Order ID: {order.order_id}")
            print(f"   Subtotal: ${order.subtotal}")
            print(f"   Shipping: ${order.shipping_cost}")
            print(f"   Total: ${order.total_amount}")
            print(f"   Items: {order.items.count()}")
            
            for item in order.items.all():
                print(f"   - {item.product_title} x{item.quantity} (${item.total_price})")
        else:
            print("\n❌ Serializer validation failed:")
            for field, errors in serializer.errors.items():
                print(f"   {field}: {errors}")
    
    except Exception as e:
        print(f"\n❌ Error creating order: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_order_creation()
