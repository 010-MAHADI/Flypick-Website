"""
Unit tests for the import engine: URL detection, SSRF guard, HTML parsing,
normalization and enrichment — all offline (no network).
"""
from django.test import TestCase

from .enrichment import enrich_product, generate_tags, make_seo_title
from .exceptions import BlockedUrlError, InvalidUrlError
from .http_client import validate_public_url
from .importers import get_importer_for
from .importers.aliexpress import AliExpressImporter
from .importers.daraz import DarazImporter
from .importers.electronicsbd import ElectronicsBDImporter
from .importers.generic import GenericImporter
from .importers.roboticsbd import RoboticsBDImporter
from .parsing import extract_json_after
from .pricing import extract_price_candidates, resolve_price_pair
from .sanitizer import html_to_text, sanitize_html
from .schema import to_decimal_string
from .stock import classify_text, detect_stock, normalize_availability


class DetectionTests(TestCase):
    def test_detects_each_dedicated_site(self):
        cases = {
            'https://www.aliexpress.com/item/1005001234.html': AliExpressImporter,
            'https://www.daraz.com.bd/products/phone-i12345.html': DarazImporter,
            'https://www.electronics.com.bd/some-tv': ElectronicsBDImporter,
            'https://store.roboticsbd.com/robotics/12-arduino.html': RoboticsBDImporter,
        }
        for url, expected in cases.items():
            self.assertIsInstance(get_importer_for(url), expected, url)

    def test_profiled_bd_stores_use_generic_with_profile(self):
        cases = {
            'https://www.startech.com.bd/asus-monitor': 'Star Tech',
            'https://www.ryans.com/some-laptop': 'Ryans Computers',
            'https://www.techlandbd.com/some-gpu': 'TechLand BD',
            'https://www.pchouse.com.bd/some-cpu': 'PC House',
            'https://www.ucc.com.bd/some-ram': 'UCC (Unique Computers)',
        }
        for url, name in cases.items():
            importer = get_importer_for(url)
            self.assertIsInstance(importer, GenericImporter, url)
            self.assertEqual(importer.site_name, name, url)

    def test_unknown_site_falls_back_to_universal_importer(self):
        importer = get_importer_for('https://www.amazon.com/dp/B000000')
        self.assertIsInstance(importer, GenericImporter)
        self.assertEqual(importer.site_key, 'generic')

    def test_lookalike_domain_not_matched_as_daraz(self):
        importer = get_importer_for('https://fakedaraz.com.bd.evil.com/products/x-i1.html')
        self.assertNotIsInstance(importer, DarazImporter)
        self.assertIsInstance(importer, GenericImporter)


class SsrfGuardTests(TestCase):
    def test_rejects_non_http_schemes(self):
        for url in ('ftp://example.com/x', 'file:///etc/passwd', 'javascript:alert(1)'):
            with self.assertRaises(InvalidUrlError):
                validate_public_url(url)

    def test_rejects_localhost_and_private_ips(self):
        for url in ('http://localhost/x', 'http://127.0.0.1/x', 'http://192.168.1.1/a',
                    'http://10.0.0.5/b', 'http://169.254.169.254/latest/meta-data'):
            with self.assertRaises(BlockedUrlError):
                validate_public_url(url)

    def test_rejects_credentials_and_odd_ports(self):
        with self.assertRaises(BlockedUrlError):
            validate_public_url('http://user:pass@example.com/')
        with self.assertRaises(BlockedUrlError):
            validate_public_url('http://example.com:22/')


