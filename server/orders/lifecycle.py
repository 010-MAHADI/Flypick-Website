"""
Order, refund and wallet state machines.

All status changes flow through the transition helpers here so that:
- illegal jumps are rejected consistently,
- every change is written to the audit tables,
- notifications fire from one place (via the existing Order post_save signals),
- business rules (cancellable statuses, restock, auto-refunds) live in one file.
"""
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Order, OrderStatusHistory, Refund, RefundEvent

# The happy path, in order. A seller/admin may move an order to ANY later
# step (skipping intermediate ones), but never backwards.
ORDER_FLOW = ['pending', 'confirmed', 'processing', 'packed',
              'shipped', 'out_for_delivery', 'delivered', 'completed']

# Terminal / exception statuses and where they may be entered from.
EXCEPTION_TRANSITIONS = {
    'cancelled': {'pending', 'confirmed', 'processing', 'packed'},
    'failed': {'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery'},
    'returned': {'delivered', 'completed'},
    'refunded': {'cancelled', 'returned', 'delivered', 'completed'},
}

# Statuses a CUSTOMER may cancel from. Business rule: cancellation is allowed
# ONLY while the order is still Pending. Once a seller starts working the order
# (Processing, Shipped, …) the customer must use the return flow instead.
def customer_cancellable_statuses():
    return set(getattr(settings, 'ORDER_CANCELLABLE_STATUSES', ['pending']))


def allowed_next_statuses(current):
    """Every status the order may legally move to from ``current``."""
    allowed = set()
    if current in ORDER_FLOW:
        idx = ORDER_FLOW.index(current)
        allowed.update(ORDER_FLOW[idx + 1:])
    for target, sources in EXCEPTION_TRANSITIONS.items():
        if current in sources:
            allowed.add(target)
    return allowed


def record_status(order, from_status, to_status, actor=None, note=''):
    OrderStatusHistory.objects.create(
        order=order,
        from_status=from_status or '',
        to_status=to_status,
        changed_by=actor if getattr(actor, 'is_authenticated', False) else None,
        note=note[:500] if note else '',
    )


@transaction.atomic
def transition_order(order, new_status, actor=None, note='',
                     tracking_number=None, courier_name=None,
                     estimated_delivery_date=None):
    """Move an order to ``new_status`` with validation + audit logging.

    Raises DRF ValidationError for illegal transitions.
    """
    current = order.status
    if new_status == current:
        raise ValidationError({'status': f'Order is already {current}.'})
    if new_status not in dict(Order.STATUS_CHOICES):
        raise ValidationError({'status': f'Unknown status "{new_status}".'})
    if new_status not in allowed_next_statuses(current):
        raise ValidationError({
            'status': f'Cannot move an order from "{current}" to "{new_status}".'
        })

    update_fields = ['status', 'updated_at']
    order.status = new_status
    if tracking_number is not None:
        order.tracking_number = tracking_number[:100]
        update_fields.append('tracking_number')
    if courier_name is not None:
        order.courier_name = courier_name[:100]
        update_fields.append('courier_name')
    if estimated_delivery_date is not None:
        order.estimated_delivery_date = estimated_delivery_date
        update_fields.append('estimated_delivery_date')
    if new_status == 'cancelled':
        order.cancellation_reason = (note or order.cancellation_reason or '')[:255]
        order.cancelled_by = actor if getattr(actor, 'is_authenticated', False) else None
        update_fields += ['cancellation_reason', 'cancelled_by']

    # A delivered COD order is automatically marked paid — the customer has
    # paid the courier, so no manual confirmation is needed. This triggers the
    # finance signal that records the seller's COD earnings (reporting only).
    is_cod = (order.payment_method or '').lower() in ('cod', 'cash_on_delivery')
    if new_status == 'delivered' and is_cod and order.payment_status != 'paid':
        order.payment_status = 'paid'
        update_fields.append('payment_status')

    order.save(update_fields=update_fields)  # post_save signals send notifications
    record_status(order, current, new_status, actor=actor, note=note)

    if new_status in ('cancelled', 'failed'):
        restock_order_items(order)

    return order


def restock_order_items(order):
    """Return quantities to product stock and roll back sold counters."""
    for item in order.items.select_related('product'):
        product = item.product
        if not product:
            continue
        product.stock = (product.stock or 0) + item.quantity
        product.sold_count = max(0, (product.sold_count or 0) - item.quantity)
        product.save(update_fields=['stock', 'sold_count', 'updated_at'])


