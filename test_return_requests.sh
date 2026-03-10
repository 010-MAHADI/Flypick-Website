#!/bin/bash

# Test Return Request API Endpoints
# Make sure the server is running before executing this script

BASE_URL="http://localhost:8000/api/orders"

echo "=== Testing Return Request API ==="
echo ""

# 1. Get authentication token (replace with actual credentials)
echo "1. Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/users/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "customer@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"
echo ""

# 2. List return requests
echo "2. Listing return requests..."
curl -s -X GET "$BASE_URL/returns/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" | python -m json.tool
echo ""

# 3. Create a return request (replace ORDER_ID with actual order ID)
echo "3. Creating a return request..."
curl -s -X POST "$BASE_URL/returns/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "FP1234567890",
    "reason": "Product damaged",
    "description": "The product arrived with visible damage",
    "items": [
      {
        "order_item_id": 1,
        "quantity": 1
      }
    ]
  }' | python -m json.tool
echo ""

# 4. Update return status (seller/admin only - replace RETURN_ID)
echo "4. Updating return status (requires seller/admin token)..."
curl -s -X PATCH "$BASE_URL/returns/1/update_status/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "admin_note": "Return approved by seller",
    "refund_amount": "99.99"
  }' | python -m json.tool
echo ""

echo "=== Test Complete ==="
