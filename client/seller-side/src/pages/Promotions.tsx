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
import { useProducts } from "../hooks/useProducts";
import {
  usePromotions,
  usePromotionStats,
  useCreatePromotion,
  useUpdatePromotion,
  useDeletePromotion,
  useSendPromotion,
  useDuplicatePromotion,
  type PromotionCampaign,
  type CreateCampaignData
} from "@/hooks/usePromotions";
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
  Users,
  Target,
  TrendingUp,
  Calendar,
  Edit,
  Copy,
} from "lucide-react";

const typeConfig = {
  email: { label: "Email", icon: Mail, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  notification: { label: "Notification", icon: Bell, color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  both: { label: "Email & Notification", icon: Megaphone, color: "bg-purple-500/10 text-purple-600 border-purple-200" },
};

const statusConfig = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-600" },
  sending: { label: "Sending", color: "bg-orange-500/10 text-orange-600" },
  sent: { label: "Sent", color: "bg-green-500/10 text-green-600" },
  active: { label: "Active", color: "bg-emerald-500/10 text-emerald-600" },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-600" },
};

export default function Promotions() {
  // API hooks
  const { data: promotions = [], isLoading } = usePromotions();
  const { data: stats } = usePromotionStats();
  const { data: products = [] } = useProducts();
  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion();
  const deletePromotion = useDeletePromotion();
  const sendPromotion = useSendPromotion();
  const duplicatePromotion = useDuplicatePromotion();

  // UI state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<PromotionCampaign | null>(null);
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

  const defaultStats = {
    total_campaigns: 0,
    sent_campaigns: 0,
    scheduled_campaigns: 0,
    avg_open_rate: 0,
    avg_click_rate: 0,
    total_sent: 0,
    total_revenue: 0
  };

  const currentStats = stats || defaultStats;

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

  const openCreateDialog = (promo?: PromotionCampaign) => {
    if (promo) {
      setFormTitle(promo.title);
      setFormMessage(promo.message);
      setFormType(promo.channel);
      setFormAudience(promo.audience);
      setFormSelectedProducts(promo.products?.map((p) => p.id) || []);
      setFormSchedule(!!promo.scheduled_at);
      setFormScheduleDate(promo.scheduled_at || "");
      setFormSubject(promo.email_subject || "");
      setEditingId(promo.id);
    } else {
      resetForm();
    }
    setShowCreateDialog(true);
  };

  const handleSave = async (asDraft: boolean) => {
    if (!formTitle.trim() || !formMessage.trim() || formSelectedProducts.length === 0) {
      toast({ 
        title: "Missing fields", 
        description: "Please fill in all required fields and select at least one product.", 
        variant: "destructive" 
      });
      return;
    }

    const campaignData: CreateCampaignData = {
      title: formTitle,
      message: formMessage,
      email_subject: formSubject || undefined,
      channel: formType,
      audience: formAudience as any,
      product_ids: formSelectedProducts,
      scheduled_at: formSchedule ? formScheduleDate : undefined,
    };

    try {
      if (editingId) {
        await updatePromotion.mutateAsync({ id: editingId, data: campaignData });
        toast({ title: "Promotion updated", description: `"${formTitle}" has been updated.` });
      } else {
        const newPromo = await createPromotion.mutateAsync(campaignData);
        
        if (!asDraft && !formSchedule) {
          // Send immediately - this will now be asynchronous
          const sendResult = await sendPromotion.mutateAsync({ 
            id: newPromo.id, 
            data: { send_immediately: true } 
          });
          
          toast({
            title: "Promotion is being sent!",
            description: `"${formTitle}" is being sent in the background. You'll see the status update shortly.`,
          });
        } else {
          toast({
            title: asDraft ? "Draft saved" : "Promotion scheduled",
            description: asDraft
              ? `"${formTitle}" saved as draft.`
              : `"${formTitle}" scheduled for ${formScheduleDate}.`,
          });
        }
      }

      setShowCreateDialog(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save promotion",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePromotion.mutateAsync(id);
      toast({ title: "Promotion deleted", description: "The promotion has been removed." });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete promotion",
        variant: "destructive"
      });
    }
  };

  const handleDuplicate = async (promo: PromotionCampaign) => {
    try {
      await duplicatePromotion.mutateAsync(promo.id);
      toast({ title: "Promotion duplicated", description: `"${promo.title} (Copy)" created as draft.` });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to duplicate promotion",
        variant: "destructive"
      });
    }
  };

  const handleSendNow = async (promo: PromotionCampaign) => {
    try {
      await sendPromotion.mutateAsync({ 
        id: promo.id, 
        data: { send_immediately: true } 
      });
      toast({ 
        title: "Promotion is being sent!", 
        description: `"${promo.title}" is being sent in the background. You'll see the status update shortly.` 
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to send promotion",
        variant: "destructive"
      });
    }
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
          { label: "Total Campaigns", value: currentStats.total_campaigns, icon: Megaphone, color: "text-primary" },
          { label: "Sent", value: currentStats.sent_campaigns, icon: Send, color: "text-green-600" },
          { label: "Scheduled", value: currentStats.scheduled_campaigns, icon: Clock, color: "text-blue-600" },
          { label: "Avg. Open Rate", value: `${currentStats.avg_open_rate.toFixed(1)}%`, icon: TrendingUp, color: "text-amber-600" },
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
          {isLoading ? (
            <Card className="border-dashed border-border">
              <CardContent className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-3" />
                <p className="text-muted-foreground font-medium">Loading promotions...</p>
              </CardContent>
            </Card>
          ) : filteredPromotions.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardContent className="py-12 text-center">
                <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No promotions found</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first promotion to start engaging customers.</p>
              </CardContent>
            </Card>
          ) : (
            filteredPromotions.map((promo) => {
              const tConfig = typeConfig[promo.channel];
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
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{promo.products?.length || 0} product{(promo.products?.length || 0) > 1 ? "s" : ""}</span>
                          <span className="flex items-center gap-1"><Target className="h-3 w-3" />{promo.audience}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{promo.scheduled_at ? `Scheduled: ${new Date(promo.scheduled_at).toLocaleDateString()}` : promo.sent_at ? `Sent: ${new Date(promo.sent_at).toLocaleDateString()}` : `Created: ${new Date(promo.created_at).toLocaleDateString()}`}</span>
                        </div>
                      </div>

                      {/* Metrics */}
                      {promo.status === "sent" && (
                        <div className="flex items-center gap-6 text-center">
                          <div>
                            <p className="text-lg font-bold text-foreground">{promo.sent_count?.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sent</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">{promo.open_rate}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Opened</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">{promo.click_rate}%</p>
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
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openCreateDialog(promo)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleSendNow(promo)} disabled={sendPromotion.isPending}>
                              <Send className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {promo.status === "sending" && (
                          <div className="flex items-center gap-2 text-orange-600">
                            <div className="animate-spin h-4 w-4 border-2 border-orange-600 border-t-transparent rounded-full"></div>
                            <span className="text-xs">Sending...</span>
                          </div>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(promo)} disabled={duplicatePromotion.isPending}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {promo.status !== "sending" && (
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(promo.id)} disabled={deletePromotion.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
                {products.map((product) => (
                  <label
                    key={product.id}
                    className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                      formSelectedProducts.includes(product.id) ? "bg-primary/5 border border-primary/30" : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <Checkbox checked={formSelectedProducts.includes(product.id)} onCheckedChange={() => toggleProduct(product.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{product.title}</p>
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
            <Button variant="outline" onClick={() => handleSave(true)} disabled={createPromotion.isPending || updatePromotion.isPending}>
              Save as Draft
            </Button>
            <Button onClick={() => handleSave(false)} className="gap-2" disabled={createPromotion.isPending || updatePromotion.isPending}>
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
                <Badge variant="outline" className={typeConfig[selectedPromotion.channel].color}>
                  <Mail className="h-3 w-3 mr-1" />
                  {typeConfig[selectedPromotion.channel].label}
                </Badge>
              </div>

              {/* Email Preview */}
              {(selectedPromotion.channel === "email" || selectedPromotion.channel === "both") && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Email Preview</CardDescription>
                    <CardTitle className="text-base">{selectedPromotion.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{selectedPromotion.message}</p>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Featured Products:</p>
                      {selectedPromotion.products?.map((product) => (
                        <div key={product.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{product.title}</p>
                            <p className="text-xs text-muted-foreground">${product.price}</p>
                          </div>
                        </div>
                      )) || <p className="text-xs text-muted-foreground">No products selected</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notification Preview */}
              {(selectedPromotion.channel === "notification" || selectedPromotion.channel === "both") && (
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
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Created: {new Date(selectedPromotion.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
