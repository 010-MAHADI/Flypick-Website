from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from products.models import Shop, Product
from orders.models import Order, OrderItem
from django.contrib.auth import get_user_model
from .roles import is_admin_user

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

        return {
            'stats': {
                'totalRevenue': f"${total_revenue:.2f}",
                'totalOrders': total_orders,
                'totalCustomers': total_customers,
                'activeProducts': active_products,
            },
            'recentOrders': recent,
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
            
            return Response({
                'stats': {
                    'totalRevenue': f"${total_revenue:.2f}",
                    'totalOrders': total_orders,
                    'totalCustomers': total_customers,
                    'totalSellers': total_sellers,
                    'activeProducts': active_products
                },
                'recentOrders': list(recent_orders)
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
