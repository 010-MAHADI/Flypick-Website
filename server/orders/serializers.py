from rest_framework import serializers
from django.utils import timezone
from .models import (
    Order, OrderItem, OrderStatusHistory, PaymentMethod,
    Refund, RefundEvent, ReturnRequest, ReturnItem, WalletTransaction,
)
from products.serializers import ProductSerializer
from decimal import Decimal


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = ['id', 'from_status', 'to_status', 'note', 'changed_by_name', 'created_at']

    def get_changed_by_name(self, obj):
        user = obj.changed_by
        if not user:
            return 'System'
        role = getattr(user, 'role', '')
        if role in ('Admin', 'Seller') or user.is_superuser:
            return 'Seller' if role == 'Seller' else 'Flypick'
        return 'You'


class RefundEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefundEvent
        fields = ['id', 'from_status', 'to_status', 'note', 'created_at']


class RefundSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True)
    customer_name = serializers.CharField(source='order.shipping_full_name', read_only=True)
    payment_method = serializers.CharField(source='order.payment_method', read_only=True)
    settlement_owner = serializers.CharField(read_only=True)
    settlement_proof_url = serializers.SerializerMethodField()
    settled_by_email = serializers.CharField(source='settled_by.email', read_only=True, default=None)
    events = RefundEventSerializer(many=True, read_only=True)

    class Meta:
        model = Refund
        fields = ['id', 'refund_id', 'order', 'order_id', 'customer_name', 'return_request',
                  'amount', 'refund_type', 'method', 'status', 'reason', 'origin',
                  'payment_method', 'settlement_owner', 'settlement_transaction_id',
                  'settlement_proof_url', 'settlement_note', 'settled_by_email', 'settled_at',
                  'events', 'created_at', 'updated_at']
        read_only_fields = fields

    def get_settlement_proof_url(self, obj):
        if not obj.settlement_proof:
            return None
        request = self.context.get('request')
        url = obj.settlement_proof.url
        return request.build_absolute_uri(url) if request else url


class WalletTransactionSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True, default=None)
    refund_id = serializers.CharField(source='refund.refund_id', read_only=True, default=None)

    class Meta:
        model = WalletTransaction
        fields = ['id', 'amount', 'source', 'note', 'order_id', 'refund_id',
                  'balance_after', 'created_at']

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'cash_on_delivery', 'bkash', 'nagad', 'credit_card', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class OrderItemSerializer(serializers.ModelSerializer):
    product_details = serializers.SerializerMethodField()
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_title', 'product_image', 'product_image_url',
            'color', 'size', 'shipping_type', 'shipping_charge',
            'shipping_estimated_delivery', 'quantity', 'price', 'total_price',
            'product_details'
        ]
        read_only_fields = ['id', 'total_price']
    
    def get_product_details(self, obj):
        if not obj.product:
            return None

        try:
            return ProductSerializer(obj.product, context=self.context).data
        except Exception:
            # Keep orders list/detail usable even if current product metadata is malformed.
            return {
                'id': obj.product_id,
                'title': obj.product_title,
                'image_url': self.get_product_image_url(obj),
            }

    def get_product_image_url(self, obj):
        """Return full URL for the product image"""
        if obj.product and obj.product.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.product.image.url)
            return obj.product.image.url
        elif obj.product_image:
            # If product is deleted but we have the image path
            request = self.context.get('request')
            if request:
                from django.conf import settings
                return request.build_absolute_uri(settings.MEDIA_URL + obj.product_image)
            return obj.product_image
        return None


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    color = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    size = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shipping_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_name = serializers.SerializerMethodField()  # Use shipping_full_name instead of username
    subtotal = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_id', 'customer', 'customer_email', 'customer_name',
            'shipping_full_name', 'shipping_phone', 'shipping_street', 'shipping_city',
            'shipping_state', 'shipping_zip_code', 'shipping_country',
            'payment_method', 'payment_status',
            'subtotal', 'shipping_cost', 'shipping_method',
            'shipping_estimated_delivery', 'discount', 'coupon_code',
            'store_credit_used', 'total_amount',
            'status', 'order_notes', 'delivery_instructions',
            'tracking_number', 'courier_name', 'estimated_delivery_date',
            'cancellation_reason',
            'created_at', 'updated_at', 'items'
        ]
        read_only_fields = ['id', 'order_id', 'customer', 'store_credit_used',
                            'cancellation_reason', 'created_at', 'updated_at']

    def get_customer_name(self, obj):
        """Return the full name from shipping address instead of username"""
        return obj.shipping_full_name or (obj.customer.username if obj.customer else "Guest")

    def _request_user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None)

    def _requested_shop_id(self):
        request = self.context.get('request')
        if not request:
            return None
        return request.query_params.get('shop')

    def _is_seller_request(self):
        user = self._request_user()
        return bool(
            user
            and user.is_authenticated
            and getattr(user, 'role', '') == 'Seller'
        )

    def _is_scoped_request(self):
        return bool(self._requested_shop_id() or self._is_seller_request())

    def _get_visible_items(self, obj):
        items = list(obj.items.all())
        requested_shop_id = self._requested_shop_id()
        if requested_shop_id:
            items = [
                item for item in items
                if item.product and str(item.product.shop_id) == str(requested_shop_id)
            ]
        elif self._is_seller_request():
            user = self._request_user()
            items = [
                item for item in items
                if item.product and item.product.shop and item.product.shop.seller_id == user.id
            ]
        return items

    def get_items(self, obj):
        queryset = self._get_visible_items(obj)
        return OrderItemSerializer(queryset, many=True, context=self.context).data

    def _get_seller_items_total(self, obj):
        total = Decimal('0')
        for item in self._get_visible_items(obj):
            total += item.price * item.quantity
        return total

    def get_subtotal(self, obj):
        if self._is_scoped_request():
            return self._get_seller_items_total(obj)
        return obj.subtotal

    def get_total_amount(self, obj):
        if self._is_scoped_request():
            # For shop/seller scoped views, only include the visible item totals.
            return self._get_seller_items_total(obj)
        return obj.total_amount


