# Shop Creation Category Field Fix

## Issue Fixed
Shop creation was failing with error: `"Incorrect type. Expected pk value, received str."`

**Root Cause**: The frontend was sending category names as strings, but the backend ShopSerializer expected category IDs (primary keys) due to the migration from CharField to ForeignKey for categories.

## Changes Made

### Backend Changes

#### 1. Enhanced ShopSerializer (`server/products/serializers.py`)
- **Added `create()` method** to automatically set the seller to the current user
- **Enhanced `to_representation()`** method for backward compatibility
- **Improved category handling** to work with both old string categories and new ForeignKey categories

#### 2. Created Default Categories Script (`server/create_default_categories.py`)
- **Automated category creation** with predefined categories
- **Handles duplicates gracefully** using `get_or_create()`
- **Sets proper slugs and sort order** for categories

### Frontend Changes

#### 1. Updated CreateShop Component (`client/seller-side/src/pages/CreateShop.tsx`)
- **Added category fetching** from `/api/products/categories/` endpoint
- **Dynamic category loading** with loading states
- **Fallback categories** if API fails or no categories exist
- **Proper category ID handling** - sends category ID instead of name
- **Enhanced error handling** with specific category error messages
- **Loading state management** for better UX

#### Key improvements:
```typescript
// Before: Sent category name as string
category: formData.category

// After: Sends category ID as integer
category: selectedCategory ? selectedCategory.id : parseInt(formData.category)
```

## API Endpoints Used

### Categories Endpoint
- **GET** `/api/products/categories/` - Fetch available categories
- **Response**: Array of category objects with `id`, `name`, `slug`

### Shop Creation Endpoint  
- **POST** `/api/products/shops/` - Create new shop
- **Payload**: `{ name, category: <id>, description, status }`

## Deployment Steps

### 1. Backend Setup
```bash
cd /var/www/Flypick-Website/server
source venv/bin/activate

# Create default categories
python create_default_categories.py

# Run migrations (if needed)
python manage.py migrate

# Restart backend
sudo systemctl restart flypick
```

### 2. Frontend Deployment
```bash
cd /var/www/Flypick-Website/client/seller-side
npm install
npm run build

# Copy to nginx directory
sudo cp -r dist/* /var/www/html/seller/

# Restart nginx
sudo systemctl restart nginx
```

## Expected Results

### ✅ **Shop Creation Fixed**
- Shop creation will work without category field errors
- Categories are fetched dynamically from the database
- Proper category IDs are sent to the backend
- Better error messages for category-related issues

### ✅ **Improved User Experience**
- Loading states while fetching categories
- Fallback categories if API fails
- Clear error messages for validation failures
- Disabled submit button while loading

### ✅ **Backward Compatibility**
- Existing shops with string categories still work
- New shops use proper category relationships
- Gradual migration path for category system

## Files Modified

1. `server/products/serializers.py` - Enhanced ShopSerializer
2. `client/seller-side/src/pages/CreateShop.tsx` - Updated category handling
3. `server/create_default_categories.py` - New category creation script

## Testing

After deployment, test:
1. **Category Loading**: Categories should load in the dropdown
2. **Shop Creation**: Should create shops successfully
3. **Error Handling**: Should show proper error messages
4. **Fallback**: Should work even if categories API fails

The shop creation process now properly handles the category field migration from string to ForeignKey relationship.