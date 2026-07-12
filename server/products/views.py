from urllib.parse import urlparse

from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from django.utils import timezone
from django.utils.text import slugify

from notifications.models import Notification
from users.roles import is_admin_user, is_seller_user

from .models import Category, Shop, Product, ShippingMethod
from .serializers import CategorySerializer, ShopSerializer, ProductSerializer, ShippingMethodSerializer

SELLER_MAX_SHOPS = 1

PRODUCT_MODERATION_STATUSES = {'Active', 'Draft', 'Suspended', 'Rejected'}


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.AllowAny]
        else:
            # Only admins can create/update/delete categories
            permission_classes = [permissions.IsAdminUser]
        return [permission() for permission in permission_classes]


class ShippingMethodViewSet(viewsets.ModelViewSet):
    queryset = ShippingMethod.objects.all()
    serializer_class = ShippingMethodSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = ShippingMethod.objects.all()
        if self.action in ['list', 'retrieve'] and not (
            self.request.user
            and self.request.user.is_authenticated
            and is_admin_user(self.request.user)
        ):
            return queryset.filter(is_enabled=True)
        return queryset

    def perform_create(self, serializer):
        if not is_admin_user(self.request.user):
            raise PermissionDenied("Only admins can manage shipping methods.")
        serializer.save()

    def perform_update(self, serializer):
        if not is_admin_user(self.request.user):
            raise PermissionDenied("Only admins can manage shipping methods.")
        serializer.save()

    def perform_destroy(self, instance):
        if not is_admin_user(self.request.user):
            raise PermissionDenied("Only admins can manage shipping methods.")
        instance.delete()


