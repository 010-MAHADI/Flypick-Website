# Coupon Creation Debug Guide

## Issue
The "Create Coupon" button on the seller-side coupons page is not working.

## Debugging Steps Added

### 1. Enhanced Logging
Added console logs to track:
- Form submission events
- Form data entries
- Payload construction
- Coupon type and selections
- Button click events
- Mutation states

### 2. Relaxed Validation
Modified validation to be less strict:
- Only validate product selection if products are available
- Only validate category selection if categories are available
- Allow creation without selections for testing

### 3. Button State Debugging
Added logging to track button disabled state and mutation pending states.

## How to Debug

1. **Open Browser Developer Tools**
   - Go to Console tab
   - Clear console

2. **Try Creating a Coupon**
   - Click "Create Coupon" button
   - Fill out the form
   - Click "Create" button
   - Watch console for logs

3. **Check for Errors**
   - Look for any JavaScript errors
   - Check network tab for API calls
   - Verify form submission logs

## Expected Console Output

When working correctly, you should see:
```
Create button clicked {createPending: false, updatePending: false}
Form submitted! [FormEvent object]
Form data entries: [["code", "TEST123"], ["discountValue", "10"], ...]
Submitting coupon payload: {code: "TEST123", discount_type: "percent", ...}
Coupon type: all_products
Selected products: []
Selected category: undefined
```

## Common Issues to Check

1. **Form Validation Errors**
   - Required fields not filled
   - Invalid date format
   - Missing product/category selection

2. **Button Disabled State**
   - Mutation pending states
   - Form validation preventing submission

3. **API Errors**
   - Network connectivity
   - Authentication issues
   - Backend validation errors

4. **JavaScript Errors**
   - TypeScript compilation errors
   - Runtime exceptions
   - Missing dependencies

## Next Steps

If the console shows the form is submitting but still failing:
1. Check the network tab for API calls
2. Look for backend error responses
3. Verify authentication token
4. Check backend logs for errors

If the form is not submitting at all:
1. Check for JavaScript errors
2. Verify form structure and event handlers
3. Check if button is actually disabled
4. Look for validation preventing submission