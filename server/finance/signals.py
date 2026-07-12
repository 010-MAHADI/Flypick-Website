"""
Order lifecycle -> ledger hooks.

Every code path that marks an order paid (IPN, redirect verify, manual seller
update) or cancelled/failed goes through Order.save(), so these signals are the
single choke point that keeps the ledger in sync. All ledger posting is
idempotent (keyed on the order id), so duplicate saves are harmless.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='orders.Order')
def _sync_order_ledger(sender, instance, created, **kwargs):
    from . import services

    order = instance
    try:
        if order.payment_status == 'paid':
            services.post_order_payment(order)
        elif order.status in ('cancelled', 'failed') and order.payment_status != 'paid':
            services.release_wallet_hold(order)
            services.void_order_coupon_redemptions(order)
    except Exception:
        # A financial exception must never be silent: log, audit, page the admins.
        logger.exception('Ledger sync failed for order %s', order.order_id)
        try:
            services.write_audit(
                action='ledger.sync_failed', resource=order.order_id,
                new_state={'payment_status': order.payment_status, 'status': order.status},
            )
        except Exception:
            pass
        services._notify_admins(
            'Financial exception',
            f'Ledger posting failed for order {order.order_id}. '
            'Run `manage.py reconcile_finance` or retry from the finance dashboard.',
        )
