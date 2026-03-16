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
        SellerProfile.objects.create(user=user, status="pending")
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
