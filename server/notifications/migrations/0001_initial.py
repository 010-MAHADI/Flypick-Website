# Generated migration for notifications app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('notification_type', models.CharField(choices=[('order_confirmed', 'Order Confirmed'), ('order_shipped', 'Order Shipped'), ('order_delivered', 'Order Delivered'), ('order_cancelled', 'Order Cancelled'), ('payment_success', 'Payment Successful'), ('payment_failed', 'Payment Failed'), ('coupon_available', 'New Coupon Available'), ('product_back_in_stock', 'Product Back in Stock'), ('price_drop', 'Price Drop Alert'), ('welcome', 'Welcome Message'), ('system', 'System Notification')], default='system', max_length=50)),
                ('priority', models.CharField(choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('urgent', 'Urgent')], default='medium', max_length=10)),
                ('order_id', models.CharField(blank=True, max_length=100, null=True)),
                ('product_id', models.IntegerField(blank=True, null=True)),
                ('coupon_code', models.CharField(blank=True, max_length=50, null=True)),
                ('is_read', models.BooleanField(default=False)),
                ('is_deleted', models.BooleanField(default=False)),
                ('action_url', models.URLField(blank=True, null=True)),
                ('action_text', models.CharField(blank=True, max_length=50, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='NotificationPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email_order_updates', models.BooleanField(default=True)),
                ('email_promotions', models.BooleanField(default=True)),
                ('email_price_alerts', models.BooleanField(default=True)),
                ('email_stock_alerts', models.BooleanField(default=True)),
                ('app_order_updates', models.BooleanField(default=True)),
                ('app_promotions', models.BooleanField(default=True)),
                ('app_price_alerts', models.BooleanField(default=True)),
                ('app_stock_alerts', models.BooleanField(default=True)),
                ('push_enabled', models.BooleanField(default=False)),
                ('push_order_updates', models.BooleanField(default=True)),
                ('push_promotions', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='notification_preferences', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', '-created_at'], name='notification_user_created_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', 'is_read'], name='notification_user_read_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['notification_type'], name='notification_type_idx'),
        ),
    ]