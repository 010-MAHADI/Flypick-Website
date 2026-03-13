from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, SellerProfile, CustomerProfile, Address

class CustomerProfileInline(admin.StackedInline):
    model = CustomerProfile
    can_delete = False
    verbose_name_plural = 'Customer Profile'
    fields = ('first_name', 'last_name', 'phone', 'email_notifications', 'language', 'currency')

class SellerProfileInline(admin.StackedInline):
    model = SellerProfile
    can_delete = False
    verbose_name_plural = 'Seller Profile'
    fields = ('business_name', 'phone', 'status', 'verified', 'business_category')

class AddressInline(admin.TabularInline):
    model = Address
    extra = 0
    fields = ('full_name', 'phone', 'city', 'country', 'is_default')

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'username', 'role', 'get_full_name', 'get_phone', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'date_joined', 'is_staff']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering = ['-date_joined']
    list_per_page = 25
    
    # Add inlines based on user role
    def get_inlines(self, request, obj):
        inlines = [AddressInline]
        if obj and obj.role == 'Customer':
            inlines.insert(0, CustomerProfileInline)
        elif obj and obj.role == 'Seller':
            inlines.insert(0, SellerProfileInline)
        return inlines
    
    def get_full_name(self, obj):
        """Get full name from customer profile or user fields"""
        if hasattr(obj, 'customer_profile') and obj.customer_profile:
            profile = obj.customer_profile
            if profile.first_name or profile.last_name:
                return f"{profile.first_name or ''} {profile.last_name or ''}".strip()
        return f"{obj.first_name} {obj.last_name}".strip() or "No name"
    get_full_name.short_description = 'Full Name'
    
    def get_phone(self, obj):
        """Get phone from profile"""
        if hasattr(obj, 'customer_profile') and obj.customer_profile and obj.customer_profile.phone:
            return obj.customer_profile.phone
        elif hasattr(obj, 'seller_profile') and obj.seller_profile and obj.seller_profile.phone:
            return obj.seller_profile.phone
        return "No phone"
    get_phone.short_description = 'Phone'
    
    # Customize fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ('Role Information', {'fields': ('role',)}),
    )
    
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role Information', {'fields': ('role', 'email')}),
    )
    
    # Add actions
    actions = ['activate_users', 'deactivate_users']
    
    def activate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} users were successfully activated.')
    activate_users.short_description = "Activate selected users"
    
    def deactivate_users(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} users were successfully deactivated.')
    deactivate_users.short_description = "Deactivate selected users"

@admin.register(SellerProfile)
class SellerProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'business_name', 'phone', 'status', 'verified', 'reviewed_at']
    list_filter = ['status', 'verified', 'business_category']
    search_fields = ['user__email', 'user__username', 'business_name', 'phone']
    readonly_fields = ['reviewed_at']
    
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Business Information', {
            'fields': ('business_name', 'business_category', 'business_description')
        }),
        ('Contact Information', {
            'fields': ('phone', 'location', 'address')
        }),
        ('Documents & Verification', {
            'fields': ('idDocument', 'bankAccount', 'avatar')
        }),
        ('Status & Review', {
            'fields': ('status', 'verified', 'reviewed_by', 'reviewed_at', 'review_note')
        }),
        ('Additional Information', {
            'fields': ('additional_info',),
            'classes': ('collapse',)
        })
    )

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'get_full_name', 'phone', 'email_notifications', 'created_at']
    list_filter = ['email_notifications', 'language', 'currency', 'created_at']
    search_fields = ['user__email', 'user__username', 'first_name', 'last_name', 'phone']
    readonly_fields = ['created_at', 'updated_at']
    
    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or "No name"
    get_full_name.short_description = 'Full Name'
    
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'phone', 'profile_photo')
        }),
        ('Preferences', {
            'fields': ('email_notifications', 'language', 'currency')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'phone', 'city', 'country', 'is_default', 'created_at']
    list_filter = ['is_default', 'country', 'city', 'created_at']
    search_fields = ['user__email', 'full_name', 'phone', 'city', 'street']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'is_default')
        }),
        ('Contact Information', {
            'fields': ('full_name', 'phone')
        }),
        ('Address Information', {
            'fields': ('street', 'city', 'state', 'zip_code', 'country')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
