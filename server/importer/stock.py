"""
Stock/availability detection and normalization.

Every source website is normalized into one standard vocabulary:

    in_stock | out_of_stock | limited_stock | pre_order | unknown

plus an optional quantity when the page reveals it ("Only 3 left").
"""
import re

IN_STOCK = 'in_stock'
OUT_OF_STOCK = 'out_of_stock'
LIMITED_STOCK = 'limited_stock'
PRE_ORDER = 'pre_order'
UNKNOWN = 'unknown'

STOCK_STATUSES = (IN_STOCK, OUT_OF_STOCK, LIMITED_STOCK, PRE_ORDER, UNKNOWN)

# schema.org availability URIs
_SCHEMA_MAP = {
    'instock': IN_STOCK,
    'instoreonly': IN_STOCK,
    'onlineonly': IN_STOCK,
    'limitedavailability': LIMITED_STOCK,
    'preorder': PRE_ORDER,
    'presale': PRE_ORDER,
    'backorder': PRE_ORDER,
    'outofstock': OUT_OF_STOCK,
    'soldout': OUT_OF_STOCK,
    'discontinued': OUT_OF_STOCK,
}

_ONLY_X_LEFT_RE = re.compile(r'only\s+(\d{1,4})\s+(?:left|remaining|in stock)', re.I)

# order matters: more specific phrases first
_TEXT_RULES = (
    (PRE_ORDER, ('pre-order', 'pre order', 'preorder', 'available soon', 'coming soon', 'upcoming')),
    (OUT_OF_STOCK, ('out of stock', 'stock out', 'sold out', 'unavailable', 'not available',
                    'currently unavailable', 'discontinued')),
    (LIMITED_STOCK, ('limited stock', 'low stock', 'few left', 'hurry up', 'almost gone')),
    (IN_STOCK, ('in stock', 'available in store', 'available now', 'ready to ship', 'add to cart')),
)


def normalize_availability(value):
    """Normalize a schema.org availability URI, one of our own status values,
    or free text into the standard vocabulary."""
    if not value:
        return UNKNOWN
    if value in STOCK_STATUSES:
        return value
    lowered = str(value).lower().replace(' ', '').replace('_', '').replace('-', '')
    for key, status in _SCHEMA_MAP.items():
        if key in lowered:
            return status
    return classify_text(str(value))


def classify_text(text):
    if not text:
        return UNKNOWN
    lowered = text.lower()
    if _ONLY_X_LEFT_RE.search(lowered):
        return LIMITED_STOCK
    for status, phrases in _TEXT_RULES:
        if any(p in lowered for p in phrases):
            return status
    return UNKNOWN


def detect_stock(soup, known_status=UNKNOWN, known_quantity=0):
    """Best-effort page-level detection. Importer-provided values win."""
    status = known_status if known_status in STOCK_STATUSES and known_status != UNKNOWN else UNKNOWN
    quantity = known_quantity or 0

    page_text = soup.get_text(' ', strip=True)[:20000]

    match = _ONLY_X_LEFT_RE.search(page_text)
    if match and not quantity:
        quantity = int(match.group(1))
        if status == UNKNOWN:
            status = LIMITED_STOCK

    if status == UNKNOWN:
        # look at typical availability areas before falling back to whole page
        for node in soup.select('[class*="stock" i], [class*="availability" i], [id*="stock" i]'):
            status = classify_text(node.get_text(' ', strip=True))
            if status != UNKNOWN:
                break

    if status == UNKNOWN:
        status = classify_text(page_text)

    if quantity and status == IN_STOCK and quantity <= 5:
        status = LIMITED_STOCK
    return status, quantity
