from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0009_order_platform_charge'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='shipping_method',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='order',
            name='shipping_estimated_delivery',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='shipping_charge',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='shipping_estimated_delivery',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
    ]
