import { useState } from "react";
import {
  Activity, Clock, CreditCard, History, ListChecks, LucideIcon,
  Package, Receipt, Search, Store, Truck, User,
} from "lucide-react";
import { toast } from "sonner";

import {
  AdminOrder, useAdminOrderSearch, useAdminPaymentAction,
} from "@/hooks/useAdminOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const paymentBadge: Record<string, string> = {
  paid: "status-badge status-badge--success",
  pending: "status-badge status-badge--warning",
  failed: "status-badge status-badge--destructive",
  refunded: "status-badge status-badge--destructive",
};

function extractError(error: any, fallback: string) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return fallback;
  const first = data.detail || Object.values(data)[0];
  return Array.isArray(first) ? String(first[0]) : String(first ?? fallback);
}

function TimelineCard({ title, icon: Icon, rows }: {
  title: string; icon: LucideIcon;
  rows: Array<{ label: string; note?: string; at: string }>;
}) {
  return (
    <div className="stat-card">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" /> {title}
      </h2>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground py-2 text-center">Nothing yet.</p>
      ) : (
        <ol className="relative border-l border-border ml-1.5 space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="ml-4">
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary/60 border-2 border-background" />
              <p className="text-sm font-medium capitalize">{r.label.replace(/_/g, " ")}</p>
              {r.note && <p className="text-[11px] text-muted-foreground">{r.note}</p>}
              <p className="text-[10px] text-muted-foreground/70">{new Date(r.at).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function AdminOrders() {
  const search = useAdminOrderSearch();
  const paymentAction = useAdminPaymentAction();

  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<AdminOrder | null>(null);

  // payment edit dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payStatus, setPayStatus] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [payNote, setPayNote] = useState("");

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const id = query.trim();
    if (!id) return;
    try {
      const result = await search.mutateAsync(id);
      setOrder(result);
    } catch (error) {
      setOrder(null);
      toast.error(extractError(error, "Order not found"));
    }
  };

  const openPayDialog = () => {
    if (!order) return;
    setPayStatus(order.payment_status);
    setPayMethod(order.payment_method);
    setPayNote("");
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!order) return;
    try {
      const updated = await paymentAction.mutateAsync({
        id: order.id,
        payment_status: payStatus,
        payment_method: payMethod,
        note: payNote.trim(),
      });
      setOrder(updated);
      setPayOpen(false);
      toast.success("Payment updated");
    } catch (error) {
      toast.error(extractError(error, "Failed to update payment"));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header !mb-0">
        <h1>Admin Orders</h1>
        <p>Look up any order and manage its payment &amp; financial history</p>
      </div>

      <form onSubmit={runSearch} className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Order ID (e.g. FP1A2B3C4D5E)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={search.isPending}>
          {search.isPending ? "Searching…" : "Search"}
        </Button>
      </form>

      {!order ? (
        <div className="stat-card py-12 text-center text-muted-foreground">
          Enter an Order ID above to view its full details, payment information and financial history.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header row */}
          <div className="stat-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono">{order.order_id}</span>
                <span className={paymentBadge[order.payment_status] ?? "status-badge"}>
                  {order.payment_status}
                </span>
                <span className="status-badge">{order.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Placed {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
            <Button size="sm" onClick={openPayDialog}>
              <CreditCard className="h-4 w-4 mr-1.5" /> Manage Payment
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Customer + shipping */}
            <div className="stat-card space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Customer
              </h2>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{order.shipping_full_name || order.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{order.customer_email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{order.shipping_phone}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">City</span><span>{order.shipping_city}</span></div>
              </div>
            </div>

            {/* Payment */}
            <div className="stat-card space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Payment
              </h2>
              <div className="text-sm space-y-1">
                {order.shipping_method && (
                  <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{order.shipping_method}</p>
                    {order.shipping_estimated_delivery && <p>Estimated delivery: {order.shipping_estimated_delivery}</p>}
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{order.payment_method}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={paymentBadge[order.payment_status] ?? ""}>{order.payment_status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>৳{order.subtotal}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>৳{order.shipping_cost}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>৳{order.discount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Store credit</span><span>৳{order.store_credit_used}</span></div>
                <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>৳{order.total_amount}</span></div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="stat-card">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" /> Items
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-1.5 pr-3">Product</th>
                  <th className="py-1.5 pr-3">Qty</th>
                  <th className="py-1.5 pr-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3">{item.product_title}</td>
                    <td className="py-2 pr-3">{item.quantity}</td>
                    <td className="py-2 pr-3 text-right">৳{item.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shipment */}
          {(order.tracking_number || order.courier_name) && (
            <div className="stat-card space-y-1 text-sm">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-muted-foreground" /> Shipment
              </h2>
              <div className="flex justify-between"><span className="text-muted-foreground">Courier</span><span>{order.courier_name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tracking</span><span>{order.tracking_number || "—"}</span></div>
            </div>
          )}

          {/* Refunds */}
          {order.refunds && order.refunds.length > 0 && (
            <div className="stat-card">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-muted-foreground" /> Refunds
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-1.5 pr-3">Refund ID</th>
                    <th className="py-1.5 pr-3">Amount</th>
                    <th className="py-1.5 pr-3">Method</th>
                    <th className="py-1.5 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {order.refunds.map((r) => (
                    <tr key={r.refund_id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 font-mono">{r.refund_id}</td>
                      <td className="py-2 pr-3">৳{r.amount}</td>
                      <td className="py-2 pr-3">{r.method}</td>
                      <td className="py-2 pr-3">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Financial history */}
          <div className="stat-card">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-muted-foreground" /> Financial History
            </h2>
            {!order.financial_history?.length ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                No ledger activity for this order yet.
              </p>
            ) : (
              <div className="space-y-4">
                {order.financial_history.map((txn) => (
                  <div key={txn.transaction_id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{txn.txn_type}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(txn.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">{txn.notes}</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-3">Account</th>
                          <th className="py-1 pr-3">Owner</th>
                          <th className="py-1 pr-3 text-right">Debit</th>
                          <th className="py-1 pr-3 text-right">Credit</th>
                          <th className="py-1 pr-3 text-right">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txn.entries.map((entry) => (
                          <tr key={entry.id} className="border-t border-border/40">
                            <td className="py-1 pr-3">{entry.account_type}</td>
                            <td className="py-1 pr-3">{entry.account_owner || "—"}</td>
                            <td className="py-1 pr-3 text-right text-destructive">
                              {parseFloat(entry.debit) > 0 ? `৳${entry.debit}` : ""}
                            </td>
                            <td className="py-1 pr-3 text-right text-success">
                              {parseFloat(entry.credit) > 0 ? `৳${entry.credit}` : ""}
                            </td>
                            <td className="py-1 pr-3 text-right">৳{entry.balance_after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sellers */}
          {order.sellers && order.sellers.length > 0 && (
            <div className="stat-card">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Store className="h-4 w-4 text-muted-foreground" /> Seller(s)
              </h2>
              <div className="text-sm space-y-1">
                {order.sellers.map((s) => (
                  <div key={s.seller_email} className="flex justify-between">
                    <span>{s.shop} — {s.seller_name}</span>
                    <span className="text-muted-foreground">{s.seller_email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TimelineCard title="Payment Timeline" icon={CreditCard}
              rows={(order.payment_timeline || []).map((e) => ({
                label: e.event, note: e.note, at: e.created_at }))} />
            <TimelineCard title="Tracking Timeline" icon={Truck}
              rows={(order.tracking_timeline || []).map((e) => ({
                label: e.to_status, note: e.note || `by ${e.actor}`, at: e.created_at }))} />
            <TimelineCard title="Status History" icon={Clock}
              rows={(order.status_history || []).map((e) => ({
                label: `${e.from_status || "—"} → ${e.to_status}`,
                note: e.note ? `${e.note} · ${e.actor}` : e.actor, at: e.created_at }))} />
            <TimelineCard title="Seller Activities" icon={Activity}
              rows={(order.seller_activities || []).map((e) => ({
                label: `${e.from_status || "—"} → ${e.to_status}`, note: e.note, at: e.created_at }))} />
          </div>

          {/* Operation logs */}
          <div className="stat-card">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-muted-foreground" /> Operation Logs
            </h2>
            {!order.operation_logs?.length ? (
              <p className="text-sm text-muted-foreground py-2 text-center">No operations logged.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3">When</th>
                      <th className="py-1.5 pr-3">Action</th>
                      <th className="py-1.5 pr-3">By</th>
                      <th className="py-1.5 pr-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.operation_logs.map((log, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-1.5 pr-3">{log.action}</td>
                        <td className="py-1.5 pr-3">{log.actor}</td>
                        <td className="py-1.5 pr-3">{log.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manage payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Payment — {order?.order_id}</DialogTitle>
            <DialogDescription>
              Admin-only payment correction. Setting the status to “paid” posts the order to the
              finance ledger. Sellers cannot change payment information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment Status</label>
              <Select value={payStatus} onValueChange={setPayStatus}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
              <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={paymentAction.isPending}>
              {paymentAction.isPending ? "Saving…" : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
