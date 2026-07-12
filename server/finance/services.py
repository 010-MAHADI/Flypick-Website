"""
Ledger-first financial services.

Every function that moves money goes through post(), which:
  - runs inside a database transaction,
  - locks the affected accounts (SELECT ... FOR UPDATE),
  - validates that total debits equal total credits,
  - enforces per-account balance floors,
  - writes immutable ledger entries with balance_before/balance_after,
  - updates the account snapshots,
  - writes an audit log row,
  - is idempotent via the transaction `reference` key.

Nothing outside this module may write LedgerAccount.balance.
"""
import logging
import uuid
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    SELLER_NEGATIVE_LIMIT,
    AdminCoupon, AdminCouponRedemption, FinanceAuditLog,
    LedgerAccount, LedgerEntry, LedgerTransaction, WithdrawalRequest,
)

logger = logging.getLogger(__name__)

TWO_PLACES = Decimal('0.01')

# Balance floors per account type. None = unbounded.
ACCOUNT_FLOORS = {
    LedgerAccount.CUSTOMER_WALLET: Decimal('0'),
    LedgerAccount.WALLET_HOLDS: Decimal('0'),
    LedgerAccount.SELLER_MARKETPLACE: SELLER_NEGATIVE_LIMIT,
    LedgerAccount.SELLER_LOCKED: Decimal('0'),
    LedgerAccount.PLATFORM_BALANCE: Decimal('0'),
    LedgerAccount.COUPON_RESERVE: Decimal('0'),
    # escrow / opening_balance / seller_paid_out unbounded
}

FLOOR_MESSAGES = {
    LedgerAccount.CUSTOMER_WALLET: 'Insufficient store credit balance.',
    LedgerAccount.SELLER_MARKETPLACE: (
        f'Seller Marketplace Balance cannot go below {SELLER_NEGATIVE_LIMIT}. '
        'A seller deposit is required before further financial actions.'
    ),
    LedgerAccount.SELLER_LOCKED: 'Insufficient locked balance.',
    LedgerAccount.PLATFORM_BALANCE: 'Insufficient Platform Balance.',
    LedgerAccount.COUPON_RESERVE: 'Insufficient coupon reserve.',
    LedgerAccount.WALLET_HOLDS: 'Wallet hold mismatch.',
}


def q2(value):
    return Decimal(value).quantize(TWO_PLACES)


# --------------------------------------------------------------- accounts

def get_account(account_type, user=None, coupon=None):
    """Get or create the snapshot row for an account."""
    account, _ = LedgerAccount.objects.get_or_create(
        account_type=account_type, user=user, coupon=coupon,
    )
    return account


def escrow_account():
    return get_account(LedgerAccount.ESCROW)


def cod_clearing_account():
    return get_account(LedgerAccount.COD_CLEARING)


def platform_account():
    return get_account(LedgerAccount.PLATFORM_BALANCE)


def customer_wallet_account(user):
    return get_account(LedgerAccount.CUSTOMER_WALLET, user=user)


def seller_marketplace_account(user):
    return get_account(LedgerAccount.SELLER_MARKETPLACE, user=user)


def seller_locked_account(user):
    return get_account(LedgerAccount.SELLER_LOCKED, user=user)


def seller_paid_out_account(user):
    return get_account(LedgerAccount.SELLER_PAID_OUT, user=user)


def customer_wallet_balance(user):
    acct = LedgerAccount.objects.filter(
        account_type=LedgerAccount.CUSTOMER_WALLET, user=user).first()
    return acct.balance if acct else Decimal('0.00')


def seller_balances(user):
    """Snapshot of the seller's three logical balances."""
    def bal(t):
        acct = LedgerAccount.objects.filter(account_type=t, user=user).first()
        return acct.balance if acct else Decimal('0.00')
    return {
        'marketplace_balance': bal(LedgerAccount.SELLER_MARKETPLACE),
        'locked_balance': bal(LedgerAccount.SELLER_LOCKED),
        'paid_out_balance': bal(LedgerAccount.SELLER_PAID_OUT),
    }


# ------------------------------------------------------------------ audit

def write_audit(*, action, user=None, ip=None, resource='', txn=None,
                previous_state=None, new_state=None):
    try:
        FinanceAuditLog.objects.create(
            user=user if getattr(user, 'is_authenticated', False) else None,
            role=getattr(user, 'role', '') or '',
            ip_address=ip,
            action=action[:60],
            resource=str(resource)[:120],
            transaction=txn,
            previous_state=previous_state or {},
            new_state=new_state or {},
        )
    except Exception:
        logger.exception('Failed to write finance audit log for %s', action)
        raise  # audit trail is mandatory — never continue silently


# ------------------------------------------------------------------- post

