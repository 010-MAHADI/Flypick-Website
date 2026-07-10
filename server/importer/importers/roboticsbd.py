"""
RoboticsBD importer (store.roboticsbd.com — PrestaShop storefront).

PrestaShop 1.7 embeds the complete product object as JSON in
``<div id="product-details" data-product="...">``, and older themes expose
microdata + OpenGraph. We try the JSON first, then CSS selectors, and the
BaseImporter structured-data fallbacks handle the rest.
"""
import json
from urllib.parse import urljoin

from ..parsing import dig, parse_soup
from .base import BaseImporter


class RoboticsBDImporter(BaseImporter):
    site_key = 'roboticsbd'
    site_name = 'RoboticsBD'
    domains = ('roboticsbd.com', 'store.roboticsbd.com')
    example_url = 'https://store.roboticsbd.com/robotics/123-product-name.html'
    default_currency = 'BDT'

    def parse(self, html, url):
        soup = parse_soup(html)
        raw = {}

        details = soup.find(id='product-details')
        product_json = {}
        if details and details.get('data-product'):
            try:
                product_json = json.loads(details['data-product'])
            except json.JSONDecodeError:
                product_json = {}

        if product_json:
            raw['title'] = product_json.get('name', '')
            raw['external_id'] = str(product_json.get('id', ''))
            raw['sku'] = product_json.get('reference', '')
            raw['description_html'] = product_json.get('description', '')
            raw['short_description'] = self._strip_tags(product_json.get('description_short', ''))
            raw['price'] = product_json.get('price_amount') or product_json.get('price')
            regular = product_json.get('regular_price_amount') or product_json.get('regular_price')
            if regular and regular != raw.get('price'):
                raw['original_price'] = regular
            quantity = product_json.get('quantity')
            if isinstance(quantity, int):
                raw['stock_quantity'] = max(quantity, 0)
                raw['stock_status'] = 'in_stock' if quantity > 0 else 'out_of_stock'
            manufacturer = product_json.get('manufacturer_name')
            if manufacturer:
                raw['brand'] = manufacturer
            gallery = []
            for image in product_json.get('images', []):
                src = dig(image, 'bySize', 'large_default', 'url') or image.get('large', {}).get('url')
                if src:
                    gallery.append(src)
            cover = dig(product_json, 'cover', 'bySize', 'large_default', 'url')
            if cover and cover not in gallery:
                gallery.insert(0, cover)
            if gallery:
                raw['gallery'] = gallery
            features = product_json.get('features') or []
            specs = [
                {'key': str(f.get('name', '')).strip(), 'value': str(f.get('value', '')).strip()}
                for f in features if f.get('name') and f.get('value')
            ]
            if specs:
                raw['specifications'] = specs

        # Selector fallbacks for older PrestaShop themes
        if not raw.get('title'):
            heading = soup.select_one('h1[itemprop="name"], h1.product-name, h1')
            if heading:
                raw['title'] = heading.get_text(strip=True)
        if not raw.get('price'):
            price_node = soup.select_one('[itemprop="price"], .current-price span, #our_price_display')
            if price_node:
                raw['price'] = price_node.get('content') or price_node.get_text(strip=True)
        if not raw.get('description_html'):
            description = soup.select_one('#description, .product-description, #tab-description')
            if description:
                raw['description_html'] = description.decode_contents()
        if not raw.get('gallery'):
            gallery = []
            for img in soup.select('.product-images img, #thumbs_list img, .images-container img'):
                src = img.get('data-image-large-src') or img.get('data-src') or img.get('src')
                if src and not src.startswith('data:'):
                    gallery.append(urljoin(url, src))
            if gallery:
                raw['gallery'] = gallery
        return raw

    @staticmethod
    def _strip_tags(html_fragment):
        from ..sanitizer import html_to_text
        return html_to_text(html_fragment)
