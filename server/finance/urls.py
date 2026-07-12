from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'seller/withdrawals', views.SellerWithdrawalViewSet, basename='seller-withdrawal')
router.register(r'admin/withdrawals', views.AdminWithdrawalViewSet, basename='admin-withdrawal')
router.register(r'admin/coupons', views.AdminCouponViewSet, basename='admin-coupon')

urlpatterns = [
    path('seller/wallet/', views.seller_wallet_view, name='seller-wallet'),
    path('admin/summary/', views.admin_summary_view, name='finance-admin-summary'),
    path('admin/ledger/', views.admin_ledger_view, name='finance-admin-ledger'),
    path('admin/history/<str:category>/', views.account_history_view, name='finance-account-history'),
    path('admin/deposit/', views.admin_deposit_view, name='finance-admin-deposit'),
    path('admin/seller-deposit/', views.admin_seller_deposit_view, name='finance-seller-deposit'),
    path('admin/settlement-report/', views.settlement_report_view, name='finance-settlement-report'),
    path('', include(router.urls)),
]
