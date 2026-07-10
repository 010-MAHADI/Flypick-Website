"""Backfill ProductSource rows for products imported before the model
existed (their source URL lived inside the public variants JSON), then
remove the URL from the variants so customers can no longer see it."""
from django.db import migrations


def backfill(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    ProductSource = apps.get_model('importer', 'ProductSource')

    for product in Product.objects.exclude(variants=None).iterator():
        variants = product.variants
        if not isinstance(variants, dict):
            continue
        imported = variants.get('imported')
        if not isinstance(imported, dict):
            continue
        url = imported.get('source_url')
        if url and not ProductSource.objects.filter(product_id=product.id, url=url).exists():
            ProductSource.objects.create(
                product_id=product.id,
                url=url[:2000],
                source_site=imported.get('source_site', '')[:100],
                is_primary=not ProductSource.objects.filter(product_id=product.id, is_primary=True).exists(),
                last_seen_stock_status=imported.get('stock_status', ''),
            )
        # scrub source details from the public variants JSON
        changed = False
        for secret in ('source_url', 'source_site', 'image_renditions', 'slug', 'stock_status'):
            if secret in imported:
                imported.pop(secret)
                changed = True
        if changed:
            variants['imported'] = imported
            product.variants = variants
            product.save(update_fields=['variants'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('importer', '0002_productsource_and_more'),
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
