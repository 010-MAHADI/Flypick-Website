import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, Copy, ArrowUpDown, RotateCcw, XCircle, CreditCard, Loader2, Check } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useOrders, Order } from "@/context/OrderContext";
import { toast } from "sonner";
import TakaSign from "@/components/TakaSign";
import api from "@/lib/api";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = typeof STATUS_TABS[number]["key"];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/12 text-amber-600",
  processing: "bg-primary/10 text-primary",
  shipped: "bg-blue-500/12 text-blue-600",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: "COD",
  cash_on_delivery: "COD",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Card",
  credit_card: "Card",
  uddoktapay: "Online Payment",
};

const Orders = () => {
  const { orders, loading, cancelOrder } = useOrders();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  const filteredOrders = orders
    .filter((o) => activeTab === "all" || o.status === activeTab)
    .sort((a, b) => {
      const dA = new Date(a.created_at).getTime();
      const dB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dB - dA : dA - dB;
    });

  const getTabCount = (key: TabKey) =>
    key === "all" ? orders.length : orders.filter((o) => o.status === key).length;

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Order ID copied");
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;
    setCancellingOrder(orderId);
    try {
      const success = await cancelOrder(orderId);
      if (success) toast.success("Order cancelled successfully");
      else toast.error("Failed to cancel order. Please try again.");
    } catch {
      toast.error("Failed to cancel order. Please try again.");
    } finally {
      setCancellingOrder(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[980px] mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-mobile-nav md:pb-10">
        <div className="flex items-center justify-between mb-3 sm:mb-5">
          <h1 className="text-xl sm:text-2xl font-extrabold">My Orders</h1>
          <Link to="/returns" className="chip !py-2">
            <RotateCcw className="w-3.5 h-3.5" /> Returns
          </Link>
        </div>

        {/* Status chips */}
        <div className="snap-rail -mx-3 px-3 sm:mx-0 sm:px-0 mb-3">
          {STATUS_TABS.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`chip snap-start flex-shrink-0 !py-2 ${isActive ? "chip-active" : ""}`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sort row */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === "newest" ? "Newest first" : "Oldest first"}
          </button>
          <span className="text-xs text-muted-foreground">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.07)]">
                <div className="skeleton h-4 w-1/3 !rounded-full mb-3" />
                <div className="flex gap-3">
                  <div className="skeleton w-16 h-16" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 !rounded-full" />
                    <div className="skeleton h-3 w-1/2 !rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)]">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-extrabold mb-1">
              {activeTab === "all" ? "No orders yet" : `No ${STATUS_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} orders`}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {activeTab === "all" ? "When you place orders, they'll appear here." : "Orders with this status will appear here."}
            </p>
            <Link to="/" className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full hover:opacity-90 text-sm active:scale-[0.98] transition-all">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onCopyId={handleCopyId}
                onCancelOrder={handleCancelOrder}
                cancellingOrder={cancellingOrder}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

const OrderCard = ({
  order,
  onCopyId,
  onCancelOrder,
  cancellingOrder,
}: {
  order: Order;
  onCopyId: (id: string) => void;
  onCancelOrder: (orderId: string) => void;
  cancellingOrder: string | null;
}) => {
  const [retrying, setRetrying] = useState(false);

  const handleCompletePayment = async () => {
    setRetrying(true);
    try {
      const resp = await api.post("/orders/payments/retry/", {
        order_id: order.order_id,
        frontend_url: window.location.origin,
      });
      if (resp.data.payment_url) {
        window.location.href = resp.data.payment_url;
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to get payment link. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  const statusStyle = STATUS_STYLES[order.status] || "bg-muted text-muted-foreground";
  const needsPayment = order.payment_method === "uddoktapay" && order.payment_status !== "paid" && order.status !== "cancelled";

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)] overflow-hidden">
      {/* Header row */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-2 flex-wrap border-b border-border/60">
        <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full capitalize ${statusStyle}`}>
          {order.status}
        </span>
        {order.payment_method === "uddoktapay" && (
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            order.payment_status === "paid" ? "bg-success/15 text-success" : "bg-secondary/15 text-secondary"
          }`}>
            {order.payment_status === "paid" ? "✓ Paid" : "Payment pending"}
          </span>
        )}
        <button
          onClick={() => onCopyId(order.order_id)}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Copy order ID"
        >
          <span className="font-mono font-bold text-foreground/80">{order.order_id}</span>
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items */}
      <Link to={`/order/${order.order_id}`} className="block px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="space-y-2.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-3 items-center">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={item.product_details?.image || item.product_image_url || "/placeholder.svg"}
                  alt={item.product_title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium line-clamp-1">{item.product_title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ×{item.quantity}
                  {item.color ? ` · ${item.color}` : ""}
                  {item.size ? ` · ${item.size}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-dashed border-border/70">
          <span className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            {order.shipping_city}
          </span>
          <span className="text-base font-extrabold">
            <TakaSign />
            {parseFloat(order.total_amount).toLocaleString()}
          </span>
        </div>
      </Link>

      {/* Actions */}
      <div className="px-4 pb-3.5 flex gap-2">
        <Link
          to={`/order/${order.order_id}`}
          className="flex-1 text-center text-[13px] font-bold py-2.5 rounded-full border border-border text-foreground/80 hover:border-primary/40 hover:text-primary transition-colors"
        >
          View Details
        </Link>

        {needsPayment && (
          <button
            onClick={handleCompletePayment}
            disabled={retrying}
            className="flex-1 text-center text-[13px] font-bold py-2.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            {retrying ? "Loading…" : "Complete Payment"}
          </button>
        )}

        {order.status === "pending" && order.payment_status !== "paid" && (
          <button
            onClick={() => onCancelOrder(order.order_id)}
            disabled={cancellingOrder === order.order_id}
            className="flex-1 text-center text-[13px] font-bold py-2.5 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {cancellingOrder === order.order_id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            {cancellingOrder === order.order_id ? "Cancelling…" : "Cancel"}
          </button>
        )}

        {(order.status === "processing" || order.status === "shipped") && (
          <Link
            to={`/track-order/${order.order_id}`}
            className="flex-1 text-center text-[13px] font-bold py-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Track Order
          </Link>
        )}
        {(order.status === "delivered" || order.status === "shipped") && order.items.length === 1 && (
          <Link
            to={`/write-review/${order.order_id}/${order.items[0].id}`}
            className="flex-1 text-center text-[13px] font-bold py-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Write Review
          </Link>
        )}
      </div>
    </div>
  );
};

export default Orders;
