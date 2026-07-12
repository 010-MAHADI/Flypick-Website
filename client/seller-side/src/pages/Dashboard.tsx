import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  DollarSign,
  PackageCheck,
  PackageSearch,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Truck,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";
import { useDashboard, DashboardRange } from "@/hooks/useDashboard";

const COLORS = [
  "hsl(14, 78%, 57%)",
  "hsl(160, 72%, 40%)",
  "hsl(34, 94%, 52%)",
  "hsl(210, 90%, 54%)",
  "hsl(262, 60%, 60%)",
];

const money = (n: number) =>
  `৳${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const RANGE_OPTIONS: { key: DashboardRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

const statusClass: Record<string, string> = {
  delivered: "status-badge status-badge--success",
  Delivered: "status-badge status-badge--success",
  completed: "status-badge status-badge--success",
  Completed: "status-badge status-badge--success",
  processing: "status-badge status-badge--info",
  Processing: "status-badge status-badge--info",
  shipped: "status-badge status-badge--warning",
  Shipped: "status-badge status-badge--warning",
  pending: "status-badge status-badge--warning",
  Pending: "status-badge status-badge--warning",
  cancelled: "status-badge status-badge--destructive",
  Cancelled: "status-badge status-badge--destructive",
  refunded: "status-badge status-badge--destructive",
  Refunded: "status-badge status-badge--destructive",
  returned: "status-badge status-badge--destructive",
  Returned: "status-badge status-badge--destructive",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentShop } = useShop();
  const { user, isAdmin } = useAuth();
  const [range, setRange] = useState<DashboardRange>("all");
  const { data: dashboardData, isLoading } = useDashboard(currentShop?.id, range);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const profileCompletion = useMemo(() => {
    if (isAdmin) return null;
    const profile = user?.seller_profile;
    const checks: { label: string; done: boolean }[] = [
      { label: "Phone number", done: !!profile?.phone },
      { label: "Business name", done: !!profile?.business_name },
      { label: "Shop address", done: !!(currentShop?.senderVillage || currentShop?.senderZilla) },
      { label: "Shop description", done: !!currentShop?.description },
      { label: "National ID number", done: !!profile?.idDocument },
      { label: "ID photo", done: !!profile?.id_photo },
      { label: "Bank information", done: !!profile?.bankAccount },
    ];
    const done = checks.filter((c) => c.done).length;
    return {
      percent: Math.round((done / checks.length) * 100),
      missing: checks.filter((c) => !c.done).map((c) => c.label),
    };
  }, [isAdmin, user?.seller_profile, currentShop]);

  const s = dashboardData?.stats;
  const revenueChart = dashboardData?.revenueData?.length
    ? dashboardData.revenueData
    : [{ label: "No data", revenue: 0 }];
  const categoryData = dashboardData?.categoryData?.length
    ? dashboardData.categoryData
    : [{ name: "No data", value: 100 }];
  const topProducts = dashboardData?.topProducts ?? [];
  const recentOrders = dashboardData?.recentOrders ?? [];

  if (isLoading || !s) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const bentoTile = ({
    label, value, hint, icon: Icon, tone, onClick,
  }: {
    label: string;
    value: string;
    hint?: string;
    icon: React.ElementType;
    tone: "primary" | "success" | "warning" | "info" | "destructive" | "muted";
    onClick?: () => void;
  }) => {
    const toneMap: Record<string, string> = {
      primary: "bg-primary/10 text-primary",
      success: "bg-success/10 text-success",
      warning: "bg-warning/10 text-warning",
      info: "bg-info/10 text-info",
      destructive: "bg-destructive/10 text-destructive",
      muted: "bg-muted text-muted-foreground",
    };
    return (
      <button
        type="button"
        onClick={onClick}
        className="metric-card text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className={`rounded-xl p-2.5 ${toneMap[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">{label}</p>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p> : null}
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero header with time-range filter */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.18), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{greeting}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {user?.username || (isAdmin ? "Admin" : "Seller")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? (
                <>Here&apos;s what&apos;s happening across the marketplace.</>
              ) : (
                <>Here&apos;s what&apos;s happening with <span className="font-semibold text-foreground">{currentShop?.name}</span>.</>
              )}
            </p>
          </div>
          {/* Global time filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-background/60 p-1 backdrop-blur">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  range === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Profile completion (sellers only) */}
      {profileCompletion && profileCompletion.percent < 100 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="relative h-12 w-12 shrink-0">
            <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="4"
                strokeLinecap="round" strokeDasharray={`${(profileCompletion.percent / 100) * 97.4} 97.4`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
              {profileCompletion.percent}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Complete your seller profile</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Missing: {profileCompletion.missing.join(", ")}
            </p>
          </div>
          <Button size="sm" className="rounded-lg" onClick={() => navigate("/settings")}>
            Complete Profile
          </Button>
        </div>
      ) : null}

      {/* BENTO KPI GRID */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {/* Total Sales — spans 2 */}
        <div className="col-span-2 md:col-span-2 lg:col-span-2">
          <div className="metric-card h-full">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                {RANGE_OPTIONS.find((r) => r.key === range)?.label}
              </span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Total Sales</p>
            <p className="mt-0.5 text-3xl font-bold tracking-tight">{money(s.totalSales)}</p>
            <div className="mt-3 flex items-center gap-4 border-t pt-3 text-[11px]">
              {isAdmin ? (
                <>
                  <div><p className="text-muted-foreground">Orders</p><p className="font-bold">{s.totalOrders.toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Completed</p><p className="font-bold text-success">{s.completedOrders.toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Revenue</p><p className="font-bold">{money(s.totalRevenue)}</p></div>
                </>
              ) : (
                <>
                  <div><p className="text-muted-foreground">Revenue</p><p className="font-bold">{money(s.totalRevenue)}</p></div>
                  <div><p className="text-muted-foreground">Net Profit</p><p className={`font-bold ${s.netProfit >= 0 ? "text-success" : "text-destructive"}`}>{money(s.netProfit)}</p></div>
                  <div><p className="text-muted-foreground">Orders</p><p className="font-bold">{s.totalOrders.toLocaleString()}</p></div>
                </>
              )}
            </div>
          </div>
        </div>

        {isAdmin ? (
          <>
            {bentoTile({ label: "Total Orders", value: s.totalOrders.toLocaleString(), hint: "In this period", icon: Receipt, tone: "primary", onClick: () => navigate("/admin-orders") })}
            {bentoTile({ label: "Pending Orders", value: String(s.pendingOrders), hint: "Awaiting fulfilment", icon: Clock, tone: "warning" })}
            {bentoTile({ label: "Completed Orders", value: String(s.completedOrders), hint: "Delivered", icon: CheckCircle2, tone: "success" })}
            {bentoTile({ label: "Cancelled", value: String(s.cancelledOrders), hint: "Not counted in sales", icon: XCircle, tone: "destructive" })}
            {bentoTile({ label: "Active Users", value: (s.activeUsers ?? 0).toLocaleString(), hint: "Platform accounts", icon: Activity, tone: "info" })}
            {bentoTile({ label: "Active Sellers", value: (s.activeSellers ?? 0).toLocaleString(), hint: `${s.totalSellers ?? 0} total`, icon: Users, tone: "primary", onClick: () => navigate("/sellers") })}
            {bentoTile({ label: "New Customers", value: (s.newCustomers ?? 0).toLocaleString(), hint: `${s.totalCustomers ?? 0} total`, icon: UserPlus, tone: "success", onClick: () => navigate("/customers") })}
          </>
        ) : (
          <>
            {bentoTile({ label: "Pending", value: String(s.pendingOrders), hint: "Awaiting action", icon: Clock, tone: "warning", onClick: () => navigate("/orders") })}
            {bentoTile({ label: "Processing", value: String(s.processingOrders), hint: "Being prepared", icon: PackageSearch, tone: "info", onClick: () => navigate("/orders") })}
            {bentoTile({ label: "Shipped", value: String(s.shippedOrders), hint: "In transit", icon: Truck, tone: "info", onClick: () => navigate("/orders") })}
            {bentoTile({ label: "Delivered", value: String(s.deliveredOrders), hint: "Completed", icon: PackageCheck, tone: "success", onClick: () => navigate("/orders") })}
            {bentoTile({ label: "Cancelled", value: String(s.cancelledOrders), hint: "Not in sales", icon: XCircle, tone: "destructive" })}
            {bentoTile({ label: "Returned", value: String(s.returnedOrders), hint: "After delivery", icon: RotateCcw, tone: "destructive" })}
            {bentoTile({ label: "Refunded", value: String(s.refundedOrders), hint: "Money returned", icon: Receipt, tone: "destructive" })}
            {bentoTile({ label: "Net Profit", value: money(s.netProfit), hint: "Sales − cost − delivery", icon: Wallet, tone: s.netProfit >= 0 ? "success" : "destructive" })}
            {bentoTile({ label: "Expenses", value: money(s.expenses), hint: "Product + delivery cost", icon: PackageSearch, tone: "muted" })}
            {bentoTile({ label: "Products", value: s.activeProducts.toLocaleString(), hint: `${s.lowStockProducts} low stock`, icon: Boxes, tone: "primary", onClick: () => navigate("/products") })}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="stat-card lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="section-title">Sales Overview</h3>
            <span className="rounded-lg bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {RANGE_OPTIONS.find((r) => r.key === range)?.label}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => money(Number(v))} contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)" }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="section-title mb-5">Category Mix</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {categoryData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {categoryData.map((category, index) => (
              <div key={category.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[12px] text-muted-foreground">{category.name}</span>
                </div>
                <span className="text-[12px] font-semibold">{category.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="stat-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Recent Orders
            </h3>
            <a href={isAdmin ? "/admin-orders" : "/orders"} className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline underline-offset-4">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No orders in this period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.slice(0, 5).map((order, index) => (
                <div key={order.id || index} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">{index + 1}</div>
                    <div>
                      <p className="text-[13px] font-semibold leading-tight">{order.customer}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{String(order.id)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold">{money(order.amount)}</p>
                    <span className={statusClass[order.status] || "status-badge status-badge--info"}>{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" /> Top Products
            </h3>
            {!isAdmin ? (
              <a href="/products" className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline underline-offset-4">
                View all <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          {topProducts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Boxes className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No sales in this period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 5).map((product, index) => (
                <div key={product.name || index} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-[11px] font-bold text-warning">#{index + 1}</div>
                    <div>
                      <p className="max-w-[180px] truncate text-[13px] font-semibold leading-tight">{product.name}</p>
                      <p className="text-[11px] text-muted-foreground">{product.sold} sold</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-bold text-success">{money(product.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
