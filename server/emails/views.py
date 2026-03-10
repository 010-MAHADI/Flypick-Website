from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import EmailPreference, EmailLog, EmailTemplate
from .serializers import EmailPreferenceSerializer, EmailLogSerializer, EmailTemplateSerializer
from .services import NotificationService

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def email_preferences(request):
    """Get or update user email preferences"""
    preference, created = EmailPreference.objects.get_or_create(user=request.user)
    
    if request.method == 'GET':
        serializer = EmailPreferenceSerializer(preference)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        serializer = EmailPreferenceSerializer(preference, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def email_logs(request):
    """Get user's email logs"""
    logs = EmailLog.objects.filter(recipient_user=request.user).order_by('-sent_at')[:50]
    serializer = EmailLogSerializer(logs, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_email(request):
    """Send a test email to the authenticated user"""
    email_type = request.data.get('type', 'welcome')
    
    notification_service = NotificationService()
    
    try:
        if email_type == 'welcome':
            success = notification_service.send_welcome_email(request.user)
        else:
            return Response(
                {'error': 'Invalid email type'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if success:
            return Response({'message': 'Test email sent successfully'})
        else:
            return Response(
                {'error': 'Failed to send test email'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

class EmailTemplateListView(generics.ListAPIView):
    """List all active email templates (admin only)"""
    queryset = EmailTemplate.objects.filter(is_active=True)
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only allow admin users to view templates
        if self.request.user.is_staff:
            return super().get_queryset()
        return EmailTemplate.objects.none()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resend_email(request, log_id):
    """Resend a failed email"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Permission denied'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    email_log = get_object_or_404(EmailLog, id=log_id)
    
    if email_log.status == 'sent':
        return Response(
            {'error': 'Email was already sent successfully'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    notification_service = NotificationService()
    
    try:
        # Determine the type of email and resend
        if email_log.template_type == 'welcome' and email_log.recipient_user:
            success = notification_service.send_welcome_email(email_log.recipient_user)
        elif email_log.template_type == 'order_confirmation' and email_log.order:
            success = notification_service.send_order_confirmation(email_log.order)
        elif email_log.template_type == 'order_status_update' and email_log.order:
            success = notification_service.send_order_status_update(email_log.order)
        elif email_log.template_type == 'new_order_seller' and email_log.order:
            success = notification_service.send_new_order_notification_to_seller(email_log.order)
        elif email_log.template_type in ['out_of_stock_alert', 'low_stock_alert'] and email_log.product:
            alert_type = 'out_of_stock' if email_log.template_type == 'out_of_stock_alert' else 'low_stock'
            success = notification_service.send_stock_alert(email_log.product, alert_type)
        else:
            return Response(
                {'error': 'Cannot resend this type of email'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if success:
            return Response({'message': 'Email resent successfully'})
        else:
            return Response(
                {'error': 'Failed to resend email'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )