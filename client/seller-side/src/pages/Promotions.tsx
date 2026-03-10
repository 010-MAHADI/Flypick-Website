import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  Bell,
  Mail,
  Megaphone,
  Package,
  Plus,
  Send,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  Users,
  Target,
  TrendingUp,
  Calendar,
  Edit,
  Copy,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
}

interface Promotion {
  id: number;
  title: string;
  message: string;
  type: "email" | "notification" | "both";
  status: "draft" | "scheduled" | "sent" | "active";
  products: Product[];
  audience: string;
  sentCount?: number;
  openRate?: number;
  clickRate?: number;
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
}

const mockProducts: Product[] = [
  { id: 1, name: "Wireless Headphones Pro", price: 129.99, image: "/placeholder.svg", category: "Electronics" },
  { id: 2, name: "Organic Cotton T-Shirt", price: 34.99, image: "/placeholder.svg", category: "Clothing" },
  { id: 3, name: "Smart Watch Ultra", price: 299.99, image: "/placeholder.svg", category: "Electronics" },
  { id: 4, name: "Leather Crossbody Bag", price: 89.99, image: "/placeholder.svg", category: "Accessories" },
  { id: 5, name: "Premium Coffee Beans 1kg", price: 24.99, image: "/placeholder.svg", category: "Food" },
  { id: 6, name: "Yoga Mat Premium", price: 49.99, image: "/placeholder.svg", category: "Sports" },
];

const mockPromotions: Promotion[] = [
  {
    id: 1,
    title: "Summer Sale - Electronics",
    message: "Don't miss our biggest summer sale! Up to 40% off on all electronics. Limited time offer.",
    type: "both",
    status: "sent",
    products: [mockProducts[0], mockProducts[2]],
    audience: "All Customers",
    sentCount: 1250,
    openRate: 42.5,
    clickRate: 18.3,
    createdAt: "2025-03-01",
    sentAt: "2025-03-02",
  },
  {
    id: 2,
    title: "New Arrivals Alert",
    message: "Fresh styles just dropped! Check out our new collection of premium clothing and accessories.",
    type: "email",
    status: "scheduled",
    products: [mockProducts[1], mockProducts[3]],
    audience: "Returning Customers",
    createdAt: "2025-03-05",
    scheduledAt: "2025-03-12",
  },
  {
    id: 3,
    title: "Flash Deal - Coffee Lovers",
    message: "24-hour flash deal! Get our Premium Coffee Beans at 30% off. Today only!",
    type: "notification",
    status: "draft",
    products: [mockProducts[4]],
    audience: "All Customers",
    createdAt: "2025-03-08",
  },
];

