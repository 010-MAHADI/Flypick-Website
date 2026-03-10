from django.contrib import admin
from .models import CustomUser, SellerProfile, CustomerProfile, Address

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['email', 'username', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active']
    search_fields = ['email', 'username']

@admin.register(SellerProfile)
class SellerProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'business_name', 'status', 'verified']
    list_filter = ['status', 'verified']
    search_fields = ['user__email', 'business_name']

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'first_name', 'last_name', 'phone']
    search_fields = ['user__email', 'first_name', 'last_name', 'phone']

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'city', 'country', 'is_default']
    list_filter = ['is_default', 'country']
    search_fields = ['user__email', 'full_name', 'city']
