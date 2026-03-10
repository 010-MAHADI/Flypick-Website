# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
cd server
cp .env.example .env
```

Required variables:
- `SECRET_KEY`: Generate a new secret key (use `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)
- `DEBUG`: Set to `False` in production
- `ALLOWED_HOSTS`: Add your domain(s)
- `DB_PASSWORD`: Use a strong database password
- `CORS_ALLOWED_ORIGINS`: Add your frontend domain(s)

### 2. Database Setup

```bash
# Create database

CREATE DATABASE flypick_db;
CREATE USER flypick WITH PASSWORD 'idahamsm@';

ALTER ROLE flypick SET client_encoding TO 'utf8';
ALTER ROLE flypick SET default_transaction_isolation TO 'read committed';
ALTER ROLE flypick SET timezone TO 'UTC';

GRANT ALL PRIVILEGES ON DATABASE flypick_db TO flypick;

createdb flypick_db

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt

chmod +x setup_storage.sh
./setup_storage.sh

```

### 4. Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### 5. Frontend Configuration

For Customer Site:
```bash
cd client/Customer_site
cp .env.example .env
# Edit .env and set VITE_API_BASE_URL to your production API URL
npm install
npm run build
```

For Seller Side:
```bash
cd client/seller-side
cp .env.example .env
# Edit .env and set VITE_API_BASE_URL to your production API URL
npm install
npm run build
```

## Security Checklist

- [ ] SECRET_KEY is unique and not in version control
- [ ] DEBUG = False
- [ ] ALLOWED_HOSTS configured with actual domains
- [ ] Database password is strong and secure
- [ ] CORS_ALLOWED_ORIGINS restricted to your domains only
- [ ] SSL/TLS certificates installed
- [ ] HTTPS redirect enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] JWT token expiration configured

## Production Server Setup

### Using Gunicorn (Recommended)

```bash
pip install gunicorn
gunicorn backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Using Nginx as Reverse Proxy

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        alias /path/to/server/media/;
    }

    location /static/ {
        alias /path/to/server/staticfiles/;
    }

    location / {
        root /path/to/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

## Monitoring & Logging

### Setup Logging

Add to settings.py:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': '/var/log/flypick/django.log',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'ERROR',
            'propagate': True,
        },
    },
}
```

## Database Backups

Setup automated backups:

```bash
# Daily backup script
pg_dump flypick_db > backup_$(date +%Y%m%d).sql
```

## Health Checks

The application should respond at:
- `/api/` - API root
- `/admin/` - Django admin

## Common Issues

1. **Static files not loading**: Run `python manage.py collectstatic`
2. **CORS errors**: Check CORS_ALLOWED_ORIGINS in .env
3. **Database connection errors**: Verify database credentials in .env
4. **JWT token errors**: Check JWT settings and token expiration

## Scaling Considerations

- Use Redis for caching and session storage
- Setup CDN for static/media files
- Use database connection pooling
- Implement Celery for background tasks
- Setup load balancer for multiple app servers