class OrderCreateSerializer(serializers.Serializer):
    # Shipping address
    shipping_full_name = serializers.CharField(max_length=200)
    shipping_phone = serializers.CharField(max_length=20)
    shipping_street = serializers.CharField()
    shipping_city = serializers.CharField(max_length=100)
    shipping_state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    shipping_zip_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    shipping_country = serializers.CharField(max_length=100, default='Bangladesh')
    
    # Payment
    payment_method = serializers.CharField(max_length=50)
    
    # Items
    items = OrderItemCreateSerializer(many=True)

    # Optional
    coupon_code = serializers.CharField(max_length=50, required=False, allow_blank=True)
    order_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    delivery_instructions = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    # Redeem available store credit against the order total
    use_store_credit = serializers.BooleanField(required=False, default=False)

    def _get_checkout_payment_config(self):
        from django.db.models import Q
        from seller.models import PaymentMethodSetting

        # Prefer admin/global payment settings for customer checkout.
        admin_config = (
            PaymentMethodSetting.objects
            .filter(Q(seller__role='Admin') | Q(seller__is_superuser=True))
            .order_by('-updated_at', '-id')
            .first()
        )
        if admin_config:
            return admin_config

        # Fallback to the most recently updated seller setting.
        seller_config = PaymentMethodSetting.objects.order_by('-updated_at', '-id').first()
        if seller_config:
            return seller_config

        # Legacy fallback for older deployments using orders.PaymentMethod.
        return PaymentMethod.objects.filter(shop__isnull=True).order_by('-updated_at', '-id').first()
    
    def validate_payment_method(self, value):
        """Validate that the payment method is enabled"""
        payment_config = self._get_checkout_payment_config()
        if not payment_config:
            # If no config exists, all methods are enabled by default.
            return value

        normalized_value = value.lower().strip()
        method_map = {
            'cod': payment_config.cash_on_delivery,
            'cash_on_delivery': payment_config.cash_on_delivery,
            'bkash': payment_config.bkash,
            'nagad': payment_config.nagad,
            'card': payment_config.credit_card,
            'credit_card': payment_config.credit_card,
            # UddoktaPay maps to credit_card toggle in admin panel
            'uddoktapay': payment_config.credit_card,
        }

        if normalized_value in method_map and not method_map[normalized_value]:
            raise serializers.ValidationError(f"Payment method '{value}' is currently not available.")

        return value
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Order must contain at least one item.")
        return value

    def _enabled_shipping_options(self, product):
        from products.serializers import normalize_product_shipping_options
        return [option for option in normalize_product_shipping_options(product) if option.get('enabled')]

    def _select_shipping_option(self, product, requested_type):
        from decimal import Decimal, InvalidOperation

        enabled_options = self._enabled_shipping_options(product)
        if not enabled_options:
            raise serializers.ValidationError(
                f'No shipping method is available for "{product.title[:60]}".')

        requested = str(requested_type or '').strip().lower()
        selected = None
        if requested:
            selected = next(
                (
                    option for option in enabled_options
                    if str(option.get('type', '')).strip().lower() == requested
                    or str(option.get('methodId', '')).strip().lower() == requested
                ),
                None,
            )
            if not selected:
                raise serializers.ValidationError(
                    f'Selected shipping method is not available for "{product.title[:60]}".')
        else:
            selected = enabled_options[0]

        try:
            charge = Decimal(str(selected.get('price', 0) or 0)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError, ValueError):
            charge = Decimal('0.00')

        return {
            'name': str(selected.get('type') or 'Shipping'),
            'charge': max(Decimal('0.00'), charge),
            'estimated_delivery': str(selected.get('estimatedDelivery') or ''),
        }
    
    def _apply_seller_coupon(self, coupon, customer, order_items, item_shipping_by_index):
        """Apply a seller coupon per spec: it may reduce only the owning
        seller's product prices (Product Only) or that seller's shipping
        (Shipping Only). Entire-order coupons are not supported.

        Returns (product_discount, shipping_discount) — exactly one is > 0.
        Raises ValidationError when the coupon cannot be applied.
        """
        from decimal import Decimal
        from finance.models import SELLER_NEGATIVE_LIMIT
        from finance.services import seller_balances

        # A seller whose Marketplace Balance fell below the allowed negative
        # limit must deposit before their coupons can be used (spec Part 2 §4).
        balance = seller_balances(coupon.seller)['marketplace_balance']
        if balance < SELLER_NEGATIVE_LIMIT:
            raise serializers.ValidationError(
                {'coupon_code': 'This coupon is temporarily unavailable.'})

        if coupon.uses >= coupon.max_uses:
            raise serializers.ValidationError({'coupon_code': 'This coupon has been fully used.'})

        # Items belonging to the coupon owner's shops.
        seller_items = [
            (idx, item) for idx, item in enumerate(order_items)
            if item['product'].shop.seller_id == coupon.seller_id
        ]
        if not seller_items:
            raise serializers.ValidationError(
                {'coupon_code': 'This coupon does not apply to any product in your order.'})

        # Narrow eligibility by coupon type.
        eligible = seller_items
        if coupon.coupon_type == 'first_order':
            if Order.objects.filter(customer=customer).exists():
                raise serializers.ValidationError(
                    {'coupon_code': 'This coupon is only valid on your first order.'})
        elif coupon.coupon_type == 'category' and coupon.category:
            eligible = [
                (idx, item) for idx, item in seller_items
                if item['product'].category_fk_id == coupon.category_id
                or (item['product'].category and coupon.category.name
                    and item['product'].category.lower() == coupon.category.name.lower())
            ]
        elif coupon.coupon_type == 'specific_products':
            allowed_ids = set(coupon.coupon_products.values_list('product_id', flat=True))
            eligible = [(idx, item) for idx, item in seller_items
                        if item['product'].id in allowed_ids]
        if not eligible:
            raise serializers.ValidationError(
                {'coupon_code': 'This coupon does not apply to any product in your order.'})

        eligible_subtotal = sum(item['price'] * item['quantity'] for _, item in eligible)

        if coupon.discount_type == 'shipping':
            # Shipping Only: free shipping for the seller's items. Handled by
            # charging less shipping — never enters marketplace accounting.
            shipping_discount = sum(item_shipping_by_index.get(idx, Decimal('0'))
                                    for idx, _ in seller_items)
            if shipping_discount <= 0:
                raise serializers.ValidationError(
                    {'coupon_code': 'These items already ship free.'})
            return Decimal('0'), shipping_discount.quantize(Decimal('0.01'))

        if coupon.min_order_amount and eligible_subtotal < coupon.min_order_amount:
            raise serializers.ValidationError(
                {'coupon_code': f'This coupon needs a minimum of ৳{coupon.min_order_amount} '
                                'in eligible products.'})

        if coupon.discount_type == 'percent':
            product_discount = (eligible_subtotal * coupon.discount_value / Decimal('100'))
        else:  # fixed
            product_discount = min(coupon.discount_value, eligible_subtotal)
        return product_discount.quantize(Decimal('0.01')), Decimal('0')

    def _apply_admin_coupon(self, coupon, customer, order_items, subtotal):
        """Admin coupon: product price only, never shipping, funded by the
        Platform Balance reserve. Returns {seller_id: discount} distributed
        proportionally across participating sellers (spec Part 2 §5)."""
        from decimal import Decimal
        from django.db.models import Sum
        from finance.models import LedgerAccount

        now = timezone.now()
        if coupon.status != 'active':
            raise serializers.ValidationError({'coupon_code': 'This coupon is not active.'})
        if coupon.starts_at and coupon.starts_at > now:
            raise serializers.ValidationError({'coupon_code': 'This coupon is not active yet.'})
        if coupon.expires_at and coupon.expires_at <= now:
            raise serializers.ValidationError({'coupon_code': 'This coupon has expired.'})
        if coupon.max_uses and coupon.uses >= coupon.max_uses:
            raise serializers.ValidationError({'coupon_code': 'This coupon has been fully used.'})
        if subtotal < (coupon.min_order_amount or 0):
            raise serializers.ValidationError(
                {'coupon_code': f'This coupon needs a minimum order of ৳{coupon.min_order_amount}.'})

        # Scope eligibility per item.
        if coupon.scope == 'marketplace':
            eligible = order_items
        elif coupon.scope == 'seller':
            seller_ids = set(coupon.sellers.values_list('id', flat=True))
            eligible = [i for i in order_items if i['product'].shop.seller_id in seller_ids]
        elif coupon.scope == 'category':
            cat_ids = set(coupon.categories.values_list('id', flat=True))
            eligible = [i for i in order_items if i['product'].category_fk_id in cat_ids]
        else:  # product
            product_ids = set(coupon.products.values_list('id', flat=True))
            eligible = [i for i in order_items if i['product'].id in product_ids]
        if not eligible:
            raise serializers.ValidationError(
                {'coupon_code': 'This coupon does not apply to any product in your order.'})

        eligible_total = sum(i['price'] * i['quantity'] for i in eligible)
        if coupon.discount_type == 'percent':
            discount = eligible_total * coupon.discount_value / Decimal('100')
        else:
            discount = min(coupon.discount_value, eligible_total)
        if coupon.max_discount_amount:
            discount = min(discount, coupon.max_discount_amount)
        discount = discount.quantize(Decimal('0.01'))

        # The redemption may not exceed what is still available in the reserve
        # (reserve balance minus discounts promised to unpaid orders).
        reserve = LedgerAccount.objects.filter(
            account_type=LedgerAccount.COUPON_RESERVE, coupon=coupon).first()
        reserve_balance = reserve.balance if reserve else Decimal('0')
        pending = coupon.redemptions.filter(status='pending').aggregate(
            total=Sum('amount'))['total'] or Decimal('0')
        available = reserve_balance - pending
        if discount > available:
            if available <= 0:
                raise serializers.ValidationError(
                    {'coupon_code': 'This coupon budget has been exhausted.'})
            discount = available.quantize(Decimal('0.01'))

        # Distribute proportionally across participating sellers.
        per_seller_eligible = {}
        for item in eligible:
            sid = item['product'].shop.seller_id
            per_seller_eligible[sid] = per_seller_eligible.get(sid, Decimal('0')) \
                + item['price'] * item['quantity']
        split = {}
        remaining = discount
        seller_ids = list(per_seller_eligible.keys())
        for pos, sid in enumerate(seller_ids):
            if pos == len(seller_ids) - 1:
                share = remaining
            else:
                share = (discount * per_seller_eligible[sid] / eligible_total)\
                    .quantize(Decimal('0.01'))
                remaining -= share
            if share > 0:
                split[sid] = share
        return split

    def create(self, validated_data):
        from products.models import Product
        from seller.models import Coupon
        from finance.models import AdminCoupon, AdminCouponRedemption
        from finance import services as finance_services
        from decimal import Decimal
        from django.db import transaction
        import uuid
        import logging

        logger = logging.getLogger(__name__)

        items_data = validated_data.pop('items')
        customer = self.context['request'].user
        payment_method = validated_data['payment_method']
        is_cod = payment_method.lower() in ('cod', 'cash_on_delivery')

        # Spec: customer wallet credit is online-payment only — never COD.
        if validated_data.get('use_store_credit') and is_cod:
            raise serializers.ValidationError(
                {'use_store_credit': 'Store credit cannot be used with Cash on Delivery.'})

        with transaction.atomic():
            order_id = f"FP{uuid.uuid4().hex[:10].upper()}"

            subtotal = Decimal('0')
            shipping_cost = Decimal('0')
            order_items = []
            item_shipping_by_index = {}
            selected_shipping_methods = []

            for item_data in items_data:
                try:
                    product = Product.objects.select_related('shop__seller').get(
                        id=item_data['product_id'])
                except Product.DoesNotExist:
                    raise serializers.ValidationError(
                        f"Product with ID {item_data['product_id']} not found.")

                quantity = item_data['quantity']

                # Stock validation — legacy products use stock=0 for "untracked".
                if product.stock and quantity > product.stock:
                    raise serializers.ValidationError(
                        f'Only {product.stock} unit(s) of "{product.title[:60]}" left in stock.')

                # originalPrice is the selling price; price is the regular price.
                price = Decimal(str(product.originalPrice if product.originalPrice is not None else product.price))
                subtotal += price * quantity

                shipping_snapshot = self._select_shipping_option(
                    product, item_data.get('shipping_type', ''))
                item_shipping = shipping_snapshot['charge']
                shipping_cost += item_shipping
                item_shipping_by_index[len(order_items)] = item_shipping
                selected_shipping_methods.append(shipping_snapshot)

                order_items.append({
                    'product': product,
                    'product_title': product.title,
                    'product_image': product.image.name if product.image else '',
                    'color': item_data.get('color', ''),
                    'size': item_data.get('size', ''),
                    'shipping_type': shipping_snapshot['name'],
                    'shipping_charge': shipping_snapshot['charge'],
                    'shipping_estimated_delivery': shipping_snapshot['estimated_delivery'],
                    'quantity': quantity,
                    'price': price,
                })

            # ---------------- coupons ----------------
            # A code is either a seller coupon (product-only or shipping-only,
            # limited to that seller's items) or an admin coupon (product-only,
            # funded by Platform Balance). Invalid codes reject the checkout.
            seller_coupon = None
            admin_coupon = None
            seller_coupon_discount = Decimal('0')
            shipping_discount = Decimal('0')
            admin_split = {}
            coupon_code = validated_data.get('coupon_code', '').strip().upper()
            if coupon_code:
                seller_coupon = Coupon.objects.filter(
                    code=coupon_code, is_active=True,
                    expires_at__gte=timezone.now().date()).select_related('seller').first()
                if seller_coupon:
                    seller_coupon_discount, shipping_discount = self._apply_seller_coupon(
                        seller_coupon, customer, order_items, item_shipping_by_index)
                else:
                    admin_coupon = AdminCoupon.objects.filter(code=coupon_code).first()
                    if not admin_coupon:
                        raise serializers.ValidationError(
                            {'coupon_code': 'Invalid or expired coupon code.'})
                    admin_split = self._apply_admin_coupon(
                        admin_coupon, customer, order_items, subtotal)

            admin_coupon_discount = sum(admin_split.values(), Decimal('0'))
            # Shipping-only coupons charge less shipping; they never touch
            # marketplace accounting (spec Part 2 §4).
            shipping_cost = max(Decimal('0'), shipping_cost - shipping_discount)
            discount = seller_coupon_discount + admin_coupon_discount
            unique_methods = {snapshot['name'] for snapshot in selected_shipping_methods if snapshot['name']}
            unique_estimates = {snapshot['estimated_delivery'] for snapshot in selected_shipping_methods if snapshot['estimated_delivery']}
            order_shipping_method = (
                next(iter(unique_methods)) if len(unique_methods) == 1 else 'Multiple shipping methods'
            )
            order_shipping_estimate = (
                next(iter(unique_estimates)) if len(unique_estimates) == 1 else 'Varies by item'
            )

            goods_value = max(Decimal('0'), subtotal + shipping_cost - discount)

            # The order total is exactly the goods value — no charge is ever
            # added to it or recorded in the ledger. The 2.5% payment & service
            # charge exists only as a checkout-time surcharge shown to the
            # customer and collected by the payment gateway (see payment_views).
            total_amount = goods_value

            # ---------------- store credit ----------------
            store_credit_used = Decimal('0')
            if validated_data.get('use_store_credit'):
                balance = finance_services.customer_wallet_balance(customer)
                store_credit_used = min(balance, total_amount)
                total_amount -= store_credit_used

            order = Order.objects.create(
                customer=customer,
                order_id=order_id,
                shipping_full_name=validated_data['shipping_full_name'],
                shipping_phone=validated_data['shipping_phone'],
                shipping_street=validated_data['shipping_street'],
                shipping_city=validated_data['shipping_city'],
                shipping_state=validated_data.get('shipping_state', ''),
                shipping_zip_code=validated_data.get('shipping_zip_code', ''),
                shipping_country=validated_data.get('shipping_country', 'Bangladesh'),
                payment_method=payment_method,
                payment_status='pending',
                subtotal=subtotal,
                shipping_cost=shipping_cost,
                shipping_method=order_shipping_method,
                shipping_estimated_delivery=order_shipping_estimate,
                discount=discount,
                coupon_code=coupon_code if (discount > 0 or shipping_discount > 0) else None,
                seller_coupon_discount=seller_coupon_discount,
                admin_coupon_discount=admin_coupon_discount,
                coupon_seller=seller_coupon.seller if seller_coupon else None,
                store_credit_used=store_credit_used,
                total_amount=total_amount,
                status='pending',
                order_notes=validated_data.get('order_notes', '') or None,
                delivery_instructions=validated_data.get('delivery_instructions', '') or None,
            )

            # Record coupon usage now that the order exists.
            if seller_coupon and (seller_coupon_discount > 0 or shipping_discount > 0):
                seller_coupon.uses += 1
                seller_coupon.save(update_fields=['uses'])
            if admin_coupon and admin_split:
                for seller_id, share in admin_split.items():
                    AdminCouponRedemption.objects.create(
                        coupon=admin_coupon, order=order,
                        seller_id=seller_id, amount=share, status='pending')
                admin_coupon.uses += 1
                admin_coupon.save(update_fields=['uses', 'updated_at'])

            # Hold the redeemed store credit in the ledger until payment settles
            # (released automatically if the order is cancelled before payment).
            if store_credit_used > 0:
                finance_services.hold_wallet_credit(order, store_credit_used, actor=customer)

            from .lifecycle import record_status
            record_status(order, '', 'pending', actor=customer, note='Order placed')

            # Create order items, reserve stock and update sold counters
            for item_data in order_items:
                OrderItem.objects.create(order=order, **item_data)
                product = item_data['product']
                product.sold_count += item_data['quantity']
                update_fields = ['sold_count']
                if product.stock is not None and product.stock > 0:
                    product.stock = max(0, product.stock - item_data['quantity'])
                    update_fields.append('stock')
                product.save(update_fields=update_fields)

            # Fully wallet-funded online orders need no gateway step. They are
            # marked paid but kept Pending (visible to the seller, cancellable).
            if not is_cod and order.total_amount == 0 and store_credit_used > 0:
                order.payment_status = 'paid'
                order.save(update_fields=['payment_status'])

        # Send email notifications only for non-UddoktaPay orders.
        # For UddoktaPay, emails are deferred until payment is confirmed via IPN
        # so the seller never gets notified about an unpaid order.
        if order.payment_method != 'uddoktapay' or order.payment_status == 'paid':
            try:
                self._send_order_notifications(order)
            except Exception as e:
                logger.error(f"Failed to send order notifications for order {order.order_id}: {e}")

        return order
    
    def _send_order_notifications(self, order):
        """Send email notifications for new order"""
        import logging
        from django.conf import settings
        from django.template.loader import render_to_string
        from django.core.mail import send_mail
        from django.utils import timezone
        
        logger = logging.getLogger(__name__)
        
        try:
            # Send order confirmation to customer
            self._send_customer_confirmation(order)
            
            # Send new order notification to sellers
            self._send_seller_notifications(order)
            
        except Exception as e:
            logger.error(f"Failed to send order notifications: {e}")
            raise
    
    def _send_customer_confirmation(self, order):
        """Send order confirmation email to customer"""
        try:
            from django.conf import settings
            from django.core.mail import send_mail
            from django.template.loader import render_to_string
            
            # Calculate order items details
            items_details = []
            for item in order.items.all():
                items_details.append({
                    'name': item.product_title,
                    'quantity': item.quantity,
                    'price': item.price,
                    'total': item.total_price,
                    'image': item.product_image,
                })
            
            context = {
                'user_name': order.customer.first_name or order.customer.username,
                'order_id': order.order_id,
                'order_date': order.created_at.strftime('%B %d, %Y'),
                'items': items_details,
                'subtotal': order.subtotal,
                'shipping_cost': order.shipping_cost,
                'discount': order.discount,
                'total_amount': order.total_amount,
                'shipping_address': {
                    'name': order.shipping_full_name,
                    'phone': order.shipping_phone,
                    'address': f"{order.shipping_street}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip_code}",
                    'country': order.shipping_country,
                },
                'payment_method': order.payment_method,
                'estimated_delivery': order.shipping_estimated_delivery or 'Contact seller for details',
                'tracking_url': f"{getattr(settings, 'FRONTEND_URL', 'http://54.169.101.239')}/orders/{order.order_id}",
                'site_name': getattr(settings, 'SITE_NAME', 'Flypick'),
                'current_year': timezone.now().year,
            }
            
            # Render email template
            try:
                html_content = render_to_string('email_templates/order_confirmation.html', context)
            except:
                # Fallback to simple HTML if template not found
                html_content = f"""
                <h2>Order Confirmation - {order.order_id}</h2>
                <p>Dear {context['user_name']},</p>
                <p>Thank you for your order! Your order has been confirmed.</p>
                <p><strong>Order ID:</strong> {order.order_id}</p>
                <p><strong>Total Amount:</strong> ৳{order.total_amount}</p>
                <p><strong>Estimated Delivery:</strong> {context['estimated_delivery']}</p>
                <p>You can track your order at: <a href="{context['tracking_url']}">Track Order</a></p>
                <p>Thank you for shopping with {context['site_name']}!</p>
                """
            
            # Send email
            send_mail(
                subject=f'Order Confirmation - {order.order_id}',
                message=f'Your order {order.order_id} has been confirmed. Total: ৳{order.total_amount}',
                from_email=f"{getattr(settings, 'EMAIL_SENDER_NAME', 'Flypick')} <{getattr(settings, 'SMTP_USER', 'noreply@flypick.com')}>",
                recipient_list=[order.customer.email],
                html_message=html_content,
                fail_silently=False,
            )
            
        except Exception as e:
            logger.error(f"Failed to send customer confirmation for order {order.order_id}: {e}")
            raise
    
    def _send_seller_notifications(self, order):
        """Send new order notification to sellers"""
        try:
            from django.conf import settings
            from django.core.mail import send_mail
            from django.template.loader import render_to_string
            
            # Get all sellers involved in this order
            sellers = set()
            for item in order.items.all():
                if item.product and item.product.shop:
                    sellers.add(item.product.shop.seller)
            
            for seller in sellers:
                # Get items for this seller
                seller_items = []
                for item in order.items.all():
                    if item.product and item.product.shop and item.product.shop.seller == seller:
                        seller_items.append({
                            'name': item.product_title,
                            'quantity': item.quantity,
                            'price': item.price,
                            'total': item.total_price,
                        })
                
                context = {
                    'seller_name': seller.first_name or seller.username,
                    'order_id': order.order_id,
                    'order_date': order.created_at.strftime('%B %d, %Y'),
                    'customer_name': order.customer.first_name or order.customer.username,
                    'customer_email': order.customer.email,
                    'items': seller_items,
                    'shipping_address': {
                        'name': order.shipping_full_name,
                        'phone': order.shipping_phone,
                        'address': f"{order.shipping_street}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip_code}",
                        'country': order.shipping_country,
                    },
                    'payment_method': order.payment_method,
                    'dashboard_url': f"{getattr(settings, 'SELLER_FRONTEND_URL', 'http://54.169.101.239:8080')}/orders",
                    'site_name': getattr(settings, 'SITE_NAME', 'Flypick'),
                    'current_year': timezone.now().year,
                }
                
                # Render email template
                try:
                    html_content = render_to_string('email_templates/new_order_seller.html', context)
                except:
                    # Fallback to simple HTML if template not found
                    items_html = ""
                    for item in seller_items:
                        items_html += f"<li>{item['name']} - Qty: {item['quantity']} - ৳{item['price']} each</li>"
                    
                    html_content = f"""
                    <h2>🎉 New Order Received!</h2>
                    <p>Dear {context['seller_name']},</p>
                    <p>You have received a new order!</p>
                    
                    <h3>Order Details:</h3>
                    <p><strong>Order ID:</strong> {order.order_id}</p>
                    <p><strong>Order Date:</strong> {context['order_date']}</p>
                    <p><strong>Customer:</strong> {context['customer_name']} ({context['customer_email']})</p>
                    
                    <h3>Items Ordered:</h3>
                    <ul>{items_html}</ul>
                    
                    <h3>Shipping Address:</h3>
                    <p>{context['shipping_address']['name']}<br>
                    {context['shipping_address']['phone']}<br>
                    {context['shipping_address']['address']}<br>
                    {context['shipping_address']['country']}</p>
                    
                    <p><strong>Payment Method:</strong> {context['payment_method']}</p>
                    
                    <p>Please log in to your seller dashboard to manage this order:</p>
                    <p><a href="{context['dashboard_url']}">View Order in Dashboard</a></p>
                    
                    <p>Thank you for being part of {context['site_name']}!</p>
                    """
                
                # Send email to seller
                send_mail(
                    subject=f'🎉 New Order Received - {order.order_id}',
                    message=f'You have received a new order {order.order_id} from {context["customer_name"]}. Please check your dashboard.',
                    from_email=f"{getattr(settings, 'EMAIL_SENDER_NAME', 'Flypick')} <{getattr(settings, 'SMTP_USER', 'noreply@flypick.com')}>",
                    recipient_list=[seller.email],
                    html_message=html_content,
                    fail_silently=False,
                )
                
        except Exception as e:
            logger.error(f"Failed to send seller notifications for order {order.order_id}: {e}")
            raise


class ReturnItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='order_item.product_title', read_only=True)
    product_image = serializers.CharField(source='order_item.product_image', read_only=True)
    
    class Meta:
        model = ReturnItem
        fields = ['id', 'order_item', 'product_title', 'product_image', 'quantity', 'reason']
        read_only_fields = ['id', 'product_title', 'product_image']


class ReturnRequestSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True, read_only=True)
    order_id = serializers.CharField(source='order.order_id', read_only=True)
    
    image_urls = serializers.SerializerMethodField()

    class Meta:
        model = ReturnRequest
        fields = [
            'id', 'return_id', 'order', 'order_id', 'reason', 'description',
            'refund_method', 'status', 'refund_amount', 'admin_note', 'items',
            'image_urls', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'return_id', 'created_at', 'updated_at']

    def get_image_urls(self, obj):
        from django.conf import settings as dj_settings
        request = self.context.get('request')
        urls = []
        for path in obj.images or []:
            url = f'{dj_settings.MEDIA_URL}{path}'
            urls.append(request.build_absolute_uri(url) if request else url)
        return urls


class ReturnRequestCreateSerializer(serializers.Serializer):
    order_id = serializers.CharField()
    reason = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(
        child=serializers.DictField(child=serializers.IntegerField())
    )
    # Optional photo evidence: list of base64 data URLs, stored to media
    images = serializers.ListField(
        child=serializers.CharField(), required=False, default=list, max_length=5
    )
    # How the customer wants their refund if the return is approved
    refund_method = serializers.ChoiceField(
        choices=['original', 'store_credit'], required=False, default='original'
    )

    def validate_order_id(self, value):
        try:
            order = Order.objects.get(order_id=value)
            if order.customer != self.context['request'].user:
                raise serializers.ValidationError("You can only request returns for your own orders.")
            if order.status not in ('delivered', 'completed'):
                raise serializers.ValidationError("Returns can only be requested for delivered orders.")
            
            # Check if there's already a pending or approved return request for this order
            existing_returns = ReturnRequest.objects.filter(
                order=order,
                status__in=['pending', 'approved']
            )
            if existing_returns.exists():
                raise serializers.ValidationError(
                    "A return request for this order is already pending or approved. "
                    "Please wait for it to be processed before submitting another request."
                )
            
            return value
        except Order.DoesNotExist:
            raise serializers.ValidationError("Order not found.")
    
    def validate(self, data):
        """Validate that items haven't been returned already"""
        from .models import ReturnRequest, ReturnItem
        
        order = Order.objects.get(order_id=data['order_id'])
        items_data = data.get('items', [])
        
        # Get all existing return items for this order (excluding rejected returns)
        existing_return_items = ReturnItem.objects.filter(
            return_request__order=order,
            return_request__status__in=['pending', 'approved', 'refunded']
        ).select_related('order_item')
        
        # Create a map of order_item_id -> total returned quantity
        returned_quantities = {}
        for return_item in existing_return_items:
            order_item_id = return_item.order_item.id
            returned_quantities[order_item_id] = returned_quantities.get(order_item_id, 0) + return_item.quantity
        
        # Check if any requested items exceed available quantity
        errors = []
        for item_data in items_data:
            order_item_id = item_data['order_item_id']
            requested_qty = item_data['quantity']
            
            try:
                order_item = OrderItem.objects.get(id=order_item_id, order=order)
            except OrderItem.DoesNotExist:
                raise serializers.ValidationError(f"Order item {order_item_id} not found in this order.")
            
            already_returned = returned_quantities.get(order_item_id, 0)
            available_qty = order_item.quantity - already_returned
            
            if requested_qty > available_qty:
                if available_qty == 0:
                    errors.append(
                        f"{order_item.product_title}: This item has already been fully returned."
                    )
                else:
                    errors.append(
                        f"{order_item.product_title}: Only {available_qty} item(s) available for return "
                        f"({already_returned} already returned)."
                    )
        
        if errors:
            raise serializers.ValidationError({
                'items': errors
            })
        
        return data
    
    def _store_images(self, images, return_id):
        """Persist base64 data-URL evidence under media/returns/."""
        import base64
        import uuid as uuid_mod
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        stored = []
        for image in (images or [])[:5]:
            if not isinstance(image, str) or not image.startswith('data:image/'):
                continue
            try:
                header, payload = image.split(',', 1)
                ext = header.split('/')[1].split(';')[0].lower()
                if ext not in ('jpeg', 'jpg', 'png', 'webp'):
                    continue
                data = base64.b64decode(payload)
                if len(data) > 5 * 1024 * 1024:  # 5MB per image
                    continue
                path = f'returns/{return_id}_{uuid_mod.uuid4().hex[:6]}.{ext}'
                stored.append(default_storage.save(path, ContentFile(data)))
            except Exception:
                continue
        return stored

    def create(self, validated_data):
        import uuid
        from .models import ReturnRequest, ReturnItem

        order = Order.objects.get(order_id=validated_data['order_id'])
        items_data = validated_data.pop('items')

        # Generate unique return ID
        return_id = f"RET{uuid.uuid4().hex[:10].upper()}"

        # Create return request
        return_request = ReturnRequest.objects.create(
            order=order,
            return_id=return_id,
            reason=validated_data['reason'],
            description=validated_data.get('description', ''),
            images=self._store_images(validated_data.get('images'), return_id),
            refund_method=validated_data.get('refund_method', 'original'),
            status='pending'
        )
        
        # Create return items
        for item_data in items_data:
            order_item = OrderItem.objects.get(id=item_data['order_item_id'])
            ReturnItem.objects.create(
                return_request=return_request,
                order_item=order_item,
                quantity=item_data['quantity']
            )
        
        return return_request
