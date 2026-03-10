#!/bin/bash

# Test Category Image Upload
# This script tests the category image upload functionality

echo "========================================="
echo "Category Image Upload Test"
echo "========================================="
echo ""

# Configuration
API_URL="http://localhost:8000"
TOKEN="YOUR_ADMIN_TOKEN_HERE"

echo "Step 1: Get all categories"
echo "GET $API_URL/api/products/categories/"
curl -s "$API_URL/api/products/categories/" | python -m json.tool
echo ""
echo ""

echo "Step 2: Create a test category"
echo "POST $API_URL/api/products/categories/"
CATEGORY_RESPONSE=$(curl -s -X POST "$API_URL/api/products/categories/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Category Upload",
    "description": "Testing image upload",
    "is_active": true,
    "sort_order": 0
  }')

echo "$CATEGORY_RESPONSE" | python -m json.tool
CATEGORY_ID=$(echo "$CATEGORY_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -z "$CATEGORY_ID" ]; then
  echo "Failed to create category"
  exit 1
fi

echo ""
echo "Created category with ID: $CATEGORY_ID"
echo ""

echo "Step 3: Upload image to category"
echo "POST $API_URL/api/products/upload-category-image/"

# Create a simple test image (1x1 pixel PNG)
echo "Creating test image..."
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > test_image.png

UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/products/upload-category-image/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "category_id=$CATEGORY_ID" \
  -F "image=@test_image.png")

echo "$UPLOAD_RESPONSE" | python -m json.tool
echo ""

echo "Step 4: Verify image was uploaded"
echo "GET $API_URL/api/products/categories/$CATEGORY_ID/"
curl -s "$API_URL/api/products/categories/$CATEGORY_ID/" | python -m json.tool
echo ""

# Cleanup
rm -f test_image.png

echo ""
echo "========================================="
echo "Test Complete"
echo "========================================="
echo ""
echo "Check the response above to verify:"
echo "1. Category was created with ID: $CATEGORY_ID"
echo "2. Image was uploaded successfully"
echo "3. Category response includes 'image' and 'image_url' fields"
echo ""
echo "To delete the test category:"
echo "curl -X DELETE \"$API_URL/api/products/categories/$CATEGORY_ID/\" -H \"Authorization: Bearer $TOKEN\""
