import { useEffect, useState } from "react";
import { ArrowDownToLine, Banknote, CheckCircle2, Clock, Lock, WalletCards } from "lucide-react";
import { toast } from "sonner";

import {
  useCreateWithdrawal,
  useSellerWallet,
  useSellerWithdrawals,
} from "@/hooks/useFinance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const statusBadge: Record<string, string> = {
  requested: "status-badge status-badge--warning",
  approved: "status-badge status-badge--success",
  rejected: "status-badge status-badge--destructive",
};

const txnLabel: Record<string, string> = {
  online_payment: "Order payment",
  cod_confirmation: "COD coupon compensation",
  refund: "Refund",
  withdrawal_requested: "Withdrawal locked",
  withdrawal_approved: "Withdrawal paid",
  withdrawal_rejected: "Withdrawal returned",
  coupon_redemption: "Coupon compensation",
  seller_deposit: "Deposit",
  reversal: "Correction",
};

export default function Wallet() {
  const { data: wallet, isLoading } = useSellerWallet();
  const { data: withdrawals } = useSellerWithdrawals();
  const createWithdrawal = useCreateWithdrawal();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const marketplace = parseFloat(wallet?.marketplace_balance ?? "0");

  // Radix dialogs can leave `pointer-events: none` stuck on <body> when a
  // query invalidation re-renders the page mid close-animation — clear it.
  useEffect(() => {
    if (!dialogOpen) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [dialogOpen]);

  const submitWithdrawal = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid withdrawal amount");
      return;
    }
    if (value > marketplace) {
      toast.error("You cannot withdraw more than your Marketplace Balance");
      return;
    }
    try {
      await createWithdrawal.mutateAsync({ amount: amount, note });
      toast.success("Withdrawal requested — the amount is now locked until admin review");
      setDialogOpen(false);
      setAmount("");
      setNote("");
    } catch (error: any) {
      const data = error?.response?.data;
      toast.error(
        data?.amount || data?.detail || "Failed to create the withdrawal request"
      );
    }
  };

  const cards = [
    {
      label: "Marketplace Balance",
      value: wallet?.marketplace_balance,
      icon: WalletCards,
      tone: "bg-success/10 text-success",
      hint: "Available for refunds, coupons and withdrawals",
    },
    {
      label: "Locked Balance",
      value: wallet?.locked_balance,
      icon: Lock,
      tone: "bg-warning/10 text-warning",
      hint: "Withdrawal requests awaiting admin review",
    },
    {
      label: "Paid Out (lifetime)",
      value: wallet?.paid_out_balance,
      icon: Banknote,
      tone: "bg-primary/10 text-primary",
      hint: "Already transferred to your bank / mobile account",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Wallet</h1>
          <p>Your marketplace balances and payout history</p>
        </div>
        <Button
          size="sm"
          className="rounded-lg"
          disabled={isLoading || marketplace <= 0}
          onClick={() => setDialogOpen(true)}
        >
          <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Request Withdrawal
        </Button>
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading wallet...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {cards.map((card) => (
              <div key={card.label} className="stat-card flex items-center gap-4">
                <div className={`rounded-xl p-2.5 ${card.tone}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                  <p className="text-xl font-bold tracking-tight">৳{card.value ?? "0.00"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{card.hint}</p>
                </div>
              </div>
            ))}
          </div>

          {marketplace < 0 ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Your Marketplace Balance is negative. Below ৳{wallet?.negative_limit} no further
              refunds or coupons are possible — please contact the marketplace to make a deposit.
            </div>
          ) : null}

          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Withdrawal Requests
            </h2>
            {!withdrawals?.results?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No withdrawal requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Request</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Payment</th>
                      <th className="py-2 pr-4">Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.results.map((wd) => (
                      <tr key={wd.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{wd.request_id}</td>
                        <td className="py-2.5 pr-4">৳{wd.amount}</td>
                        <td className="py-2.5 pr-4">
                          <span className={statusBadge[wd.status] ?? "status-badge"}>{wd.status}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {wd.status === "approved"
                            ? `${wd.payment_method} · ${wd.payment_transaction_id}`
                            : wd.status === "rejected"
                              ? wd.admin_note || "—"
                              : "Awaiting review"}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {new Date(wd.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Ledger History
            </h2>
            {!wallet?.entries?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No financial activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Reference</th>
                      <th className="py-2 pr-4">Debit</th>
                      <th className="py-2 pr-4">Credit</th>
                      <th className="py-2 pr-4">Balance</th>
                      <th className="py-2 pr-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-4">
                          <span className="font-medium">{txnLabel[entry.txn_type] ?? entry.txn_type}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {entry.account_type.replace("seller_", "").replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {entry.order_id || entry.withdrawal_id || "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-destructive">
                          {parseFloat(entry.debit) > 0 ? `-৳${entry.debit}` : ""}
                        </td>
                        <td className="py-2.5 pr-4 text-success">
                          {parseFloat(entry.credit) > 0 ? `+৳${entry.credit}` : ""}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">৳{entry.balance_after}</td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              The amount is locked immediately and paid out manually after admin review.
              Available: ৳{wallet?.marketplace_balance ?? "0.00"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount (৳)</label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything the admin should know"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitWithdrawal} disabled={createWithdrawal.isPending}>
              {createWithdrawal.isPending ? "Submitting..." : "Lock & Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