class ParsingHelperTests(TestCase):
    def test_extract_json_after_handles_nested_braces(self):
        text = 'foo; window.runParams = {"data": {"a": {"b": [1, 2, "}"]}}}; bar;'
        data = extract_json_after(text, 'window.runParams')
        self.assertEqual(data['data']['a']['b'][2], '}')

    def test_to_decimal_string(self):
        self.assertEqual(to_decimal_string('1,299.50'), '1299.50')
        self.assertEqual(to_decimal_string('৳ 1,299'), '1299.00')
        self.assertEqual(to_decimal_string(15), '15.00')
        self.assertEqual(to_decimal_string('free'), '')
        self.assertEqual(to_decimal_string(0), '')

    def test_to_decimal_string_never_merges_multiple_numbers(self):
        # "51,200৳ 53,900৳" must yield the FIRST price, not 5120053900
        self.assertEqual(to_decimal_string('51,200৳ 53,900৳'), '51200.00')
        self.assertEqual(to_decimal_string('Tk 750 (was Tk 1,172)'), '750.00')

    def test_to_decimal_string_rejects_out_of_range_values(self):
        # anything beyond the Product price column (8 integer digits) is noise
        self.assertEqual(to_decimal_string('5120053900'), '')
        self.assertEqual(to_decimal_string(99999999.99), '99999999.99')

    def test_sanitizer_strips_scripts_and_handlers(self):
        dirty = '<div onclick="evil()"><script>alert(1)</script><p>Hello <b>World</b></p>' \
                '<img src="javascript:x" alt="a"><a href="https://ok.com">link</a></div>'
        clean = sanitize_html(dirty)
        self.assertNotIn('script', clean)
        self.assertNotIn('onclick', clean)
        self.assertNotIn('javascript:', clean)
        self.assertIn('<b>World</b>', clean)
        self.assertIn('https://ok.com', clean)

    def test_html_to_text_dedupes_lines(self):
        text = html_to_text('<p>Line one</p><p>Line one</p><p>Line two</p>')
        self.assertEqual(text.splitlines(), ['Line one', 'Line two'])


class NormalizationTests(TestCase):
    SAMPLE_HTML = """
    <html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="Wireless Mouse 2.4G">
      <meta property="og:description" content="Ergonomic wireless mouse with USB receiver.">
      <meta property="og:image" content="https://cdn.example.com/mouse.jpg">
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Wireless Mouse 2.4G",
       "sku":"WM-24","brand":{"@type":"Brand","name":"LogiTech"},
       "image":["https://cdn.example.com/mouse.jpg","https://cdn.example.com/mouse2.jpg"],
       "offers":{"@type":"Offer","price":"499.00","priceCurrency":"BDT",
                 "availability":"https://schema.org/InStock"}}
      </script>
    </head><body>
      <ul class="breadcrumb"><li><a>Home</a></li><li><a>Computer Accessories</a></li><li><a>Mice</a></li></ul>
      <h1>Wireless Mouse 2.4G</h1>
      <div id="tab-specification"><table>
        <tr><td>Connection</td><td>2.4G Wireless</td></tr>
        <tr><td>DPI</td><td>1600</td></tr>
      </table></div>
    </body></html>
    """

    def test_generic_normalization_from_structured_data(self):
        importer = ElectronicsBDImporter()
        raw = importer.parse(self.SAMPLE_HTML, 'https://www.electronics.com.bd/wireless-mouse')
        product = importer.normalize(raw, self.SAMPLE_HTML, 'https://www.electronics.com.bd/wireless-mouse')
        self.assertEqual(product.title, 'Wireless Mouse 2.4G')
        self.assertEqual(product.price, '499.00')
        self.assertEqual(product.currency, 'BDT')
        self.assertEqual(product.brand, 'LogiTech')
        self.assertEqual(product.sku, 'WM-24')
        self.assertEqual(product.stock_status, 'in_stock')
        self.assertIn('https://cdn.example.com/mouse2.jpg', product.gallery)
        self.assertIn({'key': 'Connection', 'value': '2.4G Wireless'}, product.specifications)
        self.assertIn('Computer Accessories', product.category_path)

    def test_missing_price_produces_warning_not_crash(self):
        html = '<html><head><meta property="og:title" content="Mystery Item"></head><body></body></html>'
        importer = ElectronicsBDImporter()
        product = importer.normalize({}, html, 'https://www.electronics.com.bd/x')
        self.assertEqual(product.price, '')
        self.assertTrue(any('price' in w.lower() for w in product.warnings))