def post(txn_type, lines, *, reference=None, order=None, refund=None,
         withdrawal=None, coupon=None, customer=None, seller=None,
         actor=None, ip=None, notes='', reversal_of=None):
    """Post one balanced, immutable, idempotent ledger transaction.

    ``lines`` is a list of (account, side, amount) where side is 'debit'
    or 'credit'. Returns the LedgerTransaction (the existing one when the
    reference was already posted).
    """
    with transaction.atomic():
        if reference:
            existing = LedgerTransaction.objects.filter(reference=reference).first()
            if existing:
                return existing  # idempotent no-op

        cleaned = []
        for account, side, amount in lines:
            amount = q2(amount)
            if amount < 0:
                raise ValidationError({'detail': 'Ledger amounts must be positive.'})
            if amount == 0:
                continue
            if side not in ('debit', 'credit'):
                raise ValidationError({'detail': f'Invalid ledger side "{side}".'})
            cleaned.append((account, side, amount))

        if not cleaned:
            raise ValidationError({'detail': 'A ledger transaction needs at least one non-zero line.'})

        total_debit = sum(a for _, s, a in cleaned if s == 'debit')
        total_credit = sum(a for _, s, a in cleaned if s == 'credit')
        if total_debit != total_credit:
            raise ValidationError({
                'detail': f'Unbalanced ledger transaction: debits {total_debit} != credits {total_credit}.'
            })

        # Lock all touched accounts in a stable order to avoid deadlocks.
        account_ids = sorted({acc.pk for acc, _, _ in cleaned})
        locked = {a.pk: a for a in
                  LedgerAccount.objects.select_for_update().filter(pk__in=account_ids)}

        for pk, acct in locked.items():
            if acct.is_frozen:
                raise ValidationError({
                    'detail': f'Account {acct} is frozen pending reconciliation. Contact the administrator.'
                })

        try:
            txn = LedgerTransaction.objects.create(
                reference=reference or None,
                txn_type=txn_type,
                order=order, refund=refund, withdrawal=withdrawal, coupon=coupon,
                customer=customer, seller=seller,
                created_by=actor if getattr(actor, 'is_authenticated', False) else None,
                notes=(notes or '')[:500],
                reversal_of=reversal_of,
            )
        except Exception:
            # Unique-constraint race on reference: another process posted it first.
            if reference:
                existing = LedgerTransaction.objects.filter(reference=reference).first()
                if existing:
                    return existing
            raise

        # Aggregate per-account deltas, then apply and validate floors.
        for account, side, amount in cleaned:
            acct = locked[account.pk]
            if acct.is_debit_normal:
                delta = amount if side == 'debit' else -amount
            else:
                delta = amount if side == 'credit' else -amount

            before = acct.balance
            after = q2(before + delta)

            floor = ACCOUNT_FLOORS.get(acct.account_type)
            if floor is not None and after < floor:
                raise ValidationError({
                    'detail': FLOOR_MESSAGES.get(
                        acct.account_type,
                        f'Operation would take {acct.account_type} below its allowed minimum.'),
                })

            LedgerEntry.objects.create(
                transaction=txn,
                account=acct,
                debit=amount if side == 'debit' else Decimal('0.00'),
                credit=amount if side == 'credit' else Decimal('0.00'),
                balance_before=before,
                balance_after=after,
            )
            acct.balance = after
            acct.save(update_fields=['balance', 'updated_at'])

            # Backward compatibility: mirror customer-wallet movements into the
            # legacy orders.WalletTransaction table so existing UI keeps working.
            # Migrations/rebuilds are derived FROM that table, so don't mirror them.
            if (acct.account_type == LedgerAccount.CUSTOMER_WALLET
                    and txn_type not in ('migration_opening', 'snapshot_rebuild')):
                _mirror_customer_wallet_entry(acct, side, amount, after, txn)

        write_audit(
            action=f'ledger.{txn_type}', user=actor, ip=ip,
            resource=reference or str(txn.transaction_id), txn=txn,
            new_state={'debits': str(total_debit), 'credits': str(total_credit)},
        )
        return txn


def _mirror_customer_wallet_entry(account, side, amount, balance_after, txn):
    from orders.models import WalletTransaction
    signed = amount if side == 'credit' else -amount
    source = 'adjustment'
    if txn.refund_id:
        source = 'refund'
    elif txn.order_id:
        source = 'order'
    WalletTransaction.objects.create(
        user=account.user,
        amount=signed,
        source=source,
        note=(txn.notes or txn.get_txn_type_display())[:255],
        order=txn.order,
        refund=txn.refund,
        balance_after=balance_after,
    )


def reverse_transaction(txn, *, actor=None, ip=None, notes=''):
    """Correct a posted transaction by posting its mirror image."""
    if txn.status == 'reversed':
        raise ValidationError({'detail': 'Transaction is already reversed.'})
    lines = []
    for entry in txn.entries.select_related('account'):
        if entry.debit:
            lines.append((entry.account, 'credit', entry.debit))
        else:
            lines.append((entry.account, 'debit', entry.credit))
    with transaction.atomic():
        reversal = post(
            'reversal', lines,
            reference=f'reversal-{txn.transaction_id}',
            order=txn.order, refund=txn.refund, withdrawal=txn.withdrawal,
            coupon=txn.coupon, customer=txn.customer, seller=txn.seller,
            actor=actor, ip=ip,
            notes=notes or f'Reversal of {txn.transaction_id}',
            reversal_of=txn,
        )
        txn.status = 'reversed'
        txn.save(update_fields=['status'])
    return reversal


# --------------------------------------------------- replay / reconciliation

def replay_balance(account):
    """Recompute an account balance purely from its ledger entries."""
    sums = account.entries.aggregate(d=Sum('debit'), c=Sum('credit'))
    debit = sums['d'] or Decimal('0')
    credit = sums['c'] or Decimal('0')
    if account.is_debit_normal:
        return q2(debit - credit)
    return q2(credit - debit)


def verify_snapshot(account):
    return account.balance == replay_balance(account)


def rebuild_snapshot(account, *, actor=None):
    """Spec §3 (Part 3): freeze, replay, rebuild, audit, notify admin."""
    with transaction.atomic():
        acct = LedgerAccount.objects.select_for_update().get(pk=account.pk)
        computed = replay_balance(acct)
        if computed == acct.balance:
            return acct.balance
        previous = acct.balance
        acct.balance = computed
        acct.is_frozen = False
        acct.save(update_fields=['balance', 'is_frozen', 'updated_at'])
        write_audit(
            action='snapshot.rebuild', user=actor,
            resource=f'account:{acct.pk}',
            previous_state={'balance': str(previous)},
            new_state={'balance': str(computed)},
        )
    _notify_admins('Wallet snapshot rebuilt',
                   f'Account {acct} snapshot corrected from {previous} to {computed}.')
    return computed


