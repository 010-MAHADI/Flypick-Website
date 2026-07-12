import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  priority: "low" | "medium" | "high" | "urgent";
  product_id?: number | null;
  order_id?: string | null;
  is_read: boolean;
  created_at: string;
  time_ago?: string;
}

const NOTIFICATIONS_URL = "/notifications/notifications/";

export const useNotifications = (options?: { limit?: number; enabled?: boolean }) =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<AppNotification[]> => {
      const response = await api.get(NOTIFICATIONS_URL);
      const payload = response.data?.results ?? response.data;
      return Array.isArray(payload) ? payload : [];
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 60_000,
    select: options?.limit ? (data: AppNotification[]) => data.slice(0, options.limit) : undefined,
  });

export const useUnreadNotificationCount = (enabled = true) =>
  useQuery({
    queryKey: ["notifications_unread_count"],
    queryFn: async (): Promise<number> => {
      const response = await api.get(`${NOTIFICATIONS_URL}unread_count/`);
      return Number(response.data?.unread_count || 0);
    },
    enabled,
    refetchInterval: 60_000,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.post(`${NOTIFICATIONS_URL}${id}/mark_read/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications_unread_count"] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post(`${NOTIFICATIONS_URL}mark_all_read/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications_unread_count"] });
    },
  });
};
