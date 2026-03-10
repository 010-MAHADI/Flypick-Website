import { Bell, Package, ShoppingCart, Star, AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Notification {
  id: number;
  icon: typeof Bell;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "order" | "product" | "review" | "alert";
}

const initialNotifications: Notification[] = [
  { id: 1, icon: ShoppingCart, title: "New Order", message: "Order #ORD-7291 placed by Sarah Johnson ($129.99)", time: "2 min ago", read: false, type: "order" },
  { id: 2, icon: Star, title: "New Review", message: "5-star review on USB-C PD Charger 120W", time: "15 min ago", read: false, type: "review" },
  { id: 3, icon: AlertTriangle, title: "Low Stock Alert", message: "Ergonomic Mouse Wireless is out of stock", time: "1 hour ago", read: false, type: "alert" },
  { id: 4, icon: ShoppingCart, title: "New Order", message: "Order #ORD-7290 placed by Mike Chen ($89.50)", time: "2 hours ago", read: true, type: "order" },
  { id: 5, icon: Package, title: "Product Update", message: "LED Desk Lamp stock updated to 89 units", time: "3 hours ago", read: true, type: "product" },
  { id: 6, icon: Star, title: "New Review", message: "2-star review on Phone Case Universal — needs attention", time: "5 hours ago", read: true, type: "review" },
  { id: 7, icon: ShoppingCart, title: "Order Cancelled", message: "Order #ORD-7286 cancelled by James Brown", time: "1 day ago", read: true, type: "order" },
];

const iconColor: Record<string, string> = {
  order: "text-primary bg-primary/10",
  product: "text-info bg-info/10",
  review: "text-warning bg-warning/10",
  alert: "text-destructive bg-destructive/10",
};

export default function Notifications() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All marked as read");
  };

  const markRead = (id: number) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header !mb-0">
          <h1>Notifications</h1>
          <p>{unread} unread</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" className="rounded-lg" onClick={markAllRead}>
            <Check className="h-4 w-4 mr-1.5" /> Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`stat-card w-full flex items-start gap-4 text-left transition-all ${!n.read ? "border-l-[3px] border-l-primary" : "opacity-60"}`}
          >
            <div className={`rounded-xl p-2.5 shrink-0 ${iconColor[n.type]}`}>
              <n.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{n.title}</p>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-4">{n.time}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
            </div>
            {!n.read && <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-1.5 ring-2 ring-primary/20" />}
          </button>
        ))}
      </div>
    </div>
  );
}
