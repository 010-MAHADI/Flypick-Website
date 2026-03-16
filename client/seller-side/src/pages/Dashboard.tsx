import { useMemo } from "react";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useDashboard } from "@/hooks/useDashboard";
import { useShop } from "@/context/ShopContext";

const COLORS = [
  "hsl(4, 80%, 52%)",
  "hsl(160, 84%, 39%)",
  "hsl(36, 100%, 50%)",
  "hsl(280, 65%, 55%)",
  "hsl(200, 70%, 50%)",
];

const statusClass: Record<string, string> = {
  Delivered: "status-badge status-badge--success",
  Processing: "status-badge status-badge--info",
  Shipped: "status-badge status-badge--warning",
  Pending: "status-badge status-badge--destructive",
};

export default function Dashboard() {
  const { currentShop } = useShop();
  const { data: dashboardData, isLoading } = useDashboard(currentShop?.id);

  const revData = useMemo(() => {
    // Use real revenue data if available, otherwise show empty state
    if (dashboardData?.revenueData?.length) {
      return {
        value: dashboardData.stats.totalRevenue,
        change: "+0%", // We don't have historical comparison data yet
        up: true,
        chartData: dashboardData.revenueData,
        badgeText: "Last 7 days"
      };
    }
    return {
      value: "$0.00",
      change: "+0%",
      up: true,
      chartData: [
        { label: "No data", revenue: 0 }
      ],
      badgeText: "No data"
    };
  }, [dashboardData]);

  const categoryData = useMemo(() => {
    return dashboardData?.categoryData?.length ? dashboardData.categoryData : [
      { name: "No data", value: 100 }
    ];
  }, [dashboardData]);

  const topProducts = useMemo(() => {
    return dashboardData?.topProducts?.length ? dashboardData.topProducts : [
      { name: "No products found", sold: 0, revenue: "$0.00" }
    ];
  }, [dashboardData]);

  const stats = useMemo(() => {
    if (!dashboardData) {
      return [
        { label: "Total Revenue", value: "$0", change: "0%", up: true, icon: DollarSign, gradient: "from-primary/10 to-primary/5", iconBg: "bg-primary/10 text-primary" },
        { label: "Total Orders", value: "0", change: "0%", up: true, icon: ShoppingCart, gradient: "from-success/10 to-success/5", iconBg: "bg-success/10 text-success" },
        { label: "Total Customers", value: "0", change: "0%", up: true, icon: Users, gradient: "from-info/10 to-info/5", iconBg: "bg-info/10 text-info" },
        { label: "Total Products", value: "0", change: "0%", up: false, icon: Package, gradient: "from-warning/10 to-warning/5", iconBg: "bg-warning/10 text-warning" },
      ];
    }

    return [
      { label: "Total Revenue", value: dashboardData.stats.totalRevenue, change: "+0%", up: true, icon: DollarSign, gradient: "from-primary/10 to-primary/5", iconBg: "bg-primary/10 text-primary" },
      { label: "Total Orders", value: dashboardData.stats.totalOrders.toLocaleString(), change: "+0%", up: true, icon: ShoppingCart, gradient: "from-success/10 to-success/5", iconBg: "bg-success/10 text-success" },
      { label: "Total Customers", value: dashboardData.stats.totalCustomers?.toLocaleString() || "N/A", change: "+0%", up: true, icon: Users, gradient: "from-info/10 to-info/5", iconBg: "bg-info/10 text-info" },
      { label: "Total Products", value: dashboardData.stats.activeProducts.toLocaleString(), change: "+0%", up: true, icon: Package, gradient: "from-warning/10 to-warning/5", iconBg: "bg-warning/10 text-warning" },
    ];
  }, [dashboardData]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;

  const displayRecentOrders = dashboardData?.recentOrders?.length ? dashboardData.recentOrders : [
    { id: "No orders", customer: "No data available", amount: "$0.00", status: "N/A", date: "-" }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="page-header flex items-end justify-between">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back! Here's what's happening with your shop.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          <span>Live overview</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} pointer-events-none`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={`rounded-xl p-2.5 ${stat.iconBg}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${stat.up ? "text-success" : "text-destructive"}`}>
                  {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {stat.change}
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="stat-card lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="section-title">Revenue Overview</h3>
            <span className="text-xs text-muted-foreground font-medium px-2.5 py-1 rounded-md bg-muted/50">{revData.badgeText}</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revData.chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(4, 80%, 52%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(4, 80%, 52%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 89%)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(224, 10%, 46%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(224, 10%, 46%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(225, 14%, 89%)", boxShadow: "0 4px 12px hsl(224 28% 12% / 0.08)" }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(4, 80%, 52%)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="section-title mb-6">Sales by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {categoryData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(225, 14%, 89%)" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2.5 mt-3">
            {categoryData.map((cat, idx) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-semibold">{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Recent Orders</h3>
            <a href="/orders" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline underline-offset-4">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="overflow-x-auto -mx-5">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="pl-5">Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th className="pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRecentOrders.map((order, index) => (
                  <tr key={order.id || index}>
                    <td className="font-medium font-mono text-xs pl-5">{order.id.toString().startsWith('#') ? order.id : `#ORD-${order.id}`}</td>
                    <td>{order.customer}</td>
                    <td className="font-semibold">{typeof order.amount === 'number' ? `$${order.amount.toFixed(2)}` : order.amount}</td>
                    <td className="pr-5"><span className={statusClass[order.status] || "status-badge status-badge--info"}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Top Products</h3>
            <a href="/products" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline underline-offset-4">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="overflow-x-auto -mx-5">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="pl-5">Product</th>
                  <th>Sold</th>
                  <th className="pr-5">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, index) => (
                  <tr key={p.name || index}>
                    <td className="font-medium max-w-[200px] truncate pl-5">{p.name}</td>
                    <td className="text-muted-foreground">{p.sold}</td>
                    <td className="font-semibold pr-5">{p.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}