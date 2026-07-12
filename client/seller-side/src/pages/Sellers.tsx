import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Store, MapPin, Star, Package, Eye, CheckCircle2, XCircle, Clock, Ban, Users, TrendingUp, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sellerStatusConfig } from "@/data/sellers";
import { useSellers } from "@/hooks/useSellers";

const statusIcons = { active: CheckCircle2, suspended: XCircle, pending: Clock, rejected: Ban };

const kpiTone: Record<string, string> = {
  primary: "from-primary/15 to-primary/5 text-primary ring-primary/20",
  success: "from-success/15 to-success/5 text-success ring-success/20",
  warning: "from-warning/15 to-warning/5 text-warning ring-warning/20",
  destructive: "from-destructive/15 to-destructive/5 text-destructive ring-destructive/20",
  info: "from-info/15 to-info/5 text-info ring-info/20",
};

function KpiTile({ label, value, icon: Icon, tone = "primary" }: { label: string; value: string | number; icon: React.ElementType; tone?: keyof typeof kpiTone }) {
  return (
    <div className="stat-card flex items-center gap-3">
      <div className={`rounded-xl bg-gradient-to-br p-2.5 ring-1 ${kpiTone[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
}

export default function Sellers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: sellers = [], isLoading } = useSellers();

  const filtered = sellers.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading sellers...</div>;

  const activeCount = sellers.filter((s) => s.status === "active").length;
  const pendingCount = sellers.filter((s) => s.status === "pending").length;
  const rejectedCount = sellers.filter((s) => s.status === "rejected").length;
  const suspendedCount = sellers.filter((s) => s.status === "suspended").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between !mb-0">
        <div>
          <h1>Sellers</h1>
          <p>Manage every seller, their shops, and verification status</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{sellers.length} total accounts</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiTile label="Total" value={sellers.length} icon={Users} tone="primary" />
        <KpiTile label="Active" value={activeCount} icon={CheckCircle2} tone="success" />
        <KpiTile label="Pending" value={pendingCount} icon={Clock} tone="warning" />
        <KpiTile label="Rejected" value={rejectedCount} icon={XCircle} tone="destructive" />
        <KpiTile label="Suspended" value={suspendedCount} icon={Ban} tone="destructive" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search sellers by name, email or ID..." className="h-10 rounded-xl border-transparent bg-muted/50 pl-10 focus-visible:bg-background" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-[170px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filtered.map((seller) => {
          const sc = sellerStatusConfig[seller.status];
          const StatusIcon = statusIcons[seller.status];
          return (
            <Card key={seller.id} className="group cursor-pointer overflow-hidden rounded-2xl border-border/60 p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40" onClick={() => navigate(`/sellers/${seller.id}`)}>
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center text-base font-bold text-primary-foreground shrink-0 shadow-md ring-4 ring-primary/10">
                    {seller.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base tracking-tight truncate group-hover:text-primary transition-colors">{seller.name}</h3>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0 ${sc.className}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {sc.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{seller.email}</p>
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{seller.location}</span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono">{seller.id}</span>
                      <span>Joined {new Date(seller.joinDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-success/5 px-3 py-2 text-center ring-1 ring-success/10">
                      <p className="text-sm font-bold text-success">{seller.totalRevenue}</p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Revenue</p>
                    </div>
                    <div className="rounded-xl bg-info/5 px-3 py-2 text-center ring-1 ring-info/10">
                      <p className="text-sm font-bold text-info">{seller.totalOrders.toLocaleString()}</p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Orders</p>
                    </div>
                    <div className="rounded-xl bg-primary/5 px-3 py-2 text-center ring-1 ring-primary/10">
                      <p className="text-sm font-bold text-primary">{seller.shops.length}</p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Shops</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/sellers/${seller.id}`); }}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 bg-muted/20 px-5 py-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"><ShoppingBag className="h-3 w-3" /> Shops · {seller.shops.length}</p>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {seller.shops.map((shop) => (
                    <div key={shop.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background p-3 transition-colors hover:border-primary/30">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-muted to-muted/40 border border-border/40 flex items-center justify-center shrink-0">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{shop.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{shop.category}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{shop.rating}</span>
                          <span>•</span>
                          <span><Package className="h-2.5 w-2.5 inline mr-0.5" />{shop.products}</span>
                        </div>
                      </div>
                      <Badge variant={shop.status === "active" ? "default" : "secondary"} className="text-[9px] h-5">
                        {shop.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border py-16 text-center text-muted-foreground">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Store className="h-6 w-6 opacity-50" />
            </div>
            <p className="font-semibold">No sellers found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
