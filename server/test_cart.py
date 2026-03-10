#!/usr/bin/env python
"""
Test cart functionality from Django shell
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from cart.models import Cart, CartItem
from products.models import Product

User = get_user_model()

def test_cart():
    print("=== Testing Cart Functionality ===\n")
    
    # Get or create test user
    user, created = User.objects.get_or_create(
        username='testuser',
        defaults={'email': 'test@example.com'}
    )
    if created:
        user.set_password('testpass123')
        user.save()
        print(f"✅ Created test user: {user.username}")
    else:
        print(f"✅ Using existing user: {user.username}")
    
    # Get or create cart
    cart, created = Cart.objects.get_or_create(user=user)
    print(f"✅ Cart {'created' if created else 'retrieved'}: {cart}")
    
    # Get first product
    product = Product.objects.first()
    if not product:
        print("❌ No products found. Please create products first.")
        return
    
    print(f"✅ Using product: {product.title}")
    
    # Add item to cart
    cart_item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        color='Red',
        size='M',
        defaults={'quantity': 2}
    )
    
    if not created:
        cart_item.quantity += 2
        cart_item.save()
    
    print(f"✅ Cart item {'created' if created else 'updated'}: {cart_item}")
    print(f"   Quantity: {cart_item.quantity}")
    print(f"   Total price: ${cart_item.total_price}")
    
    # Display cart summary
    print(f"\n📊 Cart Summary:")
    print(f"   Total items: {cart.total_items}")
    print(f"   Total price: ${cart.total_price}")
    print(f"   Items in cart:")
    for item in cart.items.all():
        print(f"   - {item.product.title} x{item.quantity} (${item.total_price})")
        if item.color:
            print(f"     Color: {item.color}")
        if item.size:
            print(f"     Size: {item.size}")
        print(f"     Selected: {item.selected}")
    
    print("\n✅ Cart test completed successfully!")

if __name__ == '__main__':
    test_cart()
