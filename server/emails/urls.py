from django.urls import path
from . import views

urlpatterns = [
    path('preferences/', views.email_preferences, name='email_preferences'),
    path('logs/', views.email_logs, name='email_logs'),
    path('test/', views.test_email, name='test_email'),
    path('templates/', views.EmailTemplateListView.as_view(), name='email_templates'),
    path('resend/<int:log_id>/', views.resend_email, name='resend_email'),
]