# -------------------------------------------------------- customer wallet

def credit_customer_wallet(user, amount, *, source='manual', order=None,
                           refund=None, actor=None, ip=None, note='', reference=None):
    """Manual/store credit into a customer wallet, funded by Platform Balance."""
    amount = q2(amount)
    if amount <= 0:
        raise ValidationError({'amount': 'Credit amount must be positive.'})
    return post(
        'store_credit_added',
        [(platform_account(), 'debit', amount),
         (customer_wallet_account(user), 'credit', amount)],
        reference=reference,
        order=order, refund=refund, customer=user,
        actor=actor, ip=ip, notes=note,
    )


def hold_wallet_credit(order, amount, *, actor=None, ip=None):
    """Checkout: move store credit into the holds account until payment settles."""
    amount = q2(amount)
    if amount <= 0:
        return None
    return post(
        'wallet_hold',
        [(customer_wallet_account(order.customer), 'debit', amount),
         (get_account(LedgerAccount.WALLET_HOLDS), 'credit', amount)],
        reference=f'wallet-hold-{order.order_id}',
        order=order, customer=order.customer,
        actor=actor, ip=ip,
        notes=f'Store credit held for order {order.order_id}',
    )


def release_wallet_hold(order, *, actor=None, ip=None, note=''):
    """Return held store credit when an order is cancelled/failed before payment."""
    hold = LedgerTransaction.objects.filter(
        reference=f'wallet-hold-{order.order_id}', status='posted').first()
    if not hold:
        return None
    already = LedgerTransaction.objects.filter(
        reference__in=[f'wallet-hold-release-{order.order_id}',
                       f'order-paid-{order.order_id}']).exists()
    if already:
        return None
    amount = q2(order.store_credit_used)
    if amount <= 0:
        return None
    return post(
        'wallet_hold_release',
        [(get_account(LedgerAccount.WALLET_HOLDS), 'debit', amount),
         (customer_wallet_account(order.customer), 'credit', amount)],
        reference=f'wallet-hold-release-{order.order_id}',
        order=order, customer=order.customer,
        actor=actor, ip=ip,
        notes=note or f'Store credit released for cancelled order {order.order_id}',
    )


# ------------------------------------------------------------ order split

def order_seller_breakdown(order):
    """Per-seller money breakdown for an order.

    Returns list of dicts: seller, shop, items_total (net of seller coupon),
    shipping_share, commission, admin_discount, net (seller payable credit).

    Assumptions (documented in the implementation report):
      - order.shipping_cost is allocated across sellers proportionally to
        their item totals (per-item shipping is not stored on order items);
      - commission (Shop.commission %) applies to product value only, net of
        seller coupons, never to shipping.
    """
    from products.models import Shop  # noqa: F401

    items = list(order.items.select_related('product__shop__seller'))
    groups = {}  # shop_id -> data
    orphan_total = Decimal('0')
    for item in items:
        line = q2(Decimal(item.price) * item.quantity)
        shop = item.product.shop if item.product else None
        if shop is None:
            orphan_total += line
            continue
        g = groups.setdefault(shop.id, {
            'shop': shop, 'seller': shop.seller, 'items_total': Decimal('0'),
        })
        g['items_total'] += line

    items_grand = sum(g['items_total'] for g in groups.values()) + orphan_total

    # Seller-coupon discount applies only to the owning seller's items.
    seller_coupon_discount = q2(getattr(order, 'seller_coupon_discount', 0) or 0)
    coupon_seller_id = getattr(order, 'coupon_seller_id', None)
    admin_coupon_discount = q2(getattr(order, 'admin_coupon_discount', 0) or 0)

    # Orders created before the finance system stored only a flat `discount`.
    # Any part of it not explained by the seller/admin coupon fields is
    # allocated proportionally so the split still matches what was charged.
    legacy_discount = q2(max(
        Decimal('0'),
        q2(order.discount or 0) - seller_coupon_discount - admin_coupon_discount))

    # Admin-coupon discount per seller from redemption rows.
    admin_by_seller = {}
    for red in order.admin_coupon_redemptions.exclude(status='voided'):
        admin_by_seller[red.seller_id] = admin_by_seller.get(red.seller_id, Decimal('0')) + red.amount

    shipping_total = q2(order.shipping_cost or 0)
    result = []
    remaining_shipping = shipping_total
    group_list = list(groups.values())
    for idx, g in enumerate(group_list):
        items_net = g['items_total']
        if coupon_seller_id and g['seller'].id == coupon_seller_id:
            items_net = max(Decimal('0'), items_net - seller_coupon_discount)
        if legacy_discount > 0 and items_grand > 0:
            items_net = max(Decimal('0'),
                            q2(items_net - legacy_discount * g['items_total'] / items_grand))
        # Proportional shipping allocation; last group takes the remainder.
        if idx == len(group_list) - 1:
            shipping_share = remaining_shipping
        elif items_grand > 0:
            shipping_share = q2(shipping_total * g['items_total'] / items_grand)
            remaining_shipping -= shipping_share
        else:
            shipping_share = Decimal('0')
        rate = Decimal(g['shop'].commission or 0)
        commission = q2(items_net * rate / Decimal('100'))
        admin_discount = q2(admin_by_seller.get(g['seller'].id, Decimal('0')))
        result.append({
            'seller': g['seller'],
            'shop': g['shop'],
            'items_total': q2(items_net),
            'shipping_share': q2(shipping_share),
            'commission': commission,
            'admin_discount': admin_discount,
            'net': q2(items_net + shipping_share - commission),
        })
    if orphan_total > 0:
        result.append({
            'seller': None, 'shop': None,
            'items_total': q2(orphan_total), 'shipping_share': Decimal('0.00'),
            'commission': q2(orphan_total),  # no owner — retained by platform
            'admin_discount': Decimal('0.00'),
            'net': Decimal('0.00'),
        })
    return result