class EnrichmentTests(TestCase):
    def _product(self):
        importer = ElectronicsBDImporter()
        return importer.normalize(
            {'title': 'Arduino Uno R3 Development Board', 'price': '950',
             'description_html': '<p>Genuine Arduino Uno R3 board for prototyping and learning.</p>'},
            '<html></html>', 'https://www.electronics.com.bd/arduino-uno')

    def test_seo_and_slug_generation(self):
        product = enrich_product(self._product())
        self.assertTrue(product.seo_title)
        self.assertLessEqual(len(product.seo_title), 60)
        self.assertTrue(product.seo_description)
        self.assertLessEqual(len(product.seo_description), 160)
        self.assertEqual(product.slug, 'arduino-uno-r3-development-board')

    def test_tags_and_category_suggestion(self):
        product = self._product()
        product = enrich_product(product, categories=[(1, 'Fashion'), (2, 'Electronics & Robotics'), (3, 'Home')])
        self.assertTrue(product.tags)
        self.assertNotIn('The', product.tags)
        # No strong match expected against 'Arduino' — but 'Robotics' shouldn't crash
        self.assertTrue(generate_tags(product))

    def test_seo_title_appends_brand_when_missing(self):
        product = self._product()
        product.brand = 'Arduino Italy'
        title = make_seo_title(product)
        self.assertLessEqual(len(title), 60)


class PricingTests(TestCase):
    def test_del_ins_markup_wins(self):
        from .parsing import parse_soup
        soup = parse_soup('<div class="price"><del>৳ 2,500</del> <ins>৳ 1,999</ins></div>')
        price, original = resolve_price_pair(extract_price_candidates(soup))
        self.assertEqual(price, '1999.00')
        self.assertEqual(original, '2500.00')

    def test_class_conventions(self):
        from .parsing import parse_soup
        soup = parse_soup(
            '<span class="price-old">1,500</span><span class="price-new">1,200</span>')
        price, original = resolve_price_pair(extract_price_candidates(soup))
        self.assertEqual(price, '1200.00')
        self.assertEqual(original, '1500.00')

    def test_importer_values_always_win(self):
        from .parsing import parse_soup
        soup = parse_soup('<span class="price-new">999</span><span class="price-old">1999</span>')
        price, original = resolve_price_pair(extract_price_candidates(soup), '500', '')
        self.assertEqual(price, '500.00')
        # importer gave no regular price, so the page's crossed-out value fills the gap
        self.assertEqual(original, '1999.00')

    def test_regular_below_price_is_discarded(self):
        price, original = resolve_price_pair([('100', 'sale'), ('50', 'regular')])
        self.assertEqual(price, '100.00')
        self.assertEqual(original, '')

    def test_absurd_regular_is_discarded(self):
        price, original = resolve_price_pair([('100', 'sale'), ('99999', 'regular')])
        self.assertEqual(original, '')

    def test_repeated_unknown_number_is_the_price(self):
        candidates = [('1250', 'unknown'), ('4', 'unknown'), ('1250', 'unknown')]
        price, _ = resolve_price_pair(candidates)
        self.assertEqual(price, '1250.00')


class StockTests(TestCase):
    def test_schema_availability(self):
        self.assertEqual(normalize_availability('https://schema.org/InStock'), 'in_stock')
        self.assertEqual(normalize_availability('http://schema.org/OutOfStock'), 'out_of_stock')
        self.assertEqual(normalize_availability('https://schema.org/PreOrder'), 'pre_order')
        self.assertEqual(normalize_availability('https://schema.org/LimitedAvailability'), 'limited_stock')

    def test_text_classification(self):
        self.assertEqual(classify_text('Status: In Stock'), 'in_stock')
        self.assertEqual(classify_text('Sold Out!'), 'out_of_stock')
        self.assertEqual(classify_text('Pre-Order now'), 'pre_order')
        self.assertEqual(classify_text('Hurry! Only 3 left in stock'), 'limited_stock')
        self.assertEqual(classify_text('Available Soon'), 'pre_order')

    def test_detect_stock_finds_quantity(self):
        from .parsing import parse_soup
        soup = parse_soup('<div class="stock-status">Only 4 left</div>')
        status, quantity = detect_stock(soup)
        self.assertEqual(status, 'limited_stock')
        self.assertEqual(quantity, 4)

    def test_importer_status_wins(self):
        from .parsing import parse_soup
        soup = parse_soup('<div>out of stock</div>')
        status, _ = detect_stock(soup, known_status='in_stock')
        self.assertEqual(status, 'in_stock')


