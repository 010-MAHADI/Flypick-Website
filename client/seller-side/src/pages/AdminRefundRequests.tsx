import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Receipt, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  AdminRefund, useAdminRefundQueue, useAllRefunds,
  useRejectRefundAdmin, useSettleRefundAdmin,
} from "@/hooks/useAdminRefunds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const statusBadge: Record<string, string> = {
  approved: "status-badge status-badge--warning",
  completed: "status-badge status-badge--success",
  rejected: "status-badge status-badge--destructive",
  requested: "status-badge",
};

function extractError(error: any, fallback: string) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return fallback;
  const first = data.detail || Object.values(data)[0];
  return Array.isArray(first) ? String(first[0]) : String(first ?? fallback);
}

function RefundTable({ rows, onSettle }: { rows: AdminRefund[]; onSettle?: (r: AdminRefund) => void }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No refunds here.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="py-2 pr-4">Refund</th>
            <th className="py-2 pr-4">Order</th>
            <th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Origin</th>
            <th className="py-2 pr-4">Method</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Settlement</th>
            {onSettle && <th className="py-2 pr-4">Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-0 align-top">
              <td className="py-2.5 pr-4 font-mono text-xs">{r.refund_id}</td>
              <td className="py-2.5 pr-4 font-mono text-xs">{r.order_id}</td>
              <td className="py-2.5 pr-4">{r.customer_name || "—"}</td>
              <td className="py-2.5 pr-4 font-semibold">৳{r.amount}</td>
              <td className="py-2.5 pr-4 capitalize">{r.origin}</td>
              <td className="py-2.5 pr-4 capitalize">{r.method.replace("_", " ")}</td>
              <td className="py-2.5 pr-4"><span className={statusBadge[r.status] ?? "status-badge"}>{r.status}</span></td>
              <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                {r.settlement_transaction_id ? (
                  <>
                    <span className="font-mono">{r.settlement_transaction_id}</span>
                    {r.settlement_proof_url && (
                      <a href={r.settlement_proof_url} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-0.5 text-primary ml-1">
                        proof <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </>
                ) : r.settlement_owner === "seller" ? "Seller settles" : "—"}
              </td>
              {onSettle && (
                <td className="py-2.5 pr-4">
                  {r.status === "approved" && r.settlement_owner === "admin" ? (
                    <Button size="sm" className="h-7 rounded-md" onClick={() => onSettle(r)}>
                      Process
                    </Button>
                  ) : null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminRefundRequests() {
  const { data: queue = [] } = useAdminRefundQueue();
  const { data: all = [] } = useAllRefunds();
  const settle = useSettleRefundAdmin();
  const reject = useRejectRefundAdmin();

  const [active, setActive] = useState<AdminRefund | null>(null);
  const [txnId, setTxnId] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);

  // Clear stuck Radix pointer-events after dialog close + query invalidation.
  useEffect(() => {
    if (!active) {
      const t = setTimeout(() => { document.body.style.pointerEvents = ""; }, 350);
      return () => clearTimeout(t);
    }
  }, [active]);

  const openSettle = (r: AdminRefund) => {
    setActive(r); setTxnId(""); setNote(""); setProof(null);
  };

  const submitSettle = async () => {
    if (!active) return;
    try {
      await settle.mutateAsync({ refundId: active.id, transactionId: txnId.trim(), note: note.trim(), proof });
      toast.success(`Refund ${active.refund_id} completed`);
      setActive(null);
    } catch (error) {
      toast.error(extractError(error, "Failed to complete refund"));
    }
  };

  const rejectRefund = async (r: AdminRefund) => {
    const reason = window.prompt(`Reject refund ${r.refund_id}? Optional note:`);
    if (reason === null) return;
    try {
      await reject.mutateAsync({ refundId: r.id, note: reason });
      toast.success(`Refund ${r.refund_id} rejected`);
    } catch (error) {
      toast.error(extractError(error, "Failed to reject refund"));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header !mb-0">
        <h1>Refund Requests</h1>
        <p>Review and complete online (original-method) refunds through the payment gateway</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Awaiting Processing{queue.length ? ` (${queue.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="all">All Refunds</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <div className="stat-card space-y-4">
            {!queue.length ? (
              <div className="py-10 text-center text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No online refunds are awaiting processing.
              </div>
            ) : (
              <div className="space-y-4">
                {queue.map((r) => (
                  <div key={r.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold">{r.refund_id}</span>
                        <span className={statusBadge[r.status]}>{r.status}</span>
                        <span className="status-badge capitalize">{r.origin}</span>
                        <span className="text-xs text-muted-foreground">Order {r.order_id}</span>
                      </div>
                      <span className="font-bold text-destructive">৳{r.amount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                      <p>Customer: {r.customer_name || "—"} · Paid via {r.payment_method}</p>
                      {r.reason && <p>Reason: {r.reason}</p>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="h-8 rounded-md" onClick={() => openSettle(r)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Process Refund
                      </Button>
                      <Button size="sm" variant="outline"
                        className="h-8 rounded-md text-destructive hover:text-destructive"
                        onClick={() => rejectRefund(r)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="stat-card">
            <RefundTable rows={all} onSettle={openSettle} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Process refund dialog */}
      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund {active?.refund_id}</DialogTitle>
            <DialogDescription>
              Refund ৳{active?.amount} to {active?.customer_name} through the original payment
              method ({active?.payment_method}) in your gateway, then record the transaction
              reference here to complete it. Proof is optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Transaction ID *</label>
              <Input value={txnId} onChange={(e) => setTxnId(e.target.value)}
                placeholder="Gateway refund reference" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment Proof (optional)</label>
              <Input type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={submitSettle} disabled={!txnId.trim() || settle.isPending}>
              {settle.isPending ? "Completing…" : "Complete Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
