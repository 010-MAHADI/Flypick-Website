import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";
import api from "@/lib/api";

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const { currentShop, updateShop } = useShop();
  const [storeName, setStoreName] = useState("Flypick");
  const [storeEmail, setStoreEmail] = useState(user?.email || "admin@flypick.com");
  const [storeDescription, setStoreDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentShop) {
      setStoreName(currentShop.name);
      setStoreDescription(currentShop.description || "");
    }
  }, [currentShop]);

  useEffect(() => {
    if (user?.email) {
      setStoreEmail(user.email);
    }
  }, [user?.email]);

  const saveGeneral = async () => {
    if (!currentShop?.id) {
      toast.error("No shop selected.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.patch(`/products/shops/${currentShop.id}/`, {
        name: storeName,
        description: storeDescription,
      });
      updateShop(currentShop.id, {
        name: response.data?.name || storeName,
        description: response.data?.description || storeDescription,
      });
      toast.success(isAdmin ? "Flypick shop name updated." : "Shop settings updated.");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>
          {isAdmin
            ? "Manage main admin account settings and Flypick shop name"
            : "Manage your shop and account settings"}
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="rounded-lg bg-muted/60 p-1">
          <TabsTrigger value="general" className="rounded-md">General</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-md">Notifications</TabsTrigger>
          <TabsTrigger value="security" className="rounded-md">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <div className="stat-card space-y-5">
            <h3 className="section-title">Store Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isAdmin ? "Main Shop Name" : "Shop Name"}</Label>
                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} className="rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Store Description</Label>
              <Textarea
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <Button onClick={saveGeneral} className="rounded-lg" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-6">
          <div className="stat-card space-y-5">
            <h3 className="section-title">Email Notifications</h3>
            {[
              { label: "New orders", desc: "Get notified when a new order is placed", default: true },
              { label: "Low stock alerts", desc: "Alert when product stock falls below threshold", default: true },
              { label: "New reviews", desc: "Notification for new customer reviews", default: false },
              { label: "Customer messages", desc: "New customer support messages", default: true },
              { label: "Weekly reports", desc: "Receive weekly sales summary", default: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Switch defaultChecked={item.default} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 mt-6">
          <div className="stat-card space-y-5">
            <h3 className="section-title">Change Password</h3>
            <div className="space-y-2"><Label>Current Password</Label><Input type="password" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>New Password</Label><Input type="password" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" className="rounded-lg" /></div>
            <Button onClick={() => toast.success("Password updated")} className="rounded-lg">Update Password</Button>
          </div>
          <div className="stat-card space-y-5">
            <h3 className="section-title">Two-Factor Authentication</h3>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Enable 2FA</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security</p>
              </div>
              <Switch />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
