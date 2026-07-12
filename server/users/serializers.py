from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from orders.models import Order, OrderItem, Refund, ReturnRequest
from products.models import Product
from products.serializers import ShopSerializer
from reviews.models import Review

from .models import SellerProfile
from .roles import is_admin_user
from .services import assert_user_can_authenticate

User = get_user_model()


class SellerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerProfile
        fields = [
            "phone",
            "sender_name",
            "mobile_no",
            "village",
            "post_office",
            "post_code",
            "upazila",
            "zilla",
            "avatar",
            "location",
            "address",
            "business_name",
            "business_category",
            "business_description",
            "additional_info",
            "status",
            "idDocument",
            "id_photo",
            "bankAccount",
            "verified",
            "reviewed_at",
            "review_note",
        ]
        # Review outcomes are admin-set via SellerViewSet.update_status; sellers
        # must not change them through profile updates. id_photo uploads go
        # through the dedicated multipart endpoint.
        read_only_fields = ["status", "verified", "reviewed_at", "review_note", "id_photo"]


class SellerSerializer(serializers.ModelSerializer):
    seller_profile = SellerProfileSerializer()
    shops = ShopSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined", "seller_profile", "shops"]


class SellerDetailSerializer(SellerSerializer):
    analytics = serializers.SerializerMethodField()

    class Meta(SellerSerializer.Meta):
        fields = SellerSerializer.Meta.fields + ["is_active", "last_login", "analytics"]

    def _products(self, obj):
        return Product.objects.filter(shop__seller=obj)

    def _order_items(self, obj):
        return OrderItem.objects.filter(product__shop__seller=obj).select_related("order", "product")

    def _orders(self, obj):
        return Order.objects.filter(items__product__shop__seller=obj).distinct()

    def _money_expr(self):
        return ExpressionWrapper(
            F("price") * F("quantity"),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )

    def get_analytics(self, obj):
        products = self._products(obj)
        order_items = self._order_items(obj)
        orders = self._orders(obj)
        shops = obj.shops.all()
        profile = getattr(obj, "seller_profile", None)

        revenue_expr = self._money_expr()
        total_revenue = order_items.aggregate(total=Sum(revenue_expr))["total"] or 0
        total_orders = orders.count()
        completed_orders = orders.filter(status__in=["delivered", "completed"]).count()
        cancelled_orders = orders.filter(status="cancelled").count()
        returned_orders = orders.filter(status="returned").count()
        refund_requests = Refund.objects.filter(order__in=orders).count()
        return_requests = ReturnRequest.objects.filter(order__in=orders).count()
        customers = orders.values("customer").distinct().count()

        now = timezone.now()
        today = now.date()
        week_start = today - timedelta(days=6)
        month_start = today.replace(day=1)

        daily_sales = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            day_items = order_items.filter(order__created_at__date=day)
            daily_sales.append(
                {
                    "label": day.strftime("%a"),
                    "revenue": float(day_items.aggregate(total=Sum(revenue_expr))["total"] or 0),
                    "orders": orders.filter(created_at__date=day).count(),
                }
            )

        status_counts = []
        for status_value, label in Order.STATUS_CHOICES:
            count = orders.filter(status=status_value).count()
            if count:
                status_counts.append({"status": status_value, "label": label, "count": count})

        product_statuses = {
            "total": products.count(),
            "active": products.filter(status__iexact="Active").count(),
            "draft": products.filter(status__iexact="Draft").count(),
            "suspended": products.filter(status__iexact="Suspended").count(),
            "rejected": products.filter(status__iexact="Rejected").count(),
            "outOfStock": products.filter(stock__lte=0).count(),
        }

        request = self.context.get("request")

        def media_url(image_field):
            if not image_field:
                return None
            url = image_field.url
            return request.build_absolute_uri(url) if request else url

        def last_moderation(product):
            variants = product.variants if isinstance(product.variants, dict) else {}
            history = variants.get("moderation_history")
            if isinstance(history, list) and history:
                entry = history[-1]
                if isinstance(entry, dict):
                    return {
                        "action": entry.get("action"),
                        "reason": entry.get("reason") or "",
                        "moderator": entry.get("moderator"),
                        "at": entry.get("at"),
                    }
            return None

        def product_row(product):
            item_qs = order_items.filter(product=product)
            revenue = item_qs.aggregate(total=Sum(revenue_expr))["total"] or 0
            return {
                "id": product.id,
                "name": product.title,
                "status": product.status,
                "isFeatured": product.is_featured,
                "price": float(product.originalPrice or product.price or 0),
                "image": media_url(product.image),
                "stock": product.stock,
                "sold": product.sold_count,
                "views": (product.reviews_count * 12) + (product.sold_count * 8) + 30,
                "rating": float(product.rating or 0),
                "revenue": float(revenue),
                "createdAt": product.created_at.isoformat(),
                "moderation": last_moderation(product),
            }

        all_products = [product_row(p) for p in products.order_by("-created_at")]

        reviews = Review.objects.filter(product__shop__seller=obj)
        avg_rating = reviews.aggregate(avg=Sum("rating"))["avg"]
        review_count = reviews.count()
        seller_rating = round(float(avg_rating or 0) / review_count, 2) if review_count else 0

        repeat_customers = (
            orders.values("customer")
            .annotate(order_count=Count("id", distinct=True))
            .filter(order_count__gt=1)
            .count()
        )

        shop_created = min((shop.createdDate for shop in shops), default=obj.date_joined)
        shop_age_days = max((today - shop_created.date()).days, 0) if shop_created else 0
        on_time_shipping_rate = 100 if completed_orders and not returned_orders else max(0, 100 - returned_orders * 5)
        cancellation_rate = round((cancelled_orders / total_orders) * 100, 2) if total_orders else 0
        refund_rate = round((refund_requests / total_orders) * 100, 2) if total_orders else 0
        conversion_rate = round((total_orders / max(customers * 8, 1)) * 100, 2) if customers else 0

        timeline = []
        for product in products.order_by("-created_at")[:6]:
            timeline.append(
                {
                    "type": "product_added",
                    "label": "Product Added",
                    "description": product.title,
                    "createdAt": product.created_at.isoformat(),
                }
            )
        for order in orders.order_by("-created_at")[:6]:
            timeline.append(
                {
                    "type": "order_received",
                    "label": "Order Received",
                    "description": order.order_id,
                    "createdAt": order.created_at.isoformat(),
                }
            )
        timeline = sorted(timeline, key=lambda item: item["createdAt"], reverse=True)[:10]

        return {
            "overview": {
                "shopStatus": shops.first().status if shops.exists() else "not_created",
                "verificationStatus": "verified" if profile and profile.verified else "unverified",
                "accountStatus": getattr(profile, "status", "pending") if profile else "pending",
                "sellerRating": seller_rating,
                "responseRate": 98 if total_orders else 0,
                "responseTime": "2h" if total_orders else "N/A",
                "shopCreationDate": shop_created.isoformat() if shop_created else None,
                "shopAgeDays": shop_age_days,
                "lastActive": obj.last_login.isoformat() if obj.last_login else None,
                "totalFollowers": customers * 3,
                "shopHealthScore": max(0, min(100, 100 - cancellation_rate - refund_rate)),
            },
            "sales": {
                "totalRevenue": float(total_revenue),
                "totalOrders": total_orders,
                "todaysOrders": orders.filter(created_at__date=today).count(),
                "weeklyOrders": orders.filter(created_at__date__gte=week_start).count(),
                "monthlyOrders": orders.filter(created_at__date__gte=month_start).count(),
                "pendingOrders": orders.filter(status__in=["pending", "confirmed", "processing"]).count(),
                "completedOrders": completed_orders,
                "cancelledOrders": cancelled_orders,
                "returnedOrders": returned_orders,
                "refundRequests": refund_requests,
                "conversionRate": conversion_rate,
                "dailySales": daily_sales,
            },
            "products": {
                "counts": product_statuses,
                "all": all_products,
            },
            "customers": {
                "total": customers,
                "repeatCustomers": repeat_customers,
                "newCustomers": max(customers - repeat_customers, 0),
                "averageOrderValue": round(float(total_revenue) / total_orders, 2) if total_orders else 0,
                "satisfaction": seller_rating,
                "ratings": review_count,
            },
            "orders": {
                "statusCounts": status_counts,
                "returnRequests": return_requests,
            },
            "shopAnalytics": {
                "visitors": max(customers * 8, total_orders * 4),
                "productViews": sum((p.reviews_count * 12) + (p.sold_count * 8) + 30 for p in products),
                "conversionRate": conversion_rate,
                "cartAbandonment": max(0, 70 - conversion_rate),
                "checkoutSuccessRate": min(100, 65 + conversion_rate),
            },
            "performance": {
                "responseTime": "2h" if total_orders else "N/A",
                "acceptanceRate": max(0, 100 - cancellation_rate),
                "cancellationRate": cancellation_rate,
                "refundRate": refund_rate,
                "onTimeShippingRate": on_time_shipping_rate,
                "lateDeliveryRate": max(0, 100 - on_time_shipping_rate),
            },
            "documents": {
                "nationalId": getattr(profile, "idDocument", None) if profile else None,
                "idPhoto": media_url(profile.id_photo) if profile and profile.id_photo else None,
                "bankInformation": getattr(profile, "bankAccount", None) if profile else None,
            },
            "timeline": timeline,
        }


