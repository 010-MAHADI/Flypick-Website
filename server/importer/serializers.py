from rest_framework import serializers

from .models import ImportJob, ProductSource


class ImportPreviewSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=2000)
    refresh = serializers.BooleanField(required=False, default=False)


class SpecificationSerializer(serializers.Serializer):
    # Specs live in the variants JSON column — no hard DB limit, so be
    # generous here; real-world spec sheets easily exceed a few hundred chars.
    key = serializers.CharField(max_length=200)
    value = serializers.CharField(max_length=2000)


class ImportedProductSerializer(serializers.Serializer):
    """The edited preview payload the admin submits on Save."""
    title = serializers.CharField(max_length=255)
    short_description = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    original_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0,
                                              required=False, allow_null=True)
    currency = serializers.CharField(max_length=5, required=False, allow_blank=True, default='BDT')
    brand = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    manufacturer = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    sku = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    model_number = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    category = serializers.IntegerField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, default=list)
    stock_quantity = serializers.IntegerField(required=False, min_value=0, default=0)
    stock_status = serializers.CharField(max_length=20, required=False, allow_blank=True, default='unknown')
    colors = serializers.ListField(child=serializers.CharField(max_length=50), required=False, default=list)
    sizes = serializers.ListField(child=serializers.CharField(max_length=50), required=False, default=list)
    options = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    specifications = SpecificationSerializer(many=True, required=False, default=list)
    warranty = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    highlights = serializers.ListField(child=serializers.CharField(max_length=500), required=False, default=list)
    shipping = serializers.DictField(required=False, default=dict)
    seo_title = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    seo_description = serializers.CharField(required=False, allow_blank=True, default='')
    slug = serializers.SlugField(max_length=80, required=False, allow_blank=True, default='')
    status = serializers.ChoiceField(choices=['Draft', 'Active'], required=False, default='Draft')


class ImportSaveSerializer(serializers.Serializer):
    shop = serializers.IntegerField(required=False, allow_null=True)
    source_url = serializers.URLField(max_length=2000)
    source_site = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    product = ImportedProductSerializer()
    images = serializers.ListField(child=serializers.URLField(max_length=2000), required=False,
                                   default=list, max_length=10)


class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = ['id', 'url', 'source_site', 'stage', 'status', 'error_code', 'error_message',
                  'result_summary', 'product', 'duration_ms', 'created_at']


class ProductSourceSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source='added_by.username', read_only=True)

    class Meta:
        model = ProductSource
        fields = ['id', 'product', 'url', 'source_site', 'is_primary', 'label',
                  'sync_enabled', 'last_checked_at', 'sync_status', 'last_result',
                  'last_seen_price', 'last_seen_stock_status', 'consecutive_failures',
                  'added_by_name', 'created_at']
        read_only_fields = ['product', 'last_checked_at', 'sync_status', 'last_result',
                            'last_seen_price', 'last_seen_stock_status', 'consecutive_failures',
                            'added_by_name', 'created_at']


class ProductSourceCreateSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=2000)
    label = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    is_primary = serializers.BooleanField(required=False, default=False)