# ---------------------------------------------------------------- payment

# Checkout charges applied to ONLINE (prepaid) orders only. Both are computed
# on the goods value (subtotal + shipping - discount). The 2% is a gateway fee
# that never enters our ledger; the 0.5% is platform revenue recorded in the
# Platform Balance history. Neither is itemised in any customer/seller view.
PLATFORM_CHARGE_RATE = Decimal('0.005')   # 0.5%
ONLINE_PAYMENT_CHARGE_RATE = Decimal('0.02')  # 2%


def is_cod_order(order):
    return (order.payment_method or '').lower() in ('cod', 'cash_on_delivery')


def order_goods_value(order):
    """The product + shipping value net of coupons — the base the charges and
    settlement are computed on (excludes the hidden checkout charges)."""
    return q2(Decimal(order.subtotal or 0)
              + Decimal(order.shipping_cost or 0)
              - Decimal(order.discount or 0))


def compute_checkout_charges(goods_value):
    """Return (platform_charge, online_charge) for an online order's goods value."""
    goods_value = q2(goods_value)
    return (q2(goods_value * PLATFORM_CHARGE_RATE),
            q2(goods_value * ONLINE_PAYMENT_CHARGE_RATE))


def post_order_payment(order, *, actor=None, ip=None):
    """Post the ledger when an order becomes paid.

    Online (prepaid) orders:
        Dr Escrow (goods cash) + Dr Wallet Holds (store credit)
        + Dr Coupon Reserve (admin coupon compensation)
        Cr Seller Marketplace (net of commission) + Cr Platform Balance (commission)
      plus a separate `platform_charge` transaction for the 0.5% platform fee.

    COD orders are completely independent of the marketplace financial system:
    the cash goes seller<->courier directly, so nothing touches escrow, seller
    payable/marketplace, or platform balance. The full amount the seller earns
    is recorded to Seller Paid Out (lifetime earnings) for reporting only:
        Dr COD Clearing (+ Dr Coupon Reserve for coupon compensation)
        Cr Seller Paid Out
    """
    reference = f'order-paid-{order.order_id}'
    existing = LedgerTransaction.objects.filter(reference=reference).first()
    if existing:
        return existing

    is_cod = is_cod_order(order)
    breakdown = order_seller_breakdown(order)

    pending_redemptions = list(order.admin_coupon_redemptions.filter(status='pending')
                               .select_related('coupon'))

    lines = []

    with transaction.atomic():
        if is_cod:
            # COD earnings recorded to Paid Out only (reporting). Seller keeps
            # everything: no commission, no escrow, no marketplace/payable.
            seller_parts = [p for p in breakdown if p['seller'] is not None]
            for part in seller_parts:
                # Full value the seller earns for their items (no commission).
                earning = q2(part['items_total'] + part['shipping_share'])
                if earning > 0:
                    lines.append((cod_clearing_account(), 'debit', earning))
                    lines.append((seller_paid_out_account(part['seller']), 'credit', earning))
            # Admin-coupon compensation (platform-funded) is also paid directly
            # to the seller off-platform, recorded to Paid Out from the reserve.
            for red in pending_redemptions:
                reserve = get_account(LedgerAccount.COUPON_RESERVE, coupon=red.coupon)
                lines.append((reserve, 'debit', red.amount))
                lines.append((seller_paid_out_account(red.seller), 'credit', red.amount))
            if not lines:
                for red in pending_redemptions:
                    red.status = 'redeemed'
                    red.save(update_fields=['status', 'updated_at'])
                return None
            txn = post(
                'cod_earning', lines,
                reference=reference, order=order, customer=order.customer,
                seller=seller_parts[0]['seller'] if len(seller_parts) == 1 else None,
                actor=actor, ip=ip,
                notes=f'COD earnings for delivered order {order.order_id} '
                      '(paid directly by courier — reporting only)',
            )
        else:
            store_credit = q2(order.store_credit_used or 0)
            # Escrow receives exactly the goods cash the customer paid (subtotal
            # + shipping - discount - store credit). No checkout charge is added
            # to what the customer pays. The 0.5% platform fee is taken from the
            # seller in a separate transaction below; the 2% is not modelled.
            goods_cash = q2(order_goods_value(order) - store_credit)

            if goods_cash > 0:
                lines.append((escrow_account(), 'debit', goods_cash))
            if store_credit > 0:
                lines.append((get_account(LedgerAccount.WALLET_HOLDS), 'debit', store_credit))

            for red in pending_redemptions:
                reserve = get_account(LedgerAccount.COUPON_RESERVE, coupon=red.coupon)
                lines.append((reserve, 'debit', red.amount))

            total_commission = Decimal('0')
            for part in breakdown:
                if part['seller'] is None:
                    total_commission += part['commission']
                    continue
                if part['net'] > 0:
                    lines.append((seller_marketplace_account(part['seller']), 'credit', part['net']))
                total_commission += part['commission']

            # Quantization of per-seller shares can leave a few paisa of drift
            # between the two sides; the platform commission line absorbs it so
            # the transaction always balances to the goods value.
            total_debit = sum(a for _, s, a in lines if s == 'debit')
            total_credit = sum(a for _, s, a in lines if s == 'credit')
            plug = q2(total_debit - total_credit - total_commission)
            platform_line = q2(total_commission + plug)
            if abs(plug) > Decimal('1.00'):
                raise ValidationError({
                    'detail': f'Order {order.order_id} split does not reconcile '
                              f'(difference {plug}). Payment ledger not posted.'})
            if platform_line > 0:
                lines.append((platform_account(), 'credit', platform_line))
            elif platform_line < 0:
                lines.append((platform_account(), 'debit', -platform_line))

            txn = post(
                'online_payment', lines,
                reference=reference, order=order, customer=order.customer,
                seller=breakdown[0]['seller'] if len(breakdown) == 1 and breakdown[0]['seller'] else None,
                actor=actor, ip=ip,
                notes=f'Payment for order {order.order_id}',
            )

            # The customer paid goods + 2.5% at the gateway. The gateway keeps
            # its 2% fee and remits goods + 0.5% to us; that 0.5% is the
            # marketplace's own service-charge earnings and belongs to the
            # Platform Balance. It is funded from the payment (Dr Escrow /
            # Cr Platform Balance) — NEVER deducted from the seller, who keeps
            # their full net. COD orders carry no service charge.
            service_charge = q2(Decimal(order.total_amount or 0) * PLATFORM_CHARGE_RATE)
            if service_charge > 0:
                post(
                    'platform_charge',
                    [(escrow_account(), 'debit', service_charge),
                     (platform_account(), 'credit', service_charge)],
                    reference=f'platform-charge-{order.order_id}',
                    order=order, customer=order.customer,
                    actor=actor, ip=ip,
                    notes=f'Platform service charge (0.5%) on order {order.order_id}',
                )

        for red in pending_redemptions:
            red.status = 'redeemed'
            red.save(update_fields=['status', 'updated_at'])

    if is_cod:
        _notify_sellers_cod_earning(order, breakdown)
    else:
        _notify_sellers_order_paid(order, breakdown)
    return txn


