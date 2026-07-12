"""
Finance APIs.

Seller endpoints (role=Seller):
  GET  /api/finance/seller/wallet/              balances + recent ledger history
  GET  /api/finance/seller/withdrawals/         own withdrawal requests
  POST /api/finance/seller/withdrawals/         create a withdrawal (locks funds)

Admin endpoints (role=Admin / superuser):
  GET  /api/finance/admin/summary/              seller payable / platform balance / etc.
  GET  /api/finance/admin/ledger/               full ledger history (filterable)
  GET  /api/finance/admin/withdrawals/          all withdrawal requests
  POST /api/finance/admin/withdrawals/<id>/approve/   settle (txn id + method + proof)
  POST /api/finance/admin/withdrawals/<id>/reject/
  POST /api/finance/admin/deposit/              manual Platform Balance funding
  POST /api/finance/admin/seller-deposit/       record a seller deposit
  GET  /api/finance/admin/settlement-report/    per-seller settlement aggregates
  CRUD /api/finance/admin/coupons/              admin coupons + lifecycle actions
"""
from decimal import Decimal, InvalidOperation

from django.db.models import Q, Sum
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from users.models import CustomUser
from users.roles import is_admin_user, is_seller_user

from . import services
from .models import (
    AdminCoupon, LedgerAccount, LedgerEntry, LedgerTransaction, WithdrawalRequest,
)
from .serializers import (
    AccountHistoryEntrySerializer,
    AdminCouponSerializer, AdminCouponRedemptionSerializer,
    LedgerTransactionSerializer, SellerLedgerEntrySerializer,
    WithdrawalRequestSerializer,
)


def client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class IsSeller(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_seller_user(request.user) or is_admin_user(request.user)


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)


class DefaultPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ------------------------------------------------------------------ seller

@api_view(['GET'])
@permission_classes([IsSeller])
def seller_wallet_view(request):
    """The seller's three balances plus their ledger history."""
    user = request.user
    balances = services.seller_balances(user)
    entries = (LedgerEntry.objects
               .filter(account__user=user,
                       account__account_type__in=[
                           LedgerAccount.SELLER_MARKETPLACE,
                           LedgerAccount.SELLER_LOCKED,
                           LedgerAccount.SELLER_PAID_OUT])
               .select_related('transaction__order', 'transaction__withdrawal', 'account')
               .order_by('-id')[:100])
    return Response({
        'marketplace_balance': str(balances['marketplace_balance']),
        'locked_balance': str(balances['locked_balance']),
        'paid_out_balance': str(balances['paid_out_balance']),
        'negative_limit': '-100.00',
        'entries': SellerLedgerEntrySerializer(entries, many=True).data,
    })


