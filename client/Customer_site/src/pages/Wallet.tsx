import { Link } from "react-router-dom";
import { ArrowLeft, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, ReceiptText, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/context/AuthContext";
import TakaSign from "@/components/TakaSign";
import api from "@/lib/api";

interface WalletTransaction {
  id: number;
  amount: string;
  source: string;
  note: string;
  order_id: string | null;
  refund_id: string | null;
  balance_after: string;
  created_at: string;
}

interface RefundCase {
  id: number;
  refund_id: string;
  order_id: string;
  amount: string;
  method: string;
  refund_type: string;
  status: string;
  reason: string;
  created_at: string;
}

const REFUND_STATUS_STYLES: Record<string, string> = {
  requested: "bg-amber-500/12 text-amber-600",
  under_review: "bg-blue-500/12 text-blue-600",
  approved: "bg-teal-500/12 text-teal-600",
  processing: "bg-primary/10 text-primary",
  completed: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  under_review: "Under review",
  approved: "Approved",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
};

const METHOD_LABELS: Record<string, string> = {
  original: "Original payment method",
  store_credit: "Store credit",
  manual: "Manual refund",
};

const Wallet = () => {
  const { isLoggedIn } = useAuth();

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const response = await api.get("/orders/wallet/");
      return response.data as { balance: string; transactions: WalletTransaction[] };
    },
    enabled: isLoggedIn,
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ["refunds"],
    queryFn: async () => {
      const response = await api.get("/orders/refunds/");
      const data = response.data?.results ?? response.data;
      return (Array.isArray(data) ? data : []) as RefundCase[];
    },
    enabled: isLoggedIn,
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <WalletIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-lg font-extrabold mb-2">Sign in to view your wallet</h1>
          <Link to="/auth" className="text-primary font-bold hover:underline">Sign In</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const balance = parseFloat(wallet?.balance || "0");
  const transactions = wallet?.transactions || [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[760px] mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-mobile-nav md:pb-10">
        <Link to="/orders" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground mb-3 hover:text-foreground w-fit">
          <ArrowLeft className="w-4 h-4" /> My Orders
        </Link>

        {/* Balance card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white p-6 sm:p-8 shadow-[0_8px_24px_rgba(200,30,45,0.25)] mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 flex items-center gap-1.5">
            <WalletIcon className="w-4 h-4" /> Store Credit Balance
          </p>
          <p className="text-4xl font-black mt-2">
            <TakaSign />
            {balance.toLocaleString()}
          </p>
          <p className="text-xs text-white/75 mt-2">
            Store credit is added when refunds complete — redeem it at checkout on any order.
          </p>
        </div>

        {/* Refund cases */}
        <section className="mb-5">
          <h2 className="text-base font-extrabold mb-2.5 flex items-center gap-1.5">
            <ReceiptText className="w-4 h-4 text-primary" /> My Refunds
          </h2>
          {refunds.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)] p-6 text-center text-sm text-muted-foreground">
              No refund requests yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {refunds.map((refund) => (
                <div key={refund.id} className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)] p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${REFUND_STATUS_STYLES[refund.status] || "bg-muted"}`}>
                      {REFUND_STATUS_LABELS[refund.status] || refund.status}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{refund.refund_id}</span>
                    <span className="ml-auto text-sm font-extrabold">
                      <TakaSign />
                      {parseFloat(refund.amount).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground/80 mt-1.5">{refund.reason}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span>Order <Link to={`/order/${refund.order_id}`} className="font-semibold text-primary hover:underline">{refund.order_id}</Link></span>
                    <span>· {METHOD_LABELS[refund.method] || refund.method}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(refund.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Transactions */}
        <section>
          <h2 className="text-base font-extrabold mb-2.5">Credit History</h2>
          {transactions.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)] p-6 text-center text-sm text-muted-foreground">
              No wallet activity yet.
            </div>
          ) : (
            <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)] divide-y divide-border/70">
              {transactions.map((tx) => {
                const amount = parseFloat(tx.amount);
                const isCredit = amount >= 0;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3.5">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCredit ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{tx.note || (isCredit ? "Credit" : "Payment")}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        {tx.order_id ? ` · Order ${tx.order_id}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-extrabold ${isCredit ? "text-success" : "text-destructive"}`}>
                        {isCredit ? "+" : "−"}
                        <TakaSign />
                        {Math.abs(amount).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Bal: <TakaSign />
                        {parseFloat(tx.balance_after).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Wallet;
