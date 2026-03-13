# Environment Configuration Guide

This project uses environment-based configuration to easily switch between local development and production environments.

## Environment Files Structure

```
├── server/
│   ├── .env                 # Local development (default)
│   ├── .env.local          # Local development (explicit)
│   ├── .env.production     # Production environment
│   └── .env.example        # Template for new environments
├── client/Customer_site/
│   ├── .env                # Local development (default)
│   ├── .env.local          # Local development (explicit)
│   └── .env.production     # Production environment
└── client/seller-side/
    ├── .env                # Local development (default)
    ├── .env.local          # Local development (explicit)
    └── .env.production     # Production environment
```

## Quick Environment Switching

### For Local Development (Default)
All `.env` files are configured for localhost by default. Just run:
```bash
# Start Django server
cd server && python manage.py runserver

# Start Customer site
cd client/Customer_site && npm run dev

# Start Seller dashboard
cd client/seller-side && npm run dev
```

### For Production Deployment
Copy production environment files:
```bash
# Server
cp server/.env.production server/.env

# Customer site
cp client/Customer_site/.env.production client/Customer_site/.env

# Seller dashboard
cp client/seller-side/.env.production client/seller-side/.env
```

## Environment Variables Reference

### Server (.env)
- `DEBUG`: Enable/disable debug mode
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `FRONTEND_URL`: Customer site URL for email links
- `SELLER_FRONTEND_URL`: Seller dashboard URL for email links
- `SITE_NAME`: Site name for emails and branding

### Client (.env)
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_MEDIA_URL`: Media files URL
- `VITE_SITE_NAME`: Site name for frontend
- `VITE_CUSTOMER_URL`: Customer site URL (for seller dashboard)
- `VITE_SELLER_URL`: Seller dashboard URL (for customer site)

## Adding New Environments

1. Copy `.env.example` to `.env.{environment}`
2. Update all URLs and configuration for the new environment
3. Document the new environment in this file