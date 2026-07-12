import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/context/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";

const colors = ["text-primary", "text-info", "text-success", "text-warning"];

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Analytics() {
  const { isAdmin } = useAuth();
  const { data, isLoading } = useAnalytics();

  const stats = data?.stats ?? [];
  const visitorsData = data?.weeklyTraffic ?? [];
  const conversionData = data?.conversionTrend ?? [];
  const topPages = data?.topPages ?? [];
  const platform = data?.platform;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>{isAdmin ? "Marketplace-wide performance insights" : "Traffic and performance insights"}</p>
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            {stats.map((stat, index) => (
              <div key={stat.label} className="stat-card">
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1.5 tracking-tight ${colors[index] ?? "text-primary"}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-success font-semibold mt-1">{stat.change}</p>
              </div>
            ))}
          </div>

          {isAdmin && platform ? (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground font-medium">Total Customers</p>
                  <p className="text-2xl font-bold mt-1.5 tracking-tight">{platform.totals.customers.toLocaleString()}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground font-medium">Total Sellers</p>
                  <p className="text-2xl font-bold mt-1.5 tracking-tight">{platform.totals.sellers.toLocaleString()}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground font-medium">Products Listed</p>
                  <p className="text-2xl font-bold mt-1.5 tracking-tight">{platform.totals.products.toLocaleString()}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground font-medium">Refund Rate</p>
                  <p className="text-2xl font-bold mt-1.5 tracking-tight text-warning">{platform.refunds.refundRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {platform.refunds.total} refunds · {platform.refunds.returnRequests} returns
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="stat-card">
                  <h3 className="section-title mb-6">Revenue Trend (6 months)</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={platform.growth}>
                      <defs>
                        <linearGradient id="platformRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))" }} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        fill="url(#platformRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="stat-card">
                  <h3 className="section-title mb-6">Marketplace Growth</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={platform.growth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="newCustomers" name="New Customers" stroke="hsl(210, 90%, 54%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="newSellers" name="New Sellers" stroke="hsl(160, 72%, 40%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="newProducts" name="New Products" stroke="hsl(34, 94%, 52%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="orders" name="Orders" stroke="hsl(14, 78%, 57%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="stat-card">
                  <h3 className="section-title mb-6">Category Performance</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={platform.categoryPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="stat-card p-0 overflow-hidden">
                  <div className="px-5 pt-5 pb-4">
                    <h3 className="section-title">Best Performing Sellers</h3>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th className="pl-5">Seller</th>
                        <th>Shop</th>
                        <th>Orders</th>
                        <th className="pr-5">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platform.topSellers.map((seller) => (
                        <tr key={seller.id}>
                          <td className="font-medium pl-5">{seller.name}</td>
                          <td className="text-muted-foreground">{seller.shop}</td>
                          <td>{seller.orders}</td>
                          <td className="pr-5 font-semibold text-success">{money(seller.revenue)}</td>
                        </tr>
                      ))}
                      {platform.topSellers.length === 0 && (
                        <tr>
                          <td className="pl-5 py-8 text-muted-foreground" colSpan={4}>
                            No seller sales yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="stat-card p-0 overflow-hidden">
                <div className="px-5 pt-5 pb-4">
                  <h3 className="section-title">Best Performing Products</h3>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="pl-5">Product</th>
                      <th>Units Sold</th>
                      <th className="pr-5">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platform.topProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="font-medium pl-5">{product.name}</td>
                        <td>{product.sold}</td>
                        <td className="pr-5 font-semibold text-success">{money(product.revenue)}</td>
                      </tr>
                    ))}
                    {platform.topProducts.length === 0 && (
                      <tr>
                        <td className="pl-5 py-8 text-muted-foreground" colSpan={3}>
                          No product sales yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="stat-card">
              <h3 className="section-title mb-6">Weekly Traffic</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={visitorsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 89%)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "hsl(224, 10%, 46%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(224, 10%, 46%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(225, 14%, 89%)" }} />
                  <Bar dataKey="visitors" fill="hsl(246, 80%, 60%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pageViews" fill="hsl(246, 80%, 85%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="stat-card">
              <h3 className="section-title mb-6">Conversion Rate Trend</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={conversionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 89%)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(224, 10%, 46%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(224, 10%, 46%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(225, 14%, 89%)" }} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(160, 84%, 39%)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(160, 84%, 39%)", strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="stat-card p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <h3 className="section-title">Top Pages</h3>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="pl-5">Page</th>
                  <th>Views</th>
                  <th className="pr-5">Bounce Rate</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((page) => (
                  <tr key={page.page}>
                    <td className="font-medium font-mono text-xs pl-5">{page.page}</td>
                    <td className="text-muted-foreground">{page.views.toLocaleString()}</td>
                    <td className="pr-5">{page.bounceRate}</td>
                  </tr>
                ))}
                {topPages.length === 0 && (
                  <tr>
                    <td className="pl-5 py-8 text-muted-foreground" colSpan={3}>
                      No analytics pages available yet.
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
