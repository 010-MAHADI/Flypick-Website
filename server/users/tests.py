from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from decimal import Decimal
from rest_framework.test import APITestCase

from orders.models import Order, OrderItem
from products.models import Product, Shop

from .models import CustomerProfile, SellerProfile
from .social_auth import encode_social_state

User = get_user_model()


@override_settings(
    FRONTEND_URL="https://shop.example.com",
    SOCIAL_AUTH_FRONTEND_URL="https://shop.example.com",
    BACKEND_PUBLIC_URL="https://api.example.com",
)
class SocialAuthCallbackTests(TestCase):
    def test_google_callback_creates_customer_and_redirects_with_tokens(self):
        state = encode_social_state("google", "/account")

        with patch(
            "users.social_auth.exchange_google_code_for_identity",
            return_value={
                "email": "google-user@example.com",
                "first_name": "Google",
                "last_name": "User",
                "profile_photo": "https://example.com/photo.png",
            },
        ):
            response = self.client.get(
                "/api/auth/social/google/callback/",
                {"code": "google-code", "state": state},
            )

        self.assertEqual(response.status_code, 302)

        parsed = urlparse(response["Location"])
        fragment = parse_qs(parsed.fragment)

        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "shop.example.com")
        self.assertEqual(parsed.path, "/auth")
        self.assertIn("access_token", fragment)
        self.assertIn("refresh_token", fragment)
        self.assertEqual(fragment["next"][0], "/account")

        user = User.objects.get(email="google-user@example.com")
        profile = CustomerProfile.objects.get(user=user)

        self.assertEqual(user.role, "Customer")
        self.assertEqual(profile.first_name, "Google")
        self.assertEqual(profile.last_name, "User")
        self.assertEqual(profile.profile_photo, "https://example.com/photo.png")

    def test_apple_callback_creates_customer_and_redirects_with_tokens(self):
        state = encode_social_state("apple", "/orders", nonce="apple-nonce")

        with patch(
            "users.social_auth.exchange_apple_code_for_identity",
            return_value={
                "email": "apple-user@example.com",
                "first_name": "Apple",
                "last_name": "User",
            },
        ):
            response = self.client.post(
                "/api/auth/social/apple/callback/",
                {"code": "apple-code", "state": state, "user": "{}"},
            )

        self.assertEqual(response.status_code, 302)

        parsed = urlparse(response["Location"])
        fragment = parse_qs(parsed.fragment)

        self.assertEqual(parsed.path, "/auth")
        self.assertIn("access_token", fragment)
        self.assertIn("refresh_token", fragment)
        self.assertEqual(fragment["next"][0], "/orders")

        user = User.objects.get(email="apple-user@example.com")
        profile = CustomerProfile.objects.get(user=user)

        self.assertEqual(user.role, "Customer")
        self.assertEqual(profile.first_name, "Apple")
        self.assertEqual(profile.last_name, "User")

    def test_google_callback_rejects_pending_seller_accounts(self):
        user = User.objects.create_user(
            username="pending_seller",
            email="pending-seller@example.com",
            password="test-pass-123",
            role="Seller",
        )
        # The post_save signal already auto-creates the profile
        SellerProfile.objects.update_or_create(user=user, defaults={"status": "pending"})
        state = encode_social_state("google", "/account")

        with patch(
            "users.social_auth.exchange_google_code_for_identity",
            return_value={
                "email": "pending-seller@example.com",
                "first_name": "Pending",
                "last_name": "Seller",
            },
        ):
            response = self.client.get(
                "/api/auth/social/google/callback/",
                {"code": "google-code", "state": state},
            )

        self.assertEqual(response.status_code, 302)

        parsed = urlparse(response["Location"])
        query = parse_qs(parsed.query)

        self.assertEqual(parsed.path, "/auth")
        self.assertEqual(
            query["social_error"][0],
            "Your seller request is pending admin approval.",
        )


