#!/bin/bash

echo "🔧 Fixing Seller-side Build Issues..."
echo ""

# Navigate to seller-side directory
cd client/seller-side

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🏗️ Attempting to build..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📁 Build files are in: client/seller-side/dist/"
else
    echo ""
    echo "❌ Build failed. Check the error messages above."
    echo ""
    echo "Common fixes:"
    echo "1. Check for missing exports in hook files"
    echo "2. Verify all imports are correct"
    echo "3. Check TypeScript types"
    echo ""
    echo "To debug further, run:"
    echo "cd client/seller-side && npm run build"
fi