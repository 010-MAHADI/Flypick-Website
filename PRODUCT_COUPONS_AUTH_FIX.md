# Product Coupons Authentication Fix

## 🐛 Issue Identified

Users were still being redirected to the login page when visiting product detail pages because the ProductCoupons component was making an authenticated API call to fetch available coupons.

## 🔍 Root Cause

The `ProductCoupons` component calls `/orders/orders/product_coupons/?product_id=${productId}` to fetch available coupons for a product. However:

1. **Server-side**: The `OrderViewSet` had `permission_classes = [permissions.IsAuthenticated]` for ALL actions, including `product_coupons`
2. **Client-side**: The API interceptor was redirecting to login for any 401 response from `/orders/` endpoints

This meant that even though product coupons should be publicly viewable (to show discounts to potential customers), the endpoint required authentication.

## ✅ Fix Applied

### 1. Server-side: Made product_coupons endpoint public

**File**: `server/orders/views.py`

Added custom permission handling to the `OrderViewSet`:

```python
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
```

### 2. Client-side: Updated API interceptor exception

**File**: `client/Customer_site/src/lib/api.ts`

Updated the 401 handling to exclude the public coupon endpoint:

```typescript
const isProtectedEndpoint = (url.includes('/auth/') || 
                           url.includes('/orders/') || 
                           url.includes('/cart/') || 
                           url.includes('/profile/') ||
                           url.includes('/wishlist/')) &&
                           !url.includes('/orders/orders/product_coupons/'); // Exception for public coupon endpoint
```

## 🎯 Result

✅ **Product pages are now fully accessible** without authentication
✅ **Coupons display correctly** for all users (logged in or not)
✅ **No automatic redirects** to login page when viewing products
✅ **Protected endpoints still secure** - other order operations still require authentication

## 🧪 User Experience

**Before:**
- Visit product page → ProductCoupons component loads → API call to `/orders/orders/product_coupons/` → 401 response → automatic redirect to login

**After:**
- Visit product page → ProductCoupons component loads → API call succeeds → coupons display → no redirect

## 📝 Why This Makes Sense

Product coupons should be publicly viewable because:
- They encourage purchases by showing available discounts
- Users should see potential savings before deciding to register/login
- It's a marketing tool to attract customers
- The actual coupon validation still happens at checkout (which requires authentication)

## 🔒 Security Note

This change only makes coupon **viewing** public. The actual coupon **usage** and validation still requires authentication and happens during the checkout process, maintaining security while improving user experience.