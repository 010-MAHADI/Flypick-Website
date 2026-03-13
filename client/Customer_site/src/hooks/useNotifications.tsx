import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  order_id?: string;
  product_id?: number;
  coupon_code?: string;
  is_read: boolean;
  is_deleted: boolean;
  action_url?: string;
  action_text?: string;
  metadata: Record<string, any>;
  created_at: string;
  read_at?: string;
  time_ago: string;
}

export interface NotificationPreferences {
  email_order_updates: boolean;
  email_promotions: boolean;
  email_price_alerts: boolean;
  email_stock_alerts: boolean;
  app_order_updates: boolean;
  app_promotions: boolean;
  app_price_alerts: boolean;
  app_stock_alerts: boolean;
  push_enabled: boolean;
  push_order_updates: boolean;
  push_promotions: boolean;
}

export const useNotifications = (filters?: {
  is_read?: boolean;
  type?: string;
  priority?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (filters?.is_read !== undefined) queryParams.append('is_read', filters.is_read.toString());
  if (filters?.type) queryParams.append('type', filters.type);
  if (filters?.priority) queryParams.append('priority', filters.priority);

  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: async (): Promise<Notification[]> => {
      const response = await api.get(`/notifications/notifications/?${queryParams.toString()}`);
      return response.data.results || response.data;
    },
  });
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const response = await api.get('/notifications/notifications/unread_count/');
      return response.data.unread_count;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useNotificationSummary = () => {
  return useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: async () => {
      const response = await api.get('/notifications/notifications/summary/');
      return response.data;
    },
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await api.post(`/notifications/notifications/${notificationId}/mark_read/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAsUnread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await api.post(`/notifications/notifications/${notificationId}/mark_unread/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/notifications/notifications/mark_all_read/');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await api.delete(`/notifications/notifications/${notificationId}/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async (): Promise<NotificationPreferences> => {
      const response = await api.get('/notifications/preferences/');
      return response.data;
    },
  });
};

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) => {
      const response = await api.patch('/notifications/preferences/', preferences);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
};