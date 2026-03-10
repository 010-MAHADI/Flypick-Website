# Generated manually for updating coupon category references

from django.db import migrations, models
import django.db.models.deletion

def update_coupon_references_forward(apps, schema_editor):
    """Update coupon category references to point to product categories"""
    SellerCategory = apps.get_model('seller', 'Category')
    ProductCategory = apps.get_model('products', 'Category')
    Coupon = apps.get_model('seller', 'Coupon')
    
    # Create mapping from seller category to product category
    category_mapping = {}
    
    for seller_cat in SellerCategory.objects.all():
        try:
            # Find the corresponding product category by name
            product_cat = ProductCategory.objects.get(name__iexact=seller_cat.name)
            category_mapping[seller_cat.id] = product_cat.id
        except ProductCategory.DoesNotExist:
            print(f"Warning: No product category found for seller category '{seller_cat.name}'")
    
    # Update coupon references
    for coupon in Coupon.objects.filter(category__isnull=False):
        old_category_id = coupon.category_id
        if old_category_id in category_mapping:
            new_category_id = category_mapping[old_category_id]
            # Update the category_id directly in the database
            Coupon.objects.filter(id=coupon.id).update(category_id=new_category_id)
            print(f"Updated coupon '{coupon.code}' category from {old_category_id} to {new_category_id}")

def update_coupon_references_reverse(apps, schema_editor):
    """Reverse migration - not implemented"""
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('products', '0009_shop_category_fk'),
        ('seller', '0004_migrate_to_global_categories'),
    ]

    operations = [
        # First update the references
        migrations.RunPython(update_coupon_references_forward, update_coupon_references_reverse),
        
        # Then change the foreign key field
        migrations.AlterField(
            model_name='coupon',
            name='category',
            field=models.ForeignKey(
                blank=True,
                help_text="Required when coupon_type is 'category'",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to='products.category',
            ),
        ),
    ]