class ShopViewSet(viewsets.ModelViewSet):
    queryset = Shop.objects.all()
    serializer_class = ShopSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        if self.action in ['list', 'retrieve']:
            return Shop.objects.all()
        if is_admin_user(self.request.user):
            return Shop.objects.all()
        return Shop.objects.filter(seller=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if is_admin_user(user):
            raise ValidationError("Admins manage the marketplace and cannot create seller shops.")
        if not is_seller_user(user):
            raise PermissionDenied("Only seller accounts can create shops.")
        if user.shops.count() >= SELLER_MAX_SHOPS:
            raise ValidationError("Each seller account can create only one shop.")

        serializer.save(seller=self.request.user)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="mine",
    )
    def mine(self, request):
        queryset = Shop.objects.filter(seller=request.user).order_by("id")
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["put", "post"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="set-status",
    )
    def set_status(self, request, pk=None):
        """Admin control: freeze (inactive) or unfreeze (active) a seller shop."""
        if not is_admin_user(request.user):
            raise PermissionDenied("Only admins can change a shop's status.")

        shop = self.get_object()
        next_status = request.data.get("status")
        if next_status not in dict(Shop.STATUS_CHOICES):
            raise ValidationError("Status must be 'active' or 'inactive'.")

        shop.status = next_status
        shop.save(update_fields=["status"])

        reason = str(request.data.get("reason") or "").strip()
        frozen = next_status == "inactive"
        Notification.objects.create(
            user=shop.seller,
            title="Shop frozen by Flypick admin" if frozen else "Shop reactivated",
            message=(
                f"Your shop '{shop.name}' has been {'frozen' if frozen else 'reactivated'} by the marketplace admin."
                + (f" Reason: {reason}" if reason else "")
            ),
            notification_type="system",
            priority="high" if frozen else "medium",
        )
        return Response(self.get_serializer(shop).data)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    public_actions = {'list', 'retrieve', 'resolve'}

    def get_permissions(self):
        if self.action in self.public_actions:
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        base_qs = Product.objects.select_related('shop', 'category_fk').prefetch_related('gallery_images', 'gallery_videos')

        if self.action == 'resolve':
            return base_qs
        
        # For public access (list/retrieve without auth or for customers)
        if self.action in self.public_actions:
            # If user is authenticated and is a seller/admin, filter by their shops
            if self.request.user and self.request.user.is_authenticated:
                if is_admin_user(self.request.user):
                    # Admin can see all products, but filter by shop param if provided
                    shop_id = self.request.query_params.get('shop')
                    if shop_id:
                        return base_qs.filter(shop_id=shop_id)
                    return base_qs
                elif is_seller_user(self.request.user):
                    # Sellers see only their shop's products
                    shop_id = self.request.query_params.get('shop')
                    user_shop_ids = Shop.objects.filter(seller=self.request.user).values_list('id', flat=True)
                    if shop_id:
                        # Verify the shop belongs to the seller
                        if int(shop_id) in user_shop_ids:
                            return base_qs.filter(shop_id=shop_id)
                        else:
                            # Return empty queryset if trying to access other's shop
                            return base_qs.none()
                    return base_qs.filter(shop_id__in=user_shop_ids)
            # Public access - return all products
            return base_qs

        # For create/update/delete actions
        if is_admin_user(self.request.user):
            return base_qs

        user_shop_ids = Shop.objects.filter(seller=self.request.user).values_list('id', flat=True)
        return base_qs.filter(shop_id__in=user_shop_ids)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.AllowAny],
        url_path="resolve",
    )
    def resolve(self, request):
        category_slug = (request.query_params.get("category") or "").strip()
        product_slug = (request.query_params.get("slug") or "").strip()

        if not category_slug or not product_slug:
            raise ValidationError("Both category and slug query parameters are required.")

        matched_product = None
        for product in self.get_queryset():
            normalized_category = slugify(
                getattr(product.category_fk, "name", None)
                or product.category
                or getattr(product.shop, "category", None)
                or "products"
            )
            normalized_product = slugify(product.meta_title or product.title or "")

            if normalized_category != category_slug:
                continue
            if normalized_product == product_slug or f"{normalized_product}-{product.id}" == product_slug:
                matched_product = product
                break

        if not matched_product:
            raise NotFound("Product not found for the provided category and slug.")

        serializer = self.get_serializer(matched_product)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["put", "post"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="moderate",
    )
    def moderate(self, request, pk=None):
        """Admin moderation: approve/reject/suspend/unpublish/feature a product."""
        if not is_admin_user(request.user):
            raise PermissionDenied("Only admins can moderate products.")

        product = self.get_object()
        next_status = request.data.get("status")
        is_featured = request.data.get("is_featured")
        reason = str(request.data.get("reason") or "").strip()

        update_fields = []
        if next_status is not None:
            if next_status not in PRODUCT_MODERATION_STATUSES:
                raise ValidationError(
                    f"Status must be one of: {', '.join(sorted(PRODUCT_MODERATION_STATUSES))}."
                )
            product.status = next_status
            update_fields.append("status")
        if is_featured is not None:
            product.is_featured = bool(is_featured)
            update_fields.append("is_featured")

        if not update_fields:
            raise ValidationError("Provide 'status' and/or 'is_featured' to moderate a product.")

        moderation_log = {
            "action": next_status or ("featured" if product.is_featured else "unfeatured"),
            "reason": reason,
            "moderator": request.user.username,
            "at": timezone.now().isoformat(),
        }
        variants = product.variants if isinstance(product.variants, dict) else {}
        history = variants.get("moderation_history")
        history = history if isinstance(history, list) else []
        history.append(moderation_log)
        variants["moderation_history"] = history[-20:]
        product.variants = variants
        update_fields.append("variants")

        update_fields.append("updated_at")
        product.save(update_fields=update_fields)

        status_titles = {
            "Active": "Product approved",
            "Rejected": "Product rejected",
            "Suspended": "Product suspended",
            "Draft": "Product unpublished",
        }
        Notification.objects.create(
            user=product.shop.seller,
            title=status_titles.get(next_status, "Product moderation update"),
            message=(
                f"'{product.title}' was reviewed by the Flypick admin team."
                + (f" Status: {next_status}." if next_status else "")
                + (f" Featured: {'yes' if product.is_featured else 'no'}." if is_featured is not None else "")
                + (f" Reason: {reason}" if reason else "")
            ),
            notification_type="system",
            priority="high" if next_status in {"Rejected", "Suspended"} else "medium",
            product_id=product.id,
        )

        serializer = self.get_serializer(product)
        return Response(serializer.data)

    def perform_create(self, serializer):
        user = self.request.user
        shop_id = self.request.data.get('shop')

        if is_admin_user(user):
            raise ValidationError("Admins cannot create shop products. Product operations belong to sellers.")

        try:
            shop = Shop.objects.get(id=shop_id, seller=self.request.user)
            serializer.save(shop=shop)
        except Shop.DoesNotExist:
            raise ValidationError("Shop not found or you don't own it.")
    
    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        if not is_admin_user(user) and instance.shop.seller != user:
            raise PermissionDenied("You don't have permission to update this product.")

        if not is_admin_user(user):
            next_status = serializer.validated_data.get('status')
            # Suspended (frozen) products are locked by the admin: sellers can
            # still edit details but cannot change the status. Rejected products
            # may be fixed and re-published by the seller without re-approval.
            if instance.status == 'Suspended' and next_status and next_status != 'Suspended':
                raise ValidationError(
                    "This product was suspended by the marketplace admin. "
                    "It can only be re-published after admin approval."
                )

        serializer.save()
    
    def perform_destroy(self, instance):
        if not is_admin_user(self.request.user) and instance.shop.seller != self.request.user:
            raise PermissionDenied("You don't have permission to delete this product.")
        instance.delete()

    @staticmethod
    def _normalize_path(raw_url):
        if not raw_url:
            return None
        value = str(raw_url).strip()
        if not value:
            return None
        parsed = urlparse(value)
        path = parsed.path if parsed.scheme or parsed.netloc else value
        if not path.startswith('/'):
            path = f'/{path}'
        return path

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="sync-media",
    )
    def sync_media(self, request, pk=None):
        product = self.get_object()
        if not is_admin_user(request.user) and product.shop.seller != request.user:
            raise PermissionDenied("You don't have permission to update this product media.")

        keep_image_urls = request.data.get("keep_image_urls", [])
        keep_video_urls = request.data.get("keep_video_urls", [])
        keep_image_paths = []
        keep_video_paths = []
        seen_image_paths = set()
        seen_video_paths = set()

        if isinstance(keep_image_urls, list):
            for url in keep_image_urls:
                path = self._normalize_path(url)
                if path and path not in seen_image_paths:
                    seen_image_paths.add(path)
                    keep_image_paths.append(path)

        if isinstance(keep_video_urls, list):
            for url in keep_video_urls:
                path = self._normalize_path(url)
                if path and path not in seen_video_paths:
                    seen_video_paths.add(path)
                    keep_video_paths.append(path)

        image_media = list(product.gallery_images.all())
        video_media = list(product.gallery_videos.all())
        image_path_to_media = {self._normalize_path(item.image.url): item for item in image_media if item.image}
        video_path_to_media = {self._normalize_path(item.video.url): item for item in video_media if item.video}

        for path, item in list(image_path_to_media.items()):
            if path not in seen_image_paths:
                item.image.delete(save=False)
                item.delete()
                image_path_to_media.pop(path, None)

        for path, item in list(video_path_to_media.items()):
            if path not in seen_video_paths:
                item.video.delete(save=False)
                item.delete()
                video_path_to_media.pop(path, None)

        for idx, path in enumerate(keep_image_paths):
            media = image_path_to_media.get(path)
            if media and media.sort_order != idx:
                media.sort_order = idx
                media.save(update_fields=["sort_order"])

        for idx, path in enumerate(keep_video_paths):
            media = video_path_to_media.get(path)
            if media and media.sort_order != idx:
                media.sort_order = idx
                media.save(update_fields=["sort_order"])

        changed_fields = []

        old_image_path = self._normalize_path(product.image.url) if product.image else None
        if keep_image_paths:
            first_image_path = keep_image_paths[0]
            main_image_media = image_path_to_media.get(first_image_path)
            if main_image_media and product.image != main_image_media.image:
                product.image = main_image_media.image.name
                changed_fields.append("image")
            elif not main_image_media and old_image_path != first_image_path:
                # If the previous main image was removed and first path is not resolvable, clear it.
                product.image = None
                if "image" not in changed_fields:
                    changed_fields.append("image")
        elif product.image:
            product.image = None
            changed_fields.append("image")

        old_video_path = self._normalize_path(product.video.url) if product.video else None
        if keep_video_paths:
            first_video_path = keep_video_paths[0]
            main_video_media = video_path_to_media.get(first_video_path)
            if main_video_media and product.video != main_video_media.video:
                product.video = main_video_media.video.name
                changed_fields.append("video")
            elif not main_video_media and old_video_path != first_video_path:
                product.video = None
                if "video" not in changed_fields:
                    changed_fields.append("video")
        elif product.video:
            product.video = None
            changed_fields.append("video")

        if changed_fields:
            if "updated_at" not in changed_fields:
                changed_fields.append("updated_at")
            product.save(update_fields=changed_fields)

        serializer = self.get_serializer(product)
        return Response(serializer.data)
