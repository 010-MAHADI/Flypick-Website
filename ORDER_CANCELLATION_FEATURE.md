# Order Cancellation Feature Implementation

## Overview
Implemented customer order cancellation functionality that allows customers to cancel their orders only when the status is "pending". Once the order status changes to "processing" or beyond, the cancel button is hidden and customers can no longer cancel the order.

## Features Implemented

### 1. Backend API Endpoint
**File**: `server/orders/views.py`
- Added `@action(detail=True, methods=['patch'])` decorator for `cancel` method
- **Endpoint**: `PATCH /api/orders/orders/{order_id}/cancel/`
- **Security**: Only order owners can cancel their own orders
- **Business Logic**: Only orders with "pending" status can be cancelled
- **Response**: Returns updated order data with "cancelled" status

### 2. Frontend Order Context
**File**: `client/Customer_site/src/context/OrderContext.tsx`
- Added `cancelOrder` function to OrderContext interface
- Implements API call to cancel endpoint
- Updates local state immediately after successful cancellation
- Returns boolean success indicator

### 3. Customer Orders Page
**File**: `client/Customer_site/src/pages/Orders.tsx`
- Added cancel button to order cards (only visible for pending orders)
- Confirmation dialog before cancellation
- Loading state during cancellation process
- Success/error toast notifications
- Button disappears once order status changes from "pending"

### 4. Order Detail Page
**File**: `client/Customer_site/src/pages/OrderDetail.tsx`
- Added cancel button in order actions section
- Same confirmation and loading behavior as orders page
- Consistent UI/UX with orders list page

## Business Rules

### When Customers Can Cancel:
- ✅ Order status is "pending"
- ✅ Customer is the order owner
- ✅ Order exists and is accessible

### When Customers Cannot Cancel:
- ❌ Order status is "processing", "shipped", "delivered", or "cancelled"
- ❌ Customer is not the order owner
- ❌ Order doesn't exist

## User Experience

### Visual Indicators:
- **Pending Orders**: Red "Cancel Order" button with XCircle icon
- **Processing+ Orders**: No cancel button visible
- **Loading State**: Spinner animation with "Cancelling..." text
- **Confirmation**: Browser confirm dialog before cancellation

### User Flow:
1. Customer views their orders
2. For pending orders, sees "Cancel Order" button
3. Clicks cancel button → confirmation dialog appears
4. Confirms cancellation → API call with loading state
5. Success → order status updates to "cancelled" + success toast
6. Error → error toast, order remains unchanged

## Technical Implementation

### API Security:
```python
# Check ownership
if order.customer != request.user:
    return Response({'detail': 'You can only cancel your own orders.'}, 
                   status=403)

# Check status
if order.status != 'pending':
    return Response({'detail': 'Cannot cancel order with status...'}, 
                   status=400)
```

### Frontend State Management:
```typescript
// Optimistic update
setOrders(prevOrders => 
  prevOrders.map(o => 
    o.order_id === orderId 
      ? { ...o, status: 'cancelled' }
      : o
  )
);
```

### UI Conditional Rendering:
```tsx
{order.status === "pending" && (
  <button onClick={() => onCancelOrder(order.order_id)}>
    Cancel Order
  </button>
)}
```

## Integration Points

### Notifications:
- Order cancellation triggers notification system
- Email notifications sent for cancelled orders
- Seller notifications for cancelled orders

### Order Status Flow:
- `pending` → `cancelled` (customer action)
- `pending` → `processing` → `shipped` → `delivered` (seller actions)
- Once status moves beyond "pending", customer cannot cancel

## Testing Scenarios

### Positive Cases:
1. ✅ Customer cancels their own pending order
2. ✅ UI updates immediately after cancellation
3. ✅ Cancel button disappears after status change
4. ✅ Confirmation dialog prevents accidental cancellation

### Negative Cases:
1. ✅ Cannot cancel processing/shipped/delivered orders
2. ✅ Cannot cancel other customers' orders
3. ✅ Proper error handling for API failures
4. ✅ Loading states prevent double-clicking

## Files Modified
- `server/orders/views.py` - Added cancel API endpoint
- `client/Customer_site/src/context/OrderContext.tsx` - Added cancel function
- `client/Customer_site/src/pages/Orders.tsx` - Added cancel UI to order list
- `client/Customer_site/src/pages/OrderDetail.tsx` - Added cancel UI to order detail

## Benefits
- **Customer Control**: Customers can cancel unwanted pending orders
- **Business Logic**: Prevents cancellation of orders already in fulfillment
- **User Experience**: Clear visual indicators and feedback
- **Security**: Proper authorization and validation
- **Consistency**: Same behavior across orders list and detail pages