#!/bin/bash

# Switch to Production Environment

echo "🔄 Switching to production environment..."

# Server environment
if [ -f "server/.env.production" ]; then
    cp server/.env.production server/.env
    echo "✅ Server environment switched to production"
else
    echo "❌ server/.env.production not found"
fi

# Customer site environment
if [ -f "client/Customer_site/.env.production" ]; then
    cp client/Customer_site/.env.production client/Customer_site/.env
    echo "✅ Customer site environment switched to production"
else
    echo "❌ client/Customer_site/.env.production not found"
fi

# Seller dashboard environment
if [ -f "client/seller-side/.env.production" ]; then
    cp client/seller-side/.env.production client/seller-side/.env
    echo "✅ Seller dashboard environment switched to production"
else
    echo "❌ client/seller-side/.env.production not found"
fi

echo ""
echo "⚠️  PRODUCTION ENVIRONMENT ACTIVE"
echo "📝 Production URLs:"
echo "   - Customer Site: https://flypick.shop"
echo "   - Seller Dashboard: https://seller.flypick.shop"
echo ""
echo "🔒 Remember to:"
echo "   - Update SSL certificates"
echo "   - Check database connections"
echo "   - Verify email configuration"
echo "   - Test all functionality"