# --------------------------------------------------------------- refunds

REFUND_TRANSITIONS = {
    'requested': {'under_review', 'approved', 'rejected'},
    'under_review': {'approved', 'rejected'},
    'approved': {'processing', 'completed'},
    'processing': {'completed'},
    'completed': set(),
    'rejected': set(),
}


def full_refund_amount(order):
    """A refund always returns everything the customer paid:
    the gateway/COD amount plus any store credit that was redeemed."""
    return (Decimal(order.total_amount or 0)
            + Decimal(order.store_credit_used or 0)).quantize(Decimal('0.01'))


@transaction.atomic
def create_refund(order, amount, *, method='original', refund_type='full',
                  reason='', requested_by=None, return_request=None,
                  initial_status='requested', note='', origin='manual'):
    # Spec (Part 2 §3): one refund operation per order, no partial refunds.
    amount = Decimal(amount).quantize(Decimal('0.01'))
    expected = full_refund_amount(order)
    if amount != expected:
        raise ValidationError({
            'amount': f'Partial refunds are not supported. The refund must be '
                      f'the full paid amount of {expected}.'})
    if refund_type != 'full':
        raise ValidationError({'refund_type': 'Partial refunds are not supported.'})
    if order.payment_status != 'paid':
        raise ValidationError({'order': 'Refunds are only possible for paid orders.'})
    if order.refunds.exclude(status='rejected').exists():
        raise ValidationError({'order': 'This order already has a refund in progress or completed.'})

    # A refund opened directly in "approved" skips transition_refund, so the
    # seller -100 funding limit must be validated here.
    if initial_status == 'approved':
        from finance.services import validate_refund_funding
        probe = Refund(order=order, amount=amount, method=method)
        validate_refund_funding(probe)

    refund = Refund.objects.create(
        refund_id=f'RF{uuid.uuid4().hex[:10].upper()}',
        order=order,
        return_request=return_request,
        amount=amount,
        refund_type=refund_type,
        method=method,
        status=initial_status,
        reason=reason[:255],
        origin=origin,
        requested_by=requested_by if getattr(requested_by, 'is_authenticated', False) else None,
    )
    RefundEvent.objects.create(
        refund=refund, from_status='', to_status=initial_status,
        actor=refund.requested_by, note=note[:500] if note else '',
    )
    _notify_refund(refund, initial_status)

    # Store-credit refunds are instant: complete them straight away once the
    # case is opened in an approved state (no manual settlement required).
    if refund.method == 'store_credit' and initial_status == 'approved':
        transition_refund(refund, 'completed', actor=requested_by,
                          note='Store credit refunded instantly')
    return refund


@transaction.atomic
def settle_refund(refund, *, actor, transaction_id='', proof=None, note=''):
    """Manually complete an original-payment-method refund.

    The seller settles COD refunds; the admin settles online refunds. Records
    the settlement reference/proof and moves the case to completed (which posts
    the ledger). Store-credit refunds never reach here (they auto-complete).
    """
    if refund.method == 'store_credit':
        raise ValidationError({'detail': 'Store-credit refunds complete automatically.'})
    if refund.status == 'completed':
        raise ValidationError({'detail': 'This refund is already completed.'})
    if refund.status != 'approved':
        raise ValidationError({
            'detail': f'Only an approved refund can be settled (currently {refund.status}).'})
    if not (transaction_id or '').strip():
        raise ValidationError({'settlement_transaction_id':
                               'A transaction ID is required to complete the refund.'})

    refund.settlement_transaction_id = transaction_id.strip()[:120]
    refund.settlement_note = (note or '').strip()[:500]
    if proof is not None:
        refund.settlement_proof = proof
    refund.settled_by = actor if getattr(actor, 'is_authenticated', False) else None
    refund.settled_at = timezone.now()
    refund.save(update_fields=['settlement_transaction_id', 'settlement_note',
                               'settlement_proof', 'settled_by', 'settled_at', 'updated_at'])

    transition_refund(refund, 'completed', actor=actor,
                      note=f'Settled via {transaction_id.strip()}'
                           + (f' — {note.strip()}' if note else ''))
    return refund