class UserSerializer(serializers.ModelSerializer):
    seller_profile = SellerProfileSerializer(required=False)
    shop_count = serializers.SerializerMethodField()
    max_shops = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "is_superuser",
            "seller_profile",
            "shop_count",
            "max_shops",
        ]
        read_only_fields = ["id", "role", "is_superuser", "shop_count", "max_shops"]

    def get_shop_count(self, obj):
        return obj.shops.count()

    def get_max_shops(self, obj):
        return 1 if obj.role == "Seller" else None

    def update(self, instance, validated_data):
        seller_profile_data = validated_data.pop("seller_profile", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if seller_profile_data is not None and instance.role == "Seller":
            profile, _ = SellerProfile.objects.get_or_create(user=instance)
            for attr, value in seller_profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import CustomerProfile
        model = CustomerProfile
        fields = [
            'first_name',
            'last_name',
            'phone',
            'profile_photo',
            'email_notifications',
            'language',
            'currency',
        ]


class CustomerRegisterSerializer(serializers.ModelSerializer):
    """Serializer for customer registration"""
    password = serializers.CharField(write_only=True, min_length=8)
    username = serializers.CharField(required=False, allow_blank=True)
    customer_profile = CustomerProfileSerializer(required=False)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "customer_profile",
        ]

    def validate_username(self, value):
        """Validate username uniqueness"""
        if value and User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        customer_profile_data = validated_data.pop('customer_profile', {})
        username = validated_data.pop('username', '').strip()
        email = validated_data['email']
        
        # Generate username from email if not provided
        if not username:
            username = email.split('@')[0]
        
        # Ensure username is unique (this is a safety check)
        counter = 1
        original_username = username
        while User.objects.filter(username=username).exists():
            username = f"{original_username}{counter}"
            counter += 1

        # Create user with Customer role
        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data['password'],
            role='Customer',
        )

        # A post_save signal already creates an empty CustomerProfile, so
        # get_or_create's `defaults` would be ignored — apply the submitted
        # profile fields (first/last name, phone, …) explicitly instead.
        from .models import CustomerProfile
        profile, _ = CustomerProfile.objects.get_or_create(user=user)
        if customer_profile_data:
            for attr, value in customer_profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return user


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    username = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False, default="Seller")
    owner_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    business_name = serializers.CharField(required=False, allow_blank=True)
    business_category = serializers.CharField(required=False, allow_blank=True)
    business_description = serializers.CharField(required=False, allow_blank=True)
    additional_info = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "role",
            "owner_name",
            "phone",
            "address",
            "business_name",
            "business_category",
            "business_description",
            "additional_info",
        ]

    def validate(self, attrs):
        role = attrs.get("role", "Seller")
        if role == "Admin":
            raise serializers.ValidationError({"role": "Admin accounts cannot be self-registered."})

        if role == "Seller":
            required = {
                "owner_name": "Owner name is required.",
                "phone": "Phone number is required.",
                "address": "Address is required.",
                "business_name": "Business name is required.",
                "business_category": "Business category is required.",
            }
            errors = {}
            for key, message in required.items():
                if not str(attrs.get(key, "")).strip():
                    errors[key] = message
            if errors:
                raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        role = validated_data.pop("role", "Seller")
        owner_name = validated_data.pop("owner_name", "").strip()
        phone = validated_data.pop("phone", "").strip()
        address = validated_data.pop("address", "").strip()
        business_name = validated_data.pop("business_name", "").strip()
        business_category = validated_data.pop("business_category", "").strip()
        business_description = validated_data.pop("business_description", "").strip()
        additional_info = validated_data.pop("additional_info", "").strip()

        username = validated_data.pop("username", "").strip()
        email = validated_data["email"]
        if not username:
            if owner_name:
                username = owner_name
            else:
                username = email.split("@")[0]

        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data["password"],
            role=role,
        )

        if user.role == "Seller":
            profile, _ = SellerProfile.objects.get_or_create(user=user)
            profile.phone = phone or None
            profile.location = address or None
            profile.address = address or None
            profile.business_name = business_name or None
            profile.business_category = business_category or None
            profile.business_description = business_description or None
            profile.additional_info = additional_info or None
            profile.status = "pending"
            profile.save()
        return user


class SellerRequestSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="username", read_only=True)
    phone = serializers.CharField(source="seller_profile.phone", read_only=True)
    address = serializers.CharField(source="seller_profile.address", read_only=True)
    business_name = serializers.CharField(source="seller_profile.business_name", read_only=True)
    business_category = serializers.CharField(source="seller_profile.business_category", read_only=True)
    business_description = serializers.CharField(source="seller_profile.business_description", read_only=True)
    additional_info = serializers.CharField(source="seller_profile.additional_info", read_only=True)
    status = serializers.CharField(source="seller_profile.status", read_only=True)
    reviewed_at = serializers.DateTimeField(source="seller_profile.reviewed_at", read_only=True)
    review_note = serializers.CharField(source="seller_profile.review_note", read_only=True)
    reviewed_by = serializers.CharField(source="seller_profile.reviewed_by.email", read_only=True)
    shops_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "owner_name",
            "email",
            "phone",
            "address",
            "business_name",
            "business_category",
            "business_description",
            "additional_info",
            "status",
            "date_joined",
            "reviewed_at",
            "review_note",
            "reviewed_by",
            "shops_count",
        ]

    def get_shops_count(self, obj):
        return obj.shops.count()


class SellerRequestReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    review_note = serializers.CharField(required=False, allow_blank=True)

    def save(self, **kwargs):
        seller = self.context["seller"]
        admin_user = self.context["request"].user
        profile = seller.seller_profile
        action = self.validated_data["action"]
        review_note = self.validated_data.get("review_note", "").strip()

        profile.status = "active" if action == "approve" else "rejected"
        profile.reviewed_at = timezone.now()
        profile.review_note = review_note or None
        profile.reviewed_by = admin_user if is_admin_user(admin_user) else None
        profile.verified = action == "approve"
        profile.save(
            update_fields=[
                "status",
                "reviewed_at",
                "review_note",
                "reviewed_by",
                "verified",
            ]
        )
        return seller


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        assert_user_can_authenticate(self.user)
        return data


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import Address
        model = Address
        fields = [
            'id',
            'full_name',
            'phone',
            'street',
            'city',
            'state',
            'zip_code',
            'country',
            'is_default',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CustomerUserSerializer(serializers.ModelSerializer):
    customer_profile = CustomerProfileSerializer(required=False)
    addresses = AddressSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'role',
            'customer_profile',
            'addresses',
        ]
        read_only_fields = ['id', 'email', 'role']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('customer_profile', None)
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update or create customer profile
        if profile_data:
            from .models import CustomerProfile
            profile, created = CustomerProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance
