from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F
from .models import Order, PaymentMethod
from .serializers import OrderSerializer, OrderCreateSerializer, PaymentMethodSerializer
from users.roles import is_admin_user

class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action == 'product_coupons':
            # Allow public access to product coupons
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        user = self.request.user
        shop_id = self.request.query_params.get('shop')
        
        if is_admin_user(user):
            queryset = Order.objects.all().prefetch_related('items', 'items__product', 'items__product__shop')
        elif user.role == 'Seller':
            # Sellers see orders that contain items from their shops
            shop_ids = user.shops.values_list('id', flat=True)
            queryset = Order.objects.filter(items__product__shop_id__in=shop_ids).distinct().prefetch_related('items', 'items__product', 'items__product__shop')
        else:
            queryset = Order.objects.filter(customer=user).prefetch_related('items', 'items__product', 'items__product__shop')
        
        # Filter by specific shop if provided
        if shop_id:
            queryset = queryset.filter(items__product__shop_id=shop_id).distinct()
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        return OrderSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        
        # Return the created order with full details
        output_serializer = OrderSerializer(order, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def validate_coupon(self, request):
        """Validate a coupon code for the current user and cart items"""
        from decimal import Decimal
        from django.utils import timezone
        from seller.models import Coupon
        
        coupon_code = request.data.get('coupon_code', '').strip().upper()
        cart_items = request.data.get('cart_items', [])  # List of {product_id, quantity}
        
        if not coupon_code:
            return Response({
                'valid': False,
                'error': 'Coupon code is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not cart_items:
            return Response({
                'valid': False,
                'error': 'Cart items are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Find the coupon
            coupon = Coupon.objects.get(
                code=coupon_code,
                is_active=True,
                expires_at__gte=timezone.now().date()
            )
            
            # Check if coupon has uses left
            if coupon.uses >= coupon.max_uses:
                return Response({
                    'valid': False,
                    'error': 'This coupon has been used up'
                })
            
            # Calculate subtotal from cart items
            from products.models import Product
            subtotal = Decimal('0')
            products = []
            
            for item in cart_items:
                try:
                    product = Product.objects.get(id=item['product_id'])
                    quantity = int(item.get('quantity', 1))
                    subtotal += product.price * quantity
                    products.append(product)
                except Product.DoesNotExist:
                    continue
            
            # Check minimum order amount
            if subtotal < coupon.min_order_amount:
                return Response({
                    'valid': False,
                    'error': f'Minimum order amount ৳{coupon.min_order_amount} required'
                })
            
            # Check coupon type eligibility
            is_eligible = False
            
            if coupon.coupon_type == 'all_products':
                is_eligible = True
            elif coupon.coupon_type == 'first_order':
                # Check if this is customer's first order
                previous_orders = Order.objects.filter(customer=request.user).count()
                is_eligible = previous_orders == 0
                if not is_eligible:
                    return Response({
                        'valid': False,
                        'error': 'This coupon is only valid for first-time customers'
                    })
            elif coupon.coupon_type == 'category':
                # Check if any product in cart belongs to coupon category
                if coupon.category:
                    for product in products:
                        # Check both category_fk (preferred) and category string
                        if (product.category_fk == coupon.category or 
                            (product.category and product.category.lower() == coupon.category.name.lower())):
                            is_eligible = True
                            break
                    if not is_eligible:
                        return Response({
                            'valid': False,
                            'error': f'This coupon is only valid for {coupon.category.name} products'
                        })
            elif coupon.coupon_type == 'specific_products':
                # Check if any product in cart is in coupon's specific products
                coupon_product_ids = set(coupon.coupon_products.values_list('product_id', flat=True))
                cart_product_ids = set(product.id for product in products)
                is_eligible = bool(coupon_product_ids.intersection(cart_product_ids))
                if not is_eligible:
                    return Response({
                        'valid': False,
                        'error': 'This coupon is not valid for the products in your cart'
                    })
            
            if not is_eligible:
                return Response({
                    'valid': False,
                    'error': 'This coupon is not applicable to your order'
                })
            
            # Calculate discount
            discount = Decimal('0')
            if coupon.discount_type == 'percent':
                discount = (subtotal * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
            elif coupon.discount_type == 'fixed':
                discount = min(coupon.discount_value, subtotal)  # Don't exceed order total
            elif coupon.discount_type == 'shipping':
                discount = Decimal('0')  # Will be applied to shipping cost
            
            return Response({
                'valid': True,
                'coupon': {
                    'code': coupon.code,
                    'discount_type': coupon.discount_type,
                    'discount_value': float(coupon.discount_value),
                    'discount_amount': float(discount),
                    'coupon_type': coupon.coupon_type
                }
            })
            
        except Coupon.DoesNotExist:
            return Response({
                'valid': False,
                'error': 'Invalid coupon code'
            })
        except Exception as e:
            return Response({
                'valid': False,
                'error': 'An error occurred while validating the coupon'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def product_coupons(self, request):
        """Get available coupons for a specific product"""
        from django.utils import timezone
        from seller.models import Coupon
        from products.models import Product
        
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({
                'error': 'Product ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({
                'error': 'Product not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all active coupons that are applicable to this product
        applicable_coupons = []
        
        # Get all active coupons
        active_coupons = Coupon.objects.filter(
            is_active=True,
            expires_at__gte=timezone.now().date(),
            uses__lt=F('max_uses')
        ).select_related('category').prefetch_related('coupon_products')
        
        for coupon in active_coupons:
            is_applicable = False
            
            if coupon.coupon_type == 'all_products':
                is_applicable = True
            elif coupon.coupon_type == 'first_order':
                # Show to all users, but will be validated at checkout
                is_applicable = True
            elif coupon.coupon_type == 'category':
                if coupon.category:
                    # Check if product belongs to this category
                    if (product.category_fk == coupon.category or 
                        (product.category and product.category.lower() == coupon.category.name.lower())):
                        is_applicable = True
            elif coupon.coupon_type == 'specific_products':
                # Check if this product is in the coupon's specific products
                if coupon.coupon_products.filter(product=product).exists():
                    is_applicable = True
            
            if is_applicable:
                # Calculate potential discount for display
                discount_text = ""
                if coupon.discount_type == 'percent':
                    discount_text = f"{coupon.discount_value}% OFF"
                elif coupon.discount_type == 'fixed':
                    discount_text = f"৳{coupon.discount_value} OFF"
                elif coupon.discount_type == 'shipping':
                    discount_text = "FREE SHIPPING"
                
                applicable_coupons.append({
                    'id': coupon.id,
                    'code': coupon.code,
                    'discount_type': coupon.discount_type,
                    'discount_value': float(coupon.discount_value),
                    'discount_text': discount_text,
                    'coupon_type': coupon.coupon_type,
                    'min_order_amount': float(coupon.min_order_amount),
                    'expires_at': coupon.expires_at.isoformat(),
                    'uses': coupon.uses,
                    'max_uses': coupon.max_uses,
                    'remaining_uses': coupon.max_uses - coupon.uses
                })
        
        return Response({
            'coupons': applicable_coupons,
            'count': len(applicable_coupons)
        })

    def partial_update(self, request, *args, **kwargs):
        # Allowing sellers/admins to update status
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    @action(detail=True, methods=['patch'])
    def cancel(self, request, pk=None):
        """Allow customers to cancel their own pending orders"""
        order = self.get_object()
        
        # Check if the user is the order owner
        if order.customer != request.user:
            return Response(
                {'detail': 'You can only cancel your own orders.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if order can be cancelled (only pending orders)
        if order.status != 'pending':
            return Response(
                {'detail': f'Cannot cancel order with status "{order.status}". Only pending orders can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update order status to cancelled
        order.status = 'cancelled'
        order.save(update_fields=['status'])
        
        # Return updated order
        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_customer_payment_setting(self):
        from django.db.models import Q
        from seller.models import PaymentMethodSetting

        # Prefer admin-level settings for checkout visibility.
        admin_setting = (
            PaymentMethodSetting.objects
            .filter(Q(seller__role='Admin') | Q(seller__is_superuser=True))
            .order_by('-updated_at', '-id')
            .first()
        )
        if admin_setting:
            return admin_setting

        # Fallback to latest available seller setting.
        return PaymentMethodSetting.objects.order_by('-updated_at', '-id').first()
    
    def get_queryset(self):
        user = self.request.user
        
        if is_admin_user(user):
            # Admin sees global payment methods
            return PaymentMethod.objects.filter(shop__isnull=True)
        elif user.role == 'Seller':
            # Sellers see their shop's payment methods
            shop_ids = user.shops.values_list('id', flat=True)
            return PaymentMethod.objects.filter(shop_id__in=shop_ids)
        else:
            # Customers see global payment methods (read-only)
            return PaymentMethod.objects.filter(shop__isnull=True)
    
    def list(self, request, *args, **kwargs):
        """Get payment methods configuration"""
        from seller.models import PaymentMethodSetting
        from seller.serializers import PaymentMethodSettingSerializer
        from users.models import CustomUser
        
        # Admin reads/writes its own global setting.
        if is_admin_user(request.user):
            payment_methods, created = PaymentMethodSetting.objects.get_or_create(
                seller=request.user,
                defaults={
                    'cash_on_delivery': True,
                    'bkash': True,
                    'nagad': True,
                    'credit_card': True,
                }
            )
            serializer = PaymentMethodSettingSerializer(payment_methods)
            return Response(serializer.data)

        # Customers get the global checkout setting (admin-preferred).
        if request.user.role == 'Customer':
            payment_methods = self._get_customer_payment_setting()
            if not payment_methods:
                admin_user = CustomUser.objects.filter(role='Admin').order_by('id').first()
                seller_user = CustomUser.objects.filter(role='Seller').order_by('id').first()
                owner = admin_user or seller_user
                if owner:
                    payment_methods, created = PaymentMethodSetting.objects.get_or_create(
                        seller=owner,
                        defaults={
                            'cash_on_delivery': True,
                            'bkash': True,
                            'nagad': True,
                            'credit_card': True,
                        }
                    )
                else:
                    # Return default if no sellers/admins exist yet.
                    return Response({
                        'cash_on_delivery': True,
                        'bkash': True,
                        'nagad': True,
                        'credit_card': True,
                    })

            serializer = PaymentMethodSettingSerializer(payment_methods)
            return Response(serializer.data)
        
        # For sellers, return their payment methods
        payment_methods, created = PaymentMethodSetting.objects.get_or_create(
            seller=request.user,
            defaults={
                'cash_on_delivery': True,
                'bkash': True,
                'nagad': True,
                'credit_card': True,
            }
        )
        serializer = PaymentMethodSettingSerializer(payment_methods)
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """Update payment methods configuration"""
        user = request.user
        
        # Only sellers and admins can update
        if user.role == 'Customer':
            return Response(
                {'detail': 'You do not have permission to update payment methods.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get or create payment methods
        if is_admin_user(user):
            payment_methods, created = PaymentMethod.objects.get_or_create(shop__isnull=True)
        elif user.role == 'Seller':
            # Get the first shop for this seller
            shop = user.shops.first()
            if not shop:
                return Response(
                    {'detail': 'No shop found for this seller.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            payment_methods, created = PaymentMethod.objects.get_or_create(shop=shop)
        else:
            return Response(
                {'detail': 'Invalid user role.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(payment_methods, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def toggle(self, request):
        """Toggle a specific payment method on/off"""
        from seller.models import PaymentMethodSetting
        
        user = request.user
        
        # Check if user is authenticated
        if not user.is_authenticated:
            return Response(
                {'detail': 'Authentication required.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Only sellers and admins can toggle
        user_role = getattr(user, 'role', None)
        if not (is_admin_user(user) or user_role == 'Seller'):
            return Response(
                {'detail': f'You do not have permission to update payment methods. Role: {user_role}'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get or create payment method settings for this seller/admin
        payment_methods, created = PaymentMethodSetting.objects.get_or_create(seller=user)
        
        # Update the specific field
        for key, value in request.data.items():
            if hasattr(payment_methods, key):
                setattr(payment_methods, key, value)
        
        payment_methods.save()
        
        from seller.serializers import PaymentMethodSettingSerializer
        serializer = PaymentMethodSettingSerializer(payment_methods)
        return Response(serializer.data)



class ReturnRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        from .models import ReturnRequest
        user = self.request.user
        shop_id = self.request.query_params.get('shop')
        
        if is_admin_user(user):
            queryset = ReturnRequest.objects.all().select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
        elif user.role == 'Seller':
            # Sellers see return requests for orders containing their products
            shop_ids = list(user.shops.values_list('id', flat=True))
            
            if shop_id:
                # Filter by specific shop
                queryset = ReturnRequest.objects.filter(
                    order__items__product__shop_id=shop_id
                ).distinct().select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
            elif shop_ids:
                # Show all return requests for orders with seller's products
                queryset = ReturnRequest.objects.filter(
                    order__items__product__shop_id__in=shop_ids
                ).distinct().select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
            else:
                # No shops, return empty queryset
                queryset = ReturnRequest.objects.none()
        else:
            # Customers see their own return requests
            queryset = ReturnRequest.objects.filter(
                order__customer=user
            ).select_related('order').prefetch_related('items', 'items__order_item', 'items__order_item__product')
        
        return queryset
    
    def get_serializer_class(self):
        from .serializers import ReturnRequestSerializer, ReturnRequestCreateSerializer
        if self.action == 'create':
            return ReturnRequestCreateSerializer
        return ReturnRequestSerializer
    
    def create(self, request, *args, **kwargs):
        from .serializers import ReturnRequestSerializer
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return_request = serializer.save()
        
        # Return the created return request with full details
        output_serializer = ReturnRequestSerializer(return_request, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update return request status (seller/admin only)"""
        from .serializers import ReturnRequestSerializer
        
        if request.user.role not in ['Seller', 'Admin'] and not is_admin_user(request.user):
            return Response(
                {'detail': 'Only sellers and admins can update return request status.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return_request = self.get_object()
        new_status = request.data.get('status')
        admin_note = request.data.get('admin_note', '')
        refund_amount = request.data.get('refund_amount')
        
        if new_status not in ['pending', 'approved', 'rejected', 'refunded']:
            return Response(
                {'detail': 'Invalid status value.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return_request.status = new_status
        if admin_note:
            return_request.admin_note = admin_note
        if refund_amount is not None:
            return_request.refund_amount = refund_amount
        return_request.save()
        
        serializer = ReturnRequestSerializer(return_request, context={'request': request})
        return Response(serializer.data)