@transaction.atomic
def transition_refund(refund, new_status, actor=None, note=''):
    current = refund.status
    if new_status not in REFUND_TRANSITIONS:
        raise ValidationError({'status': f'Unknown refund status "{new_status}".'})
    if new_status not in REFUND_TRANSITIONS.get(current, set()):
        raise ValidationError({
            'status': f'Cannot move a refund from "{current}" to "{new_status}".'
        })

    # Before approving, make sure the refund can actually be funded —
    # sellers may not go below the -100 Marketplace Balance limit.
    if new_status == 'approved':
        from finance.services import validate_refund_funding
        validate_refund_funding(refund)

    refund.status = new_status
    if getattr(actor, 'is_authenticated', False):
        refund.processed_by = actor
    refund.save(update_fields=['status', 'processed_by', 'updated_at'])
    RefundEvent.objects.create(
        refund=refund, from_status=current, to_status=new_status,
        actor=refund.processed_by, note=note[:500] if note else '',
    )

    if new_status == 'completed':
        _finalize_refund(refund, actor=actor)
    _notify_refund(refund, new_status)
    return refund


def _finalize_refund(refund, actor=None):
    """Apply the money movement when a refund completes.

    All movement goes through the double-entry ledger:
      store credit:      Seller Marketplace Balance -> Customer Wallet
      original (online): Seller Marketplace Balance -> Escrow (gateway refund)
      original (COD):    settled outside the platform, no ledger entries
    """
    from finance.services import post_refund
    order = refund.order
    post_refund(refund, actor=actor)

    if order.payment_status == 'paid':
        order.payment_status = 'refunded'
        order.save(update_fields=['payment_status', 'updated_at'])

    # Keep the linked return request in sync when its refund completes.
    if refund.return_request_id and refund.return_request.status != 'refunded':
        rr = refund.return_request
        rr.status = 'refunded'
        rr.save(update_fields=['status', 'updated_at'])

    # A cancellation refund keeps the order in its 'cancelled' state — the
    # cancellation is the primary event and the refund is tracked separately.
    # Only return/manual refunds advance the order to the 'refunded' status.
    if (refund.origin != 'cancellation'
            and order.status in EXCEPTION_TRANSITIONS['refunded']
            and order.status != 'refunded'):
        try:
            transition_order(order, 'refunded', actor=actor,
                             note=f'Refund {refund.refund_id} completed')
        except ValidationError:
            pass  # already terminal — keep the refund completion


def _notify_refund(refund, status):
    """In-app notification for refund lifecycle events (best-effort)."""
    try:
        from notifications.services import NotificationService
        messages = {
            'requested': ('Refund request received',
                          f'We received your refund request for order {refund.order.order_id}.'),
            'under_review': ('Refund under review',
                             f'Your refund for order {refund.order.order_id} is being reviewed.'),
            'approved': ('Refund approved',
                         f'Your refund of ৳{refund.amount} for order {refund.order.order_id} was approved.'),
            'completed': ('Refund completed',
                          f'Your refund of ৳{refund.amount} for order {refund.order.order_id} is complete'
                          + (' — added to your store credit.' if refund.method == 'store_credit' else '.')),
            'rejected': ('Refund rejected',
                         f'Your refund request for order {refund.order.order_id} was rejected.'),
        }
        if status in messages:
            title, message = messages[status]
            NotificationService.create_notification(
                user=refund.order.customer,
                title=title,
                message=message,
                notification_type='system',
                priority='high' if status in ('approved', 'completed') else 'medium',
                order_id=refund.order.order_id,
                action_url='/wallet',
                action_text='View Refunds',
            )
    except Exception:
        pass  # notifications must never break the workflow


# ---------------------------------------------------------------- wallet
#
# The customer wallet is now backed by the double-entry ledger in the
# `finance` app. These helpers keep the historical call sites working:
# balances come from the ledger snapshot, and every credit posts balanced
# ledger entries (which also mirror into WalletTransaction for the UI).

def wallet_balance(user):
    from finance.services import customer_wallet_balance
    return customer_wallet_balance(user).quantize(Decimal('0.01'))


def credit_wallet(user, amount, *, source='adjustment', note='', order=None, refund=None):
    """Manual/store credit — funded by the Platform Balance via the ledger."""
    from finance.services import credit_customer_wallet
    txn = credit_customer_wallet(
        user, amount, source=source, order=order, refund=refund, note=note)
    return txn.entries.filter(account__account_type='customer_wallet').first()