def void_order_coupon_redemptions(order):
    """Order cancelled before payment — free the pending coupon usage."""
    from django.db.models import F
    for red in order.admin_coupon_redemptions.filter(status='pending').select_related('coupon'):
        red.status = 'voided'
        red.save(update_fields=['status', 'updated_at'])
        AdminCoupon.objects.filter(pk=red.coupon_id, uses__gt=0).update(uses=F('uses') - 1)


# ----------------------------------------------------------------- refund

def refund_funding_plan(refund):
    """How a refund is funded and where the money goes.

    Returns (funding_lines, credit_lines, description).
    Raises ValidationError when a seller would fall below the -100 limit.
    """
    order = refund.order
    amount = q2(refund.amount)
    payment_txn = LedgerTransaction.objects.filter(
        reference=f'order-paid-{order.order_id}', txn_type='online_payment',
        status='posted').first()

    breakdown = order_seller_breakdown(order)
    funding = []

    if payment_txn:
        # Reverse what each party received: sellers return their net credit,
        # platform returns its commission; the admin-coupon compensation the
        # sellers received is also returned by them (it is part of net+comp),
        # and the platform recovers the coupon subsidy (see credit side).
        for part in breakdown:
            if part['seller'] is None:
                continue
            seller_share = q2(part['net'] + part['admin_discount'])
            if seller_share > 0:
                funding.append((seller_marketplace_account(part['seller']), 'debit', seller_share))
        total_commission = sum(p['commission'] for p in breakdown)
        if total_commission > 0:
            funding.append((platform_account(), 'debit', total_commission))
    else:
        # COD / legacy order — the marketplace never held this cash, so the
        # refund is funded entirely by the sellers' Marketplace Balances
        # (this is where the -100 negative limit applies).
        items_grand = sum(p['items_total'] + p['shipping_share'] for p in breakdown) or Decimal('1')
        remaining = amount
        seller_parts = [p for p in breakdown if p['seller'] is not None]
        for idx, part in enumerate(seller_parts):
            if idx == len(seller_parts) - 1:
                share = remaining
            else:
                share = q2(amount * (part['items_total'] + part['shipping_share']) / items_grand)
                remaining -= share
            if share > 0:
                funding.append((seller_marketplace_account(part['seller']), 'debit', share))

    # ---- credit side: where the customer gets the money back
    # The refund returns the GOODS value the customer paid (products + shipping
    # net of coupons). The hidden checkout charges are non-refundable: the 2%
    # gateway fee was never in our ledger, and the 0.5% platform charge is kept
    # by the platform (its charge transaction is not reversed). For online
    # orders `amount` (= total_amount + store credit) includes those charges,
    # so we refund the goods value instead.
    credits = []
    store_credit_part = q2(order.store_credit_used or 0)
    if payment_txn:
        goods_refund = order_goods_value(order)  # excludes the checkout charges
        gateway_part = q2(goods_refund - store_credit_part)
    else:
        goods_refund = amount  # COD/legacy orders carry no checkout charges
        gateway_part = q2(amount - store_credit_part)
    if refund.method == 'store_credit':
        credits.append((customer_wallet_account(order.customer), 'credit', goods_refund))
    else:  # original payment method
        if payment_txn:
            # Money leaves escrow via a manual gateway refund; the wallet
            # portion (if any) can only be returned as store credit.
            if gateway_part > 0:
                credits.append((escrow_account(), 'credit', gateway_part))
            if store_credit_part > 0:
                credits.append((customer_wallet_account(order.customer), 'credit', store_credit_part))
        else:
            # Original-method COD refund happens entirely outside the platform.
            return [], [], 'cod_original_no_ledger'

    # Balance the two sides: when an admin coupon subsidised the order the
    # sellers return more than the customer paid — the surplus returns to
    # Platform Balance (the platform recovers its promotion spend).
    total_funding = sum(a for _, _, a in funding)
    total_credit = sum(a for _, _, a in credits)
    surplus = q2(total_funding - total_credit)
    if surplus > 0:
        credits.append((platform_account(), 'credit', surplus))
    elif surplus < 0:
        # Small quantization drift is absorbed by the platform; anything larger
        # means the plan is inconsistent with the order ledger.
        if surplus >= Decimal('-1.00'):
            funding.append((platform_account(), 'debit', -surplus))
        else:
            raise ValidationError({'detail': 'Refund funding is inconsistent with the order ledger.'})

    return funding, credits, 'ok'


