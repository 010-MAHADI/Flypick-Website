#!/bin/bash

# Test Cart API Endpoints
# Make sure the Django server is running before executing this script

BASE_URL="http://localhost:8000/api"

echo "=== Testing Cart API ==="
echo ""

# Step 1: Login to get token
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/token/" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Make sure admin user exists."
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: Get empty cart
echo "2. Getting cart (should be empty or existing)..."
curl -s -X GET "$BASE_URL/cart/" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
echo ""

# Step 3: Add item to cart
echo "3. Adding product to cart..."
ADD_RESPONSE=$(curl -s -X POST "$BASE_URL/cart/add/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":2,"color":"Red","size":"M"}')

echo $ADD_RESPONSE | python -m json.tool
echo ""

# Step 4: Get cart with items
echo "4. Getting cart with items..."
CART_RESPONSE=$(curl -s -X GET "$BASE_URL/cart/" \
  -H "Authorization: Bearer $TOKEN")

echo $CART_RESPONSE | python -m json.tool
echo ""

# Extract item_id from response
ITEM_ID=$(echo $CART_RESPONSE | grep -o '"id":[0-9]*' | head -2 | tail -1 | cut -d':' -f2)

if [ -z "$ITEM_ID" ]; then
  echo "❌ No cart items found"
  exit 1
fi

echo "Cart item ID: $ITEM_ID"
echo ""

# Step 5: Update quantity
echo "5. Updating item quantity..."
curl -s -X PATCH "$BASE_URL/cart/update_item/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"item_id\":$ITEM_ID,\"quantity\":5}" | python -m json.tool
echo ""

# Step 6: Toggle selection
echo "6. Deselecting item..."
curl -s -X PATCH "$BASE_URL/cart/update_item/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"item_id\":$ITEM_ID,\"selected\":false}" | python -m json.tool
echo ""

# Step 7: Select all
echo "7. Selecting all items..."
curl -s -X POST "$BASE_URL/cart/select_all/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selected":true}' | python -m json.tool
echo ""

# Step 8: Get selected items
echo "8. Getting selected items..."
curl -s -X GET "$BASE_URL/cart/selected/" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
echo ""

# Step 9: Remove item
echo "9. Removing item from cart..."
curl -s -X DELETE "$BASE_URL/cart/remove_item/?item_id=$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
echo ""

# Step 10: Verify cart after removal
echo "10. Verifying cart after removal..."
curl -s -X GET "$BASE_URL/cart/" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
echo ""

echo "=== Cart API Test Complete ==="
