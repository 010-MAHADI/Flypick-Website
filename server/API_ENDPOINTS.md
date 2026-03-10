# API Endpoints Reference

## Base URL
`http://localhost:8000/api/`

## Authentication Endpoints

### Get JWT Token
```
POST /api/auth/token/
Body: {"username": "admin", "password": "admin123"}
Response: {"access": "...", "refresh": "..."}
```

### Refresh Token
```
POST /api/auth/token/refresh/
Body: {"refresh": "..."}
Response: {"access": "..."}
```

### Register
```
POST /api/auth/register/
Body: {"username": "...", "email": "...", "password": "...", "role": "Customer|Seller"}
```

### Get Profile
```
GET /api/auth/profile/
GET /api/users/profile/  (alias)
Headers: Authorization: Bearer <access_token>
```

### Update Profile
```
PUT /api/auth/profile/
PATCH /api/auth/profile/
Headers: Authorization: Bearer <access_token>
Body: {...profile data...}
```

## User Management (Admin Only)

### List Sellers
```
GET /api/auth/sellers/list/
GET /api/users/sellers/list/  (alias)
Headers: Authorization: Bearer <access_token>
```

### Update Seller Status
```
PUT /api/auth/sellers/list/{id}/update_status/
Body: {"status": "active|inactive", "verified": true|false}
```

## Dashboard

### Get Dashboard Stats
```
GET /api/auth/dashboard/stats/
GET /api/users/dashboard/stats/  (alias)
Headers: Authorization: Bearer <access_token>
```

## Products & Shops

### List All Products
```
GET /api/products/
```

### Get Single Product
```
GET /api/products/{id}/
```

### Create Product (Authenticated)
```
POST /api/products/
Headers: Authorization: Bearer <access_token>
Body: {"name": "...", "price": 100, "shop": 1, ...}
```

### Update Product (Owner Only)
```
PUT /api/products/{id}/
PATCH /api/products/{id}/
Headers: Authorization: Bearer <access_token>
```

### Delete Product (Owner Only)
```
DELETE /api/products/{id}/
Headers: Authorization: Bearer <access_token>
```

### List All Shops
```
GET /api/products/shops/
GET /api/shops/  (alias)
```

### Get Single Shop
```
GET /api/products/shops/{id}/
GET /api/shops/{id}/  (alias)
```

### Create Shop (Authenticated)
```
POST /api/products/shops/
POST /api/shops/  (alias)
Headers: Authorization: Bearer <access_token>
Body: {"name": "...", "category": "...", "description": "..."}
```

### Update Shop (Owner Only)
```
PUT /api/products/shops/{id}/
PATCH /api/products/shops/{id}/
Headers: Authorization: Bearer <access_token>
```

### Delete Shop (Owner Only)
```
DELETE /api/products/shops/{id}/
Headers: Authorization: Bearer <access_token>
```

## Orders

### List Orders
```
GET /api/orders/
Headers: Authorization: Bearer <access_token>
```
- Customers see their own orders
- Sellers see orders containing their products
- Admins see all orders

### Get Single Order
```
GET /api/orders/{id}/
Headers: Authorization: Bearer <access_token>
```

### Create Order
```
POST /api/orders/
Headers: Authorization: Bearer <access_token>
Body: {order data}
```

### Update Order Status
```
PATCH /api/orders/{id}/
Headers: Authorization: Bearer <access_token>
Body: {"status": "pending|processing|shipped|delivered|cancelled"}
```

## Cart (Authenticated Users Only)

### Get Cart
```
GET /api/cart/
Headers: Authorization: Bearer <access_token>
Response: {
  "id": 1,
  "user": 1,
  "items": [...],
  "total_items": 5,
  "total_price": "5000.00"
}
```

### Add to Cart
```
POST /api/cart/add/
Headers: Authorization: Bearer <access_token>
Body: {
  "product_id": 1,
  "quantity": 1,
  "color": "Red",
  "size": "M",
  "shipping_type": "Standard"
}
```

### Update Cart Item
```
PATCH /api/cart/update_item/
Headers: Authorization: Bearer <access_token>
Body: {
  "item_id": 1,
  "quantity": 2,
  "selected": true
}
```

### Remove Cart Item
```
DELETE /api/cart/remove_item/?item_id=1
Headers: Authorization: Bearer <access_token>
```

### Select/Deselect All Items
```
POST /api/cart/select_all/
Headers: Authorization: Bearer <access_token>
Body: {"selected": true}
```

### Clear Cart
```
POST /api/cart/clear/
Headers: Authorization: Bearer <access_token>
```

### Get Selected Items
```
GET /api/cart/selected/
Headers: Authorization: Bearer <access_token>
Response: {
  "items": [...],
  "total": "3000.00",
  "count": 3
}
```

## URL Aliases

For compatibility, these aliases are available:

- `/api/users/*` → `/api/auth/*`
- `/api/shops/*` → `/api/products/shops/*`

## Testing with cURL

### Get Token
```bash
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Get Profile
```bash
curl http://localhost:8000/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### List Products
```bash
curl http://localhost:8000/api/products/
```

### Create Shop
```bash
curl -X POST http://localhost:8000/api/products/shops/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Shop","category":"Electronics","description":"Best electronics"}'
```

## Response Formats

### Success Response
```json
{
  "id": 1,
  "field1": "value1",
  "field2": "value2"
}
```

### Error Response
```json
{
  "detail": "Error message"
}
```

### Validation Error
```json
{
  "field_name": ["Error message for this field"]
}
```

## Pagination

List endpoints return paginated results:

```json
{
  "count": 100,
  "next": "http://localhost:8000/api/products/?page=2",
  "previous": null,
  "results": [...]
}
```

Default page size: 20 items

## Rate Limiting

- Anonymous users: 100 requests/hour
- Authenticated users: 1000 requests/hour

## CORS

Allowed origins (development):
- http://localhost:5173
- http://localhost:5174
- http://localhost:8081
- http://localhost:3000
