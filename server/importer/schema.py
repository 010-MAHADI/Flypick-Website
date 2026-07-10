"""
The standardized product object every importer must return.

Keeping this in one place guarantees that AliExpress, Daraz and every future
importer speak the same language to the preview UI and the save endpoint.
"""
import re
from dataclasses import dataclass, field, asdict
from decimal import Decimal, InvalidOperation

# First standalone number in a string: "51,200৳ 53,900৳" -> "51,200"
_NUMBER_TOKEN_RE = re.compile(r'\d[\d,]*(?:\.\d{1,2})?')

# Product.price is DecimalField(max_digits=10, decimal_places=2) -> 8 integer digits
_MAX_PRICE = Decimal('99999999.99')


@dataclass
class NormalizedProduct:
    # Source
    source_url: str = ''
    source_site: str = ''
    external_id: str = ''

    # Core content
    title: str = ''
    short_description: str = ''
    description_html: str = ''
    description_text: str = ''

    # Media (remote URLs at preview time; downloaded on save)
    main_image: str = ''
    gallery: list = field(default_factory=list)

    # Pricing
    price: str = ''            # decimal as string to survive JSON round-trips
    original_price: str = ''
    discount_percent: int = 0
    currency: str = 'BDT'

    # Identity
    brand: str = ''
    manufacturer: str = ''
    sku: str = ''
    model_number: str = ''

    # Classification
    category_path: list = field(default_factory=list)   # breadcrumb from source site
    suggested_category: str = ''                        # best match against our categories
    suggested_category_id: int = 0
    tags: list = field(default_factory=list)

    # Inventory
    stock_status: str = 'unknown'   # in_stock | out_of_stock | unknown
    stock_quantity: int = 0

    # Variants / attributes
    colors: list = field(default_factory=list)
    sizes: list = field(default_factory=list)
    options: list = field(default_factory=list)          # [{name, values: []}]
    specifications: list = field(default_factory=list)   # [{key, value}]
    attributes: dict = field(default_factory=dict)

    # Extras
    shipping: dict = field(default_factory=dict)
    warranty: str = ''
    highlights: list = field(default_factory=list)

    # SEO
    seo_title: str = ''
    seo_description: str = ''
    slug: str = ''

    # Non-fatal problems collected during import (shown in the preview)
    warnings: list = field(default_factory=list)

    def to_dict(self):
        return asdict(self)

    def add_warning(self, message):
        if message and message not in self.warnings:
            self.warnings.append(message)


def to_decimal_string(value):
    """Coerce scraped price values ('1,299.00', 1299, '৳1299') to '1299.00'.

    Only the FIRST number in a string is used — text containing several
    prices ('51,200৳ 53,900৳') must never have its digits merged together.
    Values outside the Product price column's range return ''.
    """
    if value is None:
        return ''
    if isinstance(value, (int, float, Decimal)):
        try:
            amount = Decimal(str(value))
        except InvalidOperation:
            return ''
        return _bounded(amount)
    match = _NUMBER_TOKEN_RE.search(str(value))
    if not match:
        return ''
    cleaned = match.group(0)
    # Treat commas as thousands separators unless they act as the decimal mark
    if ',' in cleaned and '.' not in cleaned:
        head, _, tail = cleaned.rpartition(',')
        cleaned = f'{head.replace(",", "")}.{tail}' if len(tail) == 2 else cleaned.replace(',', '')
    else:
        cleaned = cleaned.replace(',', '')
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return ''
    return _bounded(amount)


def _bounded(amount):
    if amount <= 0 or amount > _MAX_PRICE:
        return ''
    return str(amount.quantize(Decimal('0.01')))
