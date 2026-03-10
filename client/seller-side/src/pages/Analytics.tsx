import {
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

import { useAnalytics } from "@/hooks/useAnalytics";

const colors = ["text-primary", "text-info", "text-success", "text-warning"];

export default function Analytics() {
  const { data, isLoading } = useAnalytics();

  const stats = data?.stats ?? [];
  const visitorsData = data?.weeklyTraffic ?? [];
  const conversionData = data?.conversionTrend ?? [];
  const topPages = data?.topPages ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>Traffic and performance insights</p>
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

