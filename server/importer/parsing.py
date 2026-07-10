"""
Site-agnostic extraction helpers shared by all importers:

- JSON-LD (schema.org Product)
- OpenGraph / Twitter meta tags
- schema.org microdata
- brace-matched extraction of JavaScript-embedded JSON blobs
"""
import json
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .stock import UNKNOWN as STOCK_UNKNOWN
from .stock import normalize_availability


def parse_soup(html):
    return BeautifulSoup(html, 'html.parser')


# ---------------------------------------------------------------- JSON blobs

def extract_json_after(text, marker):
    """Extract the JSON object that starts right after ``marker`` in ``text``.

    Handles nested braces and string escapes, which regex alone cannot.
    Returns a dict or None.
    """
    idx = text.find(marker)
    if idx == -1:
        return None
    start = text.find('{', idx + len(marker))
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    for pos in range(start, min(len(text), start + 3_000_000)):
        ch = text[pos]
        if in_string:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                candidate = text[start:pos + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    return None
    return None


def dig(data, *path, default=None):
    """Safely walk nested dicts/lists: dig(d, 'a', 0, 'b')."""
    current = data
    for key in path:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and isinstance(key, int) and -len(current) <= key < len(current):
            current = current[key]
        else:
            return default
        if current is None:
            return default
    return current


# ------------------------------------------------------------------ JSON-LD

def extract_json_ld_products(soup):
    """Return every schema.org Product object found in JSON-LD blocks."""
    products = []
    for script in soup.find_all('script', type='application/ld+json'):
        raw = script.string or script.get_text()
        if not raw:
            continue
        try:
            data = json.loads(raw.strip())
        except json.JSONDecodeError:
            # Some sites embed invalid JSON with control chars; try a cleanup pass
            try:
                data = json.loads(re.sub(r'[\x00-\x1f]', ' ', raw.strip()))
            except json.JSONDecodeError:
                continue
        for node in _iter_ld_nodes(data):
            node_type = node.get('@type', '')
            types = node_type if isinstance(node_type, list) else [node_type]
            if any(str(t).lower() == 'product' for t in types):
                products.append(node)
    return products


def _iter_ld_nodes(data):
    if isinstance(data, list):
        for item in data:
            yield from _iter_ld_nodes(item)
    elif isinstance(data, dict):
        yield data
        for value in data.get('@graph', []) if isinstance(data.get('@graph'), list) else []:
            yield from _iter_ld_nodes(value)


def json_ld_to_fields(product, base_url=''):
    """Map a schema.org Product node onto our normalized field names."""
    fields = {}
    fields['title'] = _first_str(product.get('name'))
    fields['description_html'] = _first_str(product.get('description'))
    fields['sku'] = _first_str(product.get('sku')) or _first_str(product.get('mpn'))
    fields['model_number'] = _first_str(product.get('model')) or _first_str(product.get('mpn'))

    brand = product.get('brand')
    if isinstance(brand, dict):
        fields['brand'] = _first_str(brand.get('name'))
    else:
        fields['brand'] = _first_str(brand)
    manufacturer = product.get('manufacturer')
    if isinstance(manufacturer, dict):
        fields['manufacturer'] = _first_str(manufacturer.get('name'))
    else:
        fields['manufacturer'] = _first_str(manufacturer)

    images = product.get('image')
    if isinstance(images, str):
        images = [images]
    elif isinstance(images, dict):
        images = [images.get('url', '')]
    fields['gallery'] = [urljoin(base_url, img) for img in images or [] if isinstance(img, str) and img]

    offers = product.get('offers')
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if isinstance(offers, dict):
        if str(offers.get('@type', '')).lower() == 'aggregateoffer':
            fields['price'] = offers.get('lowPrice') or offers.get('price')
        else:
            fields['price'] = offers.get('price')
        fields['currency'] = _first_str(offers.get('priceCurrency'))
        status = normalize_availability(offers.get('availability'))
        if status != STOCK_UNKNOWN:
            fields['stock_status'] = status

    return {k: v for k, v in fields.items() if v}


def _first_str(value):
    if isinstance(value, list):
        value = value[0] if value else ''
    return str(value).strip() if value else ''


# ------------------------------------------------------- meta tags / OG

def extract_meta_fields(soup, base_url=''):
    """OpenGraph / twitter / standard meta fallbacks."""
    fields = {}

    def meta(*selectors):
        for attr, name in selectors:
            tag = soup.find('meta', attrs={attr: name})
            if tag and tag.get('content'):
                return tag['content'].strip()
        return ''

    fields['title'] = meta(('property', 'og:title'), ('name', 'twitter:title'))
    fields['short_description'] = meta(('property', 'og:description'), ('name', 'description'),
                                       ('name', 'twitter:description'))
    image = meta(('property', 'og:image'), ('name', 'twitter:image'))
    if image:
        fields['gallery'] = [urljoin(base_url, image)]
    price = meta(('property', 'product:price:amount'), ('property', 'og:price:amount'))
    if price:
        fields['price'] = price
    currency = meta(('property', 'product:price:currency'), ('property', 'og:price:currency'))
    if currency:
        fields['currency'] = currency
    brand = meta(('property', 'product:brand'),)
    if brand:
        fields['brand'] = brand
    availability = meta(('property', 'product:availability'), ('property', 'og:availability'))
    if availability:
        status = normalize_availability(availability)
        if status != STOCK_UNKNOWN:
            fields['stock_status'] = status

    if not fields['title']:
        title_tag = soup.find('title')
        if title_tag:
            fields['title'] = title_tag.get_text(strip=True)
    return {k: v for k, v in fields.items() if v}


# ------------------------------------------------------------- microdata

def extract_microdata_fields(soup, base_url=''):
    scope = soup.find(attrs={'itemtype': re.compile(r'schema\.org/Product', re.I)})
    if not scope:
        return {}
    fields = {}

    def prop(name):
        tag = scope.find(attrs={'itemprop': name})
        if not tag:
            return ''
        if tag.name == 'meta':
            return (tag.get('content') or '').strip()
        if tag.name == 'img':
            return urljoin(base_url, tag.get('src', ''))
        # nested itemscope (e.g. brand > name) carries the actual value
        if name != 'name':
            nested = tag.find(attrs={'itemprop': 'name'})
            if nested is not None:
                return (nested.get('content') or nested.get_text(' ', strip=True)).strip()
        text = tag.get_text(' ', strip=True)
        # drop a redundant label prefix ("Brand AOC" -> "AOC")
        if text.lower().startswith(name.lower()):
            stripped = text[len(name):].lstrip(' :-–')
            if stripped:
                text = stripped
        return text

    fields['title'] = prop('name')
    fields['brand'] = prop('brand')
    fields['sku'] = prop('sku')
    price_tag = scope.find(attrs={'itemprop': 'price'})
    if price_tag:
        fields['price'] = price_tag.get('content') or price_tag.get_text(strip=True)
    currency_tag = scope.find(attrs={'itemprop': 'priceCurrency'})
    if currency_tag:
        fields['currency'] = currency_tag.get('content') or currency_tag.get_text(strip=True)
    image = prop('image')
    if image:
        fields['gallery'] = [image]
    return {k: v for k, v in fields.items() if v}


# ----------------------------------------------------------- misc helpers

def extract_breadcrumbs(soup):
    """Best-effort breadcrumb trail (used for category suggestion)."""
    crumbs = []
    container = soup.find(attrs={'class': re.compile(r'breadcrumb', re.I)}) or \
        soup.find('nav', attrs={'aria-label': re.compile(r'breadcrumb', re.I)})
    if container:
        for link in container.find_all(['a', 'span', 'li']):
            text = link.get_text(strip=True)
            if text and text.lower() not in ('home', '/', '>', '»') and text not in crumbs:
                crumbs.append(text)
    # JSON-LD BreadcrumbList as fallback
    if not crumbs:
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
            except (json.JSONDecodeError, TypeError):
                continue
            for node in _iter_ld_nodes(data):
                if str(node.get('@type', '')).lower() == 'breadcrumblist':
                    for item in node.get('itemListElement', []):
                        name = dig(item, 'item', 'name') or item.get('name')
                        if name and str(name).lower() != 'home':
                            crumbs.append(str(name).strip())
    return crumbs[:6]


def extract_spec_tables(soup, container_selectors=None):
    """Pull key/value pairs out of specification tables and definition lists."""
    specs = []
    seen = set()
    containers = []
    if container_selectors:
        for selector in container_selectors:
            containers.extend(soup.select(selector))
    if not containers:
        containers = [soup]

    for container in containers:
        for row in container.find_all('tr'):
            cells = row.find_all(['th', 'td'])
            if len(cells) >= 2:
                key = cells[0].get_text(strip=True)
                value = cells[1].get_text(' ', strip=True)
                _push_spec(specs, seen, key, value)
        for dl in container.find_all('dl'):
            terms = dl.find_all('dt')
            values = dl.find_all('dd')
            for dt, dd in zip(terms, values):
                _push_spec(specs, seen, dt.get_text(strip=True), dd.get_text(' ', strip=True))
    return specs


def _push_spec(specs, seen, key, value):
    key = (key or '').strip().rstrip(':')
    value = (value or '').strip()
    if not key or not value or len(key) > 100 or len(value) > 500:
        return
    fingerprint = key.lower()
    if fingerprint in seen:
        return
    seen.add(fingerprint)
    specs.append({'key': key, 'value': value})