@override_settings(SECURE_SSL_REDIRECT=False)
class DashboardShopScopeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="dashboard_admin",
            email="dashboard_admin@example.com",
            password="test-pass-123",
            role="Admin",
        )
        self.customer = User.objects.create_user(
            username="dashboard_customer",
            email="dashboard_customer@example.com",
            password="test-pass-123",
            role="Customer",
        )
        self.shop_one = Shop.objects.create(
            seller=self.admin,
            name="Admin Shop One",
            category="General",
        )
        self.shop_two = Shop.objects.create(
            seller=self.admin,
            name="Admin Shop Two",
            category="General",
        )
        self.product_one = Product.objects.create(
            shop=self.shop_one,
            title="Shop One Product",
            price=Decimal("100.00"),
        )
        self.product_two = Product.objects.create(
            shop=self.shop_two,
            title="Shop Two Product",
            price=Decimal("200.00"),
        )

        order_one = Order.objects.create(
            customer=self.customer,
            order_id="FPDASHSHOP001",
            subtotal=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            status="pending",
        )
        OrderItem.objects.create(
            order=order_one,
            product=self.product_one,
            product_title=self.product_one.title,
            quantity=1,
            price=Decimal("100.00"),
        )

        order_two = Order.objects.create(
            customer=self.customer,
            order_id="FPDASHSHOP002",
            subtotal=Decimal("200.00"),
            total_amount=Decimal("200.00"),
            status="pending",
        )
        OrderItem.objects.create(
            order=order_two,
            product=self.product_two,
            product_title=self.product_two.title,
            quantity=1,
            price=Decimal("200.00"),
        )

    def test_admin_dashboard_honors_shop_filter(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/users/dashboard/stats/?shop={self.shop_one.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stats"]["totalOrders"], 1)
        self.assertEqual(response.data["stats"]["activeProducts"], 1)
        self.assertEqual(response.data["stats"]["totalCustomers"], 1)
        self.assertEqual(response.data["recentOrders"][0]["product"], "Shop One Product")


class CustomerRegistrationNameTests(APITestCase):
    """Regression: the post_save signal creates an empty CustomerProfile,
    which used to make get_or_create(defaults=...) silently drop the
    first/last name submitted at registration."""

    def test_register_saves_first_and_last_name(self):
        response = self.client.post(
            "/api/auth/customer/register/",
            {
                "email": "named-user@example.com",
                "password": "supersecret1",
                "username": "named_user_1",
                "customer_profile": {"first_name": "Mahadi", "last_name": "Hasan"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)

        user = User.objects.get(email="named-user@example.com")
        profile = CustomerProfile.objects.get(user=user)
        self.assertEqual(profile.first_name, "Mahadi")
        self.assertEqual(profile.last_name, "Hasan")

    def test_profile_endpoint_returns_name_after_registration(self):
        self.client.post(
            "/api/auth/customer/register/",
            {
                "email": "named2@example.com",
                "password": "supersecret1",
                "customer_profile": {"first_name": "Rina", "last_name": "Akter"},
            },
            format="json",
        )
        user = User.objects.get(email="named2@example.com")
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/auth/customer/profile/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["customer_profile"]["first_name"], "Rina")
        self.assertEqual(response.data["customer_profile"]["last_name"], "Akter")


class DashboardStatsTests(APITestCase):
    """The dashboard numbers must follow the business rules exactly."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='dashadmin', email='dashadmin@t.com', password='x', role='Admin')
        self.seller = User.objects.create_user(
            username='dashseller', email='dashseller@t.com', password='x', role='Seller')
        self.customer = User.objects.create_user(
            username='dashcust', email='dashcust@t.com', password='x', role='Customer')
        self.shop = Shop.objects.create(seller=self.seller, name='Dash Shop', category='Tech')
        self.product = Product.objects.create(
            shop=self.shop, title='Dash Widget', price=Decimal('500'),
            originalPrice=Decimal('500'), actualCost=Decimal('300'), stock=100)

    def _order(self, status='delivered', payment_status='paid', qty=1,
               price=Decimal('500'), shipping=Decimal('50')):
        import uuid
        o = Order.objects.create(
            customer=self.customer, order_id=f'DSH{uuid.uuid4().hex[:8].upper()}',
            payment_method='cod', payment_status=payment_status,
            subtotal=price * qty, shipping_cost=shipping,
            total_amount=price * qty + shipping, status=status)
        OrderItem.objects.create(
            order=o, product=self.product, product_title=self.product.title,
            quantity=qty, price=price, shipping_charge=shipping)
        return o

    def _stats(self, user, range_key='all'):
        self.client.force_authenticate(user)
        resp = self.client.get('/api/users/dashboard/stats/', {'range': range_key})
        self.assertEqual(resp.status_code, 200, resp.content)
        return resp.data['stats']

    def test_cancelled_refunded_returned_excluded_from_sales(self):
        self._order(status='delivered')          # counts: 500
        self._order(status='cancelled')           # excluded
        self._order(status='returned')            # excluded
        self._order(status='refunded')            # excluded
        self._order(status='delivered', payment_status='refunded')  # excluded (paid refunded)
        stats = self._stats(self.admin)
        # Only the one valid delivered order counts (500 goods).
        self.assertEqual(stats['totalSales'], 500.0)
        self.assertEqual(stats['cancelledOrders'], 1)
        self.assertEqual(stats['returnedOrders'], 1)
        self.assertEqual(stats['refundedOrders'], 2)  # status refunded + payment refunded
        self.assertEqual(stats['deliveredOrders'], 1)

    def test_net_profit_is_margin_on_completed_only(self):
        # Completed: price 500, cost 300, shipping 50 -> profit = 500 - 300 = 200.
        self._order(status='delivered', price=Decimal('500'), shipping=Decimal('50'))
        # A pending order must NOT contribute to profit.
        self._order(status='pending', price=Decimal('500'), shipping=Decimal('50'))
        stats = self._stats(self.seller)
        self.assertEqual(stats['productCost'], 300.0)
        self.assertEqual(stats['deliveryCost'], 50.0)
        # Net profit = completed sales (550) - product cost (300) - delivery (50) = 200.
        self.assertEqual(stats['netProfit'], 200.0)
        # Total sales counts both valid orders (pending is valid, delivered is valid): 1000 goods.
        self.assertEqual(stats['totalSales'], 1000.0)

    def test_cancel_immediately_drops_sales(self):
        o = self._order(status='delivered', price=Decimal('1000'), shipping=Decimal('0'))
        self.assertEqual(self._stats(self.admin)['totalSales'], 1000.0)
        o.status = 'cancelled'
        o.save(update_fields=['status'])
        self.assertEqual(self._stats(self.admin)['totalSales'], 0.0)

    def test_status_counts(self):
        self._order(status='pending')
        self._order(status='processing')
        self._order(status='shipped')
        self._order(status='delivered')
        stats = self._stats(self.seller)
        self.assertEqual(stats['pendingOrders'], 1)
        self.assertEqual(stats['processingOrders'], 1)
        self.assertEqual(stats['shippedOrders'], 1)
        self.assertEqual(stats['deliveredOrders'], 1)
        self.assertEqual(stats['totalOrders'], 4)

    def test_admin_only_metrics_present(self):
        stats = self._stats(self.admin)
        for key in ('activeUsers', 'activeSellers', 'newCustomers', 'totalCustomers', 'totalSellers'):
            self.assertIn(key, stats)