def validate_refund_funding(refund):
    """Check the -100 seller limit before a refund is approved."""
    funding, _credits, mode = refund_funding_plan(refund)
    for account, side, amount in funding:
        if account.account_type == LedgerAccount.SELLER_MARKETPLACE and side == 'debit':
            floor = ACCOUNT_FLOORS[LedgerAccount.SELLER_MARKETPLACE]
            if q2(account.balance - amount) < floor:
                raise ValidationError({
                    'detail': FLOOR_MESSAGES[LedgerAccount.SELLER_MARKETPLACE]})
    return mode


def post_refund(refund, *, actor=None, ip=None):
    """Move the money for a completed refund. Idempotent per refund."""
    reference = f'refund-{refund.refund_id}'
    existing = LedgerTransaction.objects.filter(reference=reference).first()
    if existing:
        return existing

    funding, credits, mode = refund_funding_plan(refund)
    if mode == 'cod_original_no_ledger':
        write_audit(action='refund.offline', user=actor, ip=ip,
                    resource=refund.refund_id,
                    new_state={'note': 'COD original-method refund settled outside the platform.'})
        return None

    order = refund.order
    seller = None
    seller_ids = {a.user_id for a, _, _ in funding
                  if a.account_type == LedgerAccount.SELLER_MARKETPLACE}
    if len(seller_ids) == 1:
        from users.models import CustomUser
        seller = CustomUser.objects.filter(pk=seller_ids.pop()).first()

    return post(
        'refund', funding + credits,
        reference=reference,
        order=order, refund=refund, customer=order.customer, seller=seller,
        actor=actor, ip=ip,
        notes=f'Refund {refund.refund_id} ({refund.method}) for order {order.order_id}',
    )


# ------------------------------------------------------------- withdrawal

def create_withdrawal_request(seller, amount, *, shop=None, payout_method='',
                              payout_details='', seller_note='', actor=None, ip=None):
    """Marketplace Balance -> Locked Balance, atomically with the request row."""
    amount = q2(amount)
    if amount <= 0:
        raise ValidationError({'amount': 'Withdrawal amount must be positive.'})

    with transaction.atomic():
        marketplace = LedgerAccount.objects.select_for_update().get_or_create(
            account_type=LedgerAccount.SELLER_MARKETPLACE, user=seller, coupon=None)[0]
        if marketplace.balance < amount:
            raise ValidationError({
                'amount': f'Insufficient Marketplace Balance ({marketplace.balance}) '
                          f'for a withdrawal of {amount}.'})

        wd = WithdrawalRequest.objects.create(
            request_id=f'WD{uuid.uuid4().hex[:10].upper()}',
            seller=seller, shop=shop, amount=amount,
            payout_method=payout_method[:80], payout_details=payout_details,
            seller_note=seller_note[:500],
        )
        post(
            'withdrawal_requested',
            [(marketplace, 'debit', amount),
             (seller_locked_account(seller), 'credit', amount)],
            reference=f'wd-request-{wd.request_id}',
            withdrawal=wd, seller=seller, actor=actor, ip=ip,
            notes=f'Withdrawal {wd.request_id} requested — funds locked',
        )
    _notify_admins('Withdrawal request',
                   f'Seller {seller.email} requested a withdrawal of ৳{amount} ({wd.request_id}).')
    return wd


def approve_withdrawal(wd, *, actor, payment_transaction_id, payment_method,
                       payment_proof=None, admin_note='', ip=None):
    """Admin manually transferred the money: Locked -> Paid Out."""
    if not payment_transaction_id.strip():
        raise ValidationError({'payment_transaction_id': 'The bank/mobile transaction ID is required.'})
    if not payment_method.strip():
        raise ValidationError({'payment_method': 'The payment method is required.'})

    with transaction.atomic():
        wd = WithdrawalRequest.objects.select_for_update().get(pk=wd.pk)
        if wd.status != 'requested':
            raise ValidationError({'detail': f'Withdrawal {wd.request_id} is already {wd.status}.'})

        post(
            'withdrawal_approved',
            [(seller_locked_account(wd.seller), 'debit', wd.amount),
             (seller_paid_out_account(wd.seller), 'credit', wd.amount)],
            reference=f'wd-approve-{wd.request_id}',
            withdrawal=wd, seller=wd.seller, actor=actor, ip=ip,
            notes=f'Withdrawal {wd.request_id} paid via {payment_method} ({payment_transaction_id})',
        )
        wd.status = 'approved'
        wd.processed_by = actor
        wd.payment_transaction_id = payment_transaction_id[:120]
        wd.payment_method = payment_method[:80]
        if payment_proof is not None:
            wd.payment_proof = payment_proof
        wd.admin_note = admin_note[:500]
        wd.processed_at = timezone.now()
        wd.save()

    _notify_user(wd.seller, 'Withdrawal approved',
                 f'Your withdrawal {wd.request_id} of ৳{wd.amount} was paid via '
                 f'{payment_method} (txn {payment_transaction_id}).')
    return wd


