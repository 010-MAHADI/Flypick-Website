from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, PaymentMethodViewSet, ReturnRequestViewSet

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'returns', ReturnRequestViewSet, basename='return')

urlpatterns = [
    path('', include(router.urls)),
]
