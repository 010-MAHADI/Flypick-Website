from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, PaymentMethodViewSet, RefundViewSet, ReturnRequestViewSet, wallet_view
from .payment_views import (
    InitiatePaymentView,
    RetryPaymentView,
    VerifyPaymentView,
    UddoktaPayIPNView,
    PaymentSuccessView,
    PaymentCancelView,
)

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'returns', ReturnRequestViewSet, basename='return')
router.register(r'refunds', RefundViewSet, basename='refund')

urlpatterns = [
    path('wallet/', wallet_view, name='wallet'),
    path('', include(router.urls)),
    # UddoktaPay payment gateway endpoints
    path('payments/initiate/', InitiatePaymentView.as_view(), name='payment-initiate'),
    path('payments/retry/', RetryPaymentView.as_view(), name='payment-retry'),
    path('payments/verify/', VerifyPaymentView.as_view(), name='payment-verify'),
    path('payments/ipn/', UddoktaPayIPNView.as_view(), name='payment-ipn'),
    path('payments/success/', PaymentSuccessView.as_view(), name='payment-success'),
    path('payments/cancel/', PaymentCancelView.as_view(), name='payment-cancel'),
]
