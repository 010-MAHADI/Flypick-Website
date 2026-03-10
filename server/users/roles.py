def is_admin_user(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or getattr(user, "role", "") == "Admin")
    )


def is_seller_user(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "role", "") == "Seller"
    )
