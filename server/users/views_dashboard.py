from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta, datetime
from products.models import Shop, Product, Category
from orders.models import Order, OrderItem
from django.contrib.auth import get_user_model
from .roles import is_admin_user
from decimal import Decimal

User = get_user_model()

class DashboardStatsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _shop_scoped_stats(self, shop_ids):
        order_items = OrderItem.objects.filter(product__shop_id__in=shop_ids)
        orders = Order.objects.filter(items__product__shop_id__in=shop_ids).distinct()
        total_revenue = sum(item.price * item.quantity for item in order_items)
        total_orders = orders.count()
        total_customers = orders.values('customer').distinct().count()
        active_products = Product.objects.filter(shop_id__in=shop_ids).count()

        # Recent orders
        recent_order_items = (
            order_items
            .select_related('order', 'order__customer', 'product')
            .order_by('-order__created_at')[:5]
        )
        recent = []
        for item in recent_order_items:
            recent.append({
                'id': item.order.id,
                'customer': item.order.customer.username if item.order.customer else 'Guest',
                'product': item.product.title if item.product else item.product_title,
                'amount': float(item.price * item.quantity),
                'status': item.order.status,
                'date': item.order.created_at
            })

        # Revenue overview data (last 30 days)
        now = timezone.now()
        revenue_data = []
        for i in range(7):  # Last 7 days
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            day_orders = orders.filter(created_at__range=[day_start, day_end])
            day_revenue = sum(
                item.price * item.quantity 
                for item in order_items.filter(order__in=day_orders)
            )
            
            revenue_data.append({
                'label': day.strftime('%a'),
                'revenue': float(day_revenue)
            })
        
        revenue_data.reverse()  # Show oldest to newest

        # Sales by category
        category_sales = {}
        for item in order_items.select_related('product', 'product__category_fk'):
            if item.product and item.product.category_fk:
                category_name = item.product.category_fk.name
                if category_name not in category_sales:
                    category_sales[category_name] = 0
                category_sales[category_name] += float(item.price * item.quantity)
            else:
                # Handle products without category
                if 'Other' not in category_sales:
                    category_sales['Other'] = 0
                category_sales['Other'] += float(item.price * item.quantity)

        # Convert to percentage
        total_category_sales = sum(category_sales.values())
        category_data = []
        if total_category_sales > 0:
            for category, sales in category_sales.items():
                percentage = (sales / total_category_sales) * 100
                category_data.append({
                    'name': category,
                    'value': round(percentage, 1)
                })
        
        # Sort by value and take top 5
        category_data = sorted(category_data, key=lambda x: x['value'], reverse=True)[:5]

        # Top products
        product_sales = {}
        for item in order_items.select_related('product'):
            product_title = item.product.title if item.product else item.product_title
            if product_title not in product_sales:
                product_sales[product_title] = {'sold': 0, 'revenue': 0}
            
            product_sales[product_title]['sold'] += item.quantity
            product_sales[product_title]['revenue'] += float(item.price * item.quantity)

        top_products = []
        for product, data in sorted(product_sales.items(), key=lambda x: x[1]['sold'], reverse=True)[:5]:
            top_products.append({
                'name': product,
                'sold': data['sold'],
                'revenue': f"${data['revenue']:.2f}"
            })

        return {
            'stats': {
                'totalRevenue': f"${total_revenue:.2f}",
                'totalOrders': total_orders,
                'totalCustomers': total_customers,
                'activeProducts': active_products,
            },
            'recentOrders': recent,
            'revenueData': revenue_data,
            'categoryData': category_data,
            'topProducts': top_products,
        }

    def get(self, request):
        user = request.user
        shop_id = request.query_params.get('shop')
        
        # Admin stats vs Seller stats
        if is_admin_user(user):
            if shop_id:
                return Response(self._shop_scoped_stats([shop_id]))

            total_revenue = Order.objects.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            total_orders = Order.objects.count()
            total_customers = User.objects.filter(role='Customer').count()
            total_sellers = User.objects.filter(role='Seller').count()
            active_products = Product.objects.count()
            
            # Recent orders
            recent_orders = Order.objects.order_by('-created_at')[:5].values(
                'id', 'customer__username', 'total_amount', 'status', 'created_at'
            )

            # Revenue overview data (last 7 days for admin)
            now = timezone.now()
            revenue_data = []
            for i in range(7):
                day = now - timedelta(days=i)
                day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                day_revenue = Order.objects.filter(
                    created_at__range=[day_start, day_end]
                ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
                
                revenue_data.append({
                    'label': day.strftime('%a'),
                    'revenue': float(day_revenue)
                })
            
            revenue_data.reverse()

            # Sales by category (admin view)
            category_sales = {}
            order_items = OrderItem.objects.select_related('product', 'product__category_fk')
            
            for item in order_items:
                if item.product and item.product.category_fk:
                    category_name = item.product.category_fk.name
                    if category_name not in category_sales:
                        category_sales[category_name] = 0
                    category_sales[category_name] += float(item.price * item.quantity)
                else:
                    if 'Other' not in category_sales:
                        category_sales['Other'] = 0
                    category_sales['Other'] += float(item.price * item.quantity)

            # Convert to percentage
            total_category_sales = sum(category_sales.values())
            category_data = []
            if total_category_sales > 0:
                for category, sales in category_sales.items():
                    percentage = (sales / total_category_sales) * 100
                    category_data.append({
                        'name': category,
                        'value': round(percentage, 1)
                    })
            
            category_data = sorted(category_data, key=lambda x: x['value'], reverse=True)[:5]

            # Top products (admin view)
            product_sales = {}
            for item in order_items.select_related('product'):
                product_title = item.product.title if item.product else item.product_title
                if product_title not in product_sales:
                    product_sales[product_title] = {'sold': 0, 'revenue': 0}
                
                product_sales[product_title]['sold'] += item.quantity
                product_sales[product_title]['revenue'] += float(item.price * item.quantity)

            top_products = []
            for product, data in sorted(product_sales.items(), key=lambda x: x[1]['sold'], reverse=True)[:5]:
                top_products.append({
                    'name': product,
                    'sold': data['sold'],
                    'revenue': f"${data['revenue']:.2f}"
                })
            
            return Response({
                'stats': {
                    'totalRevenue': f"${total_revenue:.2f}",
                    'totalOrders': total_orders,
                    'totalCustomers': total_customers,
                    'totalSellers': total_sellers,
                    'activeProducts': active_products
                },
                'recentOrders': list(recent_orders),
                'revenueData': revenue_data,
                'categoryData': category_data,
                'topProducts': top_products,
            })
            
        elif user.role == 'Seller':
            try:
                # Get shop IDs - either specific shop or all user's shops
                if shop_id:
                    shop_ids = [shop_id]
                else:
                    shop_ids = list(user.shops.values_list('id', flat=True))

                return Response(self._shop_scoped_stats(shop_ids))
                
            except Exception as e:
                return Response({'error': str(e)}, status=400)
                
        return Response({'error': 'Unauthorized'}, status=403)
