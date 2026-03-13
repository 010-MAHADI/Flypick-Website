# Production Deployment Checklist

## ✅ Environment Configuration Complete

All localhost URLs have been updated to production URLs:
- **Customer Site**: `http://52.221.195.134` (port 80)
- **Seller Dashboard**: `http://52.221.195.134:8080` (port 8080)
- **API Server**: `http://52.221.195.134/api` (Django backend)

## 📁 Files Updated

### Environment Files:
- ✅ `server/.env` - Production URLs configured
- ✅ `server/.env.production` - Production URLs configured
- ✅ `server/.env.example` - Updated with production URLs
- ✅ `client/Customer_site/.env` - Production URLs configured
- ✅ `client/Customer_site/.env.production` - Production URLs configured
- ✅ `client/seller-side/.env` - Production URLs configured
- ✅ `client/seller-side/.env.example` - Production URLs configured

### Backend Configuration:
- ✅ `server/backend/settings.py` - Updated default URLs and CORS settings
- ✅ `server/emails/services.py` - Updated fallback URLs in email templates

### Frontend Configuration:
- ✅ `client/Customer_site/src/utils/api.ts` - Updated fallback API URL
- ✅ `client/Customer_site/src/lib/api.ts` - Updated fallback API URL
- ✅ `client/Customer_site/src/hooks/useProducts.tsx` - Updated fallback API URL
- ✅ `client/Customer_site/src/context/CartContext.tsx` - Updated fallback API URL
- ✅ `client/seller-side/src/hooks/useProducts.tsx` - Updated fallback API URL
- ✅ `client/seller-side/src/hooks/useProductsAdmin.tsx` - Updated fallback API URL

### Scripts:
- ✅ `scripts/switch-to-production.bat` - Created for easy production setup
- ✅ `scripts/switch-to-development.bat` - Created for easy development setup

## 🚀 Deployment Steps

### 1. Switch to Production Environment
```bash
# Run the production switch script
scripts/switch-to-production.bat
```

### 2. Build Frontend Applications
```bash
# Build Customer Site
cd client/Customer_site
npm install
npm run build

# Build Seller Dashboard
cd ../seller-side
npm install
npm run build
```

### 3. Configure Database (if using PostgreSQL)
```bash
cd server
# Update .env with your PostgreSQL credentials
# Set USE_SQLITE=False in .env
python manage.py migrate
python manage.py collectstatic --noinput
```

### 4. Start Django Server
```bash
cd server
# For development testing
python manage.py runserver 0.0.0.0:8000

# For production (recommended)
pip install gunicorn
gunicorn backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### 5. Configure and Start Nginx
Your `nginx.conf` is already configured correctly. Start Nginx:
```bash
# Test configuration
nginx -t

# Start Nginx
nginx
# or
systemctl start nginx
```

## 🔍 Verification

After deployment, verify these URLs work:

### Customer Site (Port 80):
- ✅ `http://52.221.195.134` - Customer homepage
- ✅ `http://52.221.195.134/api/health/` - API health check
- ✅ `http://52.221.195.134/static/` - Static files
- ✅ `http://52.221.195.134/media/` - Media files

### Seller Dashboard (Port 8080):
- ✅ `http://52.221.195.134:8080` - Seller dashboard
- ✅ `http://52.221.195.134:8080/api/` - API access from seller dashboard

## 🔧 Environment Switching

### Switch to Production:
```bash
scripts/switch-to-production.bat
```

### Switch back to Development:
```bash
scripts/switch-to-development.bat
```

## 📝 Notes

1. **Database**: Update `DB_HOST` in production environment files if using external PostgreSQL
2. **SSL**: Consider adding SSL certificates for HTTPS in production
3. **Security**: Update `SECRET_KEY` in production environment files
4. **Email**: Verify SMTP settings in production environment files
5. **Static Files**: Ensure Django `collectstatic` is run for production
6. **Firewall**: Ensure ports 80 and 8080 are open on your server

## 🚨 Security Checklist

- [ ] Update `SECRET_KEY` in production
- [ ] Set `DEBUG=False` in production
- [ ] Configure proper `ALLOWED_HOSTS`
- [ ] Set up SSL certificates (HTTPS)
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set up monitoring

Your project is now ready for production deployment with the specified URLs!