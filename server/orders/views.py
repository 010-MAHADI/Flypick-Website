from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from django.db.models import F
from .models import Order, PaymentMethod, Refund
from .serializers import (
    OrderSerializer, OrderCreateSerializer, OrderStatusHistorySerializer,
    PaymentMethodSerializer, RefundSerializer, WalletTransactionSerializer,
)
from .lifecycle import (
    allowed_next_statuses, create_refund, customer_cancellable_statuses,
    record_status, transition_order, transition_refund, wallet_balance,
)
from users.roles import is_admin_user


def _seller_can_manage_order(user, order):
    """A seller may act on an order when it contains items from their shops."""
    shop_ids = set(user.shops.values_list('id', flat=True))
    return any(
        item.product and item.product.shop_id in shop_ids
        for item in order.items.all()
    )


def _can_manage_order(user, order):
    return is_admin_user(user) or (
        getattr(user, 'role', '') == 'Seller' and _seller_can_manage_order(user, order)
    )

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
        # Status changes always go through the lifecycle service so the
        # legacy seller UI (bare PATCH {status}) gets validation + audit too.
        new_status = request.data.get('status')
        if new_status:
            order = self.get_object()
            if new_status != order.status:
                if not _can_manage_order(request.user, order):
                    return Response(
                        {'detail': 'Only sellers and admins can update order status.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                transition_order(order, new_status, actor=request.user,
                                 note=request.data.get('note', ''))
            remaining = {k: v for k, v in request.data.items() if k not in ('status', 'note')}
            if not remaining:
                return Response(OrderSerializer(order, context={'request': request}).data)
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['patch'])
    def cancel(self, request, pk=None):
        """Customer cancellation with reason. Auto-approved before shipment
        (configurable via ORDER_CANCELLABLE_STATUSES); paid orders open a
        refund case automatically."""
        order = self.get_object()

        if order.customer != request.user and not is_admin_user(request.user):
            return Response(
                {'detail': 'You can only cancel your own orders.'},
                status=status.HTTP_403_FORBIDDEN
            )

        cancellable = customer_cancellable_statuses()
        if order.status not in cancellable and not is_admin_user(request.user):
            return Response(
                {'detail': f'Cannot cancel an order that is already "{order.get_status_display()}". '
                           'Please request a return after delivery instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = (request.data.get('reason') or 'Cancelled by customer').strip()
        transition_order(order, 'cancelled', actor=request.user, note=reason)

        # Paid orders get their money back through the refund workflow
        refund = None
        if order.payment_status == 'paid' and order.total_amount > 0:
            refund = create_refund(
                order, order.total_amount,
                method='original', refund_type='full',
                reason=f'Order cancelled: {reason}'[:255],
                requested_by=request.user,
                note='Automatically opened on cancellation of a paid order',
            )
        # Money paid from store credit always returns instantly
        if order.store_credit_used and order.store_credit_used > 0:
            credit_back = create_refund(
                order, order.store_credit_used,
                method='store_credit', refund_type='partial' if refund else 'full',
                reason='Store credit returned after cancellation',
                requested_by=request.user,
                initial_status='requested',
            )
            transition_refund(credit_back, 'approved', actor=request.user,
                              note='Auto-approved store credit return')
            transition_refund(credit_back, 'completed', actor=request.user)

        serializer = OrderSerializer(order, context={'request': request})
        data = serializer.data
        if refund:
            data['refund_id'] = refund.refund_id
        return Response(data)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Seller/admin fulfilment workflow: move an order forward through
        the lifecycle, optionally attaching tracking details."""
        order = self.get_object()
        if not _can_manage_order(request.user, order):
            return Response(
                {'detail': 'Only sellers and admins can update order status.'},
                status=status.HTTP_403_FORBIDDEN
            )

        new_status = request.data.get('status')
        note = request.data.get('note', '')
        if not new_status:
            return Response({'detail': 'status is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Same status + a note = a tracking note on the timeline, not a
        # transition. Lets sellers post updates without changing the status.
        if new_status == order.status:
            if not note:
                return Response({'detail': 'Add a note or pick a different status.'},
                                status=status.HTTP_400_BAD_REQUEST)
            tracking_number = request.data.get('tracking_number')
            if tracking_number:
                order.tracking_number = tracking_number[:100]
                order.save(update_fields=['tracking_number', 'updated_at'])
            record_status(order, order.status, order.status, actor=request.user, note=note)
            return Response(OrderSerializer(order, context={'request': request}).data)

        estimated = request.data.get('estimated_delivery_date') or None
        transition_order(
            order, new_status, actor=request.user,
            note=note,
            tracking_number=request.data.get('tracking_number'),
            courier_name=request.data.get('courier_name'),
            estimated_delivery_date=estimated,
        )
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Seller/admin records an offline payment (e.g. COD collected)."""
        order = self.get_object()
        if not _can_manage_order(request.user, order):
            return Response({'detail': 'Only sellers and admins can record payments.'},
                            status=status.HTTP_403_FORBIDDEN)
        if order.payment_status == 'paid':
            return Response({'detail': 'This order is already marked as paid.'},
                            status=status.HTTP_400_BAD_REQUEST)

        method = (request.data.get('payment_method') or order.payment_method or 'cod').strip()
        note = (request.data.get('note') or '').strip()
        order.payment_status = 'paid'
        order.payment_method = method[:50]
        order.save(update_fields=['payment_status', 'payment_method', 'updated_at'])
        record_status(
            order, order.status, order.status, actor=request.user,
            note=f'Payment received via {method}' + (f' — {note}' if note else ''),
        )
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Full tracking view: status history + shipment info + next steps."""
        order = self.get_object()
        if order.customer != request.user and not _can_manage_order(request.user, order):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

        history = OrderStatusHistorySerializer(order.status_history.all(), many=True).data
        return Response({
            'order_id': order.order_id,
            'status': order.status,
            'tracking_number': order.tracking_number,
            'courier_name': order.courier_name,
            'estimated_delivery_date': order.estimated_delivery_date,
            'history': history,
            'allowed_next_statuses': sorted(allowed_next_statuses(order.status))
                if _can_manage_order(request.user, order) else [],
        })


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
        """Review a return request (seller/admin): approve, reject or ask the
        customer for more information. Approval opens a refund case."""
        from .serializers import ReturnRequestSerializer
        from notifications.services import NotificationService

        if request.user.role not in ['Seller', 'Admin'] and not is_admin_user(request.user):
            return Response(
                {'detail': 'Only sellers and admins can update return request status.'},
                status=status.HTTP_403_FORBIDDEN
            )

        from decimal import Decimal, InvalidOperation

        return_request = self.get_object()
        new_status = request.data.get('status')
        admin_note = request.data.get('admin_note', '')
        refund_amount = request.data.get('refund_amount')
        if refund_amount is not None:
            try:
                refund_amount = Decimal(str(refund_amount))
            except InvalidOperation:
                return Response({'detail': 'Invalid refund amount.'}, status=status.HTTP_400_BAD_REQUEST)
        # Prefer the method the customer chose when filing the return
        refund_method = request.data.get('refund_method') or return_request.refund_method or 'original'

        if new_status not in ['pending', 'info_requested', 'approved', 'rejected', 'refunded']:
            return Response(
                {'detail': 'Invalid status value.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        previous_status = return_request.status
        return_request.status = new_status
        if admin_note:
            return_request.admin_note = admin_note
        if refund_amount is not None:
            return_request.refund_amount = refund_amount
        return_request.save()

        refund = None
        if new_status == 'refunded' and previous_status != 'refunded':
            # Legacy seller flow: marking the return "refunded" completes the
            # linked refund case (creating one first if it doesn't exist).
            order = return_request.order
            amount = return_request.refund_amount or order.total_amount
            open_refund = return_request.refunds.exclude(status__in=['rejected', 'completed']).first()
            if not open_refund and not return_request.refunds.filter(status='completed').exists():
                open_refund = create_refund(
                    order, amount,
                    method=refund_method if refund_method in ('original', 'store_credit', 'manual') else 'original',
                    refund_type='full' if amount >= order.total_amount else 'partial',
                    reason=f'Return {return_request.return_id} refunded',
                    requested_by=order.customer,
                    return_request=return_request,
                    initial_status='approved',
                )
            if open_refund:
                if open_refund.status in ('requested', 'under_review'):
                    transition_refund(open_refund, 'approved', actor=request.user, note=admin_note)
                if open_refund.status == 'approved':
                    transition_refund(open_refund, 'processing', actor=request.user)
                if open_refund.status == 'processing':
                    transition_refund(open_refund, 'completed', actor=request.user,
                                      note='Refund processed from return request')

        if new_status == 'approved' and previous_status != 'approved':
            # Open a refund case for the agreed amount
            order = return_request.order
            amount = return_request.refund_amount or order.total_amount
            if not return_request.refunds.exclude(status='rejected').exists():
                refund = create_refund(
                    order, amount,
                    method=refund_method if refund_method in ('original', 'store_credit', 'manual') else 'original',
                    refund_type='full' if amount >= order.total_amount else 'partial',
                    reason=f'Return {return_request.return_id} approved',
                    requested_by=order.customer,
                    return_request=return_request,
                    initial_status='approved',
                    note=admin_note or 'Return approved',
                )
            try:
                transition_order(order, 'returned', actor=request.user,
                                 note=f'Return {return_request.return_id} approved')
            except DRFValidationError:
                pass  # order may not be in a returnable status anymore

        # Notify the customer about the review outcome
        try:
            messages = {
                'info_requested': ('More information needed',
                                   f'We need more details about your return {return_request.return_id}. '
                                   + (admin_note or 'Please contact support.')),
                'approved': ('Return approved',
                             f'Your return {return_request.return_id} was approved. A refund is being processed.'),
                'rejected': ('Return rejected',
                             f'Your return {return_request.return_id} was rejected. '
                             + (admin_note or 'Contact support for details.')),
            }
            if new_status in messages and new_status != previous_status:
                title, message = messages[new_status]
                NotificationService.create_notification(
                    user=return_request.order.customer,
                    title=title, message=message,
                    notification_type='system', priority='high',
                    order_id=return_request.order.order_id,
                    action_url='/returns', action_text='View Returns',
                )
        except Exception:
            pass

        serializer = ReturnRequestSerializer(return_request, context={'request': request})
        data = serializer.data
        if refund:
            data['refund_id'] = refund.refund_id
        return Response(data)


class RefundViewSet(viewsets.ReadOnlyModelViewSet):
    """Refund cases: customers see their own, sellers see their shops',
    admins see everything. Status moves via the ``transition`` action."""
    serializer_class = RefundSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = Refund.objects.select_related('order').prefetch_related('events')
        if is_admin_user(user):
            return base
        if getattr(user, 'role', '') == 'Seller':
            shop_ids = user.shops.values_list('id', flat=True)
            return base.filter(order__items__product__shop_id__in=shop_ids).distinct()
        return base.filter(order__customer=user)

    def create(self, request, *args, **kwargs):
        """Create a refund.

        - Customers: opens a refund *request* for their own paid order
          (reviewed by the seller before any money moves).
        - Sellers/admins: processes a refund directly (full or partial) —
          the case is created, approved and completed in one step, moving
          store credit / marking the order refunded immediately.
        """
        from decimal import Decimal, InvalidOperation

        order_id = request.data.get('order_id')
        reason = (request.data.get('reason') or '').strip()
        method = request.data.get('method', 'original')
        if method not in ('original', 'store_credit', 'manual'):
            method = 'original'
        is_manager = is_admin_user(request.user) or getattr(request.user, 'role', '') == 'Seller'

        if not reason:
            return Response({'detail': 'Please provide a reason for the refund.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # ---------- seller / admin: process a refund now ----------
        if is_manager:
            order = Order.objects.filter(order_id=order_id).first()
            if not order or not _can_manage_order(request.user, order):
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

            try:
                amount = Decimal(str(request.data.get('amount') or order.total_amount))
            except InvalidOperation:
                return Response({'detail': 'Invalid refund amount.'}, status=status.HTTP_400_BAD_REQUEST)

            from django.db.models import Sum
            already_refunded = (
                order.refunds.filter(status='completed').aggregate(total=Sum('amount'))['total']
                or Decimal('0')
            )
            refundable = order.total_amount - already_refunded
            if amount <= 0 or amount > refundable:
                return Response(
                    {'detail': f'Refund amount must be between 0 and {refundable} '
                               '(order total minus already-refunded amounts).'},
                    status=status.HTTP_400_BAD_REQUEST)

            refund_type = 'full' if amount >= refundable and already_refunded == 0 else 'partial'
            refund = create_refund(
                order, amount, method=method, refund_type=refund_type,
                reason=reason, requested_by=request.user,
                initial_status='approved',
                note=f'Initiated by {"admin" if is_admin_user(request.user) else "seller"}',
            )
            transition_refund(refund, 'processing', actor=request.user)
            transition_refund(refund, 'completed', actor=request.user,
                              note=(request.data.get('note') or '').strip())
            return Response(RefundSerializer(refund).data, status=status.HTTP_201_CREATED)

        # ---------- customer: open a refund request ----------
        try:
            order = Order.objects.get(order_id=order_id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.payment_status != 'paid':
            return Response({'detail': 'Refunds can only be requested for paid orders.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if order.refunds.exclude(status='rejected').exists():
            return Response({'detail': 'A refund for this order is already in progress.'},
                            status=status.HTTP_400_BAD_REQUEST)

        refund = create_refund(
            order, order.total_amount,
            method=method if method in ('original', 'store_credit') else 'original',
            refund_type='full', reason=reason, requested_by=request.user,
        )
        return Response(RefundSerializer(refund).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        """Move a refund through its workflow (seller/admin only)."""
        if request.user.role not in ['Seller', 'Admin'] and not is_admin_user(request.user):
            return Response({'detail': 'Only sellers and admins can process refunds.'},
                            status=status.HTTP_403_FORBIDDEN)
        refund = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response({'detail': 'status is required.'}, status=status.HTTP_400_BAD_REQUEST)
        transition_refund(refund, new_status, actor=request.user,
                          note=request.data.get('note', ''))
        return Response(RefundSerializer(refund).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def wallet_view(request):
    """The customer's store-credit balance and full transaction history."""
    transactions = request.user.wallet_transactions.select_related('order', 'refund')[:50]
    return Response({
        'balance': str(wallet_balance(request.user)),
        'transactions': WalletTransactionSerializer(transactions, many=True).data,
    })
