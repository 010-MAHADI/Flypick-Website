# Seller-side Build Fix

## 🐛 Issue Fixed

**Error**: `"useUpdateOrderStatus" is not exported by "src/hooks/useOrders.tsx"`

## ✅ Solution Applied

### 1. Added Missing Export
Added `useUpdateOrderStatus` function to `client/seller-side/src/hooks/useOrders.tsx`:

```typescript
export const useUpdateOrderStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ orderApiId, status }: { orderApiId: string; status: string }) => {
            const response = await api.patch(`/orders/orders/${orderApiId}/`, {
                status: status
            });
            return response.data;
        },
        onSuccess: () => {
            // Invalidate and refetch orders
            queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
        },
        onError: (error) => {
            console.error('Failed to update order status:', error);
        }
    });
};
```

### 2. Fixed Import Issues
- Updated imports to include `useMutation` and `useQueryClient`
- Removed duplicate import statements
- Ensured proper TypeScript types

### 3. Parameter Matching
The function accepts parameters that match the usage in `Orders.tsx`:
- `orderApiId`: The order ID for the API call
- `status`: The new status to update

## 🚀 Next Steps

1. **Run the build again**:
   ```bash
   cd /var/www/SIPI-Website/client/seller-side
   npm run build
   ```

2. **If successful**, the build files will be in `dist/` folder

3. **Update browserslist** (optional but recommended):
   ```bash
   npx update-browserslist-db@latest
   ```

## 🔍 Verification

The function is used in `Orders.tsx` as:
```typescript
const updateOrderStatus = useUpdateOrderStatus();

// Later used as:
await updateOrderStatus.mutateAsync({
  orderApiId: targetOrder.apiId,
  status: targetStatus,
});
```

## 📁 Files Modified

- ✅ `client/seller-side/src/hooks/useOrders.tsx` - Added missing export
- ✅ Fixed duplicate imports
- ✅ Added proper TypeScript types

The build should now complete successfully!