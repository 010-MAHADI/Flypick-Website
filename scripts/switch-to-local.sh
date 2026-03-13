#!/bin/bash

# Switch to Local Development Environment

echo "🔄 Switching to local development environment..."

# Server environment
if [ -f "server/.env.local" ]; then
    cp server/.env.local server/.env
    echo "✅ Server environment switched to local"
else
    echo "❌ server/.env.local not found"
fi

# Customer site environment
if [ -f "client/Customer_site/.env.local" ]; then
    cp client/Customer_site/.env.local client/Customer_site/.env
    echo "✅ Customer site environment switched to local"
else
    echo "❌ client/Customer_site/.env.local not found"
fi

# Seller dashboard environment
if [ -f "client/seller-side/.env.local" ]; then
    cp client/seller-side/.env.local client/seller-side/.env
    echo "✅ Seller dashboard environment switched to local"
else
    echo "❌ client/seller-side/.env.local not found"
fi

echo ""
echo "🎉 Environment switch complete!"
echo "📝 Local development URLs:"
echo "   - API Server: http://localhost:8000"
echo "   - Customer Site: http://localhost:8080"
echo "   - Seller Dashboard: http://localhost:8081"
echo ""
echo "🚀 Start development servers:"
echo "   cd server && python manage.py runserver"
echo "   cd client/Customer_site && npm run dev"
echo "   cd client/seller-side && npm run dev"