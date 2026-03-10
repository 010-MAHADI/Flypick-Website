from products.models import Shop

from .roles import is_admin_user

ADMIN_DEFAULT_SHOP_NAME = "Flypick"
ADMIN_DEFAULT_SHOP_CATEGORY = "Marketplace"
ADMIN_DEFAULT_SHOP_DESCRIPTION = "Main Flypick admin storefront."


def ensure_admin_shop(user):
    if not is_admin_user(user):
        return None

    shop = (
        Shop.objects.filter(seller=user)
        .order_by("id")
        .first()
    )
    if shop:
        return shop

    return Shop.objects.create(
        seller=user,
        name=ADMIN_DEFAULT_SHOP_NAME,
        category=ADMIN_DEFAULT_SHOP_CATEGORY,
        description=ADMIN_DEFAULT_SHOP_DESCRIPTION,
        status="active",
    )