def reject_withdrawal(wd, *, actor, admin_note='', ip=None):
    """Locked -> Marketplace Balance."""
    with transaction.atomic():
        wd = WithdrawalRequest.objects.select_for_update().get(pk=wd.pk)
        if wd.status != 'requested':
            raise ValidationError({'detail': f'Withdrawal {wd.request_id} is already {wd.status}.'})

        post(
            'withdrawal_rejected',
            [(seller_locked_account(wd.seller), 'debit', wd.amount),
             (seller_marketplace_account(wd.seller), 'credit', wd.amount)],
            reference=f'wd-reject-{wd.request_id}',
            withdrawal=wd, seller=wd.seller, actor=actor, ip=ip,
            notes=f'Withdrawal {wd.request_id} rejected — funds unlocked',
        )
        wd.status = 'rejected'
        wd.processed_by = actor
        wd.admin_note = admin_note[:500]
        wd.processed_at = timezone.now()
        wd.save()

    _notify_user(wd.seller, 'Withdrawal rejected',
                 f'Your withdrawal {wd.request_id} of ৳{wd.amount} was rejected. '
                 + (admin_note or 'The amount is back in your Marketplace Balance.'))
    return wd


# ---------------------------------------------------------------- coupons

def activate_admin_coupon(coupon, *, actor, ip=None):
    """Draft/Paused -> Active. Reserves the budget from Platform Balance (once)."""
    with transaction.atomic():
        coupon = AdminCoupon.objects.select_for_update().get(pk=coupon.pk)
        if coupon.status not in ('draft', 'paused'):
            raise ValidationError({'detail': f'Cannot activate a coupon in status "{coupon.status}".'})
        if coupon.expires_at and coupon.expires_at <= timezone.now():
            raise ValidationError({'detail': 'Coupon expiry date is in the past.'})

        if coupon.status == 'draft':
            # Reserve the budget: Platform Balance -> Coupon Reserve.
            post(
                'coupon_reserve',
                [(platform_account(), 'debit', coupon.budget),
                 (get_account(LedgerAccount.COUPON_RESERVE, coupon=coupon), 'credit', coupon.budget)],
                reference=f'coupon-reserve-{coupon.pk}',
                coupon=coupon, actor=actor, ip=ip,
                notes=f'Budget reserved for admin coupon {coupon.code}',
            )
        # Paused -> Active keeps the existing reserve (spec: paused budget stays reserved).
        coupon.status = 'active'
        coupon.save(update_fields=['status', 'updated_at'])
        write_audit(action='coupon.activate', user=actor, ip=ip, resource=coupon.code,
                    new_state={'status': 'active'})
    return coupon


def pause_admin_coupon(coupon, *, actor, ip=None):
    with transaction.atomic():
        coupon = AdminCoupon.objects.select_for_update().get(pk=coupon.pk)
        if coupon.status != 'active':
            raise ValidationError({'detail': f'Cannot pause a coupon in status "{coupon.status}".'})
        coupon.status = 'paused'
        coupon.save(update_fields=['status', 'updated_at'])
        write_audit(action='coupon.pause', user=actor, ip=ip, resource=coupon.code,
                    new_state={'status': 'paused'})
    return coupon


def close_admin_coupon(coupon, *, actor, new_status, ip=None):
    """Expire or disable: return the unused reserve to Platform Balance."""
    if new_status not in ('expired', 'disabled'):
        raise ValidationError({'detail': 'Invalid coupon close status.'})
    with transaction.atomic():
        coupon = AdminCoupon.objects.select_for_update().get(pk=coupon.pk)
        if coupon.status in ('expired', 'disabled'):
            raise ValidationError({'detail': f'Coupon is already {coupon.status}.'})
        reserve = LedgerAccount.objects.filter(
            account_type=LedgerAccount.COUPON_RESERVE, coupon=coupon).first()
        remaining = reserve.balance if reserve else Decimal('0')
        pending = coupon.redemptions.filter(status='pending').aggregate(
            total=Sum('amount'))['total'] or Decimal('0')
        releasable = q2(remaining - pending)  # keep cover for unpaid orders
        if releasable > 0:
            post(
                'coupon_release',
                [(reserve, 'debit', releasable),
                 (platform_account(), 'credit', releasable)],
                reference=f'coupon-release-{coupon.pk}',
                coupon=coupon, actor=actor, ip=ip,
                notes=f'Unused reserve returned for {new_status} coupon {coupon.code}',
            )
        coupon.status = new_status
        coupon.save(update_fields=['status', 'updated_at'])
        write_audit(action=f'coupon.{new_status}', user=actor, ip=ip, resource=coupon.code,
                    previous_state={'reserve_remaining': str(remaining)},
                    new_state={'status': new_status, 'released': str(max(releasable, Decimal('0')))})
    return coupon


def expire_due_admin_coupons():
    """Expire every active/paused coupon whose expiry date passed. Returns count."""
    count = 0
    due = AdminCoupon.objects.filter(status__in=('active', 'paused'),
                                     expires_at__lte=timezone.now())
    for coupon in due:
        try:
            close_admin_coupon(coupon, actor=None, new_status='expired')
            count += 1
        except ValidationError:
            logger.exception('Failed to expire coupon %s', coupon.code)
    return count


# --------------------------------------------------------------- deposits

