from rest_framework import serializers
from .models import Category, Shop, Product

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
        ]
    
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
