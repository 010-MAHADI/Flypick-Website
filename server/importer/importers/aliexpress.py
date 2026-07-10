"""
AliExpress importer.

AliExpress product pages ship their data in a JavaScript blob
(``window.runParams = {...}``) whose ``data`` key contains per-module
components (title, price, images, SKU properties, specifications). Layouts
vary by region/AB-test, so every lookup is defensive and the generic
JSON-LD / OpenGraph fallbacks in BaseImporter cover the rest.
"""
import re

from ..exceptions import BlockedRequestError
from ..parsing import dig, extract_json_after
from .base import BaseImporter


class AliExpressImporter(BaseImporter):
    site_key = 'aliexpress'
    site_name = 'AliExpress'
    domains = ('aliexpress.com', 'aliexpress.us', 'aliexpress.ru')
    example_url = 'https://www.aliexpress.com/item/1005001234567890.html'
    default_currency = 'USD'

    # Locale cookies nudge AliExpress towards the server-rendered variant
    RETRY_HEADERS = {
        'Cookie': 'aep_usuc_f=site=glo&c_tp=USD&b_locale=en_US&region=US; intl_locale=en_US; x_locale=en_US',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    def fetch(self, url):
        """Fetch with a second attempt using locale cookies when AliExpress
        serves its client-side-rendered shell (no product data in the HTML)."""
        from ..http_client import fetch_html
        html, final_url = fetch_html(url)
        if self._looks_like_csr_shell(html):
            retry_html, retry_url = fetch_html(url, extra_headers=self.RETRY_HEADERS)
            if not self._looks_like_csr_shell(retry_html):
                return retry_html, retry_url
        return html, final_url

    @staticmethod
    def _looks_like_csr_shell(html):
        data = extract_json_after(html, 'window.runParams')
        has_data = bool((data or {}).get('data'))
        return not has_data and ('isCSR = true' in html or "isCSR = 'true'" in html)

    def parse(self, html, url):
        raw = {}
        match = re.search(r'/item/(\d+)\.html', url)
        if match:
            raw['external_id'] = match.group(1)

        run_params = extract_json_after(html, 'window.runParams')
        data = (run_params or {}).get('data') or run_params or {}

        # Even after the cookie retry AliExpress may only serve the
        # client-side-rendered shell. There is no product data to read in
        # that case — skip gracefully with a clear explanation.
        if not data and self._looks_like_csr_shell(html):
            raise BlockedRequestError(
                'AliExpress is currently serving a JavaScript-only page to our server '
                '(anti-bot protection). This product cannot be imported right now — '
                'try again later or add it manually. Other websites are unaffected.'
            )

        title = (
            dig(data, 'productInfoComponent', 'subject')
            or dig(data, 'titleModule', 'subject')
            or dig(data, 'metaDataComponent', 'title')
        )
        if title:
            raw['title'] = title

        images = (
            dig(data, 'imageComponent', 'imagePathList')
            or dig(data, 'imageModule', 'imagePathList')
            or []
        )
        raw['gallery'] = [self._absolutize(img) for img in images if isinstance(img, str)]

        price = (
            dig(data, 'priceComponent', 'discountPrice', 'minActivityAmount', 'value')
            or dig(data, 'priceComponent', 'origPrice', 'minAmount', 'value')
            or dig(data, 'priceModule', 'minActivityAmount', 'value')
            or dig(data, 'priceModule', 'minAmount', 'value')
        )
        original = (
            dig(data, 'priceComponent', 'origPrice', 'minAmount', 'value')
            or dig(data, 'priceModule', 'minAmount', 'value')
        )
        if price:
            raw['price'] = price
            if original and original != price:
                raw['original_price'] = original
        currency = (
            dig(data, 'priceComponent', 'discountPrice', 'minActivityAmount', 'currency')
            or dig(data, 'priceModule', 'minAmount', 'currency')
            or dig(data, 'webEnv', 'currency')
        )
        if currency:
            raw['currency'] = currency

        specs = []
        props = (
            dig(data, 'productPropComponent', 'props')
            or dig(data, 'specsModule', 'props')
            or []
        )
        for prop in props:
            key = prop.get('attrName') or prop.get('name')
            value = prop.get('attrValue') or prop.get('value')
            if key and value:
                specs.append({'key': str(key).strip(), 'value': str(value).strip()})
                if str(key).strip().lower() in ('brand name', 'brand'):
                    raw['brand'] = str(value).strip()
                if str(key).strip().lower() in ('model number', 'model'):
                    raw['model_number'] = str(value).strip()
        if specs:
            raw['specifications'] = specs

        colors, sizes, options = self._extract_sku_options(data)
        if colors:
            raw['colors'] = colors
        if sizes:
            raw['sizes'] = sizes
        if options:
            raw['options'] = options

        quantity = (
            dig(data, 'inventoryComponent', 'totalAvailQuantity')
            or dig(data, 'quantityModule', 'totalAvailQuantity')
        )
        if isinstance(quantity, int):
            raw['stock_quantity'] = quantity
            raw['stock_status'] = 'in_stock' if quantity > 0 else 'out_of_stock'

        description_url = (
            dig(data, 'productDescComponent', 'descriptionUrl')
            or dig(data, 'descriptionModule', 'descriptionUrl')
        )
        if description_url:
            # Description lives on a separate CDN document; fetch is best-effort.
            try:
                desc_html, _ = self.fetch(description_url)
                raw['description_html'] = desc_html
            except Exception:
                pass

        crumbs = dig(data, 'crossLinkComponent', 'breadCrumbPathList') or []
        path = [c.get('target') or c.get('name') for c in crumbs if isinstance(c, dict)]
        raw['category_path'] = [p for p in path if p and str(p).lower() != 'home']

        return raw

    @staticmethod
    def _extract_sku_options(data):
        colors, sizes, options = [], [], []
        sku_props = (
            dig(data, 'skuComponent', 'productSKUPropertyList')
            or dig(data, 'skuModule', 'productSKUPropertyList')
            or []
        )
        for prop in sku_props:
            name = str(prop.get('skuPropertyName', '')).strip()
            values = [
                str(v.get('propertyValueDisplayName') or v.get('propertyValueName') or '').strip()
                for v in prop.get('skuPropertyValues', [])
            ]
            values = [v for v in values if v]
            if not name or not values:
                continue
            options.append({'name': name, 'values': values})
            if 'color' in name.lower():
                colors.extend(values)
            elif 'size' in name.lower():
                sizes.extend(values)
        return colors, sizes, options

    @staticmethod
    def _absolutize(image_url):
        if image_url.startswith('//'):
            return 'https:' + image_url
        return image_url
