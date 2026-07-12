from rest_framework import serializers
from decimal import Decimal, InvalidOperation

from .models import Category, Shop, Product, ShippingMethod


class ShippingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingMethod
        fields = [
            'id',
            'name',
            'delivery_charge',
            'estimated_delivery_time',
            'description',
            'is_enabled',
            'sort_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


def normalize_product_shipping_options(product):
    variants = product.variants if isinstance(product.variants, dict) else {}
    saved_options = variants.get('shippingOptions')
    saved_options = saved_options if isinstance(saved_options, list) else []
    saved_by_id = {
        str(option.get('methodId') or option.get('method_id') or ''): option
        for option in saved_options
        if isinstance(option, dict) and (option.get('methodId') or option.get('method_id'))
    }
    saved_by_name = {
        str(option.get('type') or option.get('name') or '').strip().lower(): option
        for option in saved_options
        if isinstance(option, dict)
    }

    methods = list(ShippingMethod.objects.filter(is_enabled=True).order_by('sort_order', 'id'))
    if not methods and saved_options:
        return saved_options

    normalized = []
    for index, method in enumerate(methods):
        saved = saved_by_id.get(str(method.id)) or saved_by_name.get(method.name.strip().lower()) or {}
        charge = saved.get('price', saved.get('delivery_charge', method.delivery_charge))
        try:
            charge = Decimal(str(charge if charge not in (None, '') else 0)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError, ValueError):
            charge = Decimal('0.00')
        default_enabled = index == 0 and method.name.strip().lower().startswith('standard')
        normalized.append({
            'methodId': method.id,
            'type': method.name,
            'price': str(charge),
            'estimatedDelivery': saved.get('estimatedDelivery') or saved.get('estimated_delivery_time') or method.estimated_delivery_time,
            'description': saved.get('description') or method.description,
            'enabled': bool(saved.get('enabled', default_enabled)),
            'freeShipping': charge == 0,
        })
    return normalized

class CategorySerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image', 'image_url', 'parent', 'is_active', 'sort_order']
        read_only_fields = ['slug', 'image_url']
    
    def get_image_url(self, obj):
        """Return full URL for the image"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

class ProductSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source='shop.name', read_only=True)
    shop_category = serializers.CharField(source='shop.category', read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category_fk',
        required=False,
        allow_null=True
    )
    category_name = serializers.CharField(source='category_fk.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    image_gallery = serializers.SerializerMethodField()
    video_gallery = serializers.SerializerMethodField()
    moderation = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'shop',
            'shop_name',
            'shop_category',
            'title',
            'category',
            'category_name',
            'sku',
            'brand',
            'barcode',
            'description',
            'short_description',
            'price',
            'originalPrice',
            'actualCost',  # Add actualCost field
            'discount',
            'rating',
            'reviews_count',
            'sold_count',
            'stock',
            'image',
            'video',
            'image_url',
            'video_url',
            'image_gallery',
            'video_gallery',
            'badges',
            'variants',
            'freeShipping',
            'welcomeDeal',
            'status',
            'is_featured',
            'weight',
            'weight_unit',
            'meta_title',
            'meta_description',
            'return_policy',
            'warranty',
            'created_at',
            'updated_at',
            'moderation',
        ]
        read_only_fields = [
            'shop',
            'created_at',
            'updated_at',
            'shop_name',
            'shop_category',
            'category_name',
            'image_url',
            'video_url',
            'image_gallery',
            'video_gallery',
            'moderation',
        ]
    
    def to_representation(self, instance):
        """Import-source details are admin/owner-only: strip them from the
        variants JSON for everyone else (covers legacy imported products)."""
        data = super().to_representation(instance)
        variants = data.get('variants')
        if not isinstance(variants, dict):
            variants = {}
        variants['shippingOptions'] = normalize_product_shipping_options(instance)
        data['variants'] = variants
        if isinstance(variants, dict) and isinstance(variants.get('imported'), dict):
            request = self.context.get('request')
            user = getattr(request, 'user', None)
            is_privileged = bool(
                user and user.is_authenticated
                and (user.is_superuser or getattr(user, 'role', '') == 'Admin'
                     or instance.shop.seller_id == user.id)
            )
            if not is_privileged:
                imported = dict(variants['imported'])
                for secret in ('source_url', 'source_site', 'image_renditions', 'slug', 'stock_status'):
                    imported.pop(secret, None)
                variants = dict(variants)
                variants['imported'] = imported
                data['variants'] = variants
        return data

    def get_moderation(self, obj):
        """Latest admin moderation entry (action/reason) so sellers can see
        why a product was frozen or rejected."""
        variants = obj.variants if isinstance(obj.variants, dict) else {}
        history = variants.get('moderation_history')
        if isinstance(history, list) and history:
            entry = history[-1]
            if isinstance(entry, dict):
                return {
                    'action': entry.get('action'),
                    'reason': entry.get('reason') or '',
                    'at': entry.get('at'),
                }
        return None

    def get_image_url(self, obj):
        """Return full URL for the image"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_video_url(self, obj):
        """Return full URL for the video"""
        if obj.video:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.video.url)
            return obj.video.url
        return None

    def get_image_gallery(self, obj):
        request = self.context.get('request')
        urls = []
        if obj.image:
            main_url = request.build_absolute_uri(obj.image.url) if request else obj.image.url
            urls.append(main_url)
        for media in obj.gallery_images.all():
            if not media.image:
                continue
            media_url = request.build_absolute_uri(media.image.url) if request else media.image.url
            if media_url not in urls:
                urls.append(media_url)
        return urls

    def get_video_gallery(self, obj):
        request = self.context.get('request')
        urls = []
        if obj.video:
            main_url = request.build_absolute_uri(obj.video.url) if request else obj.video.url
            urls.append(main_url)
        for media in obj.gallery_videos.all():
            if not media.video:
                continue
            media_url = request.build_absolute_uri(media.video.url) if request else media.video.url
            if media_url not in urls:
                urls.append(media_url)
        return urls

class ShopSerializer(serializers.ModelSerializer):
    products = ProductSerializer(many=True, read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category_fk',
        required=False,
        allow_null=True
    )
    category_name = serializers.CharField(source='category_fk.name', read_only=True)
    
    class Meta:
        model = Shop
        fields = '__all__'
        read_only_fields = ['seller', 'revenue', 'commission', 'category_name']
    
    def create(self, validated_data):
        # Set the seller to the current user
        validated_data['seller'] = self.context['request'].user
        return super().create(validated_data)
    
    def to_representation(self, instance):
        """Custom representation to handle category display"""
        data = super().to_representation(instance)
        
        # If category_fk exists, use it; otherwise fall back to the old category field
        if instance.category_fk:
            data['category'] = instance.category_fk.id
            data['category_name'] = instance.category_fk.name
        elif instance.category:
            # For backward compatibility, show the old category string
            data['category_name'] = instance.category
        
        return data
