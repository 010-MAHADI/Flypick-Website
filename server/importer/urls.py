from django.urls import path

from .views import (
    ImportJobListView,
    ImportPreviewView,
    ImportSaveView,
    ProductSourceDetailView,
    ProductSourcesView,
    SupportedSitesView,
)

urlpatterns = [
    path('sources/', SupportedSitesView.as_view(), name='importer-sources'),
    path('preview/', ImportPreviewView.as_view(), name='importer-preview'),
    path('save/', ImportSaveView.as_view(), name='importer-save'),
    path('jobs/', ImportJobListView.as_view(), name='importer-jobs'),
    path('products/<int:product_id>/sources/', ProductSourcesView.as_view(), name='importer-product-sources'),
    path('product-sources/<int:source_id>/', ProductSourceDetailView.as_view(), name='importer-source-detail'),
    path('product-sources/<int:source_id>/sync/', ProductSourceDetailView.as_view(), name='importer-source-sync'),
]