class GenericImporterTests(TestCase):
    WOO_HTML = """
    <html><head><title>Gaming Mouse — SomeShop</title></head><body>
      <nav class="breadcrumb"><a>Home</a><a>Accessories</a><a>Mouse</a></nav>
      <h1 class="product_title">RGB Gaming Mouse X9</h1>
      <div class="summary">
        <p class="price"><del>৳ 1,800</del> <ins>৳ 1,450</ins></p>
        <div class="woocommerce-product-details__short-description">
          <ul><li>16000 DPI optical sensor</li><li>RGB lighting with 7 modes</li></ul>
        </div>
        <p class="stock in-stock">In stock</p>
      </div>
      <div class="woocommerce-product-gallery">
        <img src="/wp-content/uploads/mouse-1.jpg"/>
        <img src="/wp-content/uploads/mouse-2.jpg"/>
      </div>
      <div class="woocommerce-Tabs-panel--description"><p>A great mouse for gaming.</p></div>
      <table class="woocommerce-product-attributes">
        <tr><th>Sensor</th><td>Optical</td></tr>
        <tr><th>DPI</th><td>16000</td></tr>
      </table>
    </body></html>
    """

    def test_generic_importer_extracts_woocommerce_page(self):
        importer = GenericImporter()
        url = 'https://someshop.example/product/rgb-gaming-mouse-x9'
        raw = importer.parse(self.WOO_HTML, url)
        product = importer.normalize(raw, self.WOO_HTML, url)
        self.assertEqual(product.title, 'RGB Gaming Mouse X9')
        self.assertEqual(product.price, '1450.00')
        self.assertEqual(product.original_price, '1800.00')
        self.assertEqual(product.discount_percent, 19)
        self.assertEqual(product.currency, 'BDT')
        self.assertEqual(product.stock_status, 'in_stock')
        self.assertEqual(len(product.gallery), 2)
        self.assertIn({'key': 'DPI', 'value': '16000'}, product.specifications)
        self.assertIn('16000 DPI optical sensor', product.highlights)
        self.assertEqual(importer.site_name, 'someshop.example')

    def test_highlights_are_deduplicated(self):
        importer = GenericImporter()
        url = 'https://x.example/p'
        product = importer.normalize(
            {'title': 'T', 'highlights': ['Same line', 'Same line', 'Other']},
            '<html></html>', url)
        self.assertEqual(product.highlights, ['Same line', 'Other'])


class AliExpressParserTests(TestCase):
    def test_parses_run_params_blob(self):
        html = '''<html><body><script>
        window.runParams = {"data": {
          "productInfoComponent": {"subject": "USB C Cable 100W"},
          "imageComponent": {"imagePathList": ["//ae01.alicdn.com/kf/a.jpg", "//ae01.alicdn.com/kf/b.jpg"]},
          "priceComponent": {"origPrice": {"minAmount": {"value": 5.99, "currency": "USD"}},
                             "discountPrice": {"minActivityAmount": {"value": 2.99, "currency": "USD"}}},
          "productPropComponent": {"props": [{"attrName": "Brand Name", "attrValue": "UGREEN"},
                                              {"attrName": "Model Number", "attrValue": "UG-100"}]},
          "inventoryComponent": {"totalAvailQuantity": 250},
          "skuComponent": {"productSKUPropertyList": [
             {"skuPropertyName": "Color", "skuPropertyValues": [{"propertyValueDisplayName": "Black"},
                                                                 {"propertyValueDisplayName": "White"}]}]}
        }};</script></body></html>'''
        importer = AliExpressImporter()
        url = 'https://www.aliexpress.com/item/1005001234567890.html'
        raw = importer.parse(html, url)
        product = importer.normalize(raw, html, url)
        self.assertEqual(product.title, 'USB C Cable 100W')
        self.assertEqual(product.external_id, '1005001234567890')
        self.assertEqual(product.price, '2.99')
        self.assertEqual(product.original_price, '5.99')
        self.assertEqual(product.currency, 'USD')
        self.assertEqual(product.brand, 'UGREEN')
        self.assertEqual(product.model_number, 'UG-100')
        self.assertEqual(product.stock_quantity, 250)
        self.assertIn('Black', product.colors)
        self.assertTrue(all(u.startswith('https://') for u in product.gallery))


