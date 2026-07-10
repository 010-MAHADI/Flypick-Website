"""
GenericImporter — the universal fallback that makes "paste almost any
product URL" work.

It layers every extraction strategy we have (highest priority first):

1. optional per-store selector hints from a DomainProfile (see profiles.py)
2. common e-commerce selectors (WooCommerce, OpenCart, Magento, Shopify,
   PrestaShop and typical custom BD storefront conventions)
3. the BaseImporter structured-data fallbacks: JSON-LD Product, OpenGraph,
   microdata, breadcrumbs, spec tables, price-pair and stock heuristics

A dedicated importer is only needed when a site hides its data in
JavaScript blobs; everything else is covered here — including stores that
get their own display name via a DomainProfile without any custom code.
"""
import re
from urllib.parse import urlparse, urljoin

from ..parsing import parse_soup
from .base import BaseImporter

TITLE_SELECTORS = (
    'h1.product-title, h1.product-name, h1.product_title, h1[itemprop="name"], '
    '.product-title h1, .product-name h1, .product-info h1, .product_name h1, '
    '.summary h1.entry-title, h1.page-title span, h1'
)

DESCRIPTION_SELECTORS = (
    '#tab-description', '#description', '.product-description',
    '.woocommerce-Tabs-panel--description', '#tab-specification ~ #tab-description',
    '.product-details-description', '.product_description', '.description',
    '[itemprop="description"]', '#product-description', '.pd-description',
)

SHORT_DESCRIPTION_SELECTORS = (
    '.short-description', '.woocommerce-product-details__short-description',
    '.product-short-description', '.product-summary', '.pd-summary',
)

GALLERY_SELECTORS = (
    '.product-gallery img', '.woocommerce-product-gallery img',
    '.product-images img', '.product-image img', '.images-container img',
    '.thumbnails img', '.swiper-slide img', '.slick-slide img',
    '.owl-carousel img', '#image-gallery img', '.gallery img',
    'a.thumbnail', '.product-photo img', '.main-image img', 'img#image',
)

SPEC_CONTAINER_SELECTORS = (
    '#tab-specification', '#specification', '.specification',
    '.product-specification', '.specs', '#tab-specs', '.data-table',
    '.woocommerce-product-attributes', '.product-attributes', '.spec-table',
)

LABELLED_FIELDS = (
    ('brand', 'brand'),
    ('product code', 'sku'),
    ('sku', 'sku'),
    ('model', 'model_number'),
    ('warranty', 'warranty'),
)


