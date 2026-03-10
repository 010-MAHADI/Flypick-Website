from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer, AddToCartSerializer, UpdateCartItemSerializer
from products.models import Product


class CartViewSet(viewsets.ViewSet):
    """
    ViewSet for managing user shopping cart
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get user's cart with all items"""
        cart, created = Cart.objects.get_or_create(user=request.user)
        serializer = CartSerializer(cart)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def add(self, request):
        """Add item to cart"""
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        product_id = serializer.validated_data['product_id']
        quantity = serializer.validated_data.get('quantity', 1)
        color = serializer.validated_data.get('color')
        size = serializer.validated_data.get('size')
        shipping_type = serializer.validated_data.get('shipping_type')
        
        # Get or create cart
        cart, created = Cart.objects.get_or_create(user=request.user)
        
        # Get product
        product = get_object_or_404(Product, id=product_id)
        
        # Check if item already exists with same variants
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            color=color or '',
            size=size or '',
            defaults={
                'quantity': quantity,
                'shipping_type': shipping_type or ''
            }
        )
        
        if not created:
            # Update existing item
            cart_item.quantity += quantity
            if shipping_type:
                cart_item.shipping_type = shipping_type
            cart_item.save()
        
        return Response(
            CartItemSerializer(cart_item).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['patch'])
    def update_item(self, request):
        """Update cart item (quantity, selected status, variants)"""
        item_id = request.data.get('item_id')
        if not item_id:
            return Response({'error': 'item_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        cart = get_object_or_404(Cart, user=request.user)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Update fields if provided
        if 'quantity' in serializer.validated_data:
            quantity = serializer.validated_data['quantity']
            if quantity == 0:
                cart_item.delete()
                return Response({'message': 'Item removed from cart'}, status=status.HTTP_200_OK)
            cart_item.quantity = quantity
        
        if 'selected' in serializer.validated_data:
            cart_item.selected = serializer.validated_data['selected']
        
        if 'color' in serializer.validated_data:
            cart_item.color = serializer.validated_data['color']
        
        if 'size' in serializer.validated_data:
            cart_item.size = serializer.validated_data['size']
        
        if 'shipping_type' in serializer.validated_data:
            cart_item.shipping_type = serializer.validated_data['shipping_type']
        
        cart_item.save()
        return Response(CartItemSerializer(cart_item).data)
    
    @action(detail=False, methods=['delete'])
    def remove_item(self, request):
        """Remove item from cart"""
        item_id = request.query_params.get('item_id')
        if not item_id:
            return Response({'error': 'item_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        cart = get_object_or_404(Cart, user=request.user)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        cart_item.delete()
        
        return Response({'message': 'Item removed from cart'}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'])
    def select_all(self, request):
        """Select or deselect all items"""
        selected = request.data.get('selected', True)
        cart = get_object_or_404(Cart, user=request.user)
        cart.items.all().update(selected=selected)
        
        return Response({'message': f'All items {"selected" if selected else "deselected"}'})
    
    @action(detail=False, methods=['post'])
    def clear(self, request):
        """Clear all items from cart"""
        cart = get_object_or_404(Cart, user=request.user)
        cart.items.all().delete()
        
        return Response({'message': 'Cart cleared'}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def selected(self, request):
        """Get only selected items"""
        cart = get_object_or_404(Cart, user=request.user)
        selected_items = cart.items.filter(selected=True)
        serializer = CartItemSerializer(selected_items, many=True)
        
        total = sum(item.total_price for item in selected_items)
        count = sum(item.quantity for item in selected_items)
        
        return Response({
            'items': serializer.data,
            'total': total,
            'count': count
        })
