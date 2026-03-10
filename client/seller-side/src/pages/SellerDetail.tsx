import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Store, MapPin, Star, Package, ShoppingCart, Mail, Phone, Calendar,
  Shield, ShieldCheck, ShieldX, CreditCard, FileText, Edit2, Trash2, Ban,
  CheckCircle2, XCircle, Clock, Plus, ToggleLeft, ToggleRight, Percent,
  MessageSquare, AlertTriangle, Eye, TrendingUp, DollarSign, Users
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { sellerStatusConfig, shopStatusConfig, type Seller, type Shop } from "@/data/sellers";
import { useSellers } from "@/hooks/useSellers";
import { useEffect } from "react";

export default function SellerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sellers, isLoading } = useSellers();
  const sellerData = (sellers || []).find((s) => s.id === id);

  const [seller, setSeller] = useState<Seller | null>(null);
  useEffect(() => {
    if (sellerData) {
      setSeller({ ...sellerData, shops: sellerData.shops.map(s => ({ ...s })), notes: [...(sellerData.notes || [])] });
    }
  }, [sellerData]);
  const [editProfile, setEditProfile] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; label: string; shopId?: string } | null>(null);
  const [newNote, setNewNote] = useState("");
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", address: "", location: "" });
  const [shopForm, setShopForm] = useState({ name: "", description: "", category: "", commission: "" });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading details...</div>;
  }

  if (!seller) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 opacity-40" />
        <p className="font-semibold text-lg">Seller not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/sellers")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sellers
        </Button>
      </div>
    );
  }

  const sc = sellerStatusConfig[seller.status];

  const openEditProfile = () => {
    setProfileForm({ name: seller.name, email: seller.email, phone: seller.phone, address: seller.address, location: seller.location });
    setEditProfile(true);
  };

  const saveProfile = () => {
    setSeller({ ...seller, ...profileForm });
    setEditProfile(false);
    toast.success("Seller profile updated");
  };

  const openEditShop = (shop: Shop) => {
    setShopForm({ name: shop.name, description: shop.description, category: shop.category, commission: shop.commission.toString() });
    setEditShop(shop);
  };

  const saveShop = () => {
    if (!editShop) return;
    setSeller({
      ...seller,
      shops: seller.shops.map((s) =>
        s.id === editShop.id ? { ...s, name: shopForm.name, description: shopForm.description, category: shopForm.category, commission: Number(shopForm.commission) } : s
      ),
    });
    setEditShop(null);
    toast.success("Shop updated");
  };

  const toggleShopStatus = (shopId: string) => {
    setSeller({
      ...seller,
      shops: seller.shops.map((s) => (s.id === shopId ? { ...s, status: s.status === "active" ? "inactive" : "active" } : s)),
    });
    toast.success("Shop status updated");
  };

  const changeSellerStatus = (newStatus: "active" | "suspended" | "pending") => {
    setSeller({ ...seller, status: newStatus });
    setConfirmAction(null);
    toast.success(`Seller ${newStatus === "active" ? "activated" : newStatus === "suspended" ? "suspended" : "set to pending"}`);
  };

  const toggleVerification = () => {
    setSeller({ ...seller, verified: !seller.verified, idDocument: seller.verified ? "Revoked" : "Verified - Manual" });
    toast.success(seller.verified ? "Verification revoked" : "Seller verified");
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    setSeller({ ...seller, notes: [{ date: new Date().toISOString().split("T")[0], text: newNote.trim() }, ...seller.notes] });
    setNewNote("");
    toast.success("Note added");
  };

  const deleteShop = (shopId: string) => {
    setSeller({ ...seller, shops: seller.shops.filter((s) => s.id !== shopId) });
    setConfirmAction(null);
    toast.success("Shop removed");
  };

  const executeConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "suspend") changeSellerStatus("suspended");
    else if (confirmAction.type === "activate") changeSellerStatus("active");
    else if (confirmAction.type === "delete_shop" && confirmAction.shopId) deleteShop(confirmAction.shopId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/sellers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{seller.name}</h1>
            <Badge variant="outline" className={`text-xs px-2.5 py-0.5 ${sc.className}`}>{sc.label}</Badge>
            {seller.verified && (
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary border-primary/20">
                <ShieldCheck className="h-3 w-3 mr-1" /> Verified
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">ID: {seller.id} • Joined {new Date(seller.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={openEditProfile}>
            <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
          </Button>
          {seller.status === "active" ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmAction({ type: "suspend", label: `Suspend ${seller.name}? This will deactivate all their shops.` })}>
              <Ban className="h-3.5 w-3.5 mr-1.5" /> Suspend
            </Button>
          ) : (
            <Button size="sm" onClick={() => setConfirmAction({ type: "activate", label: `Activate ${seller.name}? This will restore their account.` })}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Activate
            </Button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: seller.totalRevenue, icon: DollarSign, color: "text-primary" },
          { label: "Total Orders", value: seller.totalOrders.toLocaleString(), icon: ShoppingCart, color: "text-primary" },
          { label: "Total Shops", value: seller.shops.length.toString(), icon: Store, color: "text-primary" },
          { label: "Avg. Rating", value: (seller.shops.reduce((a, s) => a + s.rating, 0) / seller.shops.length || 0).toFixed(1), icon: Star, color: "text-amber-500" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="shops" className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="shops" className="gap-1.5 text-xs"><Store className="h-3.5 w-3.5" /> Shops ({seller.shops.length})</TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="verification" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> Verification</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-xs"><MessageSquare className="h-3.5 w-3.5" /> Notes ({seller.notes.length})</TabsTrigger>
        </TabsList>

        {/* SHOPS TAB */}
        <TabsContent value="shops" className="space-y-4">
          {seller.shops.map((shop) => {
            const ssc = shopStatusConfig[shop.status];
            return (
              <Card key={shop.id} className="p-5">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Store className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{shop.name}</h3>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0 ${ssc.className}`}>{ssc.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{shop.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>ID: {shop.id}</span>
                        <span>•</span>
                        <span>{shop.category}</span>
                        <span>•</span>
                        <span>Commission: {shop.commission}%</span>
                        <span>•</span>
                        <span>Created: {new Date(shop.createdDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => toggleShopStatus(shop.id)}>
                      {shop.status === "active" ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      {shop.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => openEditShop(shop)}>
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmAction({ type: "delete_shop", label: `Delete "${shop.name}"? This cannot be undone.`, shopId: shop.id })}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>

                {/* Shop Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-bold text-sm">{shop.products}</p>
                      <p className="text-[10px] text-muted-foreground">Products</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center"><ShoppingCart className="h-4 w-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-bold text-sm">{shop.orders.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Orders</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center"><DollarSign className="h-4 w-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-bold text-sm">{shop.revenue}</p>
                      <p className="text-[10px] text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center"><Star className="h-4 w-4 text-amber-500" /></div>
                    <div>
                      <p className="font-bold text-sm">{shop.rating}</p>
                      <p className="text-[10px] text-muted-foreground">Rating</p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {seller.shops.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No shops</p>
            </div>
          )}
        </TabsContent>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Seller Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Mail, label: "Email", value: seller.email },
                { icon: Phone, label: "Phone", value: seller.phone },
                { icon: MapPin, label: "Location", value: seller.location },
                { icon: Calendar, label: "Joined", value: new Date(seller.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                  <div className="h-9 w-9 rounded-lg bg-background border flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium mt-0.5">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-background border flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Full Address</p>
                  <p className="text-sm font-medium mt-0.5">{seller.address}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Banking & Payout</h3>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="h-9 w-9 rounded-lg bg-background border flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Bank Account</p>
                <p className="text-sm font-medium mt-0.5">{seller.bankAccount}</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* VERIFICATION TAB */}
        <TabsContent value="verification" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Identity Verification</h3>
              <Button variant={seller.verified ? "destructive" : "default"} size="sm" onClick={toggleVerification}>
                {seller.verified ? <><ShieldX className="h-3.5 w-3.5 mr-1.5" /> Revoke Verification</> : <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Verify Seller</>}
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold">ID Document</p>
                </div>
                <p className="text-sm">{seller.idDocument}</p>
                <Badge variant="outline" className={`mt-2 text-[10px] ${seller.verified ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                  {seller.verified ? "Verified" : "Pending"}
                </Badge>
              </div>
              <div className="p-4 rounded-xl bg-muted/40 border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold">Account Status</p>
                </div>
                <p className="text-sm capitalize">{seller.status}</p>
                <Badge variant="outline" className={`mt-2 text-[10px] ${sc.className}`}>{sc.label}</Badge>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-3">Change Account Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["active", "pending", "suspended"] as const).map((status) => (
                <Button
                  key={status}
                  variant={seller.status === status ? "default" : "outline"}
                  size="sm"
                  className="capitalize"
                  disabled={seller.status === status}
                  onClick={() => {
                    if (status === "suspended") setConfirmAction({ type: "suspend", label: `Suspend ${seller.name}?` });
                    else changeSellerStatus(status);
                  }}
                >
                  {status === "active" && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                  {status === "pending" && <Clock className="h-3.5 w-3.5 mr-1.5" />}
                  {status === "suspended" && <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                  {status}
                </Button>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* NOTES TAB */}
        <TabsContent value="notes" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-3">Add Note</h3>
            <div className="flex gap-2">
              <Textarea placeholder="Write an admin note about this seller..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[80px]" />
            </div>
            <Button size="sm" className="mt-3" onClick={addNote} disabled={!newNote.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Note
            </Button>
          </Card>

          <div className="space-y-3">
            {seller.notes.map((note, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm">{note.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(note.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {seller.notes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No notes yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfile} onOpenChange={setEditProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Seller Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Full Name</Label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Email</Label>
                <Input value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Phone</Label>
                <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Location</Label>
              <Input value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Address</Label>
              <Textarea value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfile(false)}>Cancel</Button>
            <Button onClick={saveProfile}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shop Dialog */}
      <Dialog open={!!editShop} onOpenChange={() => setEditShop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Shop Name</Label>
              <Input value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea value={shopForm.description} onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Category</Label>
                <Input value={shopForm.category} onChange={(e) => setShopForm({ ...shopForm, category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Commission %</Label>
                <Input type="number" value={shopForm.commission} onChange={(e) => setShopForm({ ...shopForm, commission: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShop(null)}>Cancel</Button>
            <Button onClick={saveShop}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Confirm Action
            </DialogTitle>
            <DialogDescription>{confirmAction?.label}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeConfirmAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
