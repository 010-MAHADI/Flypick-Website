import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Clock,
  DollarSign,
  PackageCheck,
  PackageSearch,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";
import { useDashboard } from "@/hooks/useDashboard";

const COLORS = [
  "hsl(14, 78%, 57%)",
  "hsl(160, 72%, 40%)",
  "hsl(34, 94%, 52%)",
  "hsl(210, 90%, 54%)",
  "hsl(262, 60%, 60%)",
];

const parseMoney = (v: string | number | undefined) => {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusClass: Record<string, string> = {
  delivered: "status-badge status-badge--success",
  Delivered: "status-badge status-badge--success",
  processing: "status-badge status-badge--info",
  Processing: "status-badge status-badge--info",
  shipped: "status-badge status-badge--warning",
  Shipped: "status-badge status-badge--warning",
  pending: "status-badge status-badge--warning",
  Pending: "status-badge status-badge--warning",
  cancelled: "status-badge status-badge--destructive",
  Cancelled: "status-badge status-badge--destructive",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentShop } = useShop();
  const { user } = useAuth();
  const { data: dashboardData, isLoading } = useDashboard(currentShop?.id);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const revenueCard = useMemo(() => {
    if (dashboardData?.revenueData?.length) {
      return {
        value: dashboardData.stats.totalRevenue,
        chartData: dashboardData.revenueData,
        badgeText: "Last 7 days",
      };
    }

    return {
      value: "$0.00",
      chartData: [{ label: "No data", revenue: 0 }],
      badgeText: "No data",
    };
  }, [dashboardData]);

  const categoryData = useMemo(
    () => (dashboardData?.categoryData?.length ? dashboardData.categoryData : [{ name: "No data", value: 100 }]),
    [dashboardData]
  );

  const topProducts = useMemo(() => (dashboardData?.topProducts?.length ? dashboardData.topProducts : []), [dashboardData]);
  const recentOrders = useMemo(() => (dashboardData?.recentOrders?.length ? dashboardData.recentOrders : []), [dashboardData]);

  const derived = useMemo(() => {
    const totalRevenue = parseMoney(dashboardData?.stats?.totalRevenue);
    const totalOrders = dashboardData?.stats?.totalOrders || 0;
    const activeProducts = dashboardData?.stats?.activeProducts || 0;

    const statusOf = (s: string) => (s || "").toLowerCase();
    const pending = recentOrders.filter((o) => ["pending", "processing"].includes(statusOf(String(o.status)))).length;
    const shipped = recentOrders.filter((o) => statusOf(String(o.status)) === "shipped").length;
    const delivered = recentOrders.filter((o) => statusOf(String(o.status)) === "delivered").length;
    const cancelled = recentOrders.filter((o) => statusOf(String(o.status)) === "cancelled").length;

    // Estimated financials (rough model until backend provides real cost data)
    const estExpense = totalRevenue * 0.62;
    const netProfit = totalRevenue - estExpense;
    const lowStock = topProducts.filter((p: any) => (p.stock ?? 99) < 10).length;

    return {
      totalRevenue,
      totalOrders,
      activeProducts,
      pending,
      shipped,
      delivered,
      cancelled,
      estExpense,
      netProfit,
      lowStock,
    };
  }, [dashboardData, recentOrders, topProducts]);

  if (isLoading) {
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
    label,
    value,
    hint,
    icon: Icon,
    tone,
    onClick,
    trend,
  }: {
    label: string;
    value: string;
    hint?: string;
    icon: React.ElementType;
    tone: "primary" | "success" | "warning" | "info" | "destructive" | "muted";
    onClick?: () => void;
    trend?: { up: boolean; value: string };
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
          {trend ? (
            <div className={`flex items-center gap-1 text-[11px] font-semibold ${trend.up ? "text-success" : "text-destructive"}`}>
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}
            </div>
          ) : null}
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">{label}</p>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p> : null}
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero header — light, coral-accented */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.18), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{greeting}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {user?.username || "Seller"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening with <span className="font-semibold text-foreground">{currentShop?.name}</span> today.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-background/60 px-3.5 py-2 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Live Overview</span>
          </div>
        </div>
      </div>

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
                Live
              </span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Total Sales</p>
            <p className="mt-0.5 text-3xl font-bold tracking-tight">{money(derived.totalRevenue)}</p>
            <div className="mt-3 flex items-center gap-4 border-t pt-3 text-[11px]">
              <div>
                <p className="text-muted-foreground">Expense</p>
                <p className="font-bold text-warning">{money(derived.estExpense)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net Profit</p>
                <p className="font-bold text-success">{money(derived.netProfit)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Orders</p>
                <p className="font-bold">{derived.totalOrders.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {bentoTile({
          label: "Pending Orders",
          value: String(derived.pending),
          hint: "Awaiting action",
          icon: Clock,
          tone: "warning",
          onClick: () => navigate("/orders"),
        })}
        {bentoTile({
          label: "Shipping",
          value: String(derived.shipped),
          hint: "In transit",
          icon: Truck,
          tone: "info",
          onClick: () => navigate("/orders"),
        })}
        {bentoTile({
          label: "Delivered",
          value: String(derived.delivered),
          hint: "Completed",
          icon: PackageCheck,
          tone: "success",
          onClick: () => navigate("/orders"),
        })}
        {bentoTile({
          label: "Cancelled",
          value: String(derived.cancelled),
          hint: "This period",
          icon: Receipt,
          tone: "destructive",
        })}

        {bentoTile({
          label: "Total Products",
          value: derived.activeProducts.toLocaleString(),
          hint: "In your catalog",
          icon: Boxes,
          tone: "primary",
          onClick: () => navigate("/products"),
        })}
        {bentoTile({
          label: "Stock Warning",
          value: String(derived.lowStock),
          hint: "Low inventory",
          icon: AlertTriangle,
          tone: "warning",
          onClick: () => navigate("/products"),
        })}
        {bentoTile({
          label: "Net Profit",
          value: money(derived.netProfit),
          hint: "Est. after expense",
          icon: Wallet,
          tone: "success",
          trend: { up: derived.netProfit >= 0, value: derived.netProfit >= 0 ? "Profit" : "Loss" },
        })}
        {bentoTile({
          label: "Total Expense",
          value: money(derived.estExpense),
          hint: "Est. cost of goods",
          icon: PackageSearch,
          tone: "muted",
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="stat-card lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="section-title">Revenue Overview</h3>
            <span className="rounded-lg bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">{revenueCard.badgeText}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueCard.chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)" }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" dot={{ r: 3.5, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
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
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Orders
            </h3>
            <a href="/orders" className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline underline-offset-4">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.slice(0, 5).map((order, index) => (
                <div key={order.id || index} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold leading-tight">{order.customer}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {order.id.toString().startsWith("#") ? order.id : `#${order.id}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold">{typeof order.amount === "number" ? `$${order.amount.toFixed(2)}` : order.amount}</p>
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
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Top Products
            </h3>
            <a href="/products" className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline underline-offset-4">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          {topProducts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Boxes className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No products yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 5).map((product, index) => (
                <div key={product.name || index} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-[11px] font-bold text-warning">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="max-w-[180px] truncate text-[13px] font-semibold leading-tight">{product.name}</p>
                      <p className="text-[11px] text-muted-foreground">{product.sold} sold</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-bold text-success">{product.revenue}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
