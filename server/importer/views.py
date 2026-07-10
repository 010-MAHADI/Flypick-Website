import logging
import time

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Category, Product, ProductImage, Shop
from users.roles import is_admin_user, is_seller_user
from users.services import ensure_admin_shop

from .engine import run_import
from .exceptions import ImporterError
from .images import download_product_images
from .importers import supported_sites
from .models import ImportJob, ProductSource
from .http_client import validate_public_url
from .serializers import (
    ImportJobSerializer,
    ImportPreviewSerializer,
    ImportSaveSerializer,
    ProductSourceCreateSerializer,
    ProductSourceSerializer,
)

logger = logging.getLogger('importer')


class IsAdminOrSeller(BasePermission):
    message = 'Only admin or seller accounts can import products.'

    def has_permission(self, request, view):
        return is_admin_user(request.user) or is_seller_user(request.user)


class IsAdmin(BasePermission):
    message = 'Only administrators can view source information.'

    def has_permission(self, request, view):
        return is_admin_user(request.user)


def _error_response(exc: ImporterError):
    return Response({'error': exc.as_dict()}, status=exc.http_status)


def _flatten_errors(errors, prefix=''):
    """DRF error dict -> readable lines like 'product.price: Ensure that …'."""
    lines = []
    if isinstance(errors, dict):
        for key, value in errors.items():
            path = f'{prefix}.{key}' if prefix else str(key)
            lines.extend(_flatten_errors(value, path))
    elif isinstance(errors, list):
        for item in errors:
            if isinstance(item, (dict, list)):
                lines.extend(_flatten_errors(item, prefix))
            else:
                lines.append(f'{prefix}: {item}' if prefix else str(item))
    else:
        lines.append(f'{prefix}: {errors}' if prefix else str(errors))
    return lines


def _validation_error_response(errors):
    """Return the actual field errors instead of a bare 400 so the admin
    can see exactly what to fix."""
    lines = _flatten_errors(errors)
    return Response(
        {'error': {
            'code': 'VALIDATION_ERROR',
            'message': ' | '.join(lines[:5]) or 'The submitted data is invalid.',
            'fields': errors,
        }},
        status=status.HTTP_400_BAD_REQUEST,
    )


class SupportedSitesView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSeller]

    def get(self, request):
        return Response({'sites': supported_sites()})


class ImportPreviewView(APIView):
    """POST {url} -> normalized, editable product preview."""
    permission_classes = [IsAuthenticated, IsAdminOrSeller]

    def post(self, request):
        serializer = ImportPreviewSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error_response(serializer.errors)
        url = serializer.validated_data['url']
        refresh = serializer.validated_data['refresh']
        try:
            result = run_import(url, user=request.user, use_cache=not refresh)
        except ImporterError as exc:
            return _error_response(exc)
        return Response({'product': result})


