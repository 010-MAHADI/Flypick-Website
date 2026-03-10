import { useMemo, useState, useEffect } from "react";
import { Clock, DollarSign, Download, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { useTransactions, useUpdatePaymentMethods, PaymentMethods } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const statusClass: Record<string, string> = {
  Completed: "status-badge status-badge--success",
  Pending: "status-badge status-badge--warning",
  Refunded: "status-badge status-badge--destructive",
};

const methodConfig = [
  { key: "cash_on_delivery", label: "Cash on Delivery" },
  { key: "bkash", label: "bKash" },
  { key: "nagad", label: "Nagad" },
  { key: "credit_card", label: "Credit / Debit Card" },
] as const;

export default function Transactions() {
  const { data, isLoading, refetch } = useTransactions();
  const updatePaymentMethods = useUpdatePaymentMethods();

  const [search, setSearch] = useState("");
  // Local state to track payment methods for immediate UI updates
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethods | undefined>();

  // Update local state when data changes
  useEffect(() => {
    if (data?.paymentMethods) {
      setLocalPaymentMethods(data.paymentMethods);
    }
  }, [data?.paymentMethods]);

  const transactions = data?.transactions ?? [];
  const summary = data?.summary ?? { totalRevenue: 0, pending: 0, refunded: 0 };
  const paymentMethods = localPaymentMethods || data?.paymentMethods;

  const filtered = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.id.toLowerCase().includes(search.toLowerCase()) ||
          transaction.customer.toLowerCase().includes(search.toLowerCase())
      ),
    [search, transactions]
  );

  const handleMethodToggle = async (key: keyof NonNullable<typeof paymentMethods>, enabled: boolean) => {
    // Optimistically update local state
    setLocalPaymentMethods(prev => prev ? { ...prev, [key]: enabled } : undefined);
    
    try {
      await updatePaymentMethods.mutateAsync({ [key]: enabled });
      toast.success("Payment method updated");
      // Force refetch to ensure UI updates
      await refetch();
    } catch (error) {
      console.error("Failed to update payment method:", error);
      toast.error("Failed to update payment method");
      // Revert optimistic update on error
      await refetch();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Transactions</h1>
          <p>Payment history</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg">
          <Download className="h-4 w-4 mr-1.5" /> Export
        </Button>
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading transactions...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="stat-card flex items-center gap-4">
              <div className="rounded-xl p-2.5 bg-success/10 text-success">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-xl font-bold tracking-tight">${summary.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-4">
              <div className="rounded-xl p-2.5 bg-warning/10 text-warning">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending</p>
                <p className="text-xl font-bold tracking-tight">${summary.pending.toFixed(2)}</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-4">
              <div className="rounded-xl p-2.5 bg-destructive/10 text-destructive">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Refunded</p>
                <p className="text-xl font-bold tracking-tight">${summary.refunded.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>

          <div className="stat-card space-y-5">
            {methodConfig.map((method) => (
              <div key={method.key} className="flex items-center justify-between py-1">
                <p className="text-sm font-medium">{method.label}</p>
                <Switch
                  checked={paymentMethods ? Boolean(paymentMethods[method.key]) : false}
                  onCheckedChange={(value) => handleMethodToggle(method.key, value)}
                  disabled={updatePaymentMethods.isPending}
                />
              </div>
            ))}
          </div>

          <div className="stat-card overflow-x-auto p-0">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="pl-5">Transaction</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="pr-5">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="font-medium font-mono text-xs pl-5">{transaction.id}</td>
                    <td className="text-primary font-medium font-mono text-xs">#{transaction.order}</td>
                    <td>{transaction.customer}</td>
                    <td className="font-semibold">${transaction.amount.toFixed(2)}</td>
                    <td className="text-muted-foreground">{transaction.method}</td>
                    <td>
                      <span className={statusClass[transaction.status]}>{transaction.status}</span>
                    </td>
                    <td className="text-muted-foreground pr-5">{transaction.date}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="pl-5 py-8 text-muted-foreground" colSpan={7}>
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

