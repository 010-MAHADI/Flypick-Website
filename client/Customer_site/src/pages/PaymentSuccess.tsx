import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Package } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import api from "@/lib/api";
import TakaSign from "@/components/TakaSign";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId   = searchParams.get("order_id");
  const invoiceId = searchParams.get("invoice_id");
  const statusParam = searchParams.get("status"); // 'completed' | 'cancelled' | etc.

  const [order, setOrder]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (!orderId) {
      navigate("/orders");
      return;
    }

    const run = async () => {
      try {
        // If UddoktaPay passed invoice_id in the redirect URL, verify immediately.
        // This works even on localhost where the IPN webhook can't reach us.
        if (invoiceId) {
          const resp = await api.post("/orders/payments/verify/", {
            invoice_id: invoiceId,
            order_id: orderId,
          });
          setOrder(resp.data.order);
          return;
        }

        // No invoice_id — fall back to polling (for prod where IPN may arrive first).
        let fetchedOrder: any = null;
        for (let i = 0; i < 8; i++) {
          const resp = await api.get("/orders/orders/");
          const list = resp.data.results || resp.data;
          fetchedOrder = Array.isArray(list)
            ? list.find((o: any) => o.order_id === orderId)
            : null;
          if (fetchedOrder && fetchedOrder.payment_status !== "pending") break;
          await new Promise((r) => setTimeout(r, 1500));
        }

        if (fetchedOrder) {
          setOrder(fetchedOrder);
        } else {
          setError("Order not found. Please check your orders page.");
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to confirm payment. Please check your orders page.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [orderId, invoiceId, navigate]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Confirming your payment…</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  /* ── Error ── */
  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[600px] mx-auto px-4 py-20 text-center">
          <XCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium mb-4">{error || "Something went wrong."}</p>
          <Link to="/orders" className="text-primary font-medium hover:underline">
            View My Orders
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const isPaid   = order.payment_status === "paid";
  const isFailed = order.payment_status === "failed" || order.status === "cancelled";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[700px] mx-auto px-4 py-12">

        {/* Status banner */}
        <div className="text-center mb-8">
          {isPaid ? (
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          ) : isFailed ? (
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          ) : (
            <Loader2 className="w-16 h-16 text-warning mx-auto mb-4 animate-spin" />
          )}

          <h1 className="text-2xl font-bold mb-2">
            {isPaid ? "Payment Successful!" : isFailed ? "Payment Failed" : "Verifying Payment…"}
          </h1>
          <p className="text-muted-foreground">
            {isPaid
              ? "Your payment has been confirmed and your order is being processed."
              : isFailed
              ? "Your payment was not completed. The order has been cancelled."
              : "We are still verifying your payment. Please wait a moment."}
          </p>
          <p className="text-lg font-bold text-primary mt-2">{order.order_id}</p>
        </div>

        {/* Order items */}
        <div className="border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Order Items</h3>
          </div>
          <div className="space-y-3">
            {(order.items || []).map((item: any) => (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={item.product_details?.image || item.product_image_url || "/placeholder.svg"}
                    alt={item.product_title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.product_title}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-bold">
                  <TakaSign />
                  {parseFloat(item.total_price).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Price breakdown */}
          <div className="border-t border-border mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span><TakaSign />{parseFloat(order.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span><TakaSign />{parseFloat(order.shipping_cost).toLocaleString()}</span>
            </div>
            {parseFloat(order.discount) > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>-<TakaSign />{parseFloat(order.discount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">
                <TakaSign />{parseFloat(order.total_amount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment status pill */}
        <div className="flex justify-center mb-6">
          <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${
            isPaid
              ? "bg-success/10 text-success"
              : isFailed
              ? "bg-destructive/10 text-destructive"
              : "bg-warning/10 text-warning"
          }`}>
            {isPaid ? "✓ Payment Confirmed" : isFailed ? "✗ Payment Failed" : "⏳ Pending Confirmation"}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {isFailed ? (
            <Link
              to="/cart"
              className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90"
            >
              Back to Cart
            </Link>
          ) : (
            <>
              <Link
                to="/"
                className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90"
              >
                Continue Shopping
              </Link>
              <Link
                to="/orders"
                className="border-2 border-foreground text-foreground font-bold px-8 py-3 rounded-lg hover:bg-muted"
              >
                View Orders
              </Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default PaymentSuccess;
