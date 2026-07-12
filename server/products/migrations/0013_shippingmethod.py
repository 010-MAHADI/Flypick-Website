from django.db import migrations, models


def seed_shipping_methods(apps, schema_editor):
    ShippingMethod = apps.get_model('products', 'ShippingMethod')
    defaults = [
        ('Standard Delivery', '60.00', '4-6 days', 'Standard shipping for regular orders.', 1),
        ('Express Delivery', '120.00', '2-3 days', 'Faster delivery for urgent orders.', 2),
        ('Super Express Delivery', '200.00', '1 day', 'Fastest available delivery option.', 3),
    ]
    for name, charge, estimated, description, sort_order in defaults:
        ShippingMethod.objects.get_or_create(
            name=name,
            defaults={
                'delivery_charge': charge,
                'estimated_delivery_time': estimated,
                'description': description,
                'is_enabled': True,
                'sort_order': sort_order,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0012_shop_bank_information_shop_logo_shop_mobile_banking_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ShippingMethod',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('delivery_charge', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('estimated_delivery_time', models.CharField(max_length=80)),
                ('description', models.TextField(blank=True, default='')),
                ('is_enabled', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['sort_order', 'id'],
            },
        ),
        migrations.RunPython(seed_shipping_methods, migrations.RunPython.noop),
    ]
