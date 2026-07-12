import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  ClipboardCheck,
  FileText,
  MapPin,
  Sparkles,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import api from "@/lib/api";

const MAX_SHOPS = 1;

// Fallback categories if API fails
const fallbackCategories = [
  "Electronics",
  "Clothing & Fashion",
  "Home & Garden",
  "Sports & Outdoors",
  "Beauty & Personal Care",
  "Books & Media",
  "Toys & Games",
  "Food & Beverages",
  "Health & Wellness",
  "Automotive",
];

const emojiOptions = ["🏪", "🛍️", "🏬", "🎯", "💼", "🎨", "⚡", "🌟", "🔥", "💎", "🚀", "🎁"];

const payoutMethods = ["Bank Transfer", "bKash", "Nagad", "Rocket"];

interface Category {
  id: number;
  name: string;
  slug: string;
}

const steps = [
  { title: "Shop Basics", subtitle: "Name, logo & category", icon: Store },
  { title: "Address & Identity", subtitle: "Verification details", icon: MapPin },
  { title: "Payment Setup", subtitle: "How you get paid", icon: Banknote },
  { title: "Review & Submit", subtitle: "Confirm everything", icon: ClipboardCheck },
];

export default function CreateShop() {
  const navigate = useNavigate();
  const { shops, addShop, setCurrentShop } = useShop();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    logo: "🏪",
    category: "",
    description: "",
    village: "",
    postOffice: "",
    postCode: "",
    upazila: "",
    zilla: "",
    nationalId: "",
    tradeLicense: "",
    taxInformation: "",
    bankInformation: "",
    mobileBanking: "",
    payoutMethod: "",
  });

  const update = (key: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  // Pre-fill the address step from the seller profile (registration / settings)
  useEffect(() => {
    const profile = user?.seller_profile;
    if (!profile) return;
    setFormData((prev) => ({
      ...prev,
      village: prev.village || profile.village || "",
      postOffice: prev.postOffice || profile.post_office || "",
      postCode: prev.postCode || profile.post_code || "",
      upazila: prev.upazila || profile.upazila || "",
      zilla: prev.zilla || profile.zilla || "",
    }));
  }, [user?.seller_profile]);

  const composedAddress = [
    formData.village.trim(),
    formData.postOffice.trim() ? `Post Office: ${formData.postOffice.trim()}` : "",
    formData.postCode.trim() ? `Post Code: ${formData.postCode.trim()}` : "",
    [formData.upazila.trim(), formData.zilla.trim()].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get("/products/categories/");
        const categoryData = response.data?.results || response.data || [];

        if (Array.isArray(categoryData) && categoryData.length > 0) {
          setCategories(categoryData);
        } else {
          console.warn("No categories found, using fallback categories");
          setCategories(
            fallbackCategories.map((name, index) => ({
              id: index + 1,
              name,
              slug: name.toLowerCase().replace(/\s+/g, "-"),
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
        setCategories(
          fallbackCategories.map((name, index) => ({
            id: index + 1,
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
          }))
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const selectedCategory = categories.find((cat) => cat.id.toString() === formData.category);

  const validateStep = (index: number) => {
    if (index === 0) {
      if (!formData.name.trim()) {
        toast.error("Shop name is required");
        return false;
      }
      if (!formData.category) {
        toast.error("Please select a business category");
        return false;
      }
      if (!formData.description.trim()) {
        toast.error("Shop description is required");
        return false;
      }
    }
    if (index === 1 && !formData.village.trim() && !formData.zilla.trim()) {
      toast.error("Please fill in your shop address (at least village and zilla)");
      return false;
    }
    if (index === 2 && !formData.payoutMethod) {
      toast.error("Please choose a payout method");
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goBack = () => {
    if (step === 0) {
      navigate("/shop-selector");
      return;
    }
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (user?.role !== "Seller") {
      toast.error("Only seller accounts can create shops.");
      navigate("/");
      return;
    }

    if (shops.length >= MAX_SHOPS) {
      toast.error("Each seller account can create only one shop.");
      navigate("/shop-selector");
      return;
    }

    for (let index = 0; index < 3; index += 1) {
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await api.post("/products/shops/", {
        name: formData.name,
        logo: formData.logo,
        category: selectedCategory ? selectedCategory.id : parseInt(formData.category),
        description: formData.description,
        shop_address: composedAddress,
        sender_name: user?.username || formData.name,
        sender_mobile_no: user?.seller_profile?.phone || "",
        sender_village: formData.village,
        sender_post_office: formData.postOffice,
        sender_post_code: formData.postCode,
        sender_upazila: formData.upazila,
        sender_zilla: formData.zilla,
        national_id: formData.nationalId,
        trade_license: formData.tradeLicense,
        tax_information: formData.taxInformation,
        bank_information: formData.bankInformation,
        mobile_banking: formData.mobileBanking,
        payout_method: formData.payoutMethod,
        setup_status: "submitted",
        status: "active",
      });

      const newShop = {
        id: response.data.id.toString(),
        name: response.data.name,
        logo: response.data.logo || formData.logo,
        category: selectedCategory ? selectedCategory.name : formData.category,
        description: response.data.description,
        status: response.data.status as "active" | "inactive",
        createdAt: response.data.createdDate || new Date().toISOString(),
      };

      addShop(newShop);
      setCurrentShop(newShop);
      toast.success("Shop created successfully! Welcome to your Seller Dashboard.");
      navigate("/");
    } catch (error: any) {
      console.error("Failed to create shop:", error);

      let errorMessage = "Failed to create shop. Please try again.";
      if (error.response?.data) {
        const data = error.response.data;
        if (data.category && Array.isArray(data.category)) {
          errorMessage = `Category error: ${data.category[0]}`;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.name && Array.isArray(data.name)) {
          errorMessage = `Name error: ${data.name[0]}`;
        } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          errorMessage = data.non_field_errors[0];
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewRow = (label: string, value: string) => (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="max-w-[60%] text-right text-sm font-semibold">{value || "—"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Set Up Your Shop</h1>
          <p className="text-muted-foreground">
            A quick guided setup — you can update everything later in Shop Settings
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-between gap-2">
          {steps.map((item, index) => {
            const isDone = index < step;
            const isCurrent = index === step;
            return (
              <div key={item.title} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className={`truncate text-xs font-semibold ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.title}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{item.subtitle}</p>
                </div>
                {index < steps.length - 1 ? (
                  <div className={`mx-1 h-0.5 flex-1 rounded ${isDone ? "bg-primary" : "bg-border"}`} />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <Card className="p-8">
          {step === 0 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Shop Logo (Emoji)</Label>
                <div className="grid grid-cols-6 gap-2">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => update("logo", emoji)}
                      className={`h-12 w-12 rounded-lg border-2 text-2xl hover:border-primary transition-all ${
                        formData.logo === emoji ? "border-primary bg-primary/10 scale-110" : "border-border"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Shop Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter your shop name"
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Business Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => update("category", value)}
                  disabled={loadingCategories}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCategories ? "Loading categories..." : "Select a category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Shop Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe what your shop sells..."
                  value={formData.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Shop Address <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  This address is also used on shipping labels and in your Settings page.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="village" className="text-xs text-muted-foreground">Village</Label>
                    <Input id="village" placeholder="Village" value={formData.village} onChange={(e) => update("village", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="postOffice" className="text-xs text-muted-foreground">Post Office</Label>
                    <Input id="postOffice" placeholder="Post office" value={formData.postOffice} onChange={(e) => update("postOffice", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="postCode" className="text-xs text-muted-foreground">Post Code</Label>
                    <Input id="postCode" placeholder="Post code" value={formData.postCode} onChange={(e) => update("postCode", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="upazila" className="text-xs text-muted-foreground">Upazila</Label>
                    <Input id="upazila" placeholder="Upazila" value={formData.upazila} onChange={(e) => update("upazila", e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="zilla" className="text-xs text-muted-foreground">Zilla</Label>
                    <Input id="zilla" placeholder="Zilla" value={formData.zilla} onChange={(e) => update("zilla", e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalId">National ID (if you have one)</Label>
                <Input
                  id="nationalId"
                  placeholder="NID number"
                  value={formData.nationalId}
                  onChange={(e) => update("nationalId", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradeLicense">Trade License (if you have one)</Label>
                <Input
                  id="tradeLicense"
                  placeholder="Trade license number"
                  value={formData.tradeLicense}
                  onChange={(e) => update("tradeLicense", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxInformation">Tax Information (if applicable)</Label>
                <Input
                  id="taxInformation"
                  placeholder="TIN / BIN"
                  value={formData.taxInformation}
                  onChange={(e) => update("taxInformation", e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Payout Method <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.payoutMethod} onValueChange={(value) => update("payoutMethod", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="How would you like to receive payouts?" />
                  </SelectTrigger>
                  <SelectContent>
                    {payoutMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankInformation">Bank Information (optional)</Label>
                <Textarea
                  id="bankInformation"
                  placeholder="Bank name, branch, account name & number"
                  value={formData.bankInformation}
                  onChange={(e) => update("bankInformation", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobileBanking">Mobile Banking (optional)</Label>
                <Input
                  id="mobileBanking"
                  placeholder="bKash / Nagad / Rocket number"
                  value={formData.mobileBanking}
                  onChange={(e) => update("mobileBanking", e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
                <span className="text-3xl">{formData.logo}</span>
                <div>
                  <p className="font-bold">{formData.name || "Your shop"}</p>
                  <p className="text-xs text-muted-foreground">{selectedCategory?.name || "No category"}</p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Details</h3>
                </div>
                {reviewRow("Description", formData.description)}
                {reviewRow("Shop Address", composedAddress.replace(/\n/g, ", "))}
                {reviewRow("National ID", formData.nationalId)}
                {reviewRow("Trade License", formData.tradeLicense)}
                {reviewRow("Tax Information", formData.taxInformation)}
                {reviewRow("Payout Method", formData.payoutMethod)}
                {reviewRow("Bank Information", formData.bankInformation)}
                {reviewRow("Mobile Banking", formData.mobileBanking)}
              </div>

              <p className="text-xs text-muted-foreground">
                By submitting, your shop will be created and you&apos;ll get access to your Seller Dashboard.
                You can update these details anytime from Shop Settings.
              </p>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex gap-3 pt-8">
            <Button type="button" variant="outline" className="flex-1" onClick={goBack} disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" className="flex-1" onClick={goNext} disabled={loadingCategories}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                <Store className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : "Create Shop"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
