"""
ElectronicsBD importer (electronics.com.bd — OpenCart storefront).

OpenCart themes are fairly stable: product name in ``h1``, price in
``.price`` / ``.product-price``, description under ``#tab-description`` and a
specification table under ``#tab-specification``. Structured-data fallbacks
(JSON-LD / OpenGraph / microdata) cover theme variations.
"""
import re
from urllib.parse import urljoin

from ..parsing import parse_soup
from .base import BaseImporter


class ElectronicsBDImporter(BaseImporter):
    site_key = 'electronicsbd'
    site_name = 'ElectronicsBD'
    domains = ('electronics.com.bd',)
    example_url = 'https://www.electronics.com.bd/some-product'
    default_currency = 'BDT'

    def parse(self, html, url):
        soup = parse_soup(html)
        raw = {}

        heading = soup.select_one('#content h1, .product-title h1, h1.title, h1')
        if heading:
            raw['title'] = heading.get_text(strip=True)

        raw.update(self._extract_prices(soup))

        description = soup.select_one('#tab-description, .product-description, #description')
        if description:
            raw['description_html'] = description.decode_contents()

        specs = []
        spec_container = soup.select_one('#tab-specification, .product-specification')
        if spec_container:
            for row in spec_container.find_all('tr'):
                cells = row.find_all('td')
                if len(cells) >= 2:
                    key = cells[0].get_text(strip=True)
                    value = cells[1].get_text(' ', strip=True)
                    if key and value:
                        specs.append({'key': key, 'value': value})
        if specs:
            raw['specifications'] = specs

        raw['gallery'] = self._extract_gallery(soup, url)

        for label, target in (('brand', 'brand'), ('product code', 'sku'), ('model', 'model_number'),
                              ('reward points', None), ('availability', 'stock_status')):
            value = self._labelled_value(soup, label)
            if value and target:
                if target == 'stock_status':
                    raw[target] = 'in_stock' if 'in stock' in value.lower() else (
                        'out_of_stock' if 'out' in value.lower() else 'unknown')
                else:
                    raw[target] = value
        return raw

    @staticmethod
    def _extract_prices(soup):
        raw = {}
        price_new = soup.select_one('.price-new, .special-price, ins .amount')
        price_old = soup.select_one('.price-old, .old-price, del .amount')
        price_any = soup.select_one('.price, .product-price, [class*="price"]')
        if price_new:
            raw['price'] = price_new.get_text(strip=True)
            if price_old:
                raw['original_price'] = price_old.get_text(strip=True)
        elif price_any:
            text = price_any.get_text(' ', strip=True)
            match = re.search(r'[\d,]+(?:\.\d+)?', text)
            if match:
                raw['price'] = match.group(0)
        return raw

    @staticmethod
    def _extract_gallery(soup, base_url):
        gallery = []
        selectors = (
            '.thumbnails a, .product-image a, a.thumbnail, '
            '.swiper-slide img, .image-gallery img, #image, .product-image img'
        )
        for node in soup.select(selectors):
            src = node.get('href') if node.name == 'a' else (node.get('data-src') or node.get('src'))
            if src and not src.startswith('data:'):
                gallery.append(urljoin(base_url, src))
        return gallery

    @staticmethod
    def _labelled_value(soup, label):
        """OpenCart lists metadata as '<li>Brand: X</li>' or table rows."""
        pattern = re.compile(rf'^\s*{re.escape(label)}\s*:?\s*(.+)$', re.I)
        for node in soup.find_all(['li', 'span', 'p', 'td']):
            text = node.get_text(' ', strip=True)
            match = pattern.match(text)
            if match and len(match.group(1)) < 120:
                return match.group(1).strip()
        return ''
