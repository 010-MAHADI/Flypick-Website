"""
Automatic stock synchronization for imported products.

Every primary ProductSource is re-checked on a rolling schedule (default:
every 3 days, configurable 2–5). A sync run:

- re-imports the source page (bypassing the preview cache)
- updates the product's stock quantity / status
- detects removal (404) and source unavailability
- detects dramatic price changes (threshold configurable)
- records everything on the ProductSource and notifies seller + admins by
  email when something significant happened

One failing source never affects the rest of the run.
"""
import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.utils import timezone

from .engine import run_import
from .exceptions import (
    BlockedRequestError,
    ConnectionTimeoutError,
    FetchError,
    ImporterError,
    ProductNotFoundError,
)
from .models import ProductSource
from .notifications import notify_product_change
from . import stock as stock_states

logger = logging.getLogger('importer')

# a source is retired from auto-sync after this many consecutive failures
MAX_CONSECUTIVE_FAILURES = 5


def price_change_threshold_percent():
    return float(getattr(settings, 'IMPORTER_PRICE_CHANGE_THRESHOLD', 20))


def sync_due_sources(interval_days=3, limit=100):
    """Sync every enabled primary source not checked in ``interval_days``.

    Returns a summary dict. Designed to be called from the management
    command, a cron job, or a Celery beat task.
    """
    interval_days = min(max(int(interval_days), 2), 5)
    cutoff = timezone.now() - timedelta(days=interval_days)
    due = (
        ProductSource.objects
        .filter(is_primary=True, sync_enabled=True)
        .filter(models_q_last_checked_before(cutoff))
        .select_related('product', 'product__shop', 'product__shop__seller')
        .order_by('last_checked_at')[:limit]
    )

    summary = {'checked': 0, 'ok': 0, 'changed': 0, 'removed': 0, 'unavailable': 0, 'errors': 0}
    for source in due:
        outcome = sync_source(source)
        summary['checked'] += 1
        summary[outcome] = summary.get(outcome, 0) + 1
    logger.info('Sync run finished: %s', summary)
    return summary


def models_q_last_checked_before(cutoff):
    from django.db.models import Q
    return Q(last_checked_at__isnull=True) | Q(last_checked_at__lt=cutoff)


def sync_source(source):
    """Sync a single source. Returns one of:
    'ok' | 'changed' | 'removed' | 'unavailable' | 'errors'."""
    logger.info('Sync started: source %s (product %s) %s', source.id, source.product_id, source.url[:80])
    now = timezone.now()
    changes = []

    try:
        result = run_import(source.url, use_cache=False)
    except ProductNotFoundError:
        return _record_failure(source, now, 'removed', 'Product page no longer exists (404).',
                               notify_message='The source product page has been removed (404 Not Found).')
    except (ConnectionTimeoutError, BlockedRequestError, FetchError) as exc:
        return _record_failure(source, now, 'unavailable', exc.message,
                               notify_message=f'The source website is currently unreachable: {exc.message}')
    except ImporterError as exc:
        return _record_failure(source, now, 'error', exc.message)
    except Exception as exc:  # never let one source break the run
        logger.exception('Unexpected sync failure for source %s', source.id)
        return _record_failure(source, now, 'error', str(exc)[:250])

    product = source.product
    new_status = result.get('stock_status') or stock_states.UNKNOWN
    new_quantity = int(result.get('stock_quantity') or 0)
    new_price = _to_decimal(result.get('price'))

    # ---- stock updates (a first sync only establishes the baseline;
    # "Unknown -> X" is not a reportable change)
    old_status = source.last_seen_stock_status or stock_states.UNKNOWN
    if (new_status != stock_states.UNKNOWN and old_status != stock_states.UNKNOWN
            and new_status != old_status):
        changes.append(f'Stock status changed: {_label(old_status)} → {_label(new_status)}')

    product_updates = []
    if new_status == stock_states.OUT_OF_STOCK:
        if product.stock != 0:
            product.stock = 0
            product_updates.append('stock')
        if product.status == 'Active':
            product.status = 'Out of Stock'
            product_updates.append('status')
    elif new_status in (stock_states.IN_STOCK, stock_states.LIMITED_STOCK):
        if new_quantity and product.stock != new_quantity:
            product.stock = new_quantity
            product_updates.append('stock')
        if product.status == 'Out of Stock':
            product.status = 'Active'
            product_updates.append('status')
    if product_updates:
        product.save(update_fields=list(set(product_updates + ['updated_at'])))
        logger.info('Sync updated product %s fields %s', product.id, product_updates)

    # ---- price change detection (informational; we never silently reprice)
    threshold = price_change_threshold_percent()
    if new_price and source.last_seen_price:
        old_price = source.last_seen_price
        try:
            delta_percent = abs(new_price - old_price) / old_price * 100
        except (ZeroDivisionError, InvalidOperation):
            delta_percent = 0
        if delta_percent >= threshold:
            changes.append(
                f'Source price changed dramatically: {old_price} → {new_price} '
                f'({delta_percent:.0f}%, threshold {threshold:.0f}%)'
            )

    # ---- bookkeeping
    source.last_checked_at = now
    source.consecutive_failures = 0
    if new_price:
        source.last_seen_price = new_price
    if new_status != stock_states.UNKNOWN:
        source.last_seen_stock_status = new_status

    if changes:
        source.sync_status = 'stock_changed' if any('Stock' in c for c in changes) else 'price_changed'
        source.last_result = '; '.join(changes)[:255]
        source.save()
        notify_product_change(source, changes)
        logger.info('Sync detected changes for product %s: %s', product.id, changes)
        return 'changed'

    source.sync_status = 'ok'
    source.last_result = 'No significant change.'
    source.save()
    return 'ok'


def _record_failure(source, now, status, message, notify_message=None):
    source.last_checked_at = now
    source.sync_status = status
    source.last_result = (message or '')[:255]
    source.consecutive_failures += 1
    if source.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
        source.sync_enabled = False
        notify_message = (notify_message or message or '') + \
            f' Automatic sync has been disabled after {MAX_CONSECUTIVE_FAILURES} consecutive failures.'
    source.save()
    logger.warning('Sync %s for source %s: %s', status, source.id, message)
    if notify_message and status in ('removed', 'unavailable'):
        notify_product_change(source, [notify_message])
    return status if status in ('removed', 'unavailable') else 'errors'


def _to_decimal(value):
    if not value:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _label(status):
    return {
        stock_states.IN_STOCK: 'In Stock',
        stock_states.OUT_OF_STOCK: 'Out of Stock',
        stock_states.LIMITED_STOCK: 'Limited Stock',
        stock_states.PRE_ORDER: 'Pre-order',
        stock_states.UNKNOWN: 'Unknown',
    }.get(status, status)
