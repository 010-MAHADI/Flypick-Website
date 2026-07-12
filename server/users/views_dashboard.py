"""
Marketplace dashboard statistics — accurate, rule-based and time-filterable.

Business rules (single source of truth for every dashboard number):

  * Sales / revenue count ONLY valid orders. An order is EXCLUDED from sales
    when its status is cancelled/failed/returned/refunded, or its payment was
    refunded. So cancelling a ৳1,000 order immediately removes ৳1,000 from
    sales for its period.
  * Net Profit is realised on COMPLETED (delivered/completed) orders only:
        Net Profit = Completed Sales − Product Cost − Delivery Cost
    where Product Cost = Σ(product.actualCost × qty) and Delivery Cost =
    Σ(order item shipping_charge). Pending/cancelled/refunded/returned orders
    never contribute to profit.
  * Every figure is computed live from the orders table for the selected time
    range, so it always reflects the current financial state.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import (
    Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value,
)
from django.db.models.functions import Coalesce, TruncDay, TruncMonth
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order, OrderItem
from products.models import Product

from .roles import is_admin_user

User = get_user_model()

# Order statuses that must NEVER count as a sale.
EXCLUDED_STATUSES = ['cancelled', 'failed', 'returned', 'refunded']
# Statuses that count as a realised, completed sale (for profit).
COMPLETED_STATUSES = ['delivered', 'completed']

MONEY = DecimalField(max_digits=14, decimal_places=2)
_line = ExpressionWrapper(F('price') * F('quantity'), output_field=MONEY)
_ship = Coalesce(F('shipping_charge'), Value(0), output_field=MONEY)
_cost = ExpressionWrapper(
    Coalesce(F('product__actualCost'), Value(0), output_field=MONEY) * F('quantity'),
    output_field=MONEY,
)


def _valid(qs, order_prefix=''):
    """Restrict a queryset to valid (sale-counting) orders."""
    status_field = f'{order_prefix}status__in'
    pay_field = f'{order_prefix}payment_status'
    return qs.exclude(**{status_field: EXCLUDED_STATUSES}).exclude(**{pay_field: 'refunded'})


def _range_start(range_key):
    """Start datetime for a time range, or None for all-time."""
    now = timezone.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if range_key == 'today':
        return today
    if range_key == 'week':
        return today - timedelta(days=today.weekday())  # Monday of this week
    if range_key == 'month':
        return today.replace(day=1)
    if range_key == 'year':
        return today.replace(month=1, day=1)
    return None  # all time


class DashboardStatsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        shop_id = request.query_params.get('shop')
        range_key = (request.query_params.get('range') or 'all').lower()
        if range_key not in ('today', 'week', 'month', 'year', 'all'):
            range_key = 'all'
        start = _range_start(range_key)

        admin = is_admin_user(user)
        if not admin and getattr(user, 'role', '') != 'Seller':
            return Response({'error': 'Unauthorized'}, status=403)

        # --- scope orders / items to the seller (or all for admin) -----------
        if admin and not shop_id:
            orders = Order.objects.all()
            items = OrderItem.objects.all()
            products = Product.objects.all()
        else:
            if shop_id:
                shop_ids = [shop_id]
            else:
                shop_ids = list(user.shops.values_list('id', flat=True))
            orders = Order.objects.filter(items__product__shop_id__in=shop_ids).distinct()
            items = OrderItem.objects.filter(product__shop_id__in=shop_ids)
            products = Product.objects.filter(shop_id__in=shop_ids)

        # --- apply the time range --------------------------------------------
        if start is not None:
            orders = orders.filter(created_at__gte=start)
            items = items.filter(order__created_at__gte=start)

        stats = self._compute_stats(orders, items, products, admin, range_key, start)
        payload = {
            'range': range_key,
            'stats': stats,
            'recentOrders': self._recent_orders(items),
            'revenueData': self._revenue_series(items, range_key, start),
            'categoryData': self._category_mix(items),
            'topProducts': self._top_products(items),
        }
        return Response(payload)

    # ---------------------------------------------------------------- stats
    def _compute_stats(self, orders, items, products, admin, range_key, start):
        valid_items = _valid(items, 'order__')
        completed_items = items.filter(order__status__in=COMPLETED_STATUSES)

        # Sales / revenue (valid orders only).
        sales_agg = valid_items.aggregate(
            sales=Coalesce(Sum(_line), Value(0), output_field=MONEY),
            shipping=Coalesce(Sum(_ship), Value(0), output_field=MONEY),
        )
        total_sales = sales_agg['sales']
        total_revenue = total_sales + sales_agg['shipping']

        # Profit — completed orders only.
        profit_agg = completed_items.aggregate(
            sales=Coalesce(Sum(_line), Value(0), output_field=MONEY),
            shipping=Coalesce(Sum(_ship), Value(0), output_field=MONEY),
            cost=Coalesce(Sum(_cost), Value(0), output_field=MONEY),
        )
        completed_sales = profit_agg['sales'] + profit_agg['shipping']
        product_cost = profit_agg['cost']
        delivery_cost = profit_agg['shipping']
        net_profit = completed_sales - product_cost - delivery_cost
        expenses = product_cost + delivery_cost

        # Order status counts (over the scoped + time-ranged orders).
        counts = self._status_counts(orders)

        stats = {
            'totalSales': float(total_sales),
            'totalRevenue': float(total_revenue),
            'totalOrders': orders.count(),
            'pendingOrders': counts['pending'],
            'processingOrders': counts['processing'],
            'shippedOrders': counts['shipped'],
            'deliveredOrders': counts['delivered'],
            'completedOrders': counts['delivered'],
            'cancelledOrders': counts['cancelled'],
            'returnedOrders': counts['returned'],
            'refundedOrders': counts['refunded'],
            'productCost': float(product_cost),
            'deliveryCost': float(delivery_cost),
            'expenses': float(expenses),
            'netProfit': float(net_profit),
            'activeProducts': products.count(),
            'lowStockProducts': products.filter(stock__gt=0, stock__lt=10).count(),
        }

        if admin:
            new_customers_q = User.objects.filter(role='Customer')
            if start is not None:
                new_customers_q = new_customers_q.filter(date_joined__gte=start)
            stats.update({
                'totalCustomers': User.objects.filter(role='Customer').count(),
                'newCustomers': new_customers_q.count(),
                'totalSellers': User.objects.filter(role='Seller').count(),
                'activeSellers': User.objects.filter(
                    role='Seller', is_active=True,
                    seller_profile__status='active').count(),
                'pendingSellerRequests': User.objects.filter(
                    role='Seller', seller_profile__status='pending').count(),
                'activeUsers': User.objects.filter(is_active=True).count(),
            })
        else:
            stats['totalCustomers'] = orders.values('customer').distinct().count()

        return stats

    @staticmethod
    def _status_counts(orders):
        rows = orders.values('status', 'payment_status')
        buckets = {'pending': 0, 'processing': 0, 'shipped': 0, 'delivered': 0,
                   'cancelled': 0, 'returned': 0, 'refunded': 0}
        for row in rows:
            s = row['status']
            pay = row['payment_status']
            if s == 'refunded' or pay == 'refunded':
                buckets['refunded'] += 1
            elif s == 'returned':
                buckets['returned'] += 1
            elif s in ('cancelled', 'failed'):
                buckets['cancelled'] += 1
            elif s in ('delivered', 'completed'):
                buckets['delivered'] += 1
            elif s in ('shipped', 'out_for_delivery'):
                buckets['shipped'] += 1
            elif s in ('confirmed', 'processing', 'packed'):
                buckets['processing'] += 1
            else:  # pending
                buckets['pending'] += 1
        return buckets

    # ------------------------------------------------------------- sections
    @staticmethod
    def _recent_orders(items):
        recent = (
            _valid(items, 'order__')
            .select_related('order', 'order__customer', 'product')
            .order_by('-order__created_at')[:5]
        )
        out = []
        seen = set()
        for item in recent:
            if item.order_id in seen:
                continue
            seen.add(item.order_id)
            out.append({
                'id': item.order.order_id,
                'customer': (item.order.shipping_full_name
                             or (item.order.customer.username if item.order.customer else 'Guest')),
                'product': item.product.title if item.product else item.product_title,
                'amount': float(item.price * item.quantity),
                'status': item.order.status,
                'date': item.order.created_at,
            })
        return out

    @staticmethod
    def _revenue_series(items, range_key, start):
        """Valid sales bucketed for the chart: 7 daily / 30 daily / 12 monthly."""
        valid_items = _valid(items, 'order__')
        now = timezone.now()
        if range_key in ('today', 'week'):
            days = 7
        elif range_key == 'month':
            days = 30
        else:
            days = None  # monthly

        series = []
        if days:
            day_totals = dict(
                valid_items.annotate(d=TruncDay('order__created_at'))
                .values('d').annotate(total=Coalesce(Sum(_line), Value(0), output_field=MONEY))
                .values_list('d', 'total')
            )
            base = now.replace(hour=0, minute=0, second=0, microsecond=0)
            for i in range(days - 1, -1, -1):
                day = (base - timedelta(days=i)).date()
                total = next((v for k, v in day_totals.items() if k and k.date() == day), 0)
                series.append({'label': day.strftime('%d %b' if days > 7 else '%a'),
                               'revenue': float(total or 0)})
        else:
            month_totals = dict(
                valid_items.annotate(m=TruncMonth('order__created_at'))
                .values('m').annotate(total=Coalesce(Sum(_line), Value(0), output_field=MONEY))
                .values_list('m', 'total')
            )
            base = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            months = []
            cursor = base
            for _ in range(12):
                months.append(cursor)
                # step back one month
                prev = (cursor - timedelta(days=1)).replace(day=1)
                cursor = prev
            for m in reversed(months):
                total = next((v for k, v in month_totals.items()
                              if k and k.year == m.year and k.month == m.month), 0)
                series.append({'label': m.strftime('%b'), 'revenue': float(total or 0)})
        return series

    @staticmethod
    def _category_mix(items):
        rows = (
            _valid(items, 'order__')
            .values('product__category_fk__name')
            .annotate(total=Coalesce(Sum(_line), Value(0), output_field=MONEY))
        )
        mix = {}
        for row in rows:
            name = row['product__category_fk__name'] or 'Other'
            mix[name] = mix.get(name, 0) + float(row['total'] or 0)
        grand = sum(mix.values())
        data = []
        if grand > 0:
            for name, total in mix.items():
                data.append({'name': name, 'value': round(total / grand * 100, 1)})
        return sorted(data, key=lambda x: x['value'], reverse=True)[:5]

    @staticmethod
    def _top_products(items):
        rows = (
            _valid(items, 'order__')
            .values('product__title', 'product_title')
            .annotate(sold=Sum('quantity'),
                      revenue=Coalesce(Sum(_line), Value(0), output_field=MONEY))
            .order_by('-sold')[:5]
        )
        out = []
        for row in rows:
            out.append({
                'name': row['product__title'] or row['product_title'] or 'Product',
                'sold': int(row['sold'] or 0),
                'revenue': float(row['revenue'] or 0),
            })
        return out
