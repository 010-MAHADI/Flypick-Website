#!/usr/bin/env python
"""
Complete setup script for the email notification system
This script will set up everything needed for the email system to work
"""

import os
import sys
import django
from django.conf import settings
from django.core.management import execute_from_command_line

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from emails.models import EmailTemplate, EmailPreference
from emails.services import NotificationService

User = get_user_model()

def create_logs_directory():
    """Create logs directory if it doesn't exist"""
    logs_dir = os.path.join(settings.BASE_DIR, 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
        print("✅ Created logs directory")
    else:
        print("✅ Logs directory already exists")

def run_migrations():
    """Run database migrations"""
    print("🔄 Running database migrations...")
    try:
        execute_from_command_line(['manage.py', 'makemigrations', 'emails'])
        execute_from_command_line(['manage.py', 'migrate'])
        print("✅ Database migrations completed")
    except Exception as e:
        print(f"❌ Migration error: {str(e)}")
        return False
    return True

def setup_email_templates():
    """Setup email templates"""
    print("📧 Setting up email templates...")
    try:
        execute_from_command_line(['manage.py', 'setup_email_templates'])
        print("✅ Email templates setup completed")
    except Exception as e:
        print(f"❌ Template setup error: {str(e)}")
        return False
    return True

def create_default_preferences():
    """Create default email preferences for existing users"""
    print("⚙️ Creating default email preferences for existing users...")
    
    users_without_preferences = User.objects.filter(email_preferences__isnull=True)
    count = 0
    
    for user in users_without_preferences:
        EmailPreference.objects.get_or_create(user=user)
        count += 1
    
    if count > 0:
        print(f"✅ Created email preferences for {count} users")
    else:
        print("✅ All users already have email preferences")

def verify_configuration():
    """Verify email configuration"""
    print("🔧 Verifying email configuration...")
    
    # Check SMTP settings
    smtp_user = getattr(settings, 'SMTP_USER', '')
    smtp_pass = getattr(settings, 'SMTP_PASS', '')
    
    if not smtp_user:
        print("⚠️  SMTP_USER not configured in environment variables")
        print("   Add SMTP_USER=your-email@gmail.com to your .env file")
    else:
        print(f"✅ SMTP_USER configured: {smtp_user}")
    
    if not smtp_pass:
        print("⚠️  SMTP_PASS not configured in environment variables")
        print("   Add SMTP_PASS=your-app-password to your .env file")
    else:
        print("✅ SMTP_PASS configured")
    
    # Check other settings
    site_name = getattr(settings, 'SITE_NAME', '')
    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    
    if site_name:
        print(f"✅ SITE_NAME configured: {site_name}")
    else:
        print("⚠️  SITE_NAME not configured, using default")
    
    if frontend_url:
        print(f"✅ FRONTEND_URL configured: {frontend_url}")
    else:
        print("⚠️  FRONTEND_URL not configured, using default")

def test_email_service():
    """Test email service initialization"""
    print("🧪 Testing email service...")
    
    try:
        notification_service = NotificationService()
        print("✅ Email service initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Email service error: {str(e)}")
        return False

def display_next_steps():
    """Display next steps for the user"""
    print("\n" + "="*60)
    print("🎉 EMAIL SYSTEM SETUP COMPLETED!")
    print("="*60)
    
    print("\n📋 NEXT STEPS:")
    print("1. Configure your Gmail App Password:")
    print("   - Enable 2FA on your Gmail account")
    print("   - Generate an App Password for Mail")
    print("   - Add it to your .env file as SMTP_PASS")
    
    print("\n2. Update your .env file with these variables:")
    print("   SMTP_USER=your-email@gmail.com")
    print("   SMTP_PASS=your-16-character-app-password")
    print("   SITE_NAME=Your Site Name")
    print("   FRONTEND_URL=http://localhost:5173")
    print("   SELLER_FRONTEND_URL=http://localhost:5174")
    
    print("\n3. Test the email system:")
    print("   python test_email_system.py")
    
    print("\n4. Access email management:")
    print("   - Django Admin: /admin/emails/")
    print("   - API Endpoints: /api/emails/")
    
    print("\n5. Monitor email logs:")
    print("   - Check server/logs/email.log for detailed logs")
    print("   - View email history in Django admin")
    
    print("\n📚 Documentation:")
    print("   - Read EMAIL_SYSTEM_DOCUMENTATION.md for detailed info")
    print("   - Check API endpoints in emails/urls.py")
    
    print("\n🔧 Troubleshooting:")
    print("   - If emails fail, check SMTP credentials")
    print("   - Verify Gmail allows less secure apps or use App Password")
    print("   - Check email logs for error messages")

def main():
    """Main setup function"""
    print("🚀 EMAIL NOTIFICATION SYSTEM SETUP")
    print("="*50)
    
    # Step 1: Create logs directory
    create_logs_directory()
    
    # Step 2: Run migrations
    if not run_migrations():
        print("❌ Setup failed at migration step")
        return
    
    # Step 3: Setup email templates
    if not setup_email_templates():
        print("❌ Setup failed at template setup step")
        return
    
    # Step 4: Create default preferences
    create_default_preferences()
    
    # Step 5: Verify configuration
    verify_configuration()
    
    # Step 6: Test email service
    test_email_service()
    
    # Step 7: Display next steps
    display_next_steps()

if __name__ == '__main__':
    main()