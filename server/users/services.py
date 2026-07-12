from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from .roles import is_admin_user


def ensure_admin_shop(user):
    """Deprecated compatibility shim.

    Admins are platform managers, not sellers. Keep this function as a no-op
    while older imports are removed so profile/login calls never create a shop.
    """
    return None


def assert_user_can_authenticate(user):
    if user.role == "Seller":
        profile = getattr(user, "seller_profile", None)
        if not profile:
            raise AuthenticationFailed("Seller profile not found.")

        if profile.status == "pending":
            raise AuthenticationFailed("Your seller request is pending admin approval.")
        if profile.status == "rejected":
            raise AuthenticationFailed("Your seller request was rejected by admin.")
        if profile.status == "suspended":
            raise AuthenticationFailed("Your seller account is suspended.")
        if profile.status != "active":
            raise AuthenticationFailed("Your seller account is not active.")

    return user


def issue_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
    }
