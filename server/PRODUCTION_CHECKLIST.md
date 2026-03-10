# Production Deployment Checklist

## ✅ Security Fixes Applied

- [x] Hardcoded credentials removed (using environment variables)
- [x] SECRET_KEY moved to environment variables
- [x] DEBUG mode controlled by environment variable (defaults to False)
- [x] ALLOWED_HOSTS configured
- [x] CORS restricted to specific origins
- [x] JWT token expiration configured
- [x] Rate limiting enabled
- [x] HTTPS/SSL settings configured
- [x] Security headers enabled
- [x] Authorization checks fixed (IsAdminUser for seller management)
- [x] Product/Shop ownership validation added
- [x] Token refresh mechanism implemented
- [x] Pagination enabled
- [x] Token blacklist support added

## 📋 Pre-Deployment Tasks

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env` in server directory
- [ ] Generate new SECRET_KEY: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- [ ] Set DEBUG=False
- [ ] Configure ALLOWED_HOSTS with your domain
- [ ] Set strong database password
- [ ] Configure CORS_ALLOWED_ORIGINS with your frontend URLs
- [ ] Review JWT token lifetimes

### 2. Database
- [ ] Create production database
- [ ] Run migrations: `python manage.py migrate`
- [ ] Create superuser: `python manage.py createsuperuser`
- [ ] Setup database backups
- [ ] Configure database connection pooling

### 3. Static Files
- [ ] Run `python manage.py collectstatic`
- [ ] Configure web server to serve static files
- [ ] Configure web server to serve media files
- [ ] Setup CDN for static/media files (optional)

### 4. Dependencies
- [ ] Install production dependencies: `pip install -r requirements.txt`
- [ ] Install gunicorn: `pip install gunicorn`
- [ ] Install python-dotenv: `pip install python-dotenv`

### 5. Frontend Configuration
- [ ] Copy `.env.example` to `.env` in both frontend directories
- [ ] Set VITE_API_BASE_URL to production API URL
- [ ] Build customer site: `npm run build`
- [ ] Build seller dashboard: `npm run build`
- [ ] Configure web server to serve frontend builds

### 6. Web Server Configuration
- [ ] Install and configure Nginx/Apache
- [ ] Setup SSL certificates (Let's Encrypt recommended)
- [ ] Configure reverse proxy to Django
- [ ] Configure static file serving
- [ ] Enable gzip compression
- [ ] Configure request size limits

### 7. Application Server
- [ ] Configure Gunicorn with appropriate workers
- [ ] Setup systemd service for auto-restart
- [ ] Configure logging
- [ ] Setup process monitoring (supervisor/systemd)

### 8. Security Hardening
- [ ] Verify DEBUG=False
- [ ] Verify SECRET_KEY is unique and secure
- [ ] Verify ALLOWED_HOSTS is restrictive
- [ ] Verify CORS_ALLOWED_ORIGINS is restrictive
- [ ] Enable firewall (allow only 80, 443, SSH)
- [ ] Disable root SSH login
- [ ] Setup fail2ban for brute force protection
- [ ] Regular security updates scheduled

### 9. Monitoring & Logging
- [ ] Configure application logging
- [ ] Setup error tracking (Sentry recommended)
- [ ] Configure server monitoring
- [ ] Setup uptime monitoring
- [ ] Configure log rotation
- [ ] Setup alerts for critical errors

### 10. Backup Strategy
- [ ] Database backup script configured
- [ ] Media files backup configured
- [ ] Backup retention policy defined
- [ ] Backup restoration tested
- [ ] Offsite backup storage configured

### 11. Performance Optimization
- [ ] Database indexes reviewed
- [ ] Query optimization performed
- [ ] Caching strategy implemented (Redis recommended)
- [ ] CDN configured for static assets
- [ ] Image optimization implemented

### 12. Testing
- [ ] All tests passing: `python manage.py test`
- [ ] Manual testing in staging environment
- [ ] Load testing performed
- [ ] Security scanning completed
- [ ] Cross-browser testing done

### 13. Documentation
- [ ] API documentation updated
- [ ] Deployment procedures documented
- [ ] Rollback procedures documented
- [ ] Incident response plan created
- [ ] Team trained on deployment process

### 14. Post-Deployment
- [ ] Verify all endpoints working
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Test critical user flows
- [ ] Verify email notifications working
- [ ] Test payment processing (if applicable)

## 🚨 Critical Warnings

1. **Never commit .env files** - They contain sensitive credentials
2. **Always use HTTPS in production** - HTTP is insecure
3. **Keep dependencies updated** - Security patches are critical
4. **Monitor error logs** - Catch issues early
5. **Test backups regularly** - Ensure you can restore data
6. **Use strong passwords** - Especially for database and admin accounts
7. **Limit database access** - Only from application server
8. **Regular security audits** - Schedule quarterly reviews

## 📞 Emergency Contacts

- DevOps Lead: [Contact Info]
- Database Admin: [Contact Info]
- Security Team: [Contact Info]
- On-Call Engineer: [Contact Info]

## 🔄 Rollback Plan

If deployment fails:

1. Stop application server
2. Restore previous code version
3. Rollback database migrations if needed: `python manage.py migrate <app> <migration_number>`
4. Restart application server
5. Verify functionality
6. Investigate and document issue

## 📊 Success Metrics

- [ ] Application responding within 200ms average
- [ ] Error rate < 0.1%
- [ ] All critical user flows working
- [ ] No security vulnerabilities detected
- [ ] Database queries optimized
- [ ] Uptime > 99.9%
