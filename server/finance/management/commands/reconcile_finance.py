"""
Reconcile the finance ledger:

  - post missing payment ledger transactions for paid orders,
  - expire admin coupons whose expiry date has passed,
  - verify every account snapshot against a full ledger replay
    (freeze + rebuild + audit on mismatch),

Safe to run repeatedly (everything is idempotent). Intended for cron.
"""
from django.core.management.base import BaseCommand

from finance import services
from finance.models import LedgerAccount, LedgerTransaction


class Command(BaseCommand):
    help = 'Reconcile ledger postings, coupon expiry and wallet snapshots.'

    def add_arguments(self, parser):
        parser.add_argument('--rebuild', action='store_true',
                            help='Rebuild snapshots that do not match the ledger replay.')

    def handle(self, *args, **options):
        from orders.models import Order

        posted = 0
        paid_orders = Order.objects.filter(payment_status='paid')
        for order in paid_orders.iterator():
            ref = f'order-paid-{order.order_id}'
            if LedgerTransaction.objects.filter(reference=ref).exists():
                continue
            is_cod = (order.payment_method or '').lower() in ('cod', 'cash_on_delivery')
            has_coupon = order.admin_coupon_redemptions.filter(status='pending').exists()
            if is_cod and not has_coupon:
                continue  # plain COD orders have no ledger impact
            try:
                if services.post_order_payment(order):
                    posted += 1
                    self.stdout.write(f'Posted payment ledger for {order.order_id}')
            except Exception as exc:
                self.stderr.write(f'FAILED to post {order.order_id}: {exc}')

        expired = services.expire_due_admin_coupons()

        mismatched = 0
        for account in LedgerAccount.objects.all().iterator():
            if not services.verify_snapshot(account):
                mismatched += 1
                if options['rebuild']:
                    services.rebuild_snapshot(account)
                    self.stdout.write(f'Rebuilt snapshot for {account}')
                else:
                    self.stderr.write(
                        f'MISMATCH: {account} snapshot={account.balance} '
                        f'replay={services.replay_balance(account)} (use --rebuild to fix)')

        self.stdout.write(self.style.SUCCESS(
            f'Reconcile done: {posted} payments posted, {expired} coupons expired, '
            f'{mismatched} snapshot mismatches.'))
