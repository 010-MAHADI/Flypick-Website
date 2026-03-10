import { useState } from "react";
import { ChevronRight, Plus, Trash2, X, Clock, Gift, Search, Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface TextField {
  id: string;
  label: string;
  value: string;
}

interface BannerSection {
  id: string;
  type: "coupon" | "deal";
  backgroundColor: string;
  fields: TextField[];
}

interface DealProduct {
  id: string;
  image: string;
  title: string;
}

interface DealSection {
  id: string;
  title: string;
  badge: string;
  icon: "clock" | "gift";
  backgroundColor: string;
  products: DealProduct[];
}

interface BannerData {
  saleEndDate: string;
  discountPercentage: string;
  sections: BannerSection[];
}

interface TodaysDealsData {
  mainTitle: string;
  dealSections: DealSection[];
}

interface AvailableProduct {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  status: "Active" | "Draft" | "Out of Stock";
  image: string;
}

export default function Banners() {
  // Available products from seller's inventory
  const [availableProducts] = useState<AvailableProduct[]>([
    { id: 1, name: "USB-C PD Charger 120W Fast Charging Station", sku: "CHG-120W", category: "Electronics", price: 39.99, stock: 234, status: "Active", image: "⚡" },
    { id: 2, name: "Wireless Bluetooth Headphones Pro", sku: "AUD-BT01", category: "Electronics", price: 79.99, stock: 128, status: "Active", image: "🎧" },
    { id: 3, name: "Smart Watch Band (Silicone)", sku: "WCH-SB01", category: "Accessories", price: 14.99, stock: 562, status: "Active", image: "⌚" },
    { id: 4, name: "LED Desk Lamp Adjustable", sku: "LIT-DL01", category: "Home", price: 29.99, stock: 89, status: "Active", image: "💡" },
    { id: 5, name: "Phone Case Universal Fit", sku: "ACC-PC01", category: "Accessories", price: 9.99, stock: 1200, status: "Active", image: "📱" },
    { id: 6, name: "Ergonomic Mouse Wireless", sku: "INP-MW01", category: "Electronics", price: 34.99, stock: 156, status: "Active", image: "🖱️" },
    { id: 7, name: "Cotton T-Shirt Premium", sku: "CLT-TS01", category: "Clothing", price: 24.99, stock: 340, status: "Active", image: "👕" },
    { id: 8, name: "Yoga Mat Non-Slip", sku: "SPT-YM01", category: "Sports", price: 19.99, stock: 67, status: "Active", image: "🧘" },
    { id: 9, name: "Stainless Steel Water Bottle", sku: "KIT-WB01", category: "Home", price: 16.99, stock: 445, status: "Active", image: "🍶" },
    { id: 10, name: "Portable Bluetooth Speaker", sku: "AUD-BS01", category: "Electronics", price: 49.99, stock: 92, status: "Active", image: "🔊" },
    { id: 11, name: "Gaming Keyboard RGB", sku: "GAM-KB01", category: "Electronics", price: 89.99, stock: 78, status: "Active", image: "⌨️" },
    { id: 12, name: "Fitness Tracker Watch", sku: "FIT-TR01", category: "Sports", price: 59.99, stock: 145, status: "Active", image: "⌚" },
  ]);

  const [productSearchModal, setProductSearchModal] = useState<{ open: boolean; sectionId: string | null }>({
    open: false,
    sectionId: null,
  });
  const [productSearch, setProductSearch] = useState("");
  const [productFilterCategory, setProductFilterCategory] = useState("all");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  const [bannerData, setBannerData] = useState<BannerData>({
    saleEndDate: "Mar 8, 13:59 (GMT+6)",
    discountPercentage: "60%",
    sections: [
      {
        id: "1",
        type: "coupon",
        backgroundColor: "#ffffff",
        fields: [
          { id: "1-1", label: "Amount", value: "৳2,445.44 OFF" },
          { id: "1-2", label: "Min Order", value: "orders ৳19,441.23+" },
          { id: "1-3", label: "Code", value: "Code:CD1592" },
        ],
      },
      {
        id: "2",
        type: "coupon",
        backgroundColor: "#ffffff",
        fields: [
          { id: "2-1", label: "Amount", value: "৳244.54 OFF" },
          { id: "2-2", label: "Min Order", value: "orders ৳1,834.08+" },
          { id: "2-3", label: "Code", value: "Code:CD1502" },
        ],
      },
      {
        id: "3",
        type: "deal",
        backgroundColor: "#ffffff",
        fields: [
          { id: "3-1", label: "Emoji", value: "🔧" },
          { id: "3-2", label: "Title", value: "Top deals" },
          { id: "3-3", label: "Price", value: "৳ 2,505.35" },
        ],
      },
      {
        id: "4",
        type: "deal",
        backgroundColor: "#ffffff",
        fields: [
          { id: "4-1", label: "Emoji", value: "💡" },
          { id: "4-2", label: "Title", value: "Tech lab" },
          { id: "4-3", label: "Price", value: "৳ 684.48" },
        ],
      },
    ],
  });

  const [todaysDeals, setTodaysDeals] = useState<TodaysDealsData>({
    mainTitle: "Today's deals",
    dealSections: [
      {
        id: "bundle-1",
        title: "Bundle deals",
        badge: "3 from US $2.99",
        icon: "gift",
        backgroundColor: "#ffffff",
        products: [
          { id: "1", image: "/placeholder.svg", title: "460pcs Family Tools 1/4 Set Socket..." },
          { id: "2", image: "/placeholder.svg", title: "60W 80W Electric Soldering Iron Kit..." },
          { id: "3", image: "/placeholder.svg", title: "4 Ports USB-C PD Charger 120W Fast..." },
        ],
      },
      {
        id: "super-1",
        title: "SuperDeals",
        badge: "Ends in: 16:03:33",
        icon: "clock",
        backgroundColor: "#ffffff",
        products: [
          { id: "4", image: "/placeholder.svg", title: "Smart Stainless Steel Multifunctional..." },
          { id: "5", image: "/placeholder.svg", title: "Original Logitech G304 Lightspeed..." },
          { id: "6", image: "/placeholder.svg", title: "Lenovo SD Memory Card High Speed..." },
        ],
      },
    ],
  });

  const handleEdit = (field: string, value: string) => {
    setBannerData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFieldEdit = (sectionId: string, fieldId: string, value: string) => {
    setBannerData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.id === fieldId ? { ...field, value } : field
              ),
            }
          : section
      ),
    }));
  };

  const handleColorChange = (sectionId: string, color: string) => {
    setBannerData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, backgroundColor: color } : section
      ),
    }));
  };

  const addSection = (type: "coupon" | "deal") => {
    if (bannerData.sections.length >= 4) return;

    const newId = Date.now().toString();
    const newSection: BannerSection = {
      id: newId,
      type,
      backgroundColor: "#ffffff",
      fields:
        type === "coupon"
          ? [
              { id: `${newId}-1`, label: "Amount", value: "৳0 OFF" },
              { id: `${newId}-2`, label: "Min Order", value: "orders ৳0+" },
              { id: `${newId}-3`, label: "Code", value: "Code:NEW" },
            ]
          : [
              { id: `${newId}-1`, label: "Emoji", value: "🎁" },
              { id: `${newId}-2`, label: "Title", value: "New Deal" },
              { id: `${newId}-3`, label: "Price", value: "৳ 0" },
            ],
    };

    setBannerData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  const removeSection = (sectionId: string) => {
    setBannerData((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
  };

  const addField = (sectionId: string) => {
    setBannerData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: [
                ...section.fields,
                {
                  id: `${sectionId}-${Date.now()}`,
                  label: "New Field",
                  value: "Enter value",
                },
              ],
            }
          : section
      ),
    }));
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setBannerData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.filter((field) => field.id !== fieldId),
            }
          : section
      ),
    }));
  };

  const updateFieldLabel = (sectionId: string, fieldId: string, label: string) => {
    setBannerData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.id === fieldId ? { ...field, label } : field
              ),
            }
          : section
      ),
    }));
  };

  // Today's Deals handlers
  const handleDealEdit = (field: string, value: string) => {
    setTodaysDeals((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDealSectionEdit = (sectionId: string, field: string, value: string) => {
    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: prev.dealSections.map((section) =>
        section.id === sectionId ? { ...section, [field]: value } : section
      ),
    }));
  };

  const handleDealColorChange = (sectionId: string, color: string) => {
    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: prev.dealSections.map((section) =>
        section.id === sectionId ? { ...section, backgroundColor: color } : section
      ),
    }));
  };

  const handleProductEdit = (sectionId: string, productId: string, field: string, value: string) => {
    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: prev.dealSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              products: section.products.map((product) =>
                product.id === productId ? { ...product, [field]: value } : product
              ),
            }
          : section
      ),
    }));
  };

  const addDealSection = () => {
    if (todaysDeals.dealSections.length >= 4) return;

    const newId = `deal-${Date.now()}`;
    const newSection: DealSection = {
      id: newId,
      title: "New Deal",
      badge: "Limited Time",
      icon: "gift",
      backgroundColor: "#ffffff",
      products: [
        { id: `${newId}-1`, image: "/placeholder.svg", title: "Product 1" },
        { id: `${newId}-2`, image: "/placeholder.svg", title: "Product 2" },
        { id: `${newId}-3`, image: "/placeholder.svg", title: "Product 3" },
      ],
    };

    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: [...prev.dealSections, newSection],
    }));
  };

  const removeDealSection = (sectionId: string) => {
    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: prev.dealSections.filter((section) => section.id !== sectionId),
    }));
  };

  const openProductSelector = (sectionId: string) => {
    setProductSearchModal({ open: true, sectionId });
    setProductSearch("");
    setProductFilterCategory("all");
    setSelectedProducts([]);
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const addSelectedProductsToSection = () => {
    if (!productSearchModal.sectionId || selectedProducts.length === 0) return;

    const sectionId = productSearchModal.sectionId;
    const section = todaysDeals.dealSections.find((s) => s.id === sectionId);
    
    if (!section) return;

    // Get products to add
    const productsToAdd = availableProducts
      .filter((p) => selectedProducts.includes(p.id))
      .filter((p) => !section.products.some((sp) => sp.id === p.id.toString())); // Avoid duplicates

    if (productsToAdd.length === 0) {
      alert("All selected products are already in this deal section!");
      return;
    }

    // Add products to the section's product list
    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: prev.dealSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              products: [
                ...section.products,
                ...productsToAdd.map((p) => ({
                  id: p.id.toString(),
                  image: p.image,
                  title: p.name,
                })),
              ],
            }
          : section
      ),
    }));

    setProductSearchModal({ open: false, sectionId: null });
    setSelectedProducts([]);
  };

  const removeProduct = (sectionId: string, productId: string) => {
    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: prev.dealSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              products: section.products.filter((product) => product.id !== productId),
            }
          : section
      ),
    }));
  };

  const toggleIcon = (sectionId: string) => {
    setTodaysDeals((prev) => ({
      ...prev,
      dealSections: prev.dealSections.map((section) =>
        section.id === sectionId
          ? { ...section, icon: section.icon === "clock" ? "gift" : "clock" }
          : section
      ),
    }));
  };

  // Filter products for modal
  const filteredProducts = availableProducts.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase());
    const matchCat = productFilterCategory === "all" || p.category === productFilterCategory;
    return matchSearch && matchCat && p.status === "Active";
  });

  const productCategories = [...new Set(availableProducts.map((p) => p.category))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Banner Management</h1>
        <p className="text-muted-foreground">
          Click on any text to edit. Add or remove sections (max 4).
        </p>
      </div>

      {/* Banner Preview */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Banner Preview</h2>

        <section className="hero-banner py-3 md:py-6 px-4 bg-background rounded-lg">
          <div className="max-w-[1440px] mx-auto">
            {/* Sale End Date */}
            <p className="text-xs md:text-sm font-medium text-foreground/80 mb-1">
              Sale Ends:{" "}
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEdit("saleEndDate", e.currentTarget.textContent || "")}
                className="outline-none hover:bg-primary/10 px-1 rounded cursor-text"
              >
                {bannerData.saleEndDate}
              </span>
            </p>

            {/* Main Discount Banner */}
            <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-5 w-fit">
              <h2 className="text-2xl md:text-5xl font-black text-foreground">UP TO</h2>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEdit("discountPercentage", e.currentTarget.textContent || "")}
                className="text-2xl md:text-5xl font-black text-primary outline-none hover:bg-primary/10 px-1 rounded cursor-text"
              >
                {bannerData.discountPercentage}
              </span>
              <h2 className="text-2xl md:text-5xl font-black text-foreground">OFF</h2>
              <ChevronRight className="w-5 h-5 md:w-8 md:h-8 text-foreground/60 ml-1" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              {bannerData.sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded-lg p-3 md:p-4 border border-border relative group"
                  style={{ backgroundColor: section.backgroundColor }}
                >
                  {/* Section Controls */}
                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-6 w-6"
                      onClick={() => removeSection(section.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Color Picker */}
                  <div className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <input
                      type="color"
                      value={section.backgroundColor}
                      onChange={(e) => handleColorChange(section.id, e.target.value)}
                      className="h-6 w-6 rounded cursor-pointer border border-border"
                      title="Change background color"
                    />
                  </div>

                  {section.type === "deal" && (
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex-shrink-0">
                        {section.fields[0] && (
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) =>
                              handleFieldEdit(section.id, section.fields[0].id, e.currentTarget.textContent || "")
                            }
                            className="text-xl md:text-2xl outline-none hover:bg-primary/10 px-1 rounded cursor-text inline-block"
                          >
                            {section.fields[0].value}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {section.fields.slice(1).map((field, idx) => (
                          <div key={field.id} className="relative group/field">
                            {idx === 0 ? (
                              <p
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) =>
                                  handleFieldEdit(section.id, field.id, e.currentTarget.textContent || "")
                                }
                                className="font-bold text-xs md:text-sm outline-none hover:bg-primary/10 px-1 rounded cursor-text"
                              >
                                {field.value}
                              </p>
                            ) : (
                              <p
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) =>
                                  handleFieldEdit(section.id, field.id, e.currentTarget.textContent || "")
                                }
                                className="text-[10px] md:text-xs font-semibold bg-foreground text-card px-2 py-0.5 rounded mt-1 inline-block outline-none hover:ring-2 hover:ring-primary/50 cursor-text"
                              >
                                {field.value}
                              </p>
                            )}
                            {section.fields.length > 2 && (
                              <button
                                onClick={() => removeField(section.id, field.id)}
                                className="absolute -right-1 -top-1 opacity-0 group-hover/field:opacity-100 bg-destructive text-destructive-foreground rounded-full p-0.5"
                              >
                                <X className="h-2 w-2" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section.type === "coupon" && (
                    <div>
                      {section.fields.map((field, idx) => (
                        <div key={field.id} className="relative group/field">
                          {idx === 0 ? (
                            <p
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                handleFieldEdit(section.id, field.id, e.currentTarget.textContent || "")
                              }
                              className="text-primary font-bold text-xs md:text-sm outline-none hover:bg-primary/10 px-1 rounded cursor-text"
                            >
                              {field.value}
                            </p>
                          ) : idx === 1 ? (
                            <p
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                handleFieldEdit(section.id, field.id, e.currentTarget.textContent || "")
                              }
                              className="text-xs text-muted-foreground outline-none hover:bg-primary/10 px-1 rounded cursor-text"
                            >
                              {field.value}
                            </p>
                          ) : (
                            <p
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                handleFieldEdit(section.id, field.id, e.currentTarget.textContent || "")
                              }
                              className="text-primary text-xs font-semibold mt-1 md:mt-2 outline-none hover:bg-primary/10 px-1 rounded cursor-text"
                            >
                              {field.value}
                            </p>
                          )}
                          {section.fields.length > 2 && (
                            <button
                              onClick={() => removeField(section.id, field.id)}
                              className="absolute -right-1 -top-1 opacity-0 group-hover/field:opacity-100 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="h-2 w-2" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Field Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 text-xs"
                    onClick={() => addField(section.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Field
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Add Section Controls */}
      {bannerData.sections.length < 4 && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-3">Add New Section</h3>
          <div className="flex gap-3">
            <Button onClick={() => addSection("coupon")} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Coupon Card
            </Button>
            <Button onClick={() => addSection("deal")} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Deal Card
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {bannerData.sections.length} of 4 sections used
          </p>
        </div>
      )}

      {/* Today's Deals Section */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Today's Deals Banner</h2>

        <section className="max-w-[1440px] mx-auto px-4 py-8 bg-background rounded-lg">
          <h2
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleDealEdit("mainTitle", e.currentTarget.textContent || "")}
            className="text-2xl font-bold mb-6 outline-none hover:bg-primary/10 px-2 py-1 rounded cursor-text inline-block"
          >
            {todaysDeals.mainTitle}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {todaysDeals.dealSections.map((section) => (
              <div
                key={section.id}
                className="rounded-lg p-6 border border-border relative group"
                style={{ backgroundColor: section.backgroundColor }}
              >
                {/* Section Controls */}
                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6"
                    onClick={() => removeDealSection(section.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Color Picker */}
                <div className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <input
                    type="color"
                    value={section.backgroundColor}
                    onChange={(e) => handleDealColorChange(section.id, e.target.value)}
                    className="h-6 w-6 rounded cursor-pointer border border-border"
                    title="Change background color"
                  />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleDealSectionEdit(section.id, "title", e.currentTarget.textContent || "")}
                    className="text-xl font-bold text-foreground outline-none hover:bg-primary/10 px-2 py-1 rounded cursor-text"
                  >
                    {section.title}
                  </h3>
                  <div className="flex items-center gap-1 text-sm bg-muted px-3 py-1.5 rounded-full font-medium">
                    <button
                      onClick={() => toggleIcon(section.id)}
                      className="hover:scale-110 transition-transform"
                      title="Toggle icon"
                    >
                      {section.icon === "clock" ? (
                        <Clock className="w-4 h-4 text-primary" />
                      ) : (
                        <Gift className="w-4 h-4 text-secondary" />
                      )}
                    </button>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleDealSectionEdit(section.id, "badge", e.currentTarget.textContent || "")}
                      className="outline-none hover:bg-primary/10 px-1 rounded cursor-text"
                    >
                      {section.badge}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {section.products.slice(0, 3).map((product) => (
                    <div key={product.id} className="group/product relative">
                      <button
                        onClick={() => removeProduct(section.id, product.id)}
                        className="absolute -right-1 -top-1 opacity-0 group-hover/product:opacity-100 bg-destructive text-destructive-foreground rounded-full p-1 z-10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                        <input
                          type="text"
                          value={product.image}
                          onChange={(e) => handleProductEdit(section.id, product.id, "image", e.target.value)}
                          placeholder="Image URL"
                          className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-1 py-0.5 opacity-0 group-hover/product:opacity-100 transition-opacity"
                        />
                      </div>
                      <p
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          handleProductEdit(section.id, product.id, "title", e.currentTarget.textContent || "")
                        }
                        className="text-xs text-muted-foreground line-clamp-2 outline-none hover:bg-primary/10 px-1 rounded cursor-text"
                      >
                        {product.title}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Add Product Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-3 opacity-0 group-hover:opacity-100 transition-opacity h-8 text-xs"
                  onClick={() => openProductSelector(section.id)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Product ({section.products.length} total)
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Add Deal Section Controls */}
      {todaysDeals.dealSections.length < 4 && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-3">Add New Deal Section</h3>
          <div className="flex gap-3">
            <Button onClick={addDealSection} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Deal Section
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {todaysDeals.dealSections.length} of 4 deal sections used
          </p>
        </div>
      )}

      {/* Product Selection Modal */}
      <Dialog open={productSearchModal.open} onOpenChange={(open) => setProductSearchModal({ open, sectionId: null })}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Products to Add</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose products from your inventory. First 3 products will be shown in the banner preview.
            </p>
          </DialogHeader>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 py-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={productFilterCategory} onValueChange={setProductFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {productCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
              {filteredProducts.map((product) => {
                const currentSection = todaysDeals.dealSections.find(
                  (s) => s.id === productSearchModal.sectionId
                );
                const isAlreadyAdded = currentSection?.products.some((p) => p.id === product.id.toString());
                const isSelected = selectedProducts.includes(product.id);

                return (
                  <div
                    key={product.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md relative ${
                      isAlreadyAdded
                        ? "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                        : isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => !isAlreadyAdded && toggleProductSelection(product.id)}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-2 right-2 z-10">
                      {isAlreadyAdded ? (
                        <div className="bg-muted rounded-full p-1">
                          <Check className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                          className="bg-background"
                        />
                      )}
                    </div>

                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-4xl mb-2">
                      {product.image}
                    </div>
                    <h4 className="font-semibold text-xs line-clamp-2 mb-1">{product.name}</h4>
                    <p className="text-xs text-muted-foreground mb-1">{product.sku}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">${product.price}</span>
                      {isAlreadyAdded && (
                        <span className="text-xs text-muted-foreground font-semibold">Added</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No products found</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} selected
              </p>
              <p className="text-xs text-muted-foreground">
                {todaysDeals.dealSections.find((s) => s.id === productSearchModal.sectionId)?.products.length || 0}{" "}
                products currently in this deal
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setProductSearchModal({ open: false, sectionId: null });
                  setSelectedProducts([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={addSelectedProductsToSection}
                disabled={selectedProducts.length === 0}
              >
                Add {selectedProducts.length > 0 && `(${selectedProducts.length})`} Product{selectedProducts.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
