# Environment Setup Guide

## 🎯 Overview

This project now uses a centralized environment configuration system that allows easy switching between local development and production environments without modifying multiple files.

## 🚀 Quick Start (Local Development)

The project is now configured for local development by default. Simply run:

```bash
# 1. Start Django server
cd server
python manage.py runserver

# 2. Start Customer site (in new terminal)
cd client/Customer_site
npm run dev

# 3. Start Seller dashboard (in new terminal)
cd client/seller-side
npm run dev
```

**Local URLs:**
- API Server: http://localhost:8000
- Customer Site: http://localhost:8080
- Seller Dashboard: http://localhost:8081

## 🔄 Environment Switching

### Method 1: Using Scripts (Recommended)

**Windows:**
```cmd
# Switch to local development
scripts\switch-to-local.bat

# Switch to production
scripts\switch-to-production.bat
```

**Linux/Mac:**
```bash
# Switch to local development
bash scripts/switch-to-local.sh

# Switch to production
bash scripts/switch-to-production.sh
```

### Method 2: Manual Copy

**For Local Development:**
```bash
cp server/.env.local server/.env
cp client/Customer_site/.env.local client/Customer_site/.env
cp client/seller-side/.env.local client/seller-side/.env
```

**For Production:**
```bash
cp server/.env.production server/.env
cp client/Customer_site/.env.production client/Customer_site/.env
cp client/seller-side/.env.production client/seller-side/.env
```

## 📁 File Structure

```
├── server/
│   ├── .env                 # Active environment (local by default)
│   ├── .env.local          # Local development settings
│   ├── .env.production     # Production settings
│   └── .env.example        # Template for new environments
├── client/Customer_site/
│   ├── .env                # Active environment (local by default)
│   ├── .env.local          # Local development settings
│   └── .env.production     # Production settings
├── client/seller-side/
│   ├── .env                # Active environment (local by default)
│   ├── .env.local          # Local development settings
│   └── .env.production     # Production settings
└── scripts/
    ├── switch-to-local.sh   # Linux/Mac environment switcher
    ├── switch-to-local.bat  # Windows environment switcher
    ├── switch-to-production.sh
    └── switch-to-production.bat
```

## ⚙️ Configuration Details

### Server Environment Variables
- `DEBUG`: Enable/disable debug mode
- `ALLOWED_HOSTS`: Comma-separated allowed hosts
- `CORS_ALLOWED_ORIGINS`: Comma-separated CORS origins
- `FRONTEND_URL`: Customer site URL for email links
- `SELLER_FRONTEND_URL`: Seller dashboard URL for email links
- `USE_SQLITE`: Use SQLite (True) or PostgreSQL (False)

### Client Environment Variables
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_MEDIA_URL`: Media files URL
- `VITE_SITE_NAME`: Site name for frontend
- `VITE_CUSTOMER_URL`: Customer site URL
- `VITE_SELLER_URL`: Seller dashboard URL

## 🔒 Security Notes

- All `.env` files are now in `.gitignore`
- Never commit production credentials
- Use `.env.example` as template for new environments
- Production files contain sensitive data - handle carefully

## 🐛 Troubleshooting

**CORS Issues:**
- Check `CORS_ALLOWED_ORIGINS` in server/.env
- Ensure client URLs match server CORS settings

**API Connection Issues:**
- Verify `VITE_API_BASE_URL` in client .env files
- Check Django server is running on correct port

**Environment Not Switching:**
- Restart development servers after switching
- Check if .env files exist in all directories
- Verify script permissions on Linux/Mac