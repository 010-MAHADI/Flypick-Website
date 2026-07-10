"""
BaseImporter — the contract every website importer implements.

Lifecycle (driven by the engine):
    detect(url)  -> class method, does this importer handle the URL?
    fetch(url)   -> download the page (shared SSRF-safe client)
    parse(html)  -> site-specific extraction into a raw dict
    normalize()  -> merge raw + structured-data fallbacks into NormalizedProduct
"""
import logging
from urllib.parse import urlparse

from ..exceptions import ParsingError, ProductNotFoundError
from ..http_client import fetch_html
from ..parsing import (
    extract_breadcrumbs,
    extract_json_ld_products,
    extract_meta_fields,
    extract_microdata_fields,
    extract_spec_tables,
    json_ld_to_fields,
    parse_soup,
)
from ..pricing import (
    compute_discount_percent,
    detect_currency,
    extract_price_candidates,
    resolve_price_pair,
)
from ..sanitizer import html_to_text, sanitize_html
from ..schema import NormalizedProduct
from ..stock import UNKNOWN as STOCK_UNKNOWN
from ..stock import detect_stock, normalize_availability

logger = logging.getLogger('importer')

LIST_FIELDS = {'gallery', 'colors', 'sizes', 'options', 'specifications', 'tags',
               'category_path', 'highlights', 'warnings'}


class BaseImporter:
    site_key = 'base'
    site_name = 'Base'
    domains = ()          # hostname suffixes this importer owns
    example_url = ''
    default_currency = 'BDT'

    # ------------------------------------------------------------ detection
    @classmethod
    def detect(cls, url):
        try:
            hostname = (urlparse(url).hostname or '').lower()
        except ValueError:
            return False
        return any(hostname == d or hostname.endswith('.' + d) for d in cls.domains)

    # -------------------------------------------------------------- fetch
    def fetch(self, url):
        html, final_url = fetch_html(url)
        return html, final_url

    # -------------------------------------------------------------- parse
    def parse(self, html, url):
        """Site-specific extraction. Subclasses override; must return a dict
        of normalized field names. May raise ParsingError/ProductNotFoundError."""
        return {}

    # ---------------------------------------------------------- normalize
    def normalize(self, raw, html, url):
        """Merge site-specific data with generic structured-data fallbacks."""
        soup = parse_soup(html)
        merged = {}

        # Priority: site-specific -> JSON-LD -> microdata -> meta tags
        for source in (self._structured_fallbacks(soup, url), raw):
            for key, value in source.items():
                if value in (None, '', [], {}):
                    continue
                if key in LIST_FIELDS and merged.get(key):
                    existing = merged[key]
                    for item in value:
                        if item not in existing:
                            existing.append(item)
                else:
                    merged[key] = value

        if not merged.get('title'):
            raise ProductNotFoundError()

        product = NormalizedProduct(source_url=url, source_site=self.site_name)
        product.title = str(merged.get('title', '')).strip()[:255]
        product.external_id = str(merged.get('external_id', ''))[:100]

        description_html = merged.get('description_html', '')
        product.description_html = sanitize_html(description_html)
        product.description_text = merged.get('description_text') or html_to_text(product.description_html)
        product.short_description = str(merged.get('short_description', '')).strip()[:500]

        gallery = _dedupe([u for u in merged.get('gallery', []) if isinstance(u, str) and u.startswith('http')])
        product.gallery = gallery[:10]
        product.main_image = merged.get('main_image') or (gallery[0] if gallery else '')

        # Importer-provided prices win; page-level heuristics fill the gaps
        # (e.g. missing regular price) and never pick "the first number seen".
        try:
            candidates = extract_price_candidates(soup)
        except Exception:
            candidates = []
        product.price, product.original_price = resolve_price_pair(
            candidates, merged.get('price'), merged.get('original_price'))
        currency = merged.get('currency') or detect_currency(soup) or self.default_currency
        product.currency = str(currency).upper()[:5]
        product.discount_percent = compute_discount_percent(product.price, product.original_price)

        product.brand = str(merged.get('brand', '')).strip()[:255]
        product.manufacturer = str(merged.get('manufacturer') or merged.get('brand', '')).strip()[:255]
        product.sku = str(merged.get('sku', '')).strip()[:100]
        product.model_number = str(merged.get('model_number', '')).strip()[:100]

        product.specifications = (merged.get('specifications') or extract_spec_tables(soup))[:60]
        # The spec table is usually the most reliable place for identity
        # fields — use it whenever direct extraction found nothing.
        for spec in product.specifications:
            key = spec['key'].lower()
            if not product.brand and key in ('brand', 'brand name'):
                product.brand = spec['value'][:255]
                product.manufacturer = product.manufacturer or product.brand
            elif not product.model_number and key in ('model', 'model number', 'model name'):
                product.model_number = spec['value'][:100]
            elif not product.warranty and key == 'warranty':
                merged.setdefault('warranty', spec['value'])

        product.category_path = merged.get('category_path') or extract_breadcrumbs(soup)
        product.tags = [str(t).strip() for t in merged.get('tags', []) if str(t).strip()][:15]

        try:
            known_quantity = max(0, int(merged.get('stock_quantity', 0)))
        except (TypeError, ValueError):
            known_quantity = 0
        known_status = normalize_availability(merged.get('stock_status', STOCK_UNKNOWN))
        try:
            product.stock_status, product.stock_quantity = detect_stock(soup, known_status, known_quantity)
        except Exception:
            product.stock_status, product.stock_quantity = known_status, known_quantity

        product.colors = _dedupe(merged.get('colors', []))[:20]
        product.sizes = _dedupe(merged.get('sizes', []))[:30]
        product.options = merged.get('options', [])[:10]
        product.attributes = merged.get('attributes', {})
        product.shipping = merged.get('shipping', {})
        product.warranty = str(merged.get('warranty', '')).strip()[:100]
        product.highlights = _dedupe(merged.get('highlights', []))[:10]

        for warning in merged.get('warnings', []):
            product.add_warning(warning)
        if not product.price:
            product.add_warning('No price could be detected — please set it manually before saving.')
        if not product.gallery:
            product.add_warning('No images could be detected on the product page.')
        if not product.description_html and not product.short_description:
            product.add_warning('No description could be detected.')
        return product

    def _structured_fallbacks(self, soup, url):
        """Generic extraction shared by every site (lowest priority)."""
        fields = {}
        for extractor in (
            lambda: extract_meta_fields(soup, url),
            lambda: extract_microdata_fields(soup, url),
            lambda: self._json_ld_fields(soup, url),
        ):
            try:
                for key, value in extractor().items():
                    if value in (None, '', [], {}):
                        continue
                    if key in LIST_FIELDS and fields.get(key):
                        for item in value:
                            if item not in fields[key]:
                                fields[key].append(item)
                    else:
                        fields[key] = value
            except Exception:  # fallbacks must never break an import
                logger.exception('Structured-data fallback failed for %s', url)
        return fields

    @staticmethod
    def _json_ld_fields(soup, url):
        products = extract_json_ld_products(soup)
        return json_ld_to_fields(products[0], url) if products else {}


def _dedupe(items):
    seen = set()
    result = []
    for item in items:
        key = str(item).strip()
        if key and key.lower() not in seen:
            seen.add(key.lower())
            result.append(key)
    return result
