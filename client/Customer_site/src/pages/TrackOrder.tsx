import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, Truck, CheckCircle2, MapPin, Box, ClipboardList, Home, XCircle, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useOrders, OrderTimelineEntry } from "@/context/OrderContext";
import TakaSign from "@/components/TakaSign";
import api from "@/lib/api";

/** The visible fulfilment journey. Backend statuses map onto these steps. */
const STEPS = [
  { label: "Order Placed", desc: "Your order has been placed successfully", icon: Box, statuses: ["pending"] },
  { label: "Confirmed", desc: "Seller has confirmed your order", icon: CheckCircle2, statuses: ["confirmed"] },
  { label: "Processing", desc: "Your order is being prepared", icon: ClipboardList, statuses: ["processing", "packed"] },
  { label: "Shipped", desc: "Your order is on its way", icon: Truck, statuses: ["shipped"] },
  { label: "Out for Delivery", desc: "Your package arrives today", icon: MapPin, statuses: ["out_for_delivery"] },
  { label: "Delivered", desc: "Package has been delivered", icon: Home, statuses: ["delivered", "completed"] },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
  returned: "Returned",
  refunded: "Refunded",
};

const getActiveStep = (status: string) => {
  const idx = STEPS.findIndex((s) => s.statuses.includes(status));
  return idx;
};

const TrackOrder = () => {
  const { orderId } = useParams();
  const { orders } = useOrders();
  const order = orders.find((o) => o.order_id === orderId);

  const { data: timeline } = useQuery({
    queryKey: ["order-timeline", order?.id],
    queryFn: async () => {
      const response = await api.get(`/orders/orders/${order!.id}/timeline/`);
      return response.data as {
        status: string;
        tracking_number: string | null;
        courier_name: string | null;
        estimated_delivery_date: string | null;
        history: OrderTimelineEntry[];
      };
    },
    enabled: !!order?.id,
  });

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[1440px] mx-auto px-4 py-20 text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Order not found</h2>
          <Link to="/orders" className="text-primary font-medium hover:underline">Back to Orders</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const currentStatus = timeline?.status || order.status;
  const isCancelled = ["cancelled", "failed"].includes(currentStatus);
  const activeStep = getActiveStep(currentStatus);
  const history = timeline?.history || [];

  // Real timestamp for each reached step, from the audit history
  const stepTimestamp = (statuses: string[]) => {
    const entry = [...history].reverse().find((h) => statuses.includes(h.to_status));
    return entry ? new Date(entry.created_at) : null;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="max-w-[700px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <Link to={`/order/${order.order_id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Order Details
        </Link>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4">
          <h1 className="text-lg sm:text-xl font-bold mb-1">Track Order</h1>
          <p className="text-sm text-muted-foreground">
            Order <span className="font-mono font-bold text-foreground">{order.order_id}</span>
          </p>
          <div className="mt-3 bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              {order.items[0] && (
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                  <img
                    src={order.items[0].product_details?.image_url || order.items[0].product_image_url || order.items[0].product_details?.image || "/placeholder.svg"}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">
                  {order.items[0]?.product_details?.title || order.items[0]?.product_title}
                  {order.items.length > 1 && <span className="text-muted-foreground"> +{order.items.length - 1} more</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total: <TakaSign />{parseFloat(order.total_amount || "0").toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Shipment details from the seller */}
          {(timeline?.tracking_number || timeline?.courier_name || timeline?.estimated_delivery_date) && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {timeline?.courier_name && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Courier</p>
                  <p className="text-sm font-bold">{timeline.courier_name}</p>
                </div>
              )}
              {timeline?.tracking_number && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Tracking #</p>
                  <p className="text-sm font-bold font-mono break-all">{timeline.tracking_number}</p>
                </div>
              )}
              {timeline?.estimated_delivery_date && (
                <div className="bg-success/5 border border-success/20 rounded-lg p-2.5 col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Est. Delivery</p>
                  <p className="text-sm font-bold">
                    {new Date(timeline.estimated_delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-4 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-destructive">
                This order was {currentStatus === "failed" ? "unsuccessful" : "cancelled"}
              </p>
              {order.cancellation_reason && (
                <p className="text-xs text-muted-foreground mt-0.5">Reason: {order.cancellation_reason}</p>
              )}
            </div>
          </div>
        )}

        {/* Progress steps */}
        {!isCancelled && (
          <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4">
            <h2 className="font-bold mb-6">Shipping Progress</h2>
            <div className="relative">
              {STEPS.map((step, idx) => {
                const isCompleted = idx <= activeStep;
                const isCurrent = idx === activeStep;
                const StepIcon = step.icon;
                const timestamp = stepTimestamp(step.statuses);

                return (
                  <div key={step.label} className="flex gap-4 pb-8 last:pb-0 relative">
                    {idx < STEPS.length - 1 && (
                      <div className={`absolute left-[19px] top-10 w-0.5 h-[calc(100%-28px)] ${
                        idx < activeStep ? "bg-primary" : "bg-border"
                      }`} />
                    )}

                    <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                        : isCompleted
                          ? "bg-primary/10 text-primary border-primary"
                          : "bg-muted text-muted-foreground border-border"
                    }`}>
                      <StepIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 pt-1.5">
                      <p className={`text-sm font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                      {timestamp && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full tracking history (audit log) */}
        {history.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary" />
              <h2 className="font-bold">Tracking History</h2>
            </div>
            <div className="space-y-3">
              {[...history].reverse().map((entry) => (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {STATUS_LABELS[entry.to_status] || entry.to_status}
                      <span className="text-xs text-muted-foreground font-normal"> · by {entry.changed_by_name}</span>
                    </p>
                    {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(entry.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Delivery Address</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p className="text-foreground font-medium">{order.shipping_full_name}</p>
            <p>{order.shipping_street}, {order.shipping_city}</p>
            <p>{order.shipping_country}</p>
            {order.delivery_instructions && (
              <p className="text-xs mt-2 p-2 bg-muted/50 rounded-lg">
                <span className="font-semibold text-foreground">Instructions:</span> {order.delivery_instructions}
              </p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TrackOrder;