def admin_deposit(amount, *, actor, ip=None, note=''):
    """Manual funding of the Platform Balance."""
    amount = q2(amount)
    if amount <= 0:
        raise ValidationError({'amount': 'Deposit amount must be positive.'})
    return post(
        'admin_deposit',
        [(escrow_account(), 'debit', amount),
         (platform_account(), 'credit', amount)],
        actor=actor, ip=ip,
        notes=note or 'Manual platform deposit',
    )


def seller_deposit(seller, amount, *, actor, ip=None, note=''):
    """Seller tops up their Marketplace Balance (e.g. to clear a negative balance)."""
    amount = q2(amount)
    if amount <= 0:
        raise ValidationError({'amount': 'Deposit amount must be positive.'})
    return post(
        'seller_deposit',
        [(escrow_account(), 'debit', amount),
         (seller_marketplace_account(seller), 'credit', amount)],
        seller=seller, actor=actor, ip=ip,
        notes=note or f'Deposit into seller {seller.email} marketplace balance',
    )


# ---------------------------------------------------------------- reports

def admin_summary():
    """Admin dashboard figures, computed live from the ledger (source of truth)
    so the mandatory invariants always hold:

      Admin Seller Payable   = Σ every seller's Marketplace Balance
      Admin Customer Wallets = Σ every customer's Wallet Balance
      Platform Balance       = the marketplace's own earnings only
                               (commission + 0.5% service charge + deposits),
                               never any seller/customer/escrow money.

    Because these are aggregates of the per-account snapshots (which are only
    ever written inside the same DB transaction as their ledger entries), the
    admin figures are synchronized automatically and can never drift.
    """
    def total(t):
        return LedgerAccount.objects.filter(account_type=t).aggregate(
            total=Sum('balance'))['total'] or Decimal('0.00')

    marketplace = total(LedgerAccount.SELLER_MARKETPLACE)
    locked = total(LedgerAccount.SELLER_LOCKED)
    return {
        # Seller Payable = Σ Seller Marketplace Balance (strict formula).
        'seller_payable': q2(marketplace),
        'seller_marketplace_total': q2(marketplace),
        'seller_locked_total': q2(locked),
        'seller_paid_out_total': q2(total(LedgerAccount.SELLER_PAID_OUT)),
        'platform_balance': q2(total(LedgerAccount.PLATFORM_BALANCE)),
        'coupon_reserve_total': q2(total(LedgerAccount.COUPON_RESERVE)),
        'customer_wallet_total': q2(total(LedgerAccount.CUSTOMER_WALLET)),
        'wallet_holds_total': q2(total(LedgerAccount.WALLET_HOLDS)),
        'escrow_cumulative_in': q2(total(LedgerAccount.ESCROW)),
        'pending_withdrawals': WithdrawalRequest.objects.filter(status='requested').count(),
    }


# Maps an admin dashboard balance card to the ledger account type(s) behind it.
# Seller Payable is exactly the Seller Marketplace Balances (see admin_summary).
BALANCE_CATEGORY_ACCOUNTS = {
    'seller_payable': [LedgerAccount.SELLER_MARKETPLACE],
    'platform_balance': [LedgerAccount.PLATFORM_BALANCE],
    'coupon_reserve': [LedgerAccount.COUPON_RESERVE],
    'customer_wallet': [LedgerAccount.CUSTOMER_WALLET],
    'seller_locked': [LedgerAccount.SELLER_LOCKED],
    'seller_paid_out': [LedgerAccount.SELLER_PAID_OUT],
    'escrow': [LedgerAccount.ESCROW],
}


def account_history_queryset(category):
    """Ledger entries behind an admin balance card, newest first."""
    account_types = BALANCE_CATEGORY_ACCOUNTS.get(category)
    if not account_types:
        return None
    from .models import LedgerEntry
    return (LedgerEntry.objects
            .filter(account__account_type__in=account_types)
            .select_related('account__user', 'transaction',
                            'transaction__order', 'transaction__customer',
                            'transaction__seller')
            .prefetch_related('transaction__order__items')
            .order_by('-id'))


# ----------------------------------------------------------- notifications

def _notify_user(user, title, message, *, action_url='/wallet', action_text='View Wallet'):
    try:
        from notifications.services import NotificationService
        NotificationService.create_notification(
            user=user, title=title, message=message,
            notification_type='system', priority='high',
            action_url=action_url, action_text=action_text,
        )
    except Exception:
        logger.exception('Failed to notify user %s: %s', getattr(user, 'pk', None), title)


def _notify_admins(title, message):
    try:
        from users.models import CustomUser
        admins = CustomUser.objects.filter(role='Admin', is_active=True)[:10]
        for admin in admins:
            _notify_user(admin, title, message, action_url='/finance', action_text='Open Finance')
    except Exception:
        logger.exception('Failed to notify admins: %s', title)


def _notify_sellers_order_paid(order, breakdown):
    for part in breakdown:
        if part['seller'] is None:
            continue
        _notify_user(
            part['seller'], 'Order paid',
            f'Order {order.order_id} was paid. ৳{part["net"]} was added to your '
            'Marketplace Balance' + (f' (commission ৳{part["commission"]} deducted).'
                                     if part['commission'] else '.'),
            action_url='/wallet', action_text='View Wallet',
        )


def _notify_sellers_cod_earning(order, breakdown):
    for part in breakdown:
        if part['seller'] is None:
            continue
        earning = q2(part['items_total'] + part['shipping_share'])
        _notify_user(
            part['seller'], 'COD order delivered',
            f'COD order {order.order_id} was delivered. ৳{earning} collected '
            'directly by the courier has been added to your lifetime earnings.',
            action_url='/wallet', action_text='View Wallet',
        )
