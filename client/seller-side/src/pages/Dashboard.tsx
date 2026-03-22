import { useMemo } from "react";
import {
  Activity,
  ArrowUpRight,
  Clock,
  DollarSign,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";
import { useDashboard } from "@/hooks/useDashboard";

const COLORS = ["hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(270, 65%, 60%)", "hsl(199, 89%, 48%)"];

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

  const stats = useMemo(() => {
    const data = dashboardData?.stats;

    return [
      {
        label: "Total Revenue",
        value: data?.totalRevenue || "$0.00",
        change: "+0%",
        up: true,
        icon: DollarSign,
        bg: "bg-blue-500/10",
        iconColor: "text-blue-600",
        accent: "border-blue-500/20",
      },
      {
        label: "Total Orders",
        value: data?.totalOrders?.toLocaleString?.() || "0",
        change: "+0%",
        up: true,
        icon: ShoppingCart,
        bg: "bg-emerald-500/10",
        iconColor: "text-emerald-600",
        accent: "border-emerald-500/20",
      },
      {
        label: "Customers",
        value: data?.totalCustomers?.toLocaleString?.() || "-",
        change: "+0%",
        up: true,
        icon: Users,
        bg: "bg-violet-500/10",
        iconColor: "text-violet-600",
        accent: "border-violet-500/20",
      },
      {
        label: "Active Products",
        value: data?.activeProducts?.toLocaleString?.() || "0",
        change: "+0%",
        up: true,
        icon: Package,
        bg: "bg-amber-500/10",
        iconColor: "text-amber-600",
        accent: "border-amber-500/20",
      },
    ];
  }, [dashboardData]);

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

  return (
    <div className="space-y-7 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 70% 50%, white 1px, transparent 1px), radial-gradient(circle at 30% 80%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px, 32px 32px",
          }}
        />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-100">{greeting},</p>
            <h1 className="mt-0.5 text-2xl font-bold" style={{ fontFamily: "Fraunces, serif" }}>
              {user?.username || "Seller"}
            </h1>
            <p className="mt-1.5 text-sm text-blue-100">
              Here&apos;s what&apos;s happening with <strong>{currentShop?.name}</strong> today.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur sm:flex">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-semibold">Live Overview</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`metric-card border ${stat.accent}`}>
            <div className="mb-3 flex items-center justify-between">
              <div className={`rounded-xl p-2.5 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              <div className={`flex items-center gap-1 text-[11px] font-semibold ${stat.up ? "text-emerald-600" : "text-red-500"}`}>
                {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {stat.change}
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
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
                  <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)" }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(221,83%,53%)" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" dot={{ r: 3.5, fill: "hsl(221,83%,53%)", strokeWidth: 0 }} />
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
              <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.slice(0, 5).map((order, index) => (
                <div key={order.id || index} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-[11px] font-bold text-blue-600">
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
              <Package className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No products yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 5).map((product, index) => (
                <div key={product.name || index} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-[11px] font-bold text-amber-600">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="max-w-[180px] truncate text-[13px] font-semibold leading-tight">{product.name}</p>
                      <p className="text-[11px] text-muted-foreground">{product.sold} sold</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-bold text-emerald-600">{product.revenue}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
