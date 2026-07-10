"""
Price-pair detection heuristics.

Product pages usually show several numbers (selling price, crossed-out
regular price, EMI amounts, "save X" amounts, related-product prices).
Instead of grabbing the first visible number, we collect *candidates* with a
role attached (sale / regular / unknown) from multiple strategies and then
pick the most plausible (selling, regular) pair:

1. JSON-LD offers (price / lowPrice / highPrice)
2. <del>/<ins>/<s>/<strike> markup            -> del = regular, ins = sale
3. CSS class conventions used by WooCommerce / OpenCart / Magento / Shopify
   and most custom BD storefronts (price-old, regular-price, special-price…)
4. itemprop microdata

Rules applied at the end:
- regular price must be >= selling price; otherwise it is discarded
- a regular price more than 20x the selling price is treated as noise
"""
import re

from .schema import to_decimal_string

SALE_CLASS_RE = re.compile(
    r'(price-new|special-price|special\b|sale-price|price--sale|new-price|'
    r'offer-price|discounted-price|price-current|current-price|our-price|'
    r'product-price-new|price_sale|sale\b)', re.I)
REGULAR_CLASS_RE = re.compile(
    r'(price-old|old-price|regular-price|price--regular|was-price|price-was|'
    r'list-price|original-price|price-original|strike|line-through|'
    r'product-price-old|price_regular|compare-at-price|crossed)', re.I)
PRICE_CLASS_RE = re.compile(r'price|amount', re.I)

# "1,299", "1299.00", "১,২৯৯" not handled (Bangla digits are rare in markup)
NUMBER_RE = re.compile(r'\d[\d,]*(?:\.\d{1,2})?')

CURRENCY_HINTS = (
    ('৳', 'BDT'), ('tk', 'BDT'), ('bdt', 'BDT'),
    ('$', 'USD'), ('usd', 'USD'),
    ('€', 'EUR'), ('£', 'GBP'), ('₹', 'INR'), ('rs.', 'PKR'),
)


def extract_price_candidates(soup):
    """Collect (value, role) candidates. role ∈ {'sale', 'regular', 'unknown'}."""
    candidates = []

    # --- strikethrough markup: the strongest signal available
    for tag in soup.find_all(['del', 's', 'strike']):
        value = _first_number(tag.get_text(' ', strip=True))
        if value:
            candidates.append((value, 'regular'))
    for tag in soup.find_all('ins'):
        value = _first_number(tag.get_text(' ', strip=True))
        if value:
            candidates.append((value, 'sale'))

    # --- microdata
    for tag in soup.find_all(attrs={'itemprop': 'price'}):
        value = _first_number(tag.get('content') or tag.get_text(' ', strip=True))
        if value:
            candidates.append((value, 'sale'))

    # --- class-name conventions (scan only price-ish elements, nearest first)
    seen_nodes = set()
    for tag in soup.find_all(class_=PRICE_CLASS_RE, limit=60):
        if id(tag) in seen_nodes:
            continue
        seen_nodes.add(id(tag))
        class_attr = ' '.join(tag.get('class', []))
        own_text = tag.get_text(' ', strip=True)
        value = _first_number(own_text)
        if not value:
            continue
        if REGULAR_CLASS_RE.search(class_attr):
            candidates.append((value, 'regular'))
        elif SALE_CLASS_RE.search(class_attr):
            candidates.append((value, 'sale'))
        else:
            # inline style strikethrough
            style = tag.get('style', '')
            if 'line-through' in style:
                candidates.append((value, 'regular'))
            else:
                candidates.append((value, 'unknown'))
    return candidates


def resolve_price_pair(candidates, current_price='', current_original=''):
    """Combine already-extracted values with page candidates.

    Returns (price, original_price) as decimal strings ('' when unknown).
    Existing importer-provided values always win; heuristics only fill gaps.
    """
    price = to_decimal_string(current_price)
    original = to_decimal_string(current_original)

    sale_values = [to_decimal_string(v) for v, role in candidates if role == 'sale']
    regular_values = [to_decimal_string(v) for v, role in candidates if role == 'regular']
    unknown_values = [to_decimal_string(v) for v, role in candidates if role == 'unknown']
    sale_values = [v for v in sale_values if v]
    regular_values = [v for v in regular_values if v]
    unknown_values = [v for v in unknown_values if v]

    if not price:
        if sale_values:
            price = sale_values[0]
        elif unknown_values:
            # multiple identical "unknown" numbers -> the repeated one is the price
            price = _most_common(unknown_values)

    if not original and price:
        pool = regular_values or [v for v in unknown_values if _gt(v, price)]
        # choose the smallest regular value that is still above the price:
        # avoids picking unrelated big numbers (EMI totals, bundle prices)
        above = sorted((v for v in pool if _gt(v, price)), key=float)
        if above:
            original = above[0]

    # sanity checks
    if price and original:
        if not _gt(original, price):
            original = ''
        elif float(original) > float(price) * 20:
            original = ''
    return price, original


def detect_currency(soup, default=''):
    text = soup.get_text(' ', strip=True)[:4000].lower()
    for symbol, code in CURRENCY_HINTS:
        if symbol in text:
            return code
    return default


def compute_discount_percent(price, original_price):
    try:
        p, o = float(price), float(original_price)
    except (TypeError, ValueError):
        return 0
    if o <= 0 or p <= 0 or o <= p:
        return 0
    return round((o - p) / o * 100)


def _first_number(text):
    if not text:
        return None
    match = NUMBER_RE.search(text)
    return match.group(0) if match else None


def _most_common(values):
    counts = {}
    for v in values:
        counts[v] = counts.get(v, 0) + 1
    return max(counts, key=lambda v: (counts[v], -values.index(v)))


def _gt(a, b):
    try:
        return float(a) > float(b)
    except (TypeError, ValueError):
        return False
