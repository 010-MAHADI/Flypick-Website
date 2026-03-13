from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Notification, NotificationPreference
from .serializers import (
    NotificationSerializer, 
    NotificationPreferenceSerializer,
    NotificationCreateSerializer
)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Notification.objects.filter(user=user, is_deleted=False)
        
        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')
        
        # Filter by notification type
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)
        
        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return NotificationCreateSerializer
        return NotificationSerializer

    def create(self, request, *args, **kwargs):
        # Only allow creating notifications for the authenticated user
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification = serializer.save(user=request.user)
        
        output_serializer = NotificationSerializer(notification)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'marked as read'})

    @action(detail=True, methods=['post'])
    def mark_unread(self, request, pk=None):
        """Mark a notification as unread"""
        notification = self.get_object()
        notification.mark_as_unread()
        return Response({'status': 'marked as unread'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read for the current user"""
        count = Notification.objects.filter(
            user=request.user, 
            is_read=False, 
            is_deleted=False
        ).update(is_read=True, read_at=timezone.now())
        
        return Response({'status': f'{count} notifications marked as read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = Notification.objects.filter(
            user=request.user, 
            is_read=False, 
            is_deleted=False
        ).count()
        
        return Response({'unread_count': count})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get notification summary with counts by type and priority"""
        user = request.user
        base_queryset = Notification.objects.filter(user=user, is_deleted=False)
        
        summary = {
            'total': base_queryset.count(),
            'unread': base_queryset.filter(is_read=False).count(),
            'by_type': {},
            'by_priority': {},
            'recent': NotificationSerializer(
                base_queryset.order_by('-created_at')[:5], 
                many=True
            ).data
        }
        
        # Count by type
        for notification_type, _ in Notification.NOTIFICATION_TYPES:
            count = base_queryset.filter(notification_type=notification_type).count()
            if count > 0:
                summary['by_type'][notification_type] = count
        
        # Count by priority
        for priority, _ in Notification.PRIORITY_CHOICES:
            count = base_queryset.filter(priority=priority).count()
            if count > 0:
                summary['by_priority'][priority] = count
        
        return Response(summary)

    def destroy(self, request, *args, **kwargs):
        """Soft delete notification"""
        notification = self.get_object()
        notification.is_deleted = True
        notification.save(update_fields=['is_deleted'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or create notification preferences for the current user"""
        preferences, created = NotificationPreference.objects.get_or_create(
            user=self.request.user
        )
        return preferences

    def list(self, request, *args, **kwargs):
        """Return the user's notification preferences"""
        preferences = self.get_object()
        serializer = self.get_serializer(preferences)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """Update notification preferences"""
        preferences = self.get_object()
        serializer = self.get_serializer(preferences, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)