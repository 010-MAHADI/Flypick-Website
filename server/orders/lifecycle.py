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
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from .models import Order, OrderStatusHistory, Refund, RefundEvent, WalletTransaction

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

# Statuses a CUSTOMER may cancel from (before shipment). Overridable via
# settings for different business rules.
def customer_cancellable_statuses():
    return set(getattr(settings, 'ORDER_CANCELLABLE_STATUSES', ['pending', 'confirmed']))


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


def create_refund(order, amount, *, method='original', refund_type='full',
                  reason='', requested_by=None, return_request=None,
                  initial_status='requested', note=''):
    refund = Refund.objects.create(
        refund_id=f'RF{uuid.uuid4().hex[:10].upper()}',
        order=order,
        return_request=return_request,
        amount=amount,
        refund_type=refund_type,
        method=method,
        status=initial_status,
        reason=reason[:255],
        requested_by=requested_by if getattr(requested_by, 'is_authenticated', False) else None,
    )
    RefundEvent.objects.create(
        refund=refund, from_status='', to_status=initial_status,
        actor=refund.requested_by, note=note[:500] if note else '',
    )
    _notify_refund(refund, initial_status)
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
    """Apply the money movement when a refund completes."""
    order = refund.order
    if refund.method == 'store_credit':
        credit_wallet(
            order.customer, refund.amount,
            source='refund', refund=refund, order=order,
            note=f'Refund {refund.refund_id} for order {order.order_id}',
        )
    # Mark payment refunded when the full amount went back
    total_refunded = (
        order.refunds.filter(status='completed').aggregate(total=Sum('amount'))['total']
        or Decimal('0')
    )
    if total_refunded >= order.total_amount and order.payment_status == 'paid':
        order.payment_status = 'refunded'
        order.save(update_fields=['payment_status', 'updated_at'])
    if order.status in EXCEPTION_TRANSITIONS['refunded'] and order.status != 'refunded':
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

def wallet_balance(user):
    total = user.wallet_transactions.aggregate(total=Sum('amount'))['total']
    return (total or Decimal('0')).quantize(Decimal('0.01'))


@transaction.atomic
def credit_wallet(user, amount, *, source='adjustment', note='', order=None, refund=None):
    amount = Decimal(amount)
    if amount <= 0:
        raise ValidationError({'amount': 'Credit amount must be positive.'})
    balance = wallet_balance(user) + amount
    return WalletTransaction.objects.create(
        user=user, amount=amount, source=source, note=note[:255],
        order=order, refund=refund, balance_after=balance,
    )


@transaction.atomic
def debit_wallet(user, amount, *, source='order', note='', order=None):
    amount = Decimal(amount)
    if amount <= 0:
        raise ValidationError({'amount': 'Debit amount must be positive.'})
    balance = wallet_balance(user)
    if amount > balance:
        raise ValidationError({'store_credit': 'Insufficient store credit balance.'})
    return WalletTransaction.objects.create(
        user=user, amount=-amount, source=source, note=note[:255],
        order=order, balance_after=balance - amount,
    )