class ImportSaveView(APIView):
    """POST edited preview -> Product + downloaded gallery images."""
    permission_classes = [IsAuthenticated, IsAdminOrSeller]

    def post(self, request):
        serializer = ImportSaveSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning('Import save validation failed: %s', serializer.errors)
            return _validation_error_response(serializer.errors)
        data = serializer.validated_data

        try:
            shop = self._resolve_shop(request.user, data.get('shop'))
        except ImporterError as exc:
            return _error_response(exc)

        job = ImportJob.objects.create(
            url=data['source_url'][:2000],
            source_site=data.get('source_site', ''),
            stage='save',
            requested_by=request.user,
        )
        started = time.monotonic()

        # Download images before touching the database so a failed download
        # never leaves a half-created product behind.
        stored_images, image_errors = download_product_images(data.get('images', []))
        for failure in image_errors:
            logger.warning('Import save: image skipped %s (%s)', failure['url'], failure['error'])

        try:
            product = self._create_product(shop, data, stored_images, request.user)
        except Exception as exc:
            job.status = 'failed'
            job.error_code = 'SAVE_FAILED'
            job.error_message = str(exc)
            job.duration_ms = int((time.monotonic() - started) * 1000)
            job.save()
            logger.exception('Import save failed for %s', data['source_url'])
            # this endpoint is admin/seller-only, so the underlying reason is
            # more useful than a generic apology
            return Response(
                {'error': {'code': 'SAVE_FAILED',
                           'message': f'The product could not be saved: {str(exc)[:200]}'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        job.status = 'success'
        job.product = product
        job.duration_ms = int((time.monotonic() - started) * 1000)
        job.result_summary = {
            'title': product.title[:120],
            'images_saved': len(stored_images),
            'images_failed': len(image_errors),
        }
        job.save()
        logger.info('Import saved: product %s from %s (%s images, %s failed)',
                    product.id, data['source_url'], len(stored_images), len(image_errors))

        return Response(
            {'product_id': product.id, 'images_saved': len(stored_images), 'image_errors': image_errors},
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _resolve_shop(user, shop_id):
        if is_admin_user(user):
            if shop_id:
                try:
                    return Shop.objects.get(id=shop_id)
                except Shop.DoesNotExist:
                    raise ImporterError('Shop not found.')
            return ensure_admin_shop(user)
        if not shop_id:
            raise ImporterError('Select a shop before saving the imported product.')
        try:
            return Shop.objects.get(id=shop_id, seller=user)
        except Shop.DoesNotExist:
            raise ImporterError("Shop not found or you don't own it.")

    @staticmethod
    @transaction.atomic
    def _create_product(shop, data, stored_images, user=None):
        p = data['product']
        category = None
        if p.get('category'):
            category = Category.objects.filter(id=p['category'], is_active=True).first()

        selling_price = p['price']
        regular_price = p.get('original_price') or selling_price
        if regular_price < selling_price:
            regular_price = selling_price
        discount = 0
        if regular_price and regular_price > selling_price:
            discount = round((regular_price - selling_price) / regular_price * 100)

        # variants JSON mirrors the shape ProductForm reads/writes so imported
        # products stay fully editable in the existing form. Source URLs are
        # deliberately NOT stored here (customers can read variants) — they
        # live in the admin-only ProductSource table instead.
        variants = {
            'hasSizes': bool(p.get('sizes')),
            'hasColors': bool(p.get('colors')),
            'selectedColors': p.get('colors', []),
            'sizeStocks': [{'size': s, 'stock': 0} for s in p.get('sizes', [])],
            'shippingOptions': [],
            'specifications': [dict(s) for s in p.get('specifications', [])],
            'guides': [],
            'imported': {
                'currency': p.get('currency', ''),
                'manufacturer': p.get('manufacturer', ''),
                'model_number': p.get('model_number', ''),
                'options': p.get('options', []),
                'highlights': p.get('highlights', []),
                'shipping': p.get('shipping', {}),
            },
        }

        product = Product.objects.create(
            shop=shop,
            title=p['title'],
            category_fk=category,
            category=category.name if category else '',
            sku=p.get('sku', ''),
            brand=p.get('brand', ''),
            description=p.get('description', ''),
            short_description=p.get('short_description', ''),
            price=regular_price,
            originalPrice=selling_price,
            discount=discount,
            stock=p.get('stock_quantity', 0),
            status=p.get('status', 'Draft'),
            meta_title=(p.get('seo_title', '') or p['title'])[:255],
            meta_description=p.get('seo_description', ''),
            warranty=p.get('warranty', ''),
            badges=p.get('tags', []),
            variants=variants,
        )

        for index, image in enumerate(stored_images):
            ProductImage.objects.create(product=product, image=image['path'], sort_order=index)
        if stored_images:
            product.image = stored_images[0]['path']
            product.save(update_fields=['image', 'updated_at'])

        # Permanent, admin-only record of where this product came from;
        # also the anchor for automatic stock synchronization.
        ProductSource.objects.create(
            product=product,
            url=data['source_url'],
            source_site=data.get('source_site', ''),
            is_primary=True,
            added_by=user,
            last_seen_price=selling_price,
            last_seen_stock_status=p.get('stock_status', 'unknown'),
        )
        return product


class ImportJobListView(APIView):
    """Recent import activity — admins see everything, sellers see their own."""
    permission_classes = [IsAuthenticated, IsAdminOrSeller]

    def get(self, request):
        jobs = ImportJob.objects.all()
        if not is_admin_user(request.user):
            jobs = jobs.filter(requested_by=request.user)
        serializer = ImportJobSerializer(jobs[:50], many=True)
        return Response({'jobs': serializer.data})


class ProductSourcesView(APIView):
    """Admin-only: list / add source URLs for a product.

    GET  /api/importer/products/<id>/sources/
    POST /api/importer/products/<id>/sources/  {url, label?, is_primary?}
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, product_id):
        product = self._get_product(product_id)
        if product is None:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Product not found.'}},
                            status=status.HTTP_404_NOT_FOUND)
        sources = product.sources.all()
        last_import = product.import_jobs.filter(stage='save').order_by('-created_at').first()
        return Response({
            'sources': ProductSourceSerializer(sources, many=True).data,
            'last_import': ImportJobSerializer(last_import).data if last_import else None,
        })

    def post(self, request, product_id):
        product = self._get_product(product_id)
        if product is None:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Product not found.'}},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = ProductSourceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error_response(serializer.errors)
        url = serializer.validated_data['url']
        try:
            validate_public_url(url)
        except ImporterError as exc:
            return _error_response(exc)
        if product.sources.filter(url=url).exists():
            return Response({'error': {'code': 'DUPLICATE', 'message': 'This URL is already linked to the product.'}},
                            status=status.HTTP_400_BAD_REQUEST)

        from .importers import get_importer_for
        importer = get_importer_for(url)
        make_primary = serializer.validated_data['is_primary'] or not product.sources.filter(is_primary=True).exists()
        if make_primary:
            product.sources.update(is_primary=False)
        source = ProductSource.objects.create(
            product=product,
            url=url,
            source_site=importer.site_key,
            label=serializer.validated_data['label'],
            is_primary=make_primary,
            added_by=request.user,
        )
        logger.info('Source added to product %s: %s (primary=%s)', product.id, url[:80], make_primary)
        return Response({'source': ProductSourceSerializer(source).data}, status=status.HTTP_201_CREATED)

    @staticmethod
    def _get_product(product_id):
        return Product.objects.filter(id=product_id).select_related('shop').first()


class ProductSourceDetailView(APIView):
    """Admin-only: delete a source or trigger a manual sync.

    DELETE /api/importer/sources/<id>/
    POST   /api/importer/sources/<id>/sync/
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, source_id):
        source = ProductSource.objects.filter(id=source_id).first()
        if source is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        was_primary, product = source.is_primary, source.product
        source.delete()
        if was_primary:
            replacement = product.sources.first()
            if replacement:
                replacement.is_primary = True
                replacement.save(update_fields=['is_primary', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request, source_id):
        source = ProductSource.objects.filter(id=source_id).select_related(
            'product', 'product__shop', 'product__shop__seller').first()
        if source is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        from .sync import sync_source
        outcome = sync_source(source)
        source.refresh_from_db()
        return Response({'outcome': outcome, 'source': ProductSourceSerializer(source).data})
