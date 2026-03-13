import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Filter, Package, ShoppingCart, Gift, AlertCircle } from "lucide-react";
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
  type Notification 
} from "@/hooks/useNotifications";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

const Notifications = () => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const { isLoggedIn } = useAuth();

  const { data: notifications = [], isLoading } = useNotifications({
    is_read: filter === 'all' ? undefined : filter === 'read',
    type: typeFilter || undefined
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
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold mb-2">Sign in to view notifications</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to your account to view your notifications.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const handleMarkAsRead = (notification: Notification) => {
    if (notification.is_read) {
      markAsUnread.mutate(notification.id);
    } else {
      markAsRead.mutate(notification.id);
    }
  };

  const handleDelete = (notificationId: number) => {
    deleteNotification.mutate(notificationId, {
      onSuccess: () => {
        toast({ title: "Notification deleted" });
      }
    });
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "All notifications marked as read" });
      }
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_confirmed':
      case 'order_shipped':
      case 'order_delivered':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'order_cancelled':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'payment_success':
        return <CheckCheck className="w-5 h-5 text-green-500" />;
      case 'coupon_available':
        return <Gift className="w-5 h-5 text-purple-500" />;
      case 'price_drop':
        return <ShoppingCart className="w-5 h-5 text-orange-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50/50';
      case 'high': return 'border-l-orange-500 bg-orange-50/50';
      case 'medium': return 'border-l-blue-500 bg-blue-50/50';
      default: return 'border-l-gray-300 bg-gray-50/50';
    }
  };

  const filteredNotifications = notifications;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground">
              Stay updated with your orders, offers, and account activity
            </p>
          </div>
          
          {summary && summary.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">{summary.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-primary">{summary.unread}</div>
              <div className="text-sm text-muted-foreground">Unread</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {summary.by_priority?.high || 0}
              </div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {summary.by_type?.order_confirmed || 0}
              </div>
              <div className="text-sm text-muted-foreground">Orders</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter:</span>
          </div>
          
          <div className="flex gap-2">
            {['all', 'unread', 'read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1 text-sm border border-border rounded-md bg-background"
          >
            <option value="">All Types</option>
            <option value="order_confirmed">Orders</option>
            <option value="coupon_available">Coupons</option>
            <option value="price_drop">Price Drops</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-muted rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-full mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No notifications found</h3>
              <p className="text-muted-foreground">
                {filter === 'unread' 
                  ? "You're all caught up! No unread notifications."
                  : "You don't have any notifications yet."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-card border-l-4 border-r border-t border-b rounded-lg p-4 transition-all hover:shadow-md ${
                  getPriorityColor(notification.priority)
                } ${!notification.is_read ? 'shadow-sm' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">
                            {notification.title}
                          </h3>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {notification.time_ago}
                          </span>
                        </div>
                        
                        <p className="text-muted-foreground mb-3">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center gap-4">
                          {notification.action_url && notification.action_text && (
                            <Link
                              to={notification.action_url}
                              className="text-sm text-primary hover:text-primary/80 font-medium"
                            >
                              {notification.action_text} →
                            </Link>
                          )}
                          
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            notification.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            notification.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            notification.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {notification.priority}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkAsRead(notification)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title={notification.is_read ? "Mark as unread" : "Mark as read"}
                        >
                          <Check className={`w-4 h-4 ${notification.is_read ? 'text-green-500' : ''}`} />
                        </button>
                        
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      
      <SiteFooter />
    </div>
  );
};

export default Notifications;