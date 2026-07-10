"""
Daraz importer (daraz.com.bd and regional Daraz domains).

Daraz product pages expose a rich JSON blob (``app.run`` / ``__moduleData__``)
containing the PDP fields, plus a schema.org Product JSON-LD block. We mine
the blob for specifications, gallery and variants and let the JSON-LD /
OpenGraph fallbacks fill anything missing.
"""
import re

from ..parsing import dig, extract_json_after
from .base import BaseImporter


class DarazImporter(BaseImporter):
    site_key = 'daraz'
    site_name = 'Daraz'
    domains = ('daraz.com.bd', 'daraz.pk', 'daraz.lk', 'daraz.com.np', 'daraz.com.mm')
    example_url = 'https://www.daraz.com.bd/products/some-product-i123456789.html'
    default_currency = 'BDT'

    def parse(self, html, url):
        raw = {}
        match = re.search(r'-i(\d+)(?:-s\d+)?\.html', url)
        if match:
            raw['external_id'] = match.group(1)

        blob = (
            extract_json_after(html, 'var __moduleData__ =')
            or extract_json_after(html, 'app.run(')
            or {}
        )
        fields = dig(blob, 'data', 'root', 'fields') or {}

        product = fields.get('product') or {}
        title = product.get('title') or dig(fields, 'pdpTrackingData', 'pdt_name')
        if title:
            raw['title'] = title
        if product.get('brand'):
            brand = product['brand']
            raw['brand'] = brand.get('name') if isinstance(brand, dict) else str(brand)

        highlights_html = product.get('highlights') or ''
        if highlights_html:
            raw['highlights'] = self._html_list_items(highlights_html)

        desc = dig(product, 'desc') or dig(fields, 'product', 'description')
        if desc:
            raw['description_html'] = desc

        gallery = []
        for item in fields.get('skuGalleries', {}).values() if isinstance(fields.get('skuGalleries'), dict) else []:
            for image in item if isinstance(item, list) else []:
                src = image.get('src') if isinstance(image, dict) else None
                if src:
                    gallery.append(self._absolutize(src))
        for image in dig(fields, 'mediaGalleries') or []:
            src = image.get('src') if isinstance(image, dict) else None
            if src:
                gallery.append(self._absolutize(src))
        if gallery:
            raw['gallery'] = gallery

        price, original, currency = self._extract_price(fields)
        tracking = fields.get('tracking') or {}
        warnings = []
        if not price:
            # Server-rendered pages often omit skuInfos pricing but always
            # carry the display price in the tracking block ("৳ 2,000").
            price = tracking.get('pdt_price') or ''
        if price and not original:
            # Daraz's server HTML never carries the crossed-out price, but it
            # advertises the discount ("-36%") — derive the regular price so
            # selling/regular/discount stay consistent.
            original = self._derive_original_price(price, tracking.get('pdt_discount'))
            if original:
                warnings.append(
                    'Regular price was derived from the advertised discount '
                    f'({tracking.get("pdt_discount")}) — please verify it before saving.')
        if price:
            raw['price'] = price
        if original:
            raw['original_price'] = original
        raw['currency'] = currency or dig(tracking, 'core', 'currencyCode') or 'BDT'

        # Multi-variant listings: the server always describes the DEFAULT
        # variant, which may not be the one the pasted URL points at.
        tracked_sku = str(tracking.get('pdt_simplesku') or '')
        requested_sku = self._requested_sku(url)
        if requested_sku and tracked_sku and tracked_sku != requested_sku:
            warnings.append(
                'Daraz served data for a different variant of this listing than the '
                'pasted URL — double-check the title, price and images before saving.')

        if warnings:
            raw['warnings'] = warnings

        brand_name = tracking.get('brand_name')
        if not raw.get('brand') and brand_name and brand_name.lower() != 'no brand':
            raw['brand'] = brand_name

        specs = []
        spec_blocks = fields.get('specifications') or []
        if isinstance(spec_blocks, dict):
            spec_blocks = list(spec_blocks.values())
        for block in spec_blocks:
            features = block.get('features') if isinstance(block, dict) else None
            if isinstance(features, dict):
                for key, value in features.items():
                    if key and value:
                        specs.append({'key': str(key).strip(), 'value': str(value).strip()})
        if specs:
            raw['specifications'] = specs

        colors, sizes, options = self._extract_variants(fields)
        if colors:
            raw['colors'] = colors
        if sizes:
            raw['sizes'] = sizes
        if options:
            raw['options'] = options

        crumbs = tracking.get('pdt_category') or ''
        if isinstance(crumbs, str) and crumbs:
            raw['category_path'] = [c.strip() for c in crumbs.split('/') if c.strip()]
        elif isinstance(crumbs, list):
            raw['category_path'] = [str(c).strip() for c in crumbs if str(c).strip()]

        return raw

    @staticmethod
    def _requested_sku(url):
        match = re.search(r'-s(\d+)\.html', url)
        return match.group(1) if match else ''

    @staticmethod
    def _derive_original_price(price, discount_text):
        """'৳ 750' + '-36%' -> '1172' (regular = selling / (1 - discount))."""
        from ..schema import to_decimal_string
        if not discount_text:
            return ''
        match = re.search(r'(\d+(?:\.\d+)?)\s*%', str(discount_text))
        if not match:
            return ''
        percent = float(match.group(1))
        if not 0 < percent < 95:
            return ''
        selling = to_decimal_string(price)
        if not selling:
            return ''
        return str(round(float(selling) / (1 - percent / 100)))

    @staticmethod
    def _extract_price(fields):
        sku_infos = fields.get('skuInfos') or {}
        first_sku = None
        if isinstance(sku_infos, dict):
            first_sku = sku_infos.get('0') or next(iter(sku_infos.values()), None)
        price_info = (first_sku or {}).get('price') or {}
        sale = dig(price_info, 'salePrice', 'value')
        original = dig(price_info, 'originalPrice', 'value')
        currency = dig(price_info, 'salePrice', 'currency')
        return sale, (original if original and original != sale else None), currency

    @staticmethod
    def _extract_variants(fields):
        colors, sizes, options = [], [], []
        props = dig(fields, 'productOption', 'skuBase', 'properties') or []
        for prop in props:
            name = str(prop.get('name', '')).strip()
            values = [str(v.get('name', '')).strip() for v in prop.get('values', []) if v.get('name')]
            if not name or not values:
                continue
            options.append({'name': name, 'values': values})
            lowered = name.lower()
            if 'color' in lowered or 'colour' in lowered:
                colors.extend(values)
            elif 'size' in lowered:
                sizes.extend(values)
        return colors, sizes, options

    @staticmethod
    def _html_list_items(html_fragment):
        from ..sanitizer import html_to_text
        text = html_to_text(html_fragment)
        return [line.lstrip('•-* ').strip() for line in text.splitlines() if line.strip()][:10]

    @staticmethod
    def _absolutize(image_url):
        if image_url.startswith('//'):
            return 'https:' + image_url
        return image_url
