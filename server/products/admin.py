from django.contrib import admin
from django import forms
from .models import Category, Shop, Product, ProductImage, ProductVideo

class CategoryAdminForm(forms.ModelForm):
    """Custom form to ensure proper file upload widget"""
    class Meta:
        model = Category
        fields = '__all__'
        widgets = {
            'image': forms.FileInput(attrs={'accept': 'image/*'}),
        }

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    form = CategoryAdminForm
    list_display = ['name', 'slug', 'parent', 'image_preview', 'is_active', 'sort_order', 'created_at']
    list_filter = ['is_active', 'parent', 'created_at']
    search_fields = ['name', 'slug', 'description']
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ['is_active', 'sort_order']
    ordering = ['sort_order', 'name']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'slug', 'description')
        }),
        ('Image', {
            'fields': ('image', 'image_preview'),
            'description': 'Upload a category image (max 2MB, formats: jpg, png, webp, gif)'
        }),
        ('Organization', {
            'fields': ('parent', 'is_active', 'sort_order')
        }),
    )
    readonly_fields = ['image_preview']
    
    def image_preview(self, obj):
        if obj.image:
            from django.utils.html import format_html
            return format_html(
                '<img src="{}" style="max-height: 150px; max-width: 300px; border: 1px solid #ddd; padding: 5px;" /><br/>'
                '<small>Path: {}</small>',
                obj.image.url,
                obj.image.name
            )
        return format_html('<em>No image uploaded yet</em>')
    image_preview.short_description = 'Current Image'

@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = ['name', 'seller', 'category', 'status', 'revenue', 'commission', 'createdDate']
    list_filter = ['status', 'createdDate']
    search_fields = ['name', 'seller__username', 'category']
    list_editable = ['status', 'commission']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['title', 'shop', 'category', 'price', 'stock', 'sold_count', 'status', 'created_at']
    list_filter = ['status', 'category', 'shop', 'created_at']
    search_fields = ['title', 'sku', 'brand', 'description']
    list_editable = ['status', 'price', 'stock']
    readonly_fields = ['sold_count', 'reviews_count', 'rating', 'created_at', 'updated_at']

@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ['product', 'sort_order', 'created_at']
    list_filter = ['created_at']
    list_editable = ['sort_order']

@admin.register(ProductVideo)
class ProductVideoAdmin(admin.ModelAdmin):
    list_display = ['product', 'sort_order', 'created_at']
    list_filter = ['created_at']
    list_editable = ['sort_order']

