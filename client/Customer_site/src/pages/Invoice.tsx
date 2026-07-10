import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Package } from "lucide-react";
import { useOrders } from "@/context/OrderContext";
import TakaSign from "@/components/TakaSign";

/**
 * Print-friendly invoice. The action bar is hidden when printing, so
 * "Print / Save as PDF" produces a clean A4 document.
 */
const Invoice = () => {
  const { orderId } = useParams();
  const { orders } = useOrders();
  const order = orders.find((o) => o.order_id === orderId);

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Package className="w-12 h-12 text-muted-foreground" />
        <p className="font-bold">Invoice not found</p>
        <Link to="/orders" className="text-sm font-semibold text-primary hover:underline">Back to Orders</Link>
      </div>
    );
  }

  const subtotal = parseFloat(order.subtotal || "0");
  const shipping = parseFloat(order.shipping_cost || "0");
  const discount = parseFloat(order.discount || "0");
  const storeCredit = parseFloat(order.store_credit_used || "0");
  const total = parseFloat(order.total_amount || "0");

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      {/* Action bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/orders" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-[720px] mx-auto p-4 sm:p-8 print:p-0">
        <div className="bg-card rounded-2xl shadow-sm print:shadow-none p-6 sm:p-10">
          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b-2 border-foreground">
            <div>
              <p className="text-2xl font-black tracking-tight text-primary">
                Fly<span className="text-foreground">pick</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">www.flypick.shop</p>
            </div>
            <div className="text-right">
              <h1 className="text-xl font-black uppercase tracking-widest">Invoice</h1>
              <p className="text-sm font-mono font-bold mt-1">{order.order_id}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-6 py-6 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Billed & Shipped To</p>
              <p className="font-bold">{order.shipping_full_name}</p>
              <p className="text-muted-foreground">{order.shipping_phone}</p>
              <p className="text-muted-foreground">{order.shipping_street}</p>
              <p className="text-muted-foreground">
                {order.shipping_city}
                {order.shipping_state ? `, ${order.shipping_state}` : ""} {order.shipping_zip_code}
              </p>
              <p className="text-muted-foreground">{order.shipping_country}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Payment</p>
              <p className="font-bold capitalize">{order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method}</p>
              <p className={`text-xs font-bold mt-0.5 ${order.payment_status === "paid" ? "text-success" : "text-secondary"}`}>
                {order.payment_status === "paid" ? "PAID" : order.payment_status.toUpperCase()}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-1">Status</p>
              <p className="text-xs font-bold capitalize">{order.status.replace(/_/g, " ")}</p>
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-2 font-bold">Item</th>
                <th className="py-2 px-2 font-bold text-center">Qty</th>
                <th className="py-2 px-2 font-bold text-right">Unit Price</th>
                <th className="py-2 pl-2 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-2">
                    <p className="font-medium leading-snug">{item.product_title}</p>
                    {(item.color || item.size) && (
                      <p className="text-xs text-muted-foreground">
                        {[item.color, item.size].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center">{item.quantity}</td>
                  <td className="py-2.5 px-2 text-right">
                    <TakaSign />
                    {parseFloat(item.price).toLocaleString()}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-semibold">
                    <TakaSign />
                    {(parseFloat(item.price) * item.quantity).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span><TakaSign />{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? "Free" : <><TakaSign />{shipping.toLocaleString()}</>}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                  <span>−<TakaSign />{discount.toLocaleString()}</span>
                </div>
              )}
              {storeCredit > 0 && (
                <div className="flex justify-between text-success">
                  <span>Store credit</span>
                  <span>−<TakaSign />{storeCredit.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base border-t-2 border-foreground pt-2 mt-2">
                <span>Total</span>
                <span><TakaSign />{total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {order.order_notes && (
            <div className="mt-6 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Order notes: </span>
              {order.order_notes}
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground mt-10 pt-4 border-t border-border">
            Thank you for shopping with Flypick! · This is a computer-generated invoice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