class GenericImporter(BaseImporter):
    site_key = 'generic'
    site_name = 'Generic'
    domains = ()
    example_url = ''
    default_currency = 'BDT'

    def __init__(self, profile=None):
        self.profile = profile
        if profile:
            self.site_key = profile.key
            self.site_name = profile.name

    @classmethod
    def detect(cls, url):
        # The registry uses GenericImporter as the last resort for any
        # http(s) URL, so detection always succeeds.
        try:
            return urlparse(url).scheme in ('http', 'https')
        except ValueError:
            return False

    def parse(self, html, url):
        soup = parse_soup(html)
        if not self.profile:
            self.site_name = (urlparse(url).hostname or 'website').replace('www.', '')
        raw = {}

        hints = dict(self.profile.selectors) if self.profile else {}

        raw['title'] = self._select_text(soup, hints.get('title')) or self._select_text(soup, TITLE_SELECTORS)

        price, regular = self._extract_price_pair(soup, hints)
        if price:
            raw['price'] = price
        if regular:
            raw['original_price'] = regular

        description = self._select_node(soup, hints.get('description')) \
            or self._first_node(soup, DESCRIPTION_SELECTORS)
        if description:
            raw['description_html'] = description.decode_contents()

        short_node = self._select_node(soup, hints.get('short_description')) \
            or self._first_node(soup, SHORT_DESCRIPTION_SELECTORS)
        if short_node:
            items = [li.get_text(' ', strip=True) for li in short_node.find_all('li')]
            items = [i for i in items if i]
            if items:
                raw['highlights'] = items[:10]
            raw['short_description'] = short_node.get_text(' ', strip=True)[:500]

        gallery = self._extract_gallery(soup, url, hints.get('gallery'))
        if gallery:
            raw['gallery'] = gallery

        specs = self._extract_specs(soup, hints.get('specs'))
        if specs:
            raw['specifications'] = specs

        for label, target in LABELLED_FIELDS:
            if not raw.get(target):
                value = self._labelled_value(soup, label)
                if value:
                    raw[target] = value

        availability = self._select_text(soup, hints.get('availability'))
        if availability:
            raw['stock_status'] = availability
        return raw

    # ------------------------------------------------------------- helpers

    def _extract_price_pair(self, soup, hints):
        """Read the profile's price selectors, keeping selling and regular
        strictly separate. A node containing several prices ("51,200৳
        53,900৳") is split: first number = selling, a larger second number =
        regular. The two values are never concatenated."""
        from ..schema import to_decimal_string

        price_node = self._select_node(soup, hints.get('price'))
        regular_text = self._select_text(soup, hints.get('regular_price'))
        regular = to_decimal_string(regular_text)

        price = ''
        if price_node:
            # strikethrough children inside the price node are regular prices
            struck = price_node.find(['del', 's', 'strike'])
            if struck:
                if not regular:
                    regular = to_decimal_string(struck.get_text(' ', strip=True))
                struck.extract()
            text = price_node.get_text(' ', strip=True)
            numbers = [to_decimal_string(n) for n in re.findall(r'\d[\d,]*(?:\.\d{1,2})?', text)]
            numbers = [n for n in numbers if n]
            if numbers:
                price = numbers[0]
                if not regular and len(numbers) > 1 and float(numbers[1]) > float(price):
                    regular = numbers[1]
        return price, regular

    @staticmethod
    def _select_text(soup, selector):
        if not selector:
            return ''
        node = soup.select_one(selector)
        return node.get_text(' ', strip=True) if node else ''

    @staticmethod
    def _select_node(soup, selector):
        return soup.select_one(selector) if selector else None

    @staticmethod
    def _first_node(soup, selectors):
        for selector in selectors:
            node = soup.select_one(selector)
            if node and node.get_text(strip=True):
                return node
        return None

    @staticmethod
    def _extract_gallery(soup, base_url, hint_selector=None):
        gallery = []
        selectors = ([hint_selector] if hint_selector else []) + list(GALLERY_SELECTORS)
        for selector in selectors:
            for node in soup.select(selector):
                src = (node.get('href') if node.name == 'a' else None) \
                    or node.get('data-image-large-src') or node.get('data-large_image') \
                    or node.get('data-zoom-image') or node.get('data-src') or node.get('src')
                if not src or src.startswith('data:'):
                    continue
                absolute = urljoin(base_url, src)
                if absolute not in gallery and not _looks_like_ui_asset(absolute):
                    gallery.append(absolute)
            if gallery:
                break
        return gallery[:12]

    def _extract_specs(self, soup, hint_selector=None):
        from ..parsing import extract_spec_tables
        selectors = ([hint_selector] if hint_selector else []) + list(SPEC_CONTAINER_SELECTORS)
        for selector in selectors:
            specs = extract_spec_tables(soup, [selector])
            if specs:
                return specs
        return []

    @staticmethod
    def _labelled_value(soup, label):
        # Require an explicit "Label: value" pattern with a short value —
        # matches without a colon or with long values are almost always
        # navigation menus, filter lists or concatenated table cells.
        pattern = re.compile(rf'^\s*{re.escape(label)}\s*:\s*(.+)$', re.I)
        for node in soup.find_all(['li', 'span', 'p', 'td', 'div'], limit=800):
            direct_text = ' '.join(node.find_all(string=True, recursive=False)).strip() \
                if node.name == 'div' else node.get_text(' ', strip=True)
            match = pattern.match(direct_text or '')
            if not match:
                continue
            value = match.group(1).strip()
            if 0 < len(value) <= 60 and len(value.split()) <= 4:
                return value
        return ''


def _looks_like_ui_asset(url):
    lowered = url.lower()
    return any(token in lowered for token in (
        'logo', 'icon', 'sprite', 'placeholder', 'banner', 'payment',
        'flag', 'avatar', 'loader', 'spinner', 'blank.', 'pixel.',
    ))
