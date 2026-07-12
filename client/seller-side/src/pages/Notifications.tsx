import { AlertTriangle, Bell, Check, Package, ShoppingCart, Star, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type AppNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/useNotifications";

export const notificationIcon = (n: AppNotification) => {
  const type = n.notification_type || "";
  if (type.startsWith("order")) return ShoppingCart;
  if (type.startsWith("payment")) return Tag;
  if (type === "coupon_available") return Tag;
  if (type === "product_back_in_stock" || type === "price_drop" || n.product_id) return Package;
  if (n.priority === "high" || n.priority === "urgent") return AlertTriangle;
  return Bell;
};

export const notificationTone = (n: AppNotification) => {
  if (n.priority === "high" || n.priority === "urgent") return "text-destructive bg-destructive/10";
  const type = n.notification_type || "";
  if (type.startsWith("order")) return "text-primary bg-primary/10";
  if (type.startsWith("payment")) return "text-success bg-success/10";
  if (n.product_id) return "text-info bg-info/10";
  return "text-warning bg-warning/10";
};

export const notificationTime = (n: AppNotification) =>
  n.time_ago || (n.created_at ? new Date(n.created_at).toLocaleString() : "");

export default function Notifications() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unread = notifications.filter((n) => !n.is_read).length;

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success("All marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header !mb-0">
          <h1>Notifications</h1>
          <p>{unread} unread</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" className="rounded-lg" onClick={handleMarkAll} disabled={markAllRead.isPending}>
            <Check className="h-4 w-4 mr-1.5" /> Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="stat-card py-16 text-center text-muted-foreground">
          <Bell className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="mt-1 text-xs">Order updates and admin messages will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = notificationIcon(n);
            return (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                className={`stat-card w-full flex items-start gap-4 text-left transition-all ${!n.is_read ? "border-l-[3px] border-l-primary" : "opacity-60"}`}
              >
                <div className={`rounded-xl p-2.5 shrink-0 ${notificationTone(n)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-4">{notificationTime(n)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                </div>
                {!n.is_read && <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-1.5 ring-2 ring-primary/20" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