class ProfiledPricePairTests(TestCase):
    """Star Tech-style markup: both prices inside one node must be split."""

    def _normalize(self, html):
        importer = get_importer_for('https://www.startech.com.bd/some-product')
        raw = importer.parse(html, 'https://www.startech.com.bd/some-product')
        return importer.normalize(raw, html, 'https://www.startech.com.bd/some-product')

    def test_combined_price_node_is_split_not_concatenated(self):
        html = '''<html><body><h1 class="product-name">Test PC</h1>
        <div class="product-price">51,200৳ 53,900৳</div></body></html>'''
        product = self._normalize(html)
        self.assertEqual(product.price, '51200.00')
        self.assertEqual(product.original_price, '53900.00')
        self.assertEqual(product.discount_percent, 5)

    def test_separate_regular_price_node(self):
        html = '''<html><body><h1 class="product-name">Test PC</h1>
        <div class="product-price">51,200৳</div>
        <div class="product-regular-price">53,900৳</div></body></html>'''
        product = self._normalize(html)
        self.assertEqual(product.price, '51200.00')
        self.assertEqual(product.original_price, '53900.00')

    def test_del_inside_price_node(self):
        html = '''<html><body><h1 class="product-name">Test PC</h1>
        <div class="product-price"><ins>1,450৳</ins> <del>1,800৳</del></div></body></html>'''
        product = self._normalize(html)
        self.assertEqual(product.price, '1450.00')
        self.assertEqual(product.original_price, '1800.00')

    def test_single_price_stays_single(self):
        html = '''<html><body><h1 class="product-name">Test PC</h1>
        <div class="product-price">51,200৳</div></body></html>'''
        product = self._normalize(html)
        self.assertEqual(product.price, '51200.00')
        self.assertEqual(product.original_price, '')
        self.assertEqual(product.discount_percent, 0)


class DarazPriceMappingTests(TestCase):
    def _html(self, tracking_extra=''):
        return ('<html><body><script>var __moduleData__ = {"data": {"root": {"fields": {'
                '"product": {"title": "BMW Umbrella"},'
                '"tracking": {"pdt_price": "\\u09f3 750", "pdt_simplesku": 1344801873'
                + tracking_extra + '}}}}};</script></body></html>')

    def test_discounted_product_derives_regular_price(self):
        html = self._html(', "pdt_discount": "-36%"')
        importer = DarazImporter()
        url = 'https://www.daraz.com.bd/products/bmw-umbrella-i282749524-s1344801873.html'
        product = importer.normalize(importer.parse(html, url), html, url)
        self.assertEqual(product.price, '750.00')       # selling = current price
        self.assertEqual(product.original_price, '1172.00')  # 750 / (1 - 0.36)
        self.assertEqual(product.discount_percent, 36)
        self.assertTrue(any('derived from the advertised discount' in w for w in product.warnings))

    def test_no_discount_leaves_regular_empty(self):
        html = self._html(', "pdt_discount": ""')
        importer = DarazImporter()
        url = 'https://www.daraz.com.bd/products/bmw-umbrella-i282749524-s1344801873.html'
        product = importer.normalize(importer.parse(html, url), html, url)
        self.assertEqual(product.price, '750.00')
        self.assertEqual(product.original_price, '')
        self.assertEqual(product.discount_percent, 0)

    def test_variant_mismatch_produces_warning(self):
        html = self._html(', "pdt_discount": ""')  # tracked sku 1344801873
        importer = DarazImporter()
        url = 'https://www.daraz.com.bd/products/bmw-umbrella-i282749524-s9999999.html'
        product = importer.normalize(importer.parse(html, url), html, url)
        self.assertTrue(any('different variant' in w for w in product.warnings))


