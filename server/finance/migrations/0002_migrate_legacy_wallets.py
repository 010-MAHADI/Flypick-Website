"""
Preserve existing customer store-credit balances.

The legacy orders.WalletTransaction table (single-entry, signed amounts) stays
untouched as history. For every user with a non-zero legacy balance we open a
customer_wallet ledger account with a balanced `migration_opening` transaction:

    Dr Opening Balance    /    Cr Customer Wallet   (positive balances)
    Dr Customer Wallet    /    Cr Opening Balance   (negative balances)

After this migration the double-entry ledger is the source of truth and the
legacy table is only written as a read-compatibility mirror.
"""
from decimal import Decimal

from django.db import migrations


def forwards(apps, schema_editor):
    WalletTransaction = apps.get_model('orders', 'WalletTransaction')
    LedgerAccount = apps.get_model('finance', 'LedgerAccount')
    LedgerTransaction = apps.get_model('finance', 'LedgerTransaction')
    LedgerEntry = apps.get_model('finance', 'LedgerEntry')

    from django.db.models import Sum
    balances = (WalletTransaction.objects.values('user_id')
                .annotate(total=Sum('amount')).order_by('user_id'))

    opening, _ = LedgerAccount.objects.get_or_create(
        account_type='opening_balance', user=None, coupon=None,
        defaults={'balance': Decimal('0.00')})

    for row in balances:
        amount = (row['total'] or Decimal('0')).quantize(Decimal('0.01'))
        wallet, _ = LedgerAccount.objects.get_or_create(
            account_type='customer_wallet', user_id=row['user_id'], coupon=None,
            defaults={'balance': Decimal('0.00')})
        if amount == 0:
            continue

        txn = LedgerTransaction.objects.create(
            txn_type='migration_opening',
            reference=f'legacy-wallet-{row["user_id"]}',
            status='posted',
            customer_id=row['user_id'],
            notes='Opening balance migrated from legacy store-credit history',
        )
        if amount > 0:
            # Dr Opening Balance (debit-normal: +), Cr Customer Wallet (credit-normal: +)
            LedgerEntry.objects.create(
                transaction=txn, account=opening, debit=amount, credit=0,
                balance_before=opening.balance, balance_after=opening.balance + amount)
            opening.balance += amount
            LedgerEntry.objects.create(
                transaction=txn, account=wallet, debit=0, credit=amount,
                balance_before=wallet.balance, balance_after=wallet.balance + amount)
            wallet.balance += amount
        else:
            amt = -amount
            LedgerEntry.objects.create(
                transaction=txn, account=wallet, debit=amt, credit=0,
                balance_before=wallet.balance, balance_after=wallet.balance - amt)
            wallet.balance -= amt
            LedgerEntry.objects.create(
                transaction=txn, account=opening, debit=0, credit=amt,
                balance_before=opening.balance, balance_after=opening.balance - amt)
            opening.balance -= amt
        wallet.save(update_fields=['balance'])
        opening.save(update_fields=['balance'])


def backwards(apps, schema_editor):
    # The legacy table was never modified; dropping the ledger app tables
    # (earlier migration reversal) removes the migrated data.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0001_initial'),
        ('orders', '0008_order_admin_coupon_discount_order_coupon_seller_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
