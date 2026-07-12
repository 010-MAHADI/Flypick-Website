import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, FileImage, MapPin, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
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

interface SellerAddressForm {
  name: string;
  village: string;
  postOffice: string;
  postCode: string;
  upazila: string;
  zilla: string;
  mobileNo: string;
}

interface ShippingMethodForm {
  id?: number;
  name: string;
  delivery_charge: string;
  estimated_delivery_time: string;
  description: string;
  is_enabled: boolean;
  sort_order: number;
}

const emptySellerAddress: SellerAddressForm = {
  name: "",
  village: "",
  postOffice: "",
  postCode: "",
  upazila: "",
  zilla: "",
  mobileNo: "",
};

const trim = (value?: string | null) => (value || "").trim();

export default function Settings() {
  const { user, isAdmin, isSeller, refreshUser } = useAuth();
  const { currentShop, updateShop, refreshShops } = useShop();
  const [storeName, setStoreName] = useState("Flypick");
  const [accountName, setAccountName] = useState(user?.username || "");
  const [storeEmail, setStoreEmail] = useState(user?.email || "");
  const [storeDescription, setStoreDescription] = useState("");
  const [sellerAddress, setSellerAddress] = useState<SellerAddressForm>(emptySellerAddress);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [bankInfo, setBankInfo] = useState("");
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);
  const [isSavingVerification, setIsSavingVerification] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethodForm[]>([]);
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  const idPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const showSellerAddressSection = !!currentShop;
  const showVerificationSection = isSeller;

  const loadShippingMethods = async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/products/shipping-methods/");
      const data = Array.isArray(response.data?.results) ? response.data.results : response.data;
      if (Array.isArray(data)) {
        setShippingMethods(data.map((method: any) => ({
          id: method.id,
          name: method.name || "",
          delivery_charge: method.delivery_charge ?? "",
          estimated_delivery_time: method.estimated_delivery_time || "",
          description: method.description || "",
          is_enabled: Boolean(method.is_enabled),
          sort_order: Number(method.sort_order ?? 0),
        })));
      }
    } catch (error) {
      toast.error("Failed to load shipping methods.");
    }
  };

  useEffect(() => {
    loadShippingMethods();
  }, [isAdmin]);

  useEffect(() => {
    const profile = user?.seller_profile;
    if (!profile) return;
    setIdNumber(profile.idDocument || "");
    setBankInfo(profile.bankAccount || "");
    setIdPhotoUrl(profile.id_photo || null);
  }, [user?.seller_profile]);

  useEffect(() => {
    if (!currentShop) {
      return;
    }

    setStoreName(currentShop.name);
    setStoreDescription(currentShop.description || "");
  }, [currentShop]);

  useEffect(() => {
    if (!currentShop) {
      setSellerAddress(emptySellerAddress);
      return;
    }

    setSellerAddress({
      name: trim(currentShop.senderName) || trim(currentShop.name),
      village: trim(currentShop.senderVillage),
      postOffice: trim(currentShop.senderPostOffice),
      postCode: trim(currentShop.senderPostCode),
      upazila: trim(currentShop.senderUpazila),
      zilla: trim(currentShop.senderZilla),
      mobileNo: trim(currentShop.senderMobileNo),
    });
  }, [currentShop]);

  useEffect(() => {
    setStoreEmail(user?.email || "");
    setAccountName(user?.username || "");
  }, [user?.email, user?.username]);

  const formattedSellerAddress = useMemo(() => {
    return [
      trim(sellerAddress.village),
      trim(sellerAddress.postOffice) ? `Post Office: ${trim(sellerAddress.postOffice)}` : "",
      trim(sellerAddress.postCode) ? `Post Code: ${trim(sellerAddress.postCode)}` : "",
      [trim(sellerAddress.upazila), trim(sellerAddress.zilla)].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join("\n");
  }, [sellerAddress]);

  const updateSellerAddressField = (field: keyof SellerAddressForm, value: string) => {
    setSellerAddress((current) => ({ ...current, [field]: value }));
  };

  const saveGeneral = async () => {
    setIsSavingGeneral(true);

    try {
      const requests: Promise<any>[] = [
        api.patch("/users/profile/", {
          email: trim(storeEmail),
          username: trim(accountName) || undefined,
        }),
      ];

      if (currentShop?.id) {
        requests.push(
          api.patch(`/products/shops/${currentShop.id}/`, {
            name: trim(storeName),
            description: trim(storeDescription),
          })
        );
      }

      const responses = await Promise.all(requests);
      const shopResponse = currentShop?.id ? responses[responses.length - 1] : null;

      if (currentShop?.id && shopResponse) {
        updateShop(currentShop.id, {
          name: shopResponse.data?.name || trim(storeName),
          description: shopResponse.data?.description || trim(storeDescription),
        });
      }

      await refreshUser();
      toast.success(isAdmin ? "Settings synced with database." : "Store settings synced with database.");
    } catch (error: any) {
      const data = error?.response?.data;
      const firstFieldError =
        typeof data === "object" && data
          ? Object.values(data).flat().find(Boolean)
          : null;
      toast.error(typeof firstFieldError === "string" ? firstFieldError : data?.detail || "Failed to save settings.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const saveSellerAddress = async () => {
    if (!showSellerAddressSection) {
      return;
    }

    if (!trim(sellerAddress.name) || !trim(sellerAddress.mobileNo)) {
      toast.error("Seller name and mobile number are required.");
      return;
    }

    setIsSavingAddress(true);

    try {
      if (!currentShop?.id) {
        toast.error("No shop selected.");
        return;
      }

      await api.patch(`/products/shops/${currentShop.id}/`, {
        sender_name: trim(sellerAddress.name),
        sender_mobile_no: trim(sellerAddress.mobileNo),
        sender_village: trim(sellerAddress.village),
        sender_post_office: trim(sellerAddress.postOffice),
        sender_post_code: trim(sellerAddress.postCode),
        sender_upazila: trim(sellerAddress.upazila),
        sender_zilla: trim(sellerAddress.zilla),
      });

      // Re-fetch shops from the server so the saved address is reflected immediately
      await refreshShops();

      toast.success("Seller address saved. It will now be used in print and download documents.");
    } catch (error: any) {
      const data = error?.response?.data;
      const firstFieldError =
        typeof data === "object" && data
          ? Object.values(data).flat().find(Boolean)
          : null;
      toast.error(typeof firstFieldError === "string" ? firstFieldError : data?.detail || "Failed to save seller address.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const saveVerification = async () => {
    setIsSavingVerification(true);
    try {
      await api.patch("/users/profile/", {
        seller_profile: {
          idDocument: trim(idNumber) || null,
          bankAccount: trim(bankInfo) || null,
        },
      });
      await refreshUser();
      toast.success("Verification & payment details saved.");
    } catch (error: any) {
      const data = error?.response?.data;
      toast.error(data?.detail || "Failed to save verification details.");
    } finally {
      setIsSavingVerification(false);
    }
  };

  const uploadIdPhoto = async (file: File) => {
    setIsUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await api.post("/users/profile/id-photo/", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setIdPhotoUrl(response.data?.id_photo || null);
      await refreshUser();
      toast.success("ID photo uploaded.");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to upload ID photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const updateShippingMethod = (index: number, field: keyof ShippingMethodForm, value: string | boolean | number) => {
    setShippingMethods((current) => current.map((method, idx) => idx === index ? { ...method, [field]: value } : method));
  };

  const addShippingMethod = () => {
    setShippingMethods((current) => [
      ...current,
      {
        name: "",
        delivery_charge: "",
        estimated_delivery_time: "",
        description: "",
        is_enabled: true,
        sort_order: current.length + 1,
      },
    ]);
  };

  const removeShippingMethod = async (index: number) => {
    const method = shippingMethods[index];
    if (!method.id) {
      setShippingMethods((current) => current.filter((_, idx) => idx !== index));
      return;
    }
    try {
      await api.delete(`/products/shipping-methods/${method.id}/`);
      setShippingMethods((current) => current.filter((_, idx) => idx !== index));
      toast.success("Shipping method removed.");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to remove shipping method.");
    }
  };

  const saveShippingMethods = async () => {
    const invalid = shippingMethods.find((method) => !trim(method.name) || !trim(method.estimated_delivery_time));
    if (invalid) {
      toast.error("Delivery name and estimated delivery time are required.");
      return;
    }

    setIsSavingShipping(true);
    try {
      for (const method of shippingMethods) {
        const payload = {
          name: trim(method.name),
          delivery_charge: trim(method.delivery_charge) === "" ? null : method.delivery_charge,
          estimated_delivery_time: trim(method.estimated_delivery_time),
          description: trim(method.description),
          is_enabled: method.is_enabled,
          sort_order: method.sort_order,
        };
        if (method.id) {
          await api.patch(`/products/shipping-methods/${method.id}/`, payload);
        } else {
          await api.post("/products/shipping-methods/", payload);
        }
      }
      await loadShippingMethods();
      toast.success("Shipping methods saved.");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to save shipping methods.");
    } finally {
      setIsSavingShipping(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>{isAdmin ? "Manage your admin account" : "Manage your shop, account, verification, and seller address details"}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="rounded-lg bg-muted/60 p-1">
          <TabsTrigger value="general" className="rounded-md">General</TabsTrigger>
          {showSellerAddressSection ? (
            <TabsTrigger value="seller-address" className="rounded-md">Seller Address</TabsTrigger>
          ) : null}
          {showVerificationSection ? (
            <TabsTrigger value="verification" className="rounded-md">Verification & Payment</TabsTrigger>
          ) : null}
          {isAdmin ? (
            <TabsTrigger value="shipping" className="rounded-md">Shipping Methods</TabsTrigger>
          ) : null}
          <TabsTrigger value="notifications" className="rounded-md">Notifications</TabsTrigger>
          <TabsTrigger value="security" className="rounded-md">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="stat-card space-y-5">
            <h3 className="section-title">{isAdmin ? "Account Information" : "Store Information"}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Admin Name</Label>
                  <Input value={accountName} onChange={(event) => setAccountName(event.target.value)} className="rounded-lg" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input value={storeName} onChange={(event) => setStoreName(event.target.value)} className="rounded-lg" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Account Email</Label>
                <Input value={storeEmail} onChange={(event) => setStoreEmail(event.target.value)} className="rounded-lg" />
              </div>
            </div>
            {!isAdmin ? (
              <div className="space-y-2">
                <Label>Store Description</Label>
                <Textarea value={storeDescription} onChange={(event) => setStoreDescription(event.target.value)} className="rounded-lg" />
              </div>
            ) : (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <p>
                    This is a <strong>platform administrator</strong> account. It manages the whole
                    marketplace and has no shop of its own — shop settings live in each seller&apos;s dashboard.
                  </p>
                </div>
              </div>
            )}
            <Button onClick={saveGeneral} className="rounded-lg" disabled={isSavingGeneral}>
              {isSavingGeneral ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {showSellerAddressSection ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="section-title">Seller Address Available</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open the <strong>Seller Address</strong> tab to add or edit the address used in Print or Download Documents.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {showSellerAddressSection ? (
          <TabsContent value="seller-address" className="mt-6 space-y-6">
            <div className="stat-card space-y-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="section-title">Seller Address</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add or edit your seller address. This saved address will be used automatically in the Print or Download Documents page.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={sellerAddress.name} onChange={(event) => updateSellerAddressField("name", event.target.value)} className="rounded-lg" placeholder="Seller name" />
                </div>
                <div className="space-y-2">
                  <Label>Mobile No</Label>
                  <Input value={sellerAddress.mobileNo} onChange={(event) => updateSellerAddressField("mobileNo", event.target.value)} className="rounded-lg" placeholder="Mobile number" />
                </div>
                <div className="space-y-2">
                  <Label>Village</Label>
                  <Input value={sellerAddress.village} onChange={(event) => updateSellerAddressField("village", event.target.value)} className="rounded-lg" placeholder="Village" />
                </div>
                <div className="space-y-2">
                  <Label>Post Office</Label>
                  <Input value={sellerAddress.postOffice} onChange={(event) => updateSellerAddressField("postOffice", event.target.value)} className="rounded-lg" placeholder="Post office" />
                </div>
                <div className="space-y-2">
                  <Label>Post Code</Label>
                  <Input value={sellerAddress.postCode} onChange={(event) => updateSellerAddressField("postCode", event.target.value)} className="rounded-lg" placeholder="Post code" />
                </div>
                <div className="space-y-2">
                  <Label>Upazila</Label>
                  <Input value={sellerAddress.upazila} onChange={(event) => updateSellerAddressField("upazila", event.target.value)} className="rounded-lg" placeholder="Upazila" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Zilla</Label>
                  <Input value={sellerAddress.zilla} onChange={(event) => updateSellerAddressField("zilla", event.target.value)} className="rounded-lg" placeholder="Zilla" />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-semibold">{sellerAddress.name || "Seller name"}</p>
                  <p>{sellerAddress.mobileNo || "Mobile number"}</p>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{formattedSellerAddress || "Seller address will appear here."}</pre>
                </div>
              </div>

              <Button onClick={saveSellerAddress} className="rounded-lg" disabled={isSavingAddress}>
                {isSavingAddress ? "Saving..." : "Save Seller Address"}
              </Button>
            </div>
          </TabsContent>
        ) : null}

        {showVerificationSection ? (
          <TabsContent value="verification" className="mt-6 space-y-6">
            <div className="stat-card space-y-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <BadgeCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="section-title">Identity Verification</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your ID details are visible only to the marketplace admin and speed up shop verification.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>National ID Number</Label>
                  <Input
                    value={idNumber}
                    onChange={(event) => setIdNumber(event.target.value)}
                    className="rounded-lg"
                    placeholder="NID number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID Photo</Label>
                  <input
                    ref={idPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadIdPhoto(file);
                      event.target.value = "";
                    }}
                  />
                  <div className="flex items-center gap-3">
                    {idPhotoUrl ? (
                      <a href={idPhotoUrl} target="_blank" rel="noreferrer" className="block h-16 w-24 overflow-hidden rounded-lg border">
                        <img src={idPhotoUrl} alt="ID document" className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                        <FileImage className="h-5 w-5" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={isUploadingPhoto}
                      onClick={() => idPhotoInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {isUploadingPhoto ? "Uploading..." : idPhotoUrl ? "Replace Photo" : "Upload Photo"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card space-y-5">
              <h3 className="section-title">Bank Information</h3>
              <p className="text-sm text-muted-foreground">
                Used for payouts. Include bank name, branch, account name and account number.
              </p>
              <Textarea
                value={bankInfo}
                onChange={(event) => setBankInfo(event.target.value)}
                className="rounded-lg"
                rows={3}
                placeholder="Bank name, branch, account name & number"
              />
              <Button onClick={saveVerification} className="rounded-lg" disabled={isSavingVerification}>
                {isSavingVerification ? "Saving..." : "Save Verification & Payment"}
              </Button>
            </div>
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="shipping" className="mt-6 space-y-6">
            <div className="stat-card space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="section-title">Shipping Methods</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These delivery methods appear on seller product forms and customer checkout.
                  </p>
                </div>
                <Button type="button" variant="outline" className="rounded-lg" onClick={addShippingMethod}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add
                </Button>
              </div>

              <div className="space-y-3">
                {shippingMethods.map((method, index) => (
                  <div key={method.id || `new-${index}`} className="rounded-xl border bg-muted/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={method.is_enabled} onCheckedChange={(value) => updateShippingMethod(index, "is_enabled", value)} />
                        <span className="text-sm font-semibold">{method.name || "New shipping method"}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeShippingMethod(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Delivery Name</Label>
                        <Input value={method.name} onChange={(event) => updateShippingMethod(index, "name", event.target.value)} className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label>Delivery Charge</Label>
                        <Input type="number" step="0.01" value={method.delivery_charge} onChange={(event) => updateShippingMethod(index, "delivery_charge", event.target.value)} placeholder="Optional" className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label>Estimated Delivery Time</Label>
                        <Input value={method.estimated_delivery_time} onChange={(event) => updateShippingMethod(index, "estimated_delivery_time", event.target.value)} className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label>Sort Order</Label>
                        <Input type="number" value={method.sort_order} onChange={(event) => updateShippingMethod(index, "sort_order", Number(event.target.value || 0))} className="rounded-lg" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Description</Label>
                        <Textarea value={method.description} onChange={(event) => updateShippingMethod(index, "description", event.target.value)} className="rounded-lg" rows={2} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={saveShippingMethods} className="rounded-lg" disabled={isSavingShipping}>
                {isSavingShipping ? "Saving..." : "Save Shipping Methods"}
              </Button>
            </div>
          </TabsContent>
        ) : null}

        <TabsContent value="notifications" className="mt-6 space-y-6">
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
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked={item.default} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
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
                <p className="mt-0.5 text-xs text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Switch />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
