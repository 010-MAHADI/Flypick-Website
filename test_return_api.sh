#!/bin/bash

# Test script to check return requests API
# Run this after logging in as a seller

echo "=== Testing Return Requests API ==="
echo ""

# Replace with your actual token
TOKEN="your_seller_token_here"
SHOP_ID="1"

echo "1. Fetching return requests for shop $SHOP_ID..."
curl -s -X GET "http://localhost:8000/api/orders/returns/?shop=$SHOP_ID" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" | python -m json.tool

echo ""
echo "2. Fetching all return requests (no shop filter)..."
curl -s -X GET "http://localhost:8000/api/orders/returns/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" | python -m json.tool

echo ""
echo "=== Test Complete ==="
