# CORS Configuration Fix

## Issue
Frontend running on port 8081 was blocked by CORS policy because it wasn't in the allowed origins list.

## Solution Applied

Updated `server/.env` to include all common development ports:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8081,http://localhost:3000,https://yourdomain.com
```

## Restart Required

After changing CORS settings, you must restart the Django server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd server
python manage.py runserver
```

## Common Development Ports

- `5173` - Vite default (Customer site)
- `5174` - Vite second instance (Seller dashboard)
- `8081` - Alternative Vite port
- `3000` - React/Next.js default
- `8080` - Common alternative port

## Adding More Origins

To add more origins, edit `server/.env`:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8081,http://localhost:3000,http://localhost:8080
```

Then restart the server.

## Production Configuration

In production, only include your actual domain:

```env
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Troubleshooting

### Still Getting CORS Errors?

1. **Restart the server** - CORS changes require a restart
2. **Check the port** - Verify your frontend is running on an allowed port
3. **Clear browser cache** - Old CORS headers might be cached
4. **Check browser console** - Look for the exact origin being blocked

### Verify CORS Settings

Check if your origin is allowed:
```bash
curl -H "Origin: http://localhost:8081" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8000/api/auth/token/
```

Should return headers including:
```
Access-Control-Allow-Origin: http://localhost:8081
```

### Development vs Production

**Development (.env):**
```env
DEBUG=True
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8081
```

**Production (.env):**
```env
DEBUG=False
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

## Quick Fix for Any Port

For development only, you can temporarily allow all origins (NOT for production):

Edit `server/backend/settings.py`:
```python
# Development only - NEVER use in production
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://localhost:5174'
    ).split(',')
```

This allows all origins when DEBUG=True, but restricts them in production.