class SellerWithdrawalViewSet(viewsets.ModelViewSet):
    """Sellers create and track their own withdrawal requests."""
    serializer_class = WithdrawalRequestSerializer
    permission_classes = [IsSeller]
    pagination_class = DefaultPagination
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return (WithdrawalRequest.objects.filter(seller=self.request.user)
                .select_related('seller', 'shop'))

    def create(self, request, *args, **kwargs):
        try:
            amount = Decimal(str(request.data.get('amount', '')))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'amount': 'A valid withdrawal amount is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        shop = request.user.shops.first()
        payout_method = (request.data.get('payout_method') or
                         (shop.payout_method if shop else '') or '').strip()
        payout_details = (request.data.get('payout_details') or
                          (shop.bank_information or shop.mobile_banking if shop else '') or '').strip()

        wd = services.create_withdrawal_request(
            request.user, amount,
            shop=shop,
            payout_method=payout_method,
            payout_details=payout_details,
            seller_note=(request.data.get('note') or '').strip(),
            actor=request.user, ip=client_ip(request),
        )
        return Response(WithdrawalRequestSerializer(wd, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


# ------------------------------------------------------------------- admin

@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_summary_view(request):
    summary = services.admin_summary()
    return Response({k: str(v) if isinstance(v, Decimal) else v
                     for k, v in summary.items()})


@api_view(['GET'])
@permission_classes([IsAdmin])
def account_history_view(request, category):
    """Full transaction history behind one admin balance card
    (seller_payable / platform_balance / coupon_reserve / customer_wallet …)."""
    qs = services.account_history_queryset(category)
    if qs is None:
        return Response({'detail': f'Unknown balance category "{category}".'},
                        status=status.HTTP_400_BAD_REQUEST)
    order_id = request.query_params.get('order_id')
    if order_id:
        qs = qs.filter(transaction__order__order_id__iexact=order_id)
    paginator = DefaultPagination()
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response(
        AccountHistoryEntrySerializer(page, many=True).data)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_ledger_view(request):
    qs = (LedgerTransaction.objects
          .select_related('order', 'refund', 'withdrawal', 'coupon', 'created_by')
          .prefetch_related('entries__account__user'))
    txn_type = request.query_params.get('type')
    if txn_type:
        qs = qs.filter(txn_type=txn_type)
    order_id = request.query_params.get('order_id')
    if order_id:
        qs = qs.filter(order__order_id=order_id)
    user_id = request.query_params.get('user_id')
    if user_id:
        qs = qs.filter(Q(customer_id=user_id) | Q(seller_id=user_id))
    paginator = DefaultPagination()
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response(
        LedgerTransactionSerializer(page, many=True).data)


class AdminWithdrawalViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WithdrawalRequestSerializer
    permission_classes = [IsAdmin]
    pagination_class = DefaultPagination

    def get_queryset(self):
        qs = WithdrawalRequest.objects.select_related('seller', 'shop')
        state = self.request.query_params.get('status')
        if state:
            qs = qs.filter(status=state)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        wd = self.get_object()
        wd = services.approve_withdrawal(
            wd, actor=request.user,
            payment_transaction_id=(request.data.get('payment_transaction_id') or '').strip(),
            payment_method=(request.data.get('payment_method') or '').strip(),
            payment_proof=request.FILES.get('payment_proof'),
            admin_note=(request.data.get('admin_note') or '').strip(),
            ip=client_ip(request),
        )
        return Response(WithdrawalRequestSerializer(wd, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        wd = self.get_object()
        wd = services.reject_withdrawal(
            wd, actor=request.user,
            admin_note=(request.data.get('admin_note') or '').strip(),
            ip=client_ip(request),
        )
        return Response(WithdrawalRequestSerializer(wd, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_deposit_view(request):
    """Manually fund the Platform Balance."""
    try:
        amount = Decimal(str(request.data.get('amount', '')))
    except (InvalidOperation, TypeError, ValueError):
        return Response({'amount': 'A valid amount is required.'}, status=status.HTTP_400_BAD_REQUEST)
    txn = services.admin_deposit(amount, actor=request.user, ip=client_ip(request),
                                 note=(request.data.get('note') or '').strip())
    return Response({'transaction_id': str(txn.transaction_id),
                     'platform_balance': str(services.platform_account().balance)},
                    status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_seller_deposit_view(request):
    """Record a deposit a seller made to clear/raise their Marketplace Balance."""
    try:
        amount = Decimal(str(request.data.get('amount', '')))
    except (InvalidOperation, TypeError, ValueError):
        return Response({'amount': 'A valid amount is required.'}, status=status.HTTP_400_BAD_REQUEST)
    seller = CustomUser.objects.filter(pk=request.data.get('seller_id'), role='Seller').first()
    if not seller:
        return Response({'seller_id': 'Seller not found.'}, status=status.HTTP_404_NOT_FOUND)
    txn = services.seller_deposit(seller, amount, actor=request.user, ip=client_ip(request),
                                  note=(request.data.get('note') or '').strip())
    return Response({'transaction_id': str(txn.transaction_id),
                     'balances': {k: str(v) for k, v in services.seller_balances(seller).items()}},
                    status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAdmin])
def settlement_report_view(request):
    """Per-seller settlement snapshot: balances, paid out, pending withdrawals."""
    rows = []
    sellers = (CustomUser.objects.filter(role='Seller')
               .filter(Q(ledger_accounts__isnull=False) | Q(withdrawal_requests__isnull=False))
               .distinct())
    for seller in sellers:
        balances = services.seller_balances(seller)
        pending = (WithdrawalRequest.objects.filter(seller=seller, status='requested')
                   .aggregate(total=Sum('amount'), )['total'] or Decimal('0'))
        rows.append({
            'seller_id': seller.id,
            'seller_email': seller.email,
            'seller_name': seller.get_full_name() or seller.username,
            'marketplace_balance': str(balances['marketplace_balance']),
            'locked_balance': str(balances['locked_balance']),
            'paid_out_balance': str(balances['paid_out_balance']),
            'pending_withdrawals': str(pending),
        })
    return Response({'sellers': rows})


class AdminCouponViewSet(viewsets.ModelViewSet):
    """Admin coupon CRUD + lifecycle (Draft -> Active -> Paused -> Expired/Disabled)."""
    serializer_class = AdminCouponSerializer
    permission_classes = [IsAdmin]
    pagination_class = DefaultPagination
    queryset = AdminCoupon.objects.all().prefetch_related('reserve_accounts')

    def perform_create(self, serializer):
        coupon = serializer.save(created_by=self.request.user, status='draft')
        services.write_audit(action='coupon.create', user=self.request.user,
                             ip=client_ip(self.request), resource=coupon.code,
                             new_state={'budget': str(coupon.budget)})

    def perform_update(self, serializer):
        coupon = self.get_object()
        if coupon.status != 'draft':
            # Only safe presentation fields may change after activation;
            # the budget/discount are financially reserved.
            locked_fields = {'budget', 'discount_type', 'discount_value', 'code'}
            changed = locked_fields.intersection(serializer.validated_data.keys())
            for field in changed:
                if serializer.validated_data[field] != getattr(coupon, field):
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError(
                        {field: 'Cannot change financial terms after activation. '
                                'Disable this coupon and create a new one.'})
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        coupon = self.get_object()
        if coupon.status != 'draft':
            return Response(
                {'detail': 'Activated coupons cannot be deleted — disable them instead.'},
                status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        coupon = services.activate_admin_coupon(self.get_object(), actor=request.user,
                                                ip=client_ip(request))
        return Response(AdminCouponSerializer(coupon).data)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        coupon = services.pause_admin_coupon(self.get_object(), actor=request.user,
                                             ip=client_ip(request))
        return Response(AdminCouponSerializer(coupon).data)

    @action(detail=True, methods=['post'])
    def expire(self, request, pk=None):
        coupon = services.close_admin_coupon(self.get_object(), actor=request.user,
                                             new_status='expired', ip=client_ip(request))
        return Response(AdminCouponSerializer(coupon).data)

    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        coupon = services.close_admin_coupon(self.get_object(), actor=request.user,
                                             new_status='disabled', ip=client_ip(request))
        return Response(AdminCouponSerializer(coupon).data)

    @action(detail=True, methods=['get'])
    def redemptions(self, request, pk=None):
        qs = self.get_object().redemptions.select_related('order', 'seller', 'coupon')
        return Response(AdminCouponRedemptionSerializer(qs, many=True).data)