const typeConfig = {
  email: { label: "Email", icon: Mail, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  notification: { label: "Notification", icon: Bell, color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  both: { label: "Email & Notification", icon: Megaphone, color: "bg-purple-500/10 text-purple-600 border-purple-200" },
};

const statusConfig = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-600" },
  sent: { label: "Sent", color: "bg-green-500/10 text-green-600" },
  active: { label: "Active", color: "bg-emerald-500/10 text-emerald-600" },
};

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>(mockPromotions);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formType, setFormType] = useState<"email" | "notification" | "both">("email");
  const [formAudience, setFormAudience] = useState("all");
  const [formSelectedProducts, setFormSelectedProducts] = useState<number[]>([]);
  const [formSchedule, setFormSchedule] = useState(false);
  const [formScheduleDate, setFormScheduleDate] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const stats = {
    total: promotions.length,
    sent: promotions.filter((p) => p.status === "sent").length,
    scheduled: promotions.filter((p) => p.status === "scheduled").length,
    avgOpenRate:
      promotions.filter((p) => p.openRate).reduce((acc, p) => acc + (p.openRate || 0), 0) /
        (promotions.filter((p) => p.openRate).length || 1),
  };

  const filteredPromotions =
    activeTab === "all" ? promotions : promotions.filter((p) => p.status === activeTab);

  const resetForm = () => {
    setFormTitle("");
    setFormMessage("");
    setFormType("email");
    setFormAudience("all");
    setFormSelectedProducts([]);
    setFormSchedule(false);
    setFormScheduleDate("");
    setFormSubject("");
    setEditingId(null);
  };

  const openCreateDialog = (promo?: Promotion) => {
    if (promo) {
      setFormTitle(promo.title);
      setFormMessage(promo.message);
      setFormType(promo.type);
      setFormAudience(promo.audience === "All Customers" ? "all" : "returning");
      setFormSelectedProducts(promo.products.map((p) => p.id));
      setFormSchedule(!!promo.scheduledAt);
      setFormScheduleDate(promo.scheduledAt || "");
      setEditingId(promo.id);
    } else {
      resetForm();
    }
    setShowCreateDialog(true);
  };

  const handleSave = (asDraft: boolean) => {
    if (!formTitle.trim() || !formMessage.trim() || formSelectedProducts.length === 0) {
      toast({ title: "Missing fields", description: "Please fill in all required fields and select at least one product.", variant: "destructive" });
      return;
    }

    const selectedProds = mockProducts.filter((p) => formSelectedProducts.includes(p.id));
    const audienceLabel = formAudience === "all" ? "All Customers" : "Returning Customers";

    if (editingId) {
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
                ...p,
                title: formTitle,
                message: formMessage,
                type: formType,
                audience: audienceLabel,
                products: selectedProds,
                status: asDraft ? "draft" : formSchedule ? "scheduled" : "sent",
                scheduledAt: formSchedule ? formScheduleDate : undefined,
                sentAt: !asDraft && !formSchedule ? new Date().toISOString().split("T")[0] : undefined,
              }
            : p
        )
      );
      toast({ title: "Promotion updated", description: `"${formTitle}" has been updated.` });
    } else {
      const newPromo: Promotion = {
        id: Date.now(),
        title: formTitle,
        message: formMessage,
        type: formType,
        status: asDraft ? "draft" : formSchedule ? "scheduled" : "sent",
        products: selectedProds,
        audience: audienceLabel,
        createdAt: new Date().toISOString().split("T")[0],
        scheduledAt: formSchedule ? formScheduleDate : undefined,
        sentAt: !asDraft && !formSchedule ? new Date().toISOString().split("T")[0] : undefined,
        sentCount: !asDraft && !formSchedule ? Math.floor(Math.random() * 2000) + 500 : undefined,
      };
      setPromotions((prev) => [newPromo, ...prev]);
      toast({
        title: asDraft ? "Draft saved" : formSchedule ? "Promotion scheduled" : "Promotion sent!",
        description: asDraft
          ? `"${formTitle}" saved as draft.`
          : formSchedule
          ? `"${formTitle}" scheduled for ${formScheduleDate}.`
          : `"${formTitle}" sent to ${audienceLabel}.`,
      });
    }

    setShowCreateDialog(false);
    resetForm();
  };

  const handleDelete = (id: number) => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Promotion deleted", description: "The promotion has been removed." });
  };

  const handleDuplicate = (promo: Promotion) => {
    const dup: Promotion = {
      ...promo,
      id: Date.now(),
      title: `${promo.title} (Copy)`,
      status: "draft",
      sentCount: undefined,
      openRate: undefined,
      clickRate: undefined,
      sentAt: undefined,
      scheduledAt: undefined,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setPromotions((prev) => [dup, ...prev]);
    toast({ title: "Promotion duplicated", description: `"${dup.title}" created as draft.` });
  };

  const toggleProduct = (productId: number) => {
    setFormSelectedProducts((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Promotions</h1>
          <p className="text-sm text-muted-foreground mt-1">Promote your products via email campaigns and push notifications</p>
        </div>
        <Button onClick={() => openCreateDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Promotion
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Campaigns", value: stats.total, icon: Megaphone, color: "text-primary" },
          { label: "Sent", value: stats.sent, icon: Send, color: "text-green-600" },
          { label: "Scheduled", value: stats.scheduled, icon: Clock, color: "text-blue-600" },
          { label: "Avg. Open Rate", value: `${stats.avgOpenRate.toFixed(1)}%`, icon: TrendingUp, color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promotions List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {filteredPromotions.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardContent className="py-12 text-center">
                <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No promotions found</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first promotion to start engaging customers.</p>
              </CardContent>
            </Card>
          ) : (
            filteredPromotions.map((promo) => {
              const tConfig = typeConfig[promo.type];
              const sConfig = statusConfig[promo.status];
              return (
                <Card key={promo.id} className="border-border/50 hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-foreground truncate">{promo.title}</h3>
                          <Badge variant="outline" className={sConfig.color}>{sConfig.label}</Badge>
                          <Badge variant="outline" className={tConfig.color}>
                            <tConfig.icon className="h-3 w-3 mr-1" />
                            {tConfig.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{promo.message}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{promo.products.length} product{promo.products.length > 1 ? "s" : ""}</span>
                          <span className="flex items-center gap-1"><Target className="h-3 w-3" />{promo.audience}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{promo.scheduledAt ? `Scheduled: ${promo.scheduledAt}` : promo.sentAt ? `Sent: ${promo.sentAt}` : `Created: ${promo.createdAt}`}</span>
                        </div>
                      </div>

                      {/* Metrics */}
                      {promo.status === "sent" && (
                        <div className="flex items-center gap-6 text-center">
                          <div>
                            <p className="text-lg font-bold text-foreground">{promo.sentCount?.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sent</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">{promo.openRate}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Opened</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">{promo.clickRate}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Clicked</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedPromotion(promo); setShowPreviewDialog(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {promo.status === "draft" && (
                          <Button variant="ghost" size="icon" onClick={() => openCreateDialog(promo)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(promo)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(promo.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateDialog(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Promotion" : "Create Promotion"}</DialogTitle>
            <DialogDescription>Set up your promotion campaign with email, notification, or both.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Channel */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Channel</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["email", "notification", "both"] as const).map((t) => {
                  const cfg = typeConfig[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setFormType(t)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm ${
                        formType === t ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <cfg.icon className="h-5 w-5" />
                      <span className="font-medium">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title & Subject */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="promo-title">Campaign Title *</Label>
                <Input id="promo-title" placeholder="e.g. Summer Flash Sale" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>
              {(formType === "email" || formType === "both") && (
                <div className="space-y-1.5">
                  <Label htmlFor="promo-subject">Email Subject</Label>
                  <Input id="promo-subject" placeholder="e.g. 🔥 Don't miss our sale!" value={formSubject} onChange={(e) => setFormSubject(e.target.value)} />
                </div>
              )}
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label htmlFor="promo-message">Message *</Label>
              <Textarea id="promo-message" placeholder="Write your promotional message..." rows={4} value={formMessage} onChange={(e) => setFormMessage(e.target.value)} />
            </div>

            {/* Products */}
            <div className="space-y-2">
              <Label>Select Products *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                {mockProducts.map((product) => (
                  <label
                    key={product.id}
                    className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                      formSelectedProducts.includes(product.id) ? "bg-primary/5 border border-primary/30" : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <Checkbox checked={formSelectedProducts.includes(product.id)} onCheckedChange={() => toggleProduct(product.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">${product.price} · {product.category}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{formSelectedProducts.length} product(s) selected</p>
            </div>

            {/* Audience */}
            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <Select value={formAudience} onValueChange={setFormAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="returning">Returning Customers</SelectItem>
                  <SelectItem value="new">New Customers</SelectItem>
                  <SelectItem value="inactive">Inactive Customers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <Label className="text-sm font-medium">Schedule for later</Label>
                <p className="text-xs text-muted-foreground">Set a specific date and time to send</p>
              </div>
              <Switch checked={formSchedule} onCheckedChange={setFormSchedule} />
            </div>
            {formSchedule && (
              <Input type="datetime-local" value={formScheduleDate} onChange={(e) => setFormScheduleDate(e.target.value)} />
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleSave(true)}>
              Save as Draft
            </Button>
            <Button onClick={() => handleSave(false)} className="gap-2">
              <Send className="h-4 w-4" />
              {formSchedule ? "Schedule" : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Campaign Preview</DialogTitle>
          </DialogHeader>
          {selectedPromotion && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={statusConfig[selectedPromotion.status].color}>
                  {statusConfig[selectedPromotion.status].label}
                </Badge>
                <Badge variant="outline" className={typeConfig[selectedPromotion.type].color}>
                  <Mail className="h-3 w-3 mr-1" />
                  {typeConfig[selectedPromotion.type].label}
                </Badge>
              </div>

              {/* Email Preview */}
              {(selectedPromotion.type === "email" || selectedPromotion.type === "both") && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Email Preview</CardDescription>
                    <CardTitle className="text-base">{selectedPromotion.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{selectedPromotion.message}</p>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Featured Products:</p>
                      {selectedPromotion.products.map((product) => (
                        <div key={product.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground">${product.price}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notification Preview */}
              {(selectedPromotion.type === "notification" || selectedPromotion.type === "both") && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Push Notification Preview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl bg-muted p-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
                          <Bell className="h-3 w-3 text-primary-foreground" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Flypick</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">now</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{selectedPromotion.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{selectedPromotion.message}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{selectedPromotion.audience}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Created: {selectedPromotion.createdAt}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