class ValidationErrorResponseTests(TestCase):
    """Save failures must report the actual field errors, not a bare 400."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        User = get_user_model()
        self.admin = User.objects.create_superuser(username='val_admin', email='va@test.com', password='x')
        self.client_api = APIClient()
        self.client_api.force_authenticate(self.admin)

    def test_save_validation_error_is_readable(self):
        payload = {
            'source_url': 'https://store.roboticsbd.com/x/1-y.html',
            'images': [],
            'product': {'title': 'X', 'price': '99999999999999'},  # too many digits
        }
        response = self.client_api.post('/api/importer/save/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        error = response.json()['error']
        self.assertEqual(error['code'], 'VALIDATION_ERROR')
        self.assertIn('product.price', error['message'])
        self.assertIn('product', error['fields'])

    def test_preview_validation_error_is_readable(self):
        response = self.client_api.post('/api/importer/preview/', {'url': 'not-a-url'}, format='json')
        self.assertEqual(response.status_code, 400)
        error = response.json()['error']
        self.assertEqual(error['code'], 'VALIDATION_ERROR')
        self.assertIn('url', error['message'])


class SyncTests(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        from products.models import Shop, Product
        from .models import ProductSource

        User = get_user_model()
        self.seller = User.objects.create_user(username='sync_seller', email='seller@test.com', password='x')
        self.seller.role = 'Seller'
        self.seller.save()
        self.admin = User.objects.create_superuser(username='sync_admin', email='admin@test.com', password='x')
        self.shop = Shop.objects.create(seller=self.seller, name='Sync Shop', category='Tech')
        self.product = Product.objects.create(
            shop=self.shop, title='Synced Product', price=200, originalPrice=150,
            stock=10, status='Active')
        self.source = ProductSource.objects.create(
            product=self.product, url='https://store.roboticsbd.com/x/1-y.html',
            source_site='roboticsbd', is_primary=True,
            last_seen_price=150, last_seen_stock_status='in_stock')

    def _run(self, result=None, error=None):
        from unittest.mock import patch
        from .sync import sync_source
        if error:
            with patch('importer.sync.run_import', side_effect=error):
                return sync_source(self.source)
        with patch('importer.sync.run_import', return_value=result):
            return sync_source(self.source)

    def test_out_of_stock_updates_product_and_notifies(self):
        from unittest.mock import patch
        with patch('importer.sync.notify_product_change') as notify:
            outcome = self._run(result={'stock_status': 'out_of_stock', 'stock_quantity': 0, 'price': '150'})
        self.product.refresh_from_db()
        self.source.refresh_from_db()
        self.assertEqual(outcome, 'changed')
        self.assertEqual(self.product.stock, 0)
        self.assertEqual(self.product.status, 'Out of Stock')
        self.assertEqual(self.source.sync_status, 'stock_changed')
        notify.assert_called_once()

    def test_no_change_is_quiet(self):
        from unittest.mock import patch
        with patch('importer.sync.notify_product_change') as notify:
            outcome = self._run(result={'stock_status': 'in_stock', 'stock_quantity': 10, 'price': '150'})
        self.assertEqual(outcome, 'ok')
        notify.assert_not_called()
        self.source.refresh_from_db()
        self.assertEqual(self.source.sync_status, 'ok')

    def test_dramatic_price_change_notifies(self):
        from unittest.mock import patch
        with patch('importer.sync.notify_product_change') as notify:
            outcome = self._run(result={'stock_status': 'in_stock', 'stock_quantity': 10, 'price': '300'})
        self.assertEqual(outcome, 'changed')
        args = notify.call_args[0]
        self.assertTrue(any('price changed dramatically' in c.lower() for c in args[1]))

    def test_removed_product_records_and_notifies(self):
        from unittest.mock import patch
        from .exceptions import ProductNotFoundError
        with patch('importer.sync.notify_product_change') as notify:
            outcome = self._run(error=ProductNotFoundError())
        self.source.refresh_from_db()
        self.assertEqual(outcome, 'removed')
        self.assertEqual(self.source.sync_status, 'removed')
        notify.assert_called_once()

    def test_repeated_failures_disable_sync(self):
        from unittest.mock import patch
        from .exceptions import FetchError
        from .sync import MAX_CONSECUTIVE_FAILURES
        with patch('importer.sync.notify_product_change'):
            for _ in range(MAX_CONSECUTIVE_FAILURES):
                self._run(error=FetchError())
                self.source.refresh_from_db()
        self.assertFalse(self.source.sync_enabled)


class SourceVisibilityTests(TestCase):
    """Legacy imported metadata must be hidden from customers."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from products.models import Shop, Product
        User = get_user_model()
        self.seller = User.objects.create_user(username='vis_seller', email='v@test.com', password='x')
        self.seller.role = 'Seller'
        self.seller.save()
        self.shop = Shop.objects.create(seller=self.seller, name='V Shop', category='Tech')
        self.product = Product.objects.create(
            shop=self.shop, title='Legacy Import', price=100,
            variants={'imported': {'source_url': 'https://secret.example/x',
                                   'source_site': 'secret', 'manufacturer': 'ACME'}})

    def _serialized(self, user=None):
        from types import SimpleNamespace
        from products.serializers import ProductSerializer
        from django.contrib.auth.models import AnonymousUser
        request = SimpleNamespace(user=user or AnonymousUser(), build_absolute_uri=lambda u: u)
        return ProductSerializer(self.product, context={'request': request}).data

    def test_anonymous_customer_cannot_see_source_url(self):
        data = self._serialized()
        imported = data['variants']['imported']
        self.assertNotIn('source_url', imported)
        self.assertNotIn('source_site', imported)
        self.assertEqual(imported.get('manufacturer'), 'ACME')

    def test_owner_seller_still_sees_source_url(self):
        data = self._serialized(user=self.seller)
        self.assertEqual(data['variants']['imported'].get('source_url'), 'https://secret.example/x')


