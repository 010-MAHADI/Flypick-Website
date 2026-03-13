from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PromotionCampaignViewSet, PromotionTemplateViewSet, PromotionAnalyticsViewSet

router = DefaultRouter()
router.register(r'campaigns', PromotionCampaignViewSet, basename='promotion-campaigns')
router.register(r'templates', PromotionTemplateViewSet, basename='promotion-templates')
router.register(r'analytics', PromotionAnalyticsViewSet, basename='promotion-analytics')

urlpatterns = [
    path('', include(router.urls)),
]