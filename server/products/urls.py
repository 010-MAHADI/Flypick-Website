from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ShopViewSet, ProductViewSet
from .upload_views import upload_product_image, upload_product_video, upload_multiple_images
from .category_upload_views import upload_category_image

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'shops', ShopViewSet)
router.register(r'', ProductViewSet)

urlpatterns = [
    path('upload-image/', upload_product_image, name='upload-product-image'),
    path('upload-video/', upload_product_video, name='upload-product-video'),
    path('upload-images/', upload_multiple_images, name='upload-multiple-images'),
    path('upload-category-image/', upload_category_image, name='upload-category-image'),
    path('', include(router.urls)),
]