class RoboticsBDParserTests(TestCase):
    def test_parses_prestashop_data_product(self):
        html = '''<html><body>
        <div id="product-details" data-product='{"id": 55, "name": "Servo Motor SG90",
          "reference": "RBD-SG90", "price_amount": 145.0, "regular_price_amount": 180.0,
          "quantity": 12, "manufacturer_name": "TowerPro",
          "description": "<p>Micro servo for robotics.</p>",
          "description_short": "<p>9g micro servo</p>",
          "images": [{"bySize": {"large_default": {"url": "https://store.roboticsbd.com/img/a.jpg"}}}],
          "features": [{"name": "Torque", "value": "1.8 kg/cm"}]}'></div>
        </body></html>'''
        importer = RoboticsBDImporter()
        url = 'https://store.roboticsbd.com/robotics/55-servo-motor.html'
        raw = importer.parse(html, url)
        product = importer.normalize(raw, html, url)
        self.assertEqual(product.title, 'Servo Motor SG90')
        self.assertEqual(product.sku, 'RBD-SG90')
        self.assertEqual(product.price, '145.00')
        self.assertEqual(product.original_price, '180.00')
        self.assertEqual(product.brand, 'TowerPro')
        self.assertEqual(product.stock_status, 'in_stock')
        self.assertEqual(product.stock_quantity, 12)
        self.assertIn({'key': 'Torque', 'value': '1.8 kg/cm'}, product.specifications)
