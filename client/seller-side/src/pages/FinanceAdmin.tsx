import { useEffect, useState } from "react";
import {
  Banknote, CheckCircle2, Landmark, PiggyBank, Plus,
  TicketPercent, Wallet2, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  AdminCoupon, WithdrawalRequest,
  useAccountHistory, useAdminCouponAction, useAdminCoupons, useAdminDeposit,
  useAdminFinanceSummary, useAdminWithdrawals, useApproveWithdrawal,
  useRejectWithdrawal, useSaveAdminCoupon, useSettlementReport,
} from "@/hooks/useFinance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const wdBadge: Record<string, string> = {
  requested: "status-badge status-badge--warning",
  approved: "status-badge status-badge--success",
  rejected: "status-badge status-badge--destructive",
};

const couponBadge: Record<string, string> = {
  draft: "status-badge",
  active: "status-badge status-badge--success",
  paused: "status-badge status-badge--warning",
  expired: "status-badge status-badge--destructive",
  disabled: "status-badge status-badge--destructive",
};

function extractError(error: any, fallback: string) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return fallback;
  const first = data.detail || Object.values(data)[0];
  return Array.isArray(first) ? String(first[0]) : String(first ?? fallback);
}

export default function FinanceAdmin() {
  const { data: summary, isLoading } = useAdminFinanceSummary();
  const { data: withdrawals } = useAdminWithdrawals();
  const { data: settlement } = useSettlementReport();
  const { data: coupons } = useAdminCoupons();
  const approveWithdrawal = useApproveWithdrawal();
  const rejectWithdrawal = useRejectWithdrawal();
  const adminDeposit = useAdminDeposit();
  const saveCoupon = useSaveAdminCoupon();
  const couponAction = useAdminCouponAction();

  // approve dialog state
  const [approving, setApproving] = useState<WithdrawalRequest | null>(null);
  const [paymentTxnId, setPaymentTxnId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);

  // deposit dialog state
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");

  // balance history modal
  const [history, setHistory] = useState<{ category: string; label: string } | null>(null);
  const { data: historyData, isLoading: historyLoading } = useAccountHistory(history?.category ?? null);

  // coupon dialog state
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "", name: "", discount_type: "percent", discount_value: "",
    max_discount_amount: "", min_order_amount: "0", budget: "",
    max_uses: "0", expires_at: "",
  });

  // Radix dialogs can leave `pointer-events: none` stuck on <body> when a
  // query invalidation re-renders the page mid close-animation — clear it.
  const anyDialogOpen = !!approving || depositOpen || couponOpen || !!history;
  useEffect(() => {
    if (!anyDialogOpen) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [anyDialogOpen]);

  const submitApprove = async () => {
    if (!approving) return;
    try {
      await approveWithdrawal.mutateAsync({
        id: approving.id,
        payment_transaction_id: paymentTxnId,
        payment_method: paymentMethod,
        admin_note: adminNote,
        payment_proof: proof,
      });
      toast.success(`Withdrawal ${approving.request_id} settled`);
      setApproving(null);
      setPaymentTxnId(""); setPaymentMethod(""); setAdminNote(""); setProof(null);
    } catch (error) {
      toast.error(extractError(error, "Failed to approve withdrawal"));
    }
  };

  const submitReject = async (wd: WithdrawalRequest) => {
    const note = window.prompt(`Reject ${wd.request_id}? Optional note for the seller:`);
    if (note === null) return;
    try {
      await rejectWithdrawal.mutateAsync({ id: wd.id, admin_note: note });
      toast.success(`Withdrawal ${wd.request_id} rejected — funds returned to the seller`);
    } catch (error) {
      toast.error(extractError(error, "Failed to reject withdrawal"));
    }
  };

  const submitDeposit = async () => {
    try {
      await adminDeposit.mutateAsync({ amount: depositAmount, note: depositNote });
      toast.success("Platform Balance funded");
      setDepositOpen(false); setDepositAmount(""); setDepositNote("");
    } catch (error) {
      toast.error(extractError(error, "Failed to record the deposit"));
    }
  };

  const submitCoupon = async () => {
    try {
      await saveCoupon.mutateAsync({
        code: couponForm.code,
        name: couponForm.name,
        scope: "marketplace",
        discount_type: couponForm.discount_type as AdminCoupon["discount_type"],
        discount_value: couponForm.discount_value,
        max_discount_amount: couponForm.max_discount_amount || null,
        min_order_amount: couponForm.min_order_amount || "0",
        budget: couponForm.budget,
        max_uses: Number(couponForm.max_uses) || 0,
        expires_at: new Date(couponForm.expires_at).toISOString(),
      } as any);
      toast.success("Coupon saved as draft — activate it to reserve the budget");
      setCouponOpen(false);
      setCouponForm({ code: "", name: "", discount_type: "percent", discount_value: "",
        max_discount_amount: "", min_order_amount: "0", budget: "", max_uses: "0", expires_at: "" });
    } catch (error) {
      toast.error(extractError(error, "Failed to save coupon"));
    }
  };

  const runCouponAction = async (coupon: AdminCoupon, action: "activate" | "pause" | "expire" | "disable") => {
    try {
      await couponAction.mutateAsync({ id: coupon.id, action });
      toast.success(`Coupon ${coupon.code} ${action}d`);
    } catch (error) {
      toast.error(extractError(error, `Failed to ${action} coupon`));
    }
  };

  const summaryCards = [
    { label: "Seller Payable", value: summary?.seller_payable, icon: Wallet2,
      category: "seller_payable",
      tone: "bg-warning/10 text-warning", hint: "Owed to sellers (marketplace + locked)" },
    { label: "Platform Balance", value: summary?.platform_balance, icon: Landmark,
      category: "platform_balance",
      tone: "bg-success/10 text-success", hint: "Marketplace-owned funds" },
    { label: "Coupon Reserve", value: summary?.coupon_reserve_total, icon: TicketPercent,
      category: "coupon_reserve",
      tone: "bg-primary/10 text-primary", hint: "Reserved for active admin coupons" },
    { label: "Customer Wallets", value: summary?.customer_wallet_total, icon: PiggyBank,
      category: "customer_wallet",
      tone: "bg-destructive/10 text-destructive", hint: "Store credit owed to customers" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Finance</h1>
          <p>Escrow, settlements, withdrawals and platform funds</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setDepositOpen(true)}>
          <Banknote className="h-4 w-4 mr-1.5" /> Fund Platform Balance
        </Button>
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading finance summary...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {summaryCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => setHistory({ category: card.category, label: card.label })}
              className="stat-card flex items-center gap-4 text-left transition-all hover:ring-2 hover:ring-primary/40 hover:shadow-md"
              title={`View ${card.label} history`}
            >
              <div className={`rounded-xl p-2.5 ${card.tone}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                <p className="text-xl font-bold tracking-tight">৳{card.value ?? "0.00"}</p>
                <p className="text-[11px] text-primary/80 mt-0.5">View history →</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Tabs defaultValue="withdrawals">
        <TabsList>
          <TabsTrigger value="withdrawals">
            Withdrawals{summary?.pending_withdrawals ? ` (${summary.pending_withdrawals})` : ""}
          </TabsTrigger>
          <TabsTrigger value="settlement">Settlement Report</TabsTrigger>
          <TabsTrigger value="coupons">Admin Coupons</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawals" className="mt-4">
          <div className="stat-card">
            {!withdrawals?.results?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No withdrawal requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Request</th>
                      <th className="py-2 pr-4">Seller</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Payout Details</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.results.map((wd) => (
                      <tr key={wd.id} className="border-b border-border/60 last:border-0 align-top">
                        <td className="py-2.5 pr-4">
                          <span className="font-medium">{wd.request_id}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {new Date(wd.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          {wd.seller_name}
                          <span className="block text-[11px] text-muted-foreground">{wd.seller_email}</span>
                        </td>
                        <td className="py-2.5 pr-4 font-semibold">৳{wd.amount}</td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground max-w-[220px]">
                          {wd.payout_method || "—"}
                          {wd.payout_details ? <span className="block truncate">{wd.payout_details}</span> : null}
                          {wd.seller_note ? <span className="block italic">"{wd.seller_note}"</span> : null}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={wdBadge[wd.status]}>{wd.status}</span>
                          {wd.status === "approved" ? (
                            <span className="block text-[11px] text-muted-foreground mt-1">
                              {wd.payment_method} · {wd.payment_transaction_id}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-4">
                          {wd.status === "requested" ? (
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 rounded-md" onClick={() => setApproving(wd)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settle
                              </Button>
                              <Button size="sm" variant="outline"
                                className="h-7 rounded-md text-destructive hover:text-destructive"
                                onClick={() => submitReject(wd)}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {wd.processed_at ? new Date(wd.processed_at).toLocaleString() : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settlement" className="mt-4">
          <div className="stat-card">
            {!settlement?.sellers?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No seller balances yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Seller</th>
                      <th className="py-2 pr-4">Marketplace</th>
                      <th className="py-2 pr-4">Locked</th>
                      <th className="py-2 pr-4">Paid Out</th>
                      <th className="py-2 pr-4">Pending Withdrawals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlement.sellers.map((row) => (
                      <tr key={row.seller_id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-4">
                          {row.seller_name}
                          <span className="block text-[11px] text-muted-foreground">{row.seller_email}</span>
                        </td>
                        <td className={`py-2.5 pr-4 font-medium ${parseFloat(row.marketplace_balance) < 0 ? "text-destructive" : ""}`}>
                          ৳{row.marketplace_balance}
                        </td>
                        <td className="py-2.5 pr-4">৳{row.locked_balance}</td>
                        <td className="py-2.5 pr-4">৳{row.paid_out_balance}</td>
                        <td className="py-2.5 pr-4">৳{row.pending_withdrawals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="rounded-lg" onClick={() => setCouponOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Admin Coupon
            </Button>
          </div>
          <div className="stat-card">
            {!coupons?.results?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No admin coupons yet. Admin coupons are funded from the Platform Balance.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Discount</th>
                      <th className="py-2 pr-4">Budget</th>
                      <th className="py-2 pr-4">Reserve Left</th>
                      <th className="py-2 pr-4">Uses</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Expires</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.results.map((coupon) => (
                      <tr key={coupon.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-4">
                          <span className="font-semibold">{coupon.code}</span>
                          {coupon.name ? (
                            <span className="block text-[11px] text-muted-foreground">{coupon.name}</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-4">
                          {coupon.discount_type === "percent"
                            ? `${parseFloat(coupon.discount_value)}%`
                            : `৳${coupon.discount_value}`}
                        </td>
                        <td className="py-2.5 pr-4">৳{coupon.budget}</td>
                        <td className="py-2.5 pr-4">৳{coupon.reserve_remaining}</td>
                        <td className="py-2.5 pr-4">
                          {coupon.uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={couponBadge[coupon.status]}>{coupon.status}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {new Date(coupon.expires_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex gap-1.5">
                            {(coupon.status === "draft" || coupon.status === "paused") ? (
                              <Button size="sm" variant="outline" className="h-7 rounded-md"
                                onClick={() => runCouponAction(coupon, "activate")}>Activate</Button>
                            ) : null}
                            {coupon.status === "active" ? (
                              <Button size="sm" variant="outline" className="h-7 rounded-md"
                                onClick={() => runCouponAction(coupon, "pause")}>Pause</Button>
                            ) : null}
                            {(coupon.status === "active" || coupon.status === "paused") ? (
                              <Button size="sm" variant="outline"
                                className="h-7 rounded-md text-destructive hover:text-destructive"
                                onClick={() => runCouponAction(coupon, "disable")}>Disable</Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Balance history modal (clickable summary cards) */}
      <Dialog open={!!history} onOpenChange={(open) => !open && setHistory(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{history?.label} — Transaction History</DialogTitle>
            <DialogDescription>
              Every ledger movement behind this balance. Amounts marked +/- show whether the
              balance rose or fell.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto">
            {historyLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading history…</p>
            ) : !historyData?.results?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Seller</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3 text-right">Before</th>
                    <th className="py-2 pr-3 text-right">After</th>
                    <th className="py-2 pr-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.results.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">{e.txn_type_display}</td>
                      <td className="py-2 pr-3 font-mono">{e.order_id || "—"}</td>
                      <td className="py-2 pr-3 max-w-[160px] truncate" title={e.product || ""}>
                        {e.product || "—"}
                      </td>
                      <td className="py-2 pr-3">{e.customer_email || "—"}</td>
                      <td className="py-2 pr-3">{e.seller_email || "—"}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${e.direction === "credit" ? "text-success" : "text-destructive"}`}>
                        {e.direction === "credit" ? "+" : "-"}৳{e.amount}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">৳{e.balance_before}</td>
                      <td className="py-2 pr-3 text-right font-medium">৳{e.balance_after}</td>
                      <td className="py-2 pr-3 max-w-[200px] truncate" title={e.notes}>{e.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Transaction ID column and full audit are available via the ledger export. This history
            is visible to administrators only.
          </p>
        </DialogContent>
      </Dialog>

      {/* Approve withdrawal dialog */}
      <Dialog open={!!approving} onOpenChange={(open) => !open && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Withdrawal {approving?.request_id}</DialogTitle>
            <DialogDescription>
              Transfer ৳{approving?.amount} to {approving?.seller_name} manually first, then record
              the settlement here. This moves the locked amount to Paid Out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment Method *</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Transaction ID *</label>
              <Input value={paymentTxnId} onChange={(e) => setPaymentTxnId(e.target.value)}
                placeholder="Bank / mobile banking transaction reference" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment Proof (optional)</label>
              <Input type="file" accept="image/*,.pdf"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button onClick={submitApprove}
              disabled={approveWithdrawal.isPending || !paymentTxnId.trim() || !paymentMethod}>
              {approveWithdrawal.isPending ? "Recording..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Platform deposit dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Platform Balance</DialogTitle>
            <DialogDescription>
              Manual deposit into marketplace-owned funds (used for admin coupons and promotions).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount (৳)</label>
              <Input type="number" min="1" step="0.01" value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note</label>
              <Input value={depositNote} onChange={(e) => setDepositNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={submitDeposit} disabled={adminDeposit.isPending || !depositAmount}>
              {adminDeposit.isPending ? "Recording..." : "Record Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New coupon dialog */}
      <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Admin Coupon</DialogTitle>
            <DialogDescription>
              Applies to product prices only (never shipping) across the whole marketplace.
              Activating reserves the budget from the Platform Balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Code *</label>
              <Input value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={couponForm.name}
                onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={couponForm.discount_type}
                onValueChange={(v) => setCouponForm({ ...couponForm, discount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {couponForm.discount_type === "percent" ? "Percent *" : "Amount (৳) *"}
              </label>
              <Input type="number" min="0" value={couponForm.discount_value}
                onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Budget (৳) *</label>
              <Input type="number" min="1" value={couponForm.budget}
                onChange={(e) => setCouponForm({ ...couponForm, budget: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Max Discount / Order (৳)</label>
              <Input type="number" min="0" value={couponForm.max_discount_amount}
                onChange={(e) => setCouponForm({ ...couponForm, max_discount_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Min Order (৳)</label>
              <Input type="number" min="0" value={couponForm.min_order_amount}
                onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Max Uses (0 = unlimited)</label>
              <Input type="number" min="0" value={couponForm.max_uses}
                onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Expires At *</label>
              <Input type="datetime-local" value={couponForm.expires_at}
                onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponOpen(false)}>Cancel</Button>
            <Button onClick={submitCoupon}
              disabled={saveCoupon.isPending || !couponForm.code || !couponForm.discount_value
                || !couponForm.budget || !couponForm.expires_at}>
              {saveCoupon.isPending ? "Saving..." : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
