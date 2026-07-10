import { useState } from "react";
import { Bell, CheckCheck, Trash2, Package, ShoppingCart, Gift, AlertCircle, MailOpen, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAsUnread,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationSummary,
  type Notification,
} from "@/hooks/useNotifications";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "order_confirmed", label: "Orders" },
  { value: "coupon_available", label: "Coupons" },
  { value: "price_drop", label: "Price drops" },
  { value: "system", label: "System" },
];

const Notifications = () => {
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { isLoggedIn } = useAuth();

  const { data: notifications = [], isLoading } = useNotifications({
    is_read: filter === "all" ? undefined : filter === "read",
    type: typeFilter || undefined,
  });

  const { data: summary } = useNotificationSummary();
  const markAsRead = useMarkAsRead();
  const markAsUnread = useMarkAsUnread();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Bell className="w-9 h-9 text-accent-foreground" />
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold mb-1.5">Sign in to view notifications</h1>
          <p className="text-sm text-muted-foreground mb-6">Order updates, offers and alerts will show up here.</p>
          <Link
            to="/auth"
            className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full hover:opacity-90 text-sm active:scale-[0.98] transition-all"
          >
            Sign In
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const handleToggleRead = (notification: Notification) => {
    if (notification.is_read) markAsUnread.mutate(notification.id);
    else markAsRead.mutate(notification.id);
  };

  const handleDelete = (notificationId: number) => {
    deleteNotification.mutate(notificationId, {
      onSuccess: () => toast({ title: "Notification deleted" }),
    });
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => toast({ title: "All notifications marked as read" }),
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "order_confirmed":
      case "order_shipped":
      case "order_delivered":
        return { icon: Package, cls: "bg-blue-500/12 text-blue-600" };
      case "order_cancelled":
        return { icon: AlertCircle, cls: "bg-destructive/10 text-destructive" };
      case "payment_success":
        return { icon: CheckCheck, cls: "bg-success/15 text-success" };
      case "coupon_available":
        return { icon: Gift, cls: "bg-secondary/15 text-secondary" };
      case "price_drop":
        return { icon: ShoppingCart, cls: "bg-primary/10 text-primary" };
      default:
        return { icon: Bell, cls: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-mobile-nav md:pb-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">Notifications</h1>
            {summary && summary.unread > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-bold text-primary">{summary.unread}</span> unread
              </p>
            )}
          </div>
          {summary && summary.unread > 0 && (
            <button onClick={handleMarkAllRead} className="chip chip-active !py-2 flex-shrink-0">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(["all", "unread", "read"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`chip !py-1.5 capitalize ${filter === f ? "chip-active" : ""}`}>
              {f}
            </button>
          ))}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="ml-auto text-xs font-semibold border border-border rounded-full px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.07)] flex gap-3">
                <div className="skeleton w-10 h-10 !rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="skeleton h-3.5 w-2/3 !rounded-full" />
                  <div className="skeleton h-3 w-full !rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)]">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-extrabold mb-1">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "unread" ? "You're all caught up!" : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notification) => {
              const { icon: Icon, cls } = getIcon(notification.notification_type);
              return (
                <div
                  key={notification.id}
                  className={`bg-card rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.07)] transition-shadow hover:shadow-md ${
                    !notification.is_read ? "ring-1 ring-primary/25" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm ${notification.is_read ? "font-semibold text-foreground/80" : "font-extrabold"}`}>
                          {notification.title}
                        </h3>
                        {!notification.is_read && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                        <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">{notification.time_ago}</span>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{notification.message}</p>

                      <div className="flex items-center gap-3 mt-2">
                        {notification.action_url && notification.action_text && (
                          <Link to={notification.action_url} className="text-xs font-bold text-primary hover:underline">
                            {notification.action_text} →
                          </Link>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => handleToggleRead(notification)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all"
                            title={notification.is_read ? "Mark as unread" : "Mark as read"}
                          >
                            {notification.is_read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                            title="Delete notification"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Notifications;
