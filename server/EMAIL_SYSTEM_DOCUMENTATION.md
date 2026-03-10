# Email Notification System Documentation

## Overview

This document describes the complete SMTP-based email notification system implemented for the Flypick/Boibazar website. The system automatically sends emails for various user and seller actions using Gmail SMTP.

## Features

### 1. User Email Notifications
- **Welcome Email**: Sent when a new user account is created
- **Order Confirmation**: Sent when a user places an order
- **Order Status Updates**: Sent when order status changes (confirmed, processing, shipped, delivered, cancelled)

### 2. Seller Email Notifications
- **New Order Alerts**: Sent when a seller receives a new order
- **Out of Stock Alerts**: Sent when product stock reaches 0
- **Low Stock Warnings**: Sent when product stock goes below threshold (default: 5 items)

### 3. Email Template System
- Reusable HTML email templates
- Mobile-friendly responsive design
- Professional branding with gradients and modern styling
- Template variables for dynamic content

### 4. Email Management
- Email preference management for users
- Email delivery logging and tracking
- Failed email retry functionality
- Admin interface for template management

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=True
SMTP_USER=boibazar00@gmail.com
SMTP_PASS=your-app-password-here

# Site Configuration
SITE_NAME=Flypick / Boibazar
FRONTEND_URL=http://localhost:5173
SELLER_FRONTEND_URL=http://localhost:5174
```

### Gmail App Password Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account settings > Security > App passwords
3. Generate a new app password for "Mail"
4. Use this app password in the `SMTP_PASS` environment variable

## Installation & Setup

### 1. Install Dependencies

The system uses built-in Python libraries, no additional packages required.

### 2. Run Migrations

```bash
cd server
python manage.py makemigrations emails
python manage.py migrate
```

### 3. Setup Email Templates

```bash
python manage.py setup_email_templates
```

### 4. Test the System

```bash
python test_email_system.py
```

## API Endpoints

### Email Preferences
- `GET /api/emails/preferences/` - Get user email preferences
- `PUT /api/emails/preferences/` - Update user email preferences

### Email Logs
- `GET /api/emails/logs/` - Get user's email history

### Testing
- `POST /api/emails/test/` - Send test email

### Admin (Staff Only)
- `GET /api/emails/templates/` - List email templates
- `POST /api/emails/resend/<log_id>/` - Resend failed email

## Email Templates

### Available Templates

1. **Welcome Email** (`welcome`)
   - Subject: "Welcome to {{ site_name }}!"
   - Sent: When user creates account

2. **Order Confirmation** (`order_confirmation`)
   - Subject: "Your Order Has Been Placed Successfully - {{ order_id }}"
   - Sent: When order is created

3. **Order Status Update** (`order_status_update`)
   - Subject: "Order Update: {{ order_id }} - {{ new_status }}"
   - Sent: When order status changes

4. **New Order (Seller)** (`new_order_seller`)
   - Subject: "New Order Received - {{ order_id }}"
   - Sent: When seller receives new order

5. **Out of Stock Alert** (`out_of_stock_alert`)
   - Subject: "Product Out of Stock Alert - {{ product_name }}"
   - Sent: When product stock reaches 0

6. **Low Stock Warning** (`low_stock_alert`)
   - Subject: "Low Stock Warning - {{ product_name }}"
   - Sent: When product stock goes below threshold

### Template Variables

Templates support Django template syntax with these variables:

#### Common Variables
- `{{ site_name }}` - Site name
- `{{ current_year }}` - Current year
- `{{ user_name }}` - User's first name or username

#### Order-specific Variables
- `{{ order_id }}` - Order ID
- `{{ order_date }}` - Order date
- `{{ items }}` - List of order items
- `{{ total_amount }}` - Order total
- `{{ shipping_address }}` - Shipping address
- `{{ tracking_url }}` - Order tracking URL

#### Product-specific Variables
- `{{ product_name }}` - Product name
- `{{ product_sku }}` - Product SKU
- `{{ current_stock }}` - Current stock level
- `{{ threshold }}` - Low stock threshold

## Automatic Triggers

### User Registration
```python
# Automatically triggered by Django signals
@receiver(post_save, sender=User)
def send_welcome_email(sender, instance, created, **kwargs):
    if created:
        notification_service.send_welcome_email(instance)
