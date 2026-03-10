import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Store, MapPin, Star, Package, Eye, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sellerStatusConfig } from "@/data/sellers";
import { useSellers } from "@/hooks/useSellers";

const statusIcons = { active: CheckCircle2, suspended: XCircle, pending: Clock, rejected: Ban };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sellers</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all sellers and their shops</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Sellers", value: sellers.length.toString(), color: "text-primary" },
          { label: "Active", value: sellers.filter((s) => s.status === "active").length.toString(), color: "text-emerald-600" },
          { label: "Pending", value: sellers.filter((s) => s.status === "pending").length.toString(), color: "text-amber-600" },
          { label: "Rejected", value: sellers.filter((s) => s.status === "rejected").length.toString(), color: "text-red-600" },
          { label: "Suspended", value: sellers.filter((s) => s.status === "suspended").length.toString(), color: "text-destructive" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search sellers by name, email or ID..." className="pl-10 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] h-10">
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
            <Card key={seller.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/sellers/${seller.id}`)}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0 shadow-sm">
                    {seller.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate">{seller.name}</h3>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0 ${sc.className}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {sc.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{seller.email}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{seller.location}</span>
                      <span>ID: {seller.id}</span>
                      <span>Joined: {new Date(seller.joinDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-center shrink-0">
                  <div>
                    <p className="text-lg font-bold">{seller.totalRevenue}</p>
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{seller.totalOrders.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Orders</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{seller.shops.length}</p>
                    <p className="text-[10px] text-muted-foreground">Shops</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/sellers/${seller.id}`); }}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Shops ({seller.shops.length})</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {seller.shops.map((shop) => (
                    <div key={shop.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                      <div className="h-9 w-9 rounded-lg bg-background border flex items-center justify-center shrink-0">
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
          <div className="text-center py-16 text-muted-foreground">
            <Store className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No sellers found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
