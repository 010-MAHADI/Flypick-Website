from django.urls import path, include
from rest_framework_nested import routers
from .views import ReviewViewSet

router = routers.SimpleRouter()

# Nested router for product reviews
from products.views import ProductViewSet
products_router = routers.SimpleRouter()
products_router.register(r'products', ProductViewSet, basename='product')

reviews_router = routers.NestedSimpleRouter(products_router, r'products', lookup='product')
reviews_router.register(r'reviews', ReviewViewSet, basename='product-reviews')

urlpatterns = [
    path('', include(reviews_router.urls)),
]