```

### Order Creation
```python
# Automatically triggered when order is created
@receiver(post_save, sender=Order)
def handle_order_notifications(sender, instance, created, **kwargs):
    if created:
        notification_service.send_order_confirmation(instance)
        notification_service.send_new_order_notification_to_seller(instance)
```

### Order Status Updates
```python
# Automatically triggered when order status changes
# Tracks status changes and sends update emails
```

### Stock Alerts
```python
# Automatically triggered when product stock is updated
@receiver(post_save, sender=Product)
def handle_stock_alerts(sender, instance, created, **kwargs):
    if not created and instance.stock <= threshold:
        notification_service.send_stock_alert(instance)
```

## Email Preferences

Users can control which emails they receive:

```python
class EmailPreference(models.Model):
    # Customer notifications
    welcome_emails = models.BooleanField(default=True)
    order_confirmations = models.BooleanField(default=True)
    order_updates = models.BooleanField(default=True)
    promotional_emails = models.BooleanField(default=True)
    
    # Seller notifications
    new_order_alerts = models.BooleanField(default=True)
    stock_alerts = models.BooleanField(default=True)
    low_stock_threshold = models.IntegerField(default=5)
```

## Logging & Monitoring

### Email Logs
All emails are logged in the `EmailLog` model:
- Recipient email and user
- Template type and subject
- Status (pending, sent, failed, bounced)
- Error messages for failed emails
- Related objects (order, product)
- Timestamp

### Log Levels
- `INFO`: Successful email sends
- `ERROR`: Failed email sends
- `DEBUG`: Email service operations

### Log Files
- Location: `server/logs/email.log`
- Format: Verbose with timestamp, module, and message

## Admin Interface

### Email Templates
- View and edit email templates
- Enable/disable templates
- Preview template content

### Email Logs
- View all sent emails
- Filter by status, type, date
- Resend failed emails
- View error messages

### Email Preferences
- View user preferences
- Bulk update settings

## Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Verify Gmail app password is correct
   - Ensure 2FA is enabled on Gmail account
   - Check SMTP_USER and SMTP_PASS environment variables

2. **Templates Not Found**
   - Run `python manage.py setup_email_templates`
   - Check template files exist in `emails/templates/email_templates/`

3. **Emails Not Sending**
   - Check email logs in admin interface
   - Verify SMTP settings in Django settings
   - Test with `python test_email_system.py`

4. **Missing Email Preferences**
   - Email preferences are created automatically on first user login
   - Can be created manually in admin interface

### Testing

1. **Test Configuration**
   ```bash
   python test_email_system.py
   ```

2. **Test Individual Components**
   ```python
   from emails.services import NotificationService
   service = NotificationService()
   service.send_welcome_email(user)
   ```

3. **Check Email Logs**
   - Django Admin > Email Logs
   - Filter by status = 'failed' to see errors

## Security Considerations

1. **Credentials**
   - Never hardcode SMTP credentials
   - Use environment variables only
   - Use Gmail app passwords, not account passwords

2. **Email Content**
   - All templates are sanitized
   - User input is escaped in templates
   - No executable content in emails

3. **Rate Limiting**
   - Gmail has sending limits (500 emails/day for free accounts)
   - Consider using professional email service for production

## Production Deployment

### Recommended Email Services
- **Gmail**: Good for development and small scale
- **SendGrid**: Professional service with better deliverability
- **Amazon SES**: Cost-effective for high volume
- **Mailgun**: Developer-friendly with good APIs

### Configuration for Production
1. Use professional email service
2. Set up proper DNS records (SPF, DKIM, DMARC)
3. Monitor email deliverability
4. Set up email bounce handling
5. Implement email queue for high volume

### Monitoring
- Set up alerts for failed emails
- Monitor email delivery rates
- Track user engagement with emails
- Regular cleanup of old email logs

## Future Enhancements

1. **Email Queue System**
   - Implement Celery for background email processing
   - Handle high volume email sending

2. **Advanced Templates**
   - Rich text editor for template management
   - Template versioning and A/B testing

3. **Analytics**
   - Email open tracking
   - Click tracking
   - Delivery analytics dashboard

4. **Personalization**
   - Dynamic content based on user behavior
   - Personalized product recommendations

5. **Multi-language Support**
   - Template translations
   - User language preferences

## Support

For issues or questions about the email system:
1. Check the troubleshooting section
2. Review email logs in Django admin
3. Test with the provided test script
4. Contact the development team

---

**Last Updated**: March 10, 2026
**Version**: 1.0.0