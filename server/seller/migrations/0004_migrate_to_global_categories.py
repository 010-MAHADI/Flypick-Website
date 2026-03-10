# Generated manually for migrating to global categories

from django.db import migrations

def migrate_categories_forward(apps, schema_editor):
    """Migrate seller categories to global product categories"""
    SellerCategory = apps.get_model('seller', 'Category')
    ProductCategory = apps.get_model('products', 'Category')
    Coupon = apps.get_model('seller', 'Coupon')
    
    # Create a mapping from seller category to product category
    category_mapping = {}
    
    for seller_cat in SellerCategory.objects.all():
        # Try to find existing product category with same name
        try:
            product_cat = ProductCategory.objects.get(name__iexact=seller_cat.name)
            category_mapping[seller_cat.id] = product_cat.id
            print(f"Found existing product category '{product_cat.name}' for seller category '{seller_cat.name}'")
        except ProductCategory.DoesNotExist:
            # Create new product category
            product_cat = ProductCategory.objects.create(
                name=seller_cat.name,
                slug=seller_cat.slug,
                description=seller_cat.description or '',
                is_active=seller_cat.status == 'active',
                sort_order=0
            )
            category_mapping[seller_cat.id] = product_cat.id
            print(f"Created new product category '{product_cat.name}' from seller category '{seller_cat.name}'")
    
    # Update coupons to reference the new product categories
    for coupon in Coupon.objects.filter(category__isnull=False):
        old_category_id = coupon.category_id
        if old_category_id in category_mapping:
            new_category_id = category_mapping[old_category_id]
            # We can't update the foreign key directly in this migration since we haven't changed the field yet
            # We'll store the mapping in a temporary field or handle it in the next migration
            print(f"Coupon '{coupon.code}' will be updated from category {old_category_id} to {new_category_id}")

def migrate_categories_reverse(apps, schema_editor):
    """Reverse migration - not implemented as it's complex"""
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('products', '0009_shop_category_fk'),
        ('seller', '0003_coupon_category_coupon_coupon_type_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_categories_forward, migrate_categories_reverse),
    ]