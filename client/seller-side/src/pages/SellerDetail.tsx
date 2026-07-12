import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Ban,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Package,
  Shield,
  ShoppingCart,
  Star,
  Store,
  TrendingUp,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { sellerStatusConfig } from "@/data/sellers";
import {
  type AdminSellerProduct,
  useModerateProduct,
  useSellerDetail,
  useSetShopStatus,
  useUpdateSellerStatus,
} from "@/hooks/useSellers";

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const percent = (value: number) => `${Number(value || 0).toFixed(1)}%`;

const dateText = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "N/A";

const statTone: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
};

function Metric({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: keyof typeof statTone;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className={`rounded-lg p-2 ${statTone[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </Card>
  );
}

const CUSTOMER_SITE_URL = (import.meta.env.VITE_CUSTOMER_URL || "http://localhost:8080").replace(/\/$/, "");

const productStatusClass: Record<string, string> = {
  Active: "border-success/30 bg-success/10 text-success",
  Draft: "border-muted-foreground/30 bg-muted text-muted-foreground",
  Suspended: "border-warning/30 bg-warning/10 text-warning",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

function AdminProductCard({
  product,
  onAction,
  isModerating,
}: {
  product: AdminSellerProduct;
  onAction: (product: AdminSellerProduct, status: "Active" | "Suspended" | "Rejected") => void;
  isModerating?: boolean;
}) {
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-10 w-10 text-muted-foreground/40" />
        )}
        <Badge variant="outline" className={`absolute left-2 top-2 ${productStatusClass[product.status] || productStatusClass.Draft}`}>
          {product.status}
        </Badge>
        {product.isFeatured ? (
          <Badge variant="outline" className="absolute right-2 top-2 border-primary/30 bg-primary/10 text-primary">
            <Star className="mr-1 h-3 w-3" />
            Featured
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <a
          href={`${CUSTOMER_SITE_URL}/product/${product.id}`}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-sm font-semibold hover:text-primary hover:underline underline-offset-4"
          title="Open on customer site"
        >
          {product.name}
          <ExternalLink className="ml-1 inline h-3 w-3 align-baseline" />
        </a>
        <p className="mt-1 text-xs text-muted-foreground">
          {money(product.price)} | {product.sold} sold | {product.stock} stock
        </p>
        {product.moderation?.reason ? (
          <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
            <span className="font-semibold">Reason:</span> {product.moderation.reason}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {product.status !== "Active" ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] text-success" disabled={isModerating} onClick={() => onAction(product, "Active")}>
              Approve
            </Button>
          ) : null}
          {product.status !== "Suspended" ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] text-warning" disabled={isModerating} onClick={() => onAction(product, "Suspended")}>
              Freeze
            </Button>
          ) : null}
          {product.status !== "Rejected" ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] text-destructive" disabled={isModerating} onClick={() => onAction(product, "Rejected")}>
              Reject
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function SellerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: seller, isLoading } = useSellerDetail(id);
  const updateStatus = useUpdateSellerStatus(id);
  const setShopStatus = useSetShopStatus(id);
  const moderateProduct = useModerateProduct(id);
  const [reviewNote, setReviewNote] = useState("");
  const [moderationTarget, setModerationTarget] = useState<{
    product: AdminSellerProduct;
    status: "Suspended" | "Rejected";
  } | null>(null);
  const [moderationReason, setModerationReason] = useState("");

  const analytics = seller?.analytics;
  const statusConfig = seller ? sellerStatusConfig[seller.status] : sellerStatusConfig.pending;

  const productCounts = analytics?.products?.counts || {};
  const overview = analytics?.overview || {};
  const sales = analytics?.sales || {};
  const customers = analytics?.customers || {};
  const shopAnalytics = analytics?.shopAnalytics || {};
  const performance = analytics?.performance || {};

  const primaryShop = seller?.shops?.[0];
  const healthTone = Number(overview.shopHealthScore || 0) >= 80 ? "success" : Number(overview.shopHealthScore || 0) >= 50 ? "warning" : "destructive";

  const actionButtons = useMemo(
    () => [
      { label: "Approve", status: "active" as const, icon: CheckCircle2, show: seller?.status !== "active" },
      { label: "Suspend", status: "suspended" as const, icon: Ban, show: seller?.status === "active" },
      { label: "Reject", status: "rejected" as const, icon: XCircle, show: seller?.status === "pending" },
    ],
    [seller?.status]
  );

  const submitStatus = async (status: "active" | "suspended" | "pending" | "rejected", verified?: boolean) => {
    try {
      await updateStatus.mutateAsync({ status, verified, review_note: reviewNote });
      toast.success("Seller status updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update seller");
    }
  };

  const toggleShopFreeze = async () => {
    if (!primaryShop) return;
    const nextStatus = primaryShop.status === "active" ? "inactive" : "active";
    try {
      await setShopStatus.mutateAsync({ shopId: primaryShop.id, status: nextStatus, reason: reviewNote });
      toast.success(nextStatus === "inactive" ? "Shop frozen" : "Shop unfrozen");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to update shop status");
    }
  };

  const handleProductAction = (product: AdminSellerProduct, status: "Active" | "Suspended" | "Rejected") => {
    if (status === "Active") {
      moderateProduct
        .mutateAsync({ productId: product.id, status })
        .then(() => toast.success("Product approved"))
        .catch((error: any) => toast.error(error?.response?.data?.detail || "Failed to moderate product"));
      return;
    }
    setModerationReason("");
    setModerationTarget({ product, status });
  };

  const confirmModeration = async () => {
    if (!moderationTarget) return;
    if (!moderationReason.trim()) {
      toast.error("Please write a reason for the seller.");
      return;
    }
    try {
      await moderateProduct.mutateAsync({
        productId: moderationTarget.product.id,
        status: moderationTarget.status,
        reason: moderationReason.trim(),
      });
      toast.success(moderationTarget.status === "Suspended" ? "Product frozen" : "Product rejected");
      setModerationTarget(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to moderate product");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!seller || !analytics) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <Store className="h-10 w-10 opacity-40" />
        <p className="font-semibold">Seller not found</p>
        <Button variant="outline" onClick={() => navigate("/sellers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sellers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/sellers")}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sellers
      </Button>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden rounded-2xl border-border/60 p-0">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/60 text-xl font-bold text-primary-foreground shadow-md ring-4 ring-primary/10">
                {(seller.name || 'S').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{seller.name}</h1>
                  <Badge variant="outline" className={statusConfig.className}>{statusConfig.label}</Badge>
                  {seller.verified ? (
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      <BadgeCheck className="mr-1 h-3 w-3" />
                      Verified
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{seller.email}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {dateText(seller.joinDate)}</span>
                  <span className="flex items-center gap-1"><Store className="h-3 w-3" /> {primaryShop?.name || "No shop"}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Admin Controls</h2>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <Textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Optional admin note"
            className="mb-3 min-h-[72px] rounded-xl"
          />
          <div className="flex flex-wrap gap-2">
            {actionButtons.filter((action) => action.show).map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.status === "suspended" || action.status === "rejected" ? "destructive" : "default"}
                className="rounded-lg"
                onClick={() => submitStatus(action.status, action.status === "active" ? true : undefined)}
                disabled={updateStatus.isPending}
              >
                <action.icon className="mr-1.5 h-3.5 w-3.5" />
                {action.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => submitStatus(seller.status, !seller.verified)}
              disabled={updateStatus.isPending}
            >
              <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
              {seller.verified ? "Revoke Verify" : "Verify"}
            </Button>
            {primaryShop ? (
              <Button
                size="sm"
                variant="outline"
                className={`rounded-lg ${primaryShop.status === "active" ? "text-destructive" : "text-success"}`}
                onClick={toggleShopFreeze}
                disabled={setShopStatus.isPending}
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                {primaryShop.status === "active" ? "Freeze Shop" : "Unfreeze Shop"}
              </Button>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Metric label="Total Revenue" value={money(sales.totalRevenue)} icon={DollarSign} tone="success" />
        <Metric label="Total Orders" value={sales.totalOrders || 0} icon={ShoppingCart} />
        <Metric label="Products" value={productCounts.total || 0} icon={Package} />
        <Metric label="Customers" value={customers.total || 0} icon={Users} tone="info" />
        <Metric label="Seller Rating" value={overview.sellerRating || 0} icon={Star} tone="warning" />
        <Metric label="Health Score" value={percent(overview.shopHealthScore)} icon={Activity} tone={healthTone as any} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Shop Status" value={String(overview.shopStatus || "not_created")} icon={Store} />
            <Metric label="Verification" value={String(overview.verificationStatus || "unverified")} icon={Shield} tone="success" />
            <Metric label="Shop Age" value={`${overview.shopAgeDays || 0} days`} icon={Calendar} tone="info" />
            <Metric label="Followers" value={overview.totalFollowers || 0} icon={Users} tone="muted" />
          </div>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Shop Snapshot</h3>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p><span className="text-muted-foreground">Business:</span> {primaryShop?.name || "No shop"}</p>
              <p><span className="text-muted-foreground">Category:</span> {primaryShop?.category || "N/A"}</p>
              <p><span className="text-muted-foreground">Phone:</span> {seller.phone}</p>
              <p><span className="text-muted-foreground">Address:</span> {seller.address}</p>
              <p><span className="text-muted-foreground">Created:</span> {dateText(overview.shopCreationDate)}</p>
              <p><span className="text-muted-foreground">Last active:</span> {dateText(overview.lastActive)}</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Metric label="Today" value={sales.todaysOrders || 0} icon={Clock} />
            <Metric label="Weekly" value={sales.weeklyOrders || 0} icon={TrendingUp} />
            <Metric label="Monthly" value={sales.monthlyOrders || 0} icon={BarChart3} />
            <Metric label="Pending" value={sales.pendingOrders || 0} icon={Clock} tone="warning" />
            <Metric label="Refunds" value={sales.refundRequests || 0} icon={XCircle} tone="destructive" />
          </div>
          <Card className="p-4">
            <h3 className="mb-4 text-sm font-semibold">Revenue and Orders</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={sales.dailySales || []}>
                <defs>
                  <linearGradient id="sellerRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#sellerRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <Metric label="Active" value={productCounts.active || 0} icon={CheckCircle2} tone="success" />
            <Metric label="Draft" value={productCounts.draft || 0} icon={FileText} tone="muted" />
            <Metric label="Suspended" value={productCounts.suspended || 0} icon={Ban} tone="destructive" />
            <Metric label="Rejected" value={productCounts.rejected || 0} icon={XCircle} tone="destructive" />
            <Metric label="Out of Stock" value={productCounts.outOfStock || 0} icon={Package} tone="warning" />
            <Metric label="Views" value={shopAnalytics.productViews || 0} icon={Eye} tone="info" />
          </div>
          {analytics.products.all?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {analytics.products.all.map((product) => (
                <AdminProductCard
                  key={product.id}
                  product={product}
                  onAction={handleProductAction}
                  isModerating={moderateProduct.isPending}
                />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              This seller has no products yet.
            </Card>
          )}
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Metric label="Repeat Customers" value={customers.repeatCustomers || 0} icon={Users} tone="success" />
            <Metric label="New Customers" value={customers.newCustomers || 0} icon={Users} />
            <Metric label="Average Order" value={money(customers.averageOrderValue)} icon={DollarSign} tone="success" />
            <Metric label="Satisfaction" value={customers.satisfaction || 0} icon={Star} tone="warning" />
            <Metric label="Ratings" value={customers.ratings || 0} icon={BadgeCheck} tone="info" />
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="Response Time" value={performance.responseTime || "N/A"} icon={Clock} />
            <Metric label="Acceptance Rate" value={percent(performance.acceptanceRate)} icon={CheckCircle2} tone="success" />
            <Metric label="Cancellation Rate" value={percent(performance.cancellationRate)} icon={Ban} tone="destructive" />
            <Metric label="Refund Rate" value={percent(performance.refundRate)} icon={XCircle} tone="warning" />
            <Metric label="On-Time Shipping" value={percent(performance.onTimeShippingRate)} icon={Truck} tone="success" />
            <Metric label="Late Delivery" value={percent(performance.lateDeliveryRate)} icon={Clock} tone="warning" />
          </div>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Order Status</h3>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {analytics.orders.statusCounts.length ? analytics.orders.statusCounts.map((status) => (
                <div key={status.status} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm text-muted-foreground">{status.label}</span>
                  <span className="font-bold">{status.count}</span>
                </div>
              )) : <p className="text-sm text-muted-foreground">No order data yet</p>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">National ID</h3>
              </div>
              <p className="text-sm text-muted-foreground">{analytics.documents.nationalId || "Not uploaded"}</p>
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Bank Information</h3>
              </div>
              <p className="text-sm text-muted-foreground">{analytics.documents.bankInformation || "Not uploaded"}</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-3">
          {analytics.timeline.length ? analytics.timeline.map((item) => (
            <Card key={`${item.type}-${item.createdAt}-${item.description}`} className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateText(item.createdAt)}</p>
                </div>
              </div>
            </Card>
          )) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">No activity yet</Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!moderationTarget} onOpenChange={(open) => !open && setModerationTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {moderationTarget?.status === "Suspended" ? "Freeze product" : "Reject product"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {moderationTarget?.product.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {moderationTarget?.status === "Suspended"
              ? "A frozen product is unpublished and the seller cannot re-publish it until an admin approves it again."
              : "A rejected product is unpublished; the seller can fix the issue and re-publish it themselves."}
          </p>
          <Textarea
            value={moderationReason}
            onChange={(event) => setModerationReason(event.target.value)}
            placeholder="Write a reason for the seller (required)"
            className="min-h-[90px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModerationTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={moderateProduct.isPending}
              onClick={confirmModeration}
            >
              {moderationTarget?.status === "Suspended" ? "Freeze" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
