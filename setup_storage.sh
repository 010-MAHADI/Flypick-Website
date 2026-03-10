#!/bin/bash

# Setup script for file storage system

echo "=========================================="
echo "Setting up File Storage System"
echo "=========================================="
echo ""

# Create storage directories
echo "Creating storage directories..."
mkdir -p storage/products/images
mkdir -p storage/products/videos
mkdir -p storage/categories
mkdir -p storage/users
mkdir -p storage/shops
mkdir -p storage/banners

echo "✅ Storage directories created"
echo ""

# Set permissions (Unix/Linux/Mac only)
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
  echo "Setting permissions..."
  chmod -R 755 storage/
  echo "✅ Permissions set"
  echo ""
fi

# Run Django migrations
echo "Running Django migrations..."
cd server
python manage.py makemigrations
python manage.py migrate
cd ..

echo ""
echo "=========================================="
echo "✅ File Storage System Setup Complete!"
echo "=========================================="
echo ""
echo "Storage structure:"
echo "  storage/"
echo "  ├── products/"
echo "  │   ├── images/"
echo "  │   └── videos/"
echo "  ├── categories/"
echo "  ├── users/"
echo "  ├── shops/"
echo "  └── banners/"
echo ""
echo "Next steps:"
echo "1. Start your Django server: cd server && python manage.py runserver"
echo "2. Test file upload from the frontend"
echo "3. Check FILE_UPLOAD_SYSTEM.md for API documentation"
echo ""
