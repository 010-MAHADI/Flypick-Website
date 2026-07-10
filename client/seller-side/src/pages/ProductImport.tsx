import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Globe,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import api from "@/lib/api";
import { useCategories } from "@/hooks/useCategories";
import { useShop } from "@/context/ShopContext";
import { useQueryClient } from "@tanstack/react-query";

interface Specification { key: string; value: string; }

interface ImportedProduct {
  source_url: string;
  source_site: string;
  external_id: string;
  title: string;
  short_description: string;
  description_html: string;
  description_text: string;
  main_image: string;
  gallery: string[];
  price: string;
  original_price: string;
  discount_percent: number;
  currency: string;
  brand: string;
  manufacturer: string;
  sku: string;
  model_number: string;
  category_path: string[];
  suggested_category: string;
  suggested_category_id: number;
  tags: string[];
  stock_status: string;
  stock_quantity: number;
  colors: string[];
  sizes: string[];
  options: { name: string; values: string[] }[];
  specifications: Specification[];
  attributes: Record<string, string>;
  shipping: Record<string, unknown>;
  warranty: string;
  highlights: string[];
  seo_title: string;
  seo_description: string;
  slug: string;
  warnings: string[];
}

interface SupportedSite { key: string; name: string; domains: string[]; example: string; level?: string; }

const SectionCard = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="stat-card space-y-5">
    <div className="flex items-center justify-between">
      <h2 className="section-title !mb-0">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const ChipEditor = ({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string;
}) => {
  const [input, setInput] = useState("");
  const add = () => {
    const value = input.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="rounded-lg"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} className="rounded-lg">Add</Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1 rounded-md">
              {item}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onChange(items.filter((i) => i !== item))} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ProductImport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentShop } = useShop();
  const { data: categories = [] } = useCategories();

  const [sites, setSites] = useState<SupportedSite[]>([]);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "importing" | "preview" | "saving">("idle");
  const [importError, setImportError] = useState<{ code: string; message: string } | null>(null);

  const [product, setProduct] = useState<ImportedProduct | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    api.get("/importer/sources/")
      .then((res) => setSites(res.data?.sites || []))
      .catch(() => setSites([]));
  }, []);

  const set = <K extends keyof ImportedProduct>(key: K, value: ImportedProduct[K]) =>
    setProduct((prev) => (prev ? { ...prev, [key]: value } : prev));

  const toggleImage = (image: string) =>
    setSelectedImages((prev) => (prev.includes(image) ? prev.filter((i) => i !== image) : [...prev, image]));

  const handleImport = async (refresh = false) => {
    if (!url.trim()) { toast.error("Paste a product URL first"); return; }
    setPhase("importing");
    setImportError(null);
    try {
      const response = await api.post("/importer/preview/", { url: url.trim(), refresh }, { timeout: 120000 });
      const imported: ImportedProduct = response.data.product;
      setProduct(imported);
      setSelectedImages(imported.gallery.slice(0, 10));
      setCategory(imported.suggested_category_id ? String(imported.suggested_category_id) : "");
      setPhase("preview");
      toast.success(`Product imported from ${imported.source_site}`);
    } catch (error: any) {
      const err = error?.response?.data?.error;
      setImportError(err || { code: "IMPORT_FAILED", message: "Import failed. Check the URL and try again." });
      setPhase("idle");
    }
  };

  const updateSpec = (index: number, field: keyof Specification, value: string) => {
    if (!product) return;
    const specs = [...product.specifications];
    specs[index] = { ...specs[index], [field]: value };
    set("specifications", specs);
  };

  const discountPercent = useMemo(() => {
    if (!product) return 0;
    const selling = parseFloat(product.price);
    const regular = parseFloat(product.original_price);
    if (!selling || !regular || regular <= selling) return 0;
    return Math.round(((regular - selling) / regular) * 100);
  }, [product]);

  const handleSave = async () => {
    if (!product) return;
    if (!product.title.trim()) { toast.error("Product title is required"); return; }
    if (!product.price || parseFloat(product.price) <= 0) { toast.error("Set a valid selling price before saving"); return; }
    if (!currentShop) { toast.error("No shop selected. Please select a shop first."); return; }

    setPhase("saving");
    try {
      const payload = {
        shop: parseInt(currentShop.id),
        source_url: product.source_url,
        source_site: product.source_site,
        images: selectedImages,
        product: {
          title: product.title,
          short_description: product.short_description,
          description: product.description_html,
          price: product.price,
          original_price: product.original_price || null,
          currency: product.currency,
          brand: product.brand,
          manufacturer: product.manufacturer,
          sku: product.sku,
          model_number: product.model_number,
          category: category ? parseInt(category) : null,
          tags: product.tags,
          stock_quantity: product.stock_quantity,
          stock_status: product.stock_status,
          colors: product.colors,
          sizes: product.sizes,
          options: product.options,
          specifications: product.specifications.filter((s) => s.key.trim() && s.value.trim()),
          warranty: product.warranty,
          highlights: product.highlights,
          shipping: product.shipping,
          seo_title: product.seo_title,
          seo_description: product.seo_description,
          slug: product.slug,
          status: "Draft",
        },
      };
      const response = await api.post("/importer/save/", payload, { timeout: 180000 });
      const { product_id, images_saved, image_errors } = response.data;
      await queryClient.invalidateQueries({ queryKey: ["admin_products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      if (image_errors?.length) {
        toast.warning(`Product saved, but ${image_errors.length} image(s) could not be downloaded`);
      } else {
        toast.success(`Product imported with ${images_saved} image(s). Saved as Draft.`);
      }
      navigate(`/products/${product_id}/edit`);
    } catch (error: any) {
      const err = error?.response?.data?.error;
      let message: string = err?.message || error?.response?.data?.detail || "";
      // show the concrete field problems when the backend reports them
      if (err?.code === "VALIDATION_ERROR" && err?.fields) {
        toast.error("Some fields are invalid — fix them and save again.", {
          description: message,
          duration: 10000,
        });
      } else {
        toast.error(message || `Failed to save the imported product (HTTP ${error?.response?.status ?? "?"}).`);
      }
      setPhase("preview");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")} className="rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Import Product</h1>
          <p className="text-sm text-muted-foreground">
            Paste a product URL from a supported website — we fetch, clean and prepare everything for you.
          </p>
        </div>
        {phase === "preview" && product && (
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => { setProduct(null); setPhase("idle"); }}>
              Start Over
            </Button>
            <Button className="rounded-lg shadow-sm" onClick={handleSave}>Save Product</Button>
          </div>
        )}
        {phase === "saving" && (
          <Button disabled className="rounded-lg">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
          </Button>
        )}
      </div>

      {/* URL input */}
      <SectionCard title="Product URL">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.daraz.com.bd/products/…"
              className="rounded-lg pl-9"
              disabled={phase === "importing" || phase === "saving"}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleImport(); } }}
            />
          </div>
          <Button
            onClick={() => handleImport(false)}
            disabled={phase === "importing" || phase === "saving"}
            className="rounded-lg shadow-sm"
          >
            {phase === "importing"
              ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>)
              : (<><Sparkles className="h-4 w-4 mr-2" /> Import</>)}
          </Button>
          {phase === "preview" && (
            <Button variant="outline" onClick={() => handleImport(true)} className="rounded-lg" title="Re-fetch, skipping cache">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
            <Globe className="h-3 w-3" /> Supported:
          </span>
          {(sites.length ? sites : [
            { key: "aliexpress", name: "AliExpress" }, { key: "daraz", name: "Daraz" },
            { key: "electronicsbd", name: "ElectronicsBD" }, { key: "roboticsbd", name: "RoboticsBD" },
          ] as SupportedSite[])
            .filter((site) => site.level !== "generic")
            .map((site) => (
              <Badge key={site.key} variant="outline" className="rounded-md text-xs font-medium">{site.name}</Badge>
            ))}
          <span className="text-xs text-muted-foreground italic">
            + any other product page (best effort)
          </span>
        </div>
        {importError && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-destructive">{importError.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Error code: {importError.code}</p>
            </div>
          </div>
        )}
        {phase === "importing" && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Detecting website, fetching the product page and extracting data… this can take up to a minute.</span>
          </div>
        )}
      </SectionCard>

      {/* Editable preview */}
      {product && phase !== "importing" && (
        <>
          {product.warnings.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
              {product.warnings.map((warning, i) => (
                <p key={i} className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" /> {warning}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <SectionCard
                title="Basic Information"
                action={<Badge variant="outline" className="rounded-md text-xs">Source: {product.source_site}</Badge>}
              >
                <div className="space-y-2">
                  <Label>Product Title *</Label>
                  <Input value={product.title} onChange={(e) => set("title", e.target.value)} className="rounded-lg" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Brand</Label><Input value={product.brand} onChange={(e) => set("brand", e.target.value)} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label>Manufacturer</Label><Input value={product.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} className="rounded-lg" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>SKU</Label><Input value={product.sku} onChange={(e) => set("sku", e.target.value)} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label>Model Number</Label><Input value={product.model_number} onChange={(e) => set("model_number", e.target.value)} className="rounded-lg" /></div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}{c.id === product.suggested_category_id ? " (suggested)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {product.category_path.length > 0 && (
                    <p className="text-xs text-muted-foreground">Source category: {product.category_path.join(" › ")}</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Pricing">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Selling Price ({product.currency}) *</Label>
                    <Input type="number" step="0.01" value={product.price} onChange={(e) => set("price", e.target.value)} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label>Regular Price ({product.currency})</Label>
                    <Input type="number" step="0.01" value={product.original_price} onChange={(e) => set("original_price", e.target.value)} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock Quantity</Label>
                    <Input type="number" value={product.stock_quantity} onChange={(e) => set("stock_quantity", parseInt(e.target.value) || 0)} className="rounded-lg" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {discountPercent > 0 && (
                    <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-sm">
                      Discount: <span className="font-bold text-destructive">{discountPercent}% off</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Select value={product.stock_status} onValueChange={(v) => set("stock_status", v)}>
                      <SelectTrigger className="rounded-lg w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_stock">In Stock</SelectItem>
                        <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {product.currency !== "BDT" && (
                  <p className="text-xs text-amber-500">
                    ⚠ Prices were imported in {product.currency}. Convert them to your store currency before saving if needed.
                  </p>
                )}
              </SectionCard>

              <SectionCard title={`Images (${selectedImages.length} of ${product.gallery.length} selected)`}>
                {product.gallery.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No images were found on the product page.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {product.gallery.map((image) => {
                        const selected = selectedImages.includes(image);
                        const isMain = selectedImages[0] === image;
                        return (
                          <button
                            key={image}
                            type="button"
                            onClick={() => toggleImage(image)}
                            className={`aspect-square rounded-xl border-2 overflow-hidden relative transition-all ${
                              selected ? "border-primary shadow-sm" : "border-border opacity-50 hover:opacity-80"
                            }`}
                          >
                            <img src={image} alt="Product" className="w-full h-full object-cover" loading="lazy" />
                            {selected && (
                              <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                            {isMain && (
                              <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-primary text-primary-foreground text-xs font-medium">
                                Main
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click to select/deselect. Selected images are downloaded to our own storage on save (thumbnail, medium and original sizes are generated) — nothing is hotlinked.
                    </p>
                  </>
                )}
              </SectionCard>

              <SectionCard title="Description">
                <div className="space-y-2">
                  <Label>Short Description</Label>
                  <Input value={product.short_description} onChange={(e) => set("short_description", e.target.value)} className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label>Full Description (cleaned HTML)</Label>
                  <Textarea value={product.description_html} onChange={(e) => set("description_html", e.target.value)} rows={10} className="rounded-lg font-mono text-xs" />
                </div>
                {product.description_html && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Preview</Label>
                    <div
                      className="p-4 rounded-xl border border-border/40 bg-muted/20 text-sm max-h-64 overflow-y-auto prose prose-sm dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: product.description_html }}
                    />
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Specifications"
                action={
                  <Button type="button" variant="outline" size="sm" className="rounded-lg"
                    onClick={() => set("specifications", [...product.specifications, { key: "", value: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                }
              >
                {product.specifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No specifications were detected.</p>
                ) : (
                  product.specifications.map((spec, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input placeholder="Attribute" value={spec.key} onChange={(e) => updateSpec(i, "key", e.target.value)} className="rounded-lg" />
                      <Input placeholder="Value" value={spec.value} onChange={(e) => updateSpec(i, "value", e.target.value)} className="rounded-lg" />
                      <Button type="button" variant="ghost" size="icon"
                        onClick={() => set("specifications", product.specifications.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </SectionCard>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              <SectionCard title="Variants">
                <ChipEditor label="Colors" items={product.colors} onChange={(v) => set("colors", v)} placeholder="Add color" />
                <Separator />
                <ChipEditor label="Sizes" items={product.sizes} onChange={(v) => set("sizes", v)} placeholder="Add size" />
                {product.options.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Other options from source</Label>
                      {product.options.map((option) => (
                        <p key={option.name} className="text-xs">
                          <span className="font-semibold">{option.name}:</span> {option.values.join(", ")}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </SectionCard>

              <SectionCard title="Tags">
                <ChipEditor label="Tags (auto-generated, editable)" items={product.tags} onChange={(v) => set("tags", v)} placeholder="Add tag" />
              </SectionCard>

              <SectionCard title="Extras">
                <div className="space-y-2">
                  <Label>Warranty</Label>
                  <Input value={product.warranty} onChange={(e) => set("warranty", e.target.value)} placeholder="e.g. 1 Year" className="rounded-lg" />
                </div>
                {product.highlights.length > 0 && (
                  <div className="space-y-2">
                    <Label>Highlights</Label>
                    <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                      {product.highlights.map((h, i) => <li key={`${i}-${h.slice(0, 20)}`}>{h}</li>)}
                    </ul>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="SEO (auto-generated)">
                <div className="space-y-2">
                  <Label>SEO Title</Label>
                  <Input value={product.seo_title} onChange={(e) => set("seo_title", e.target.value)} className="rounded-lg" />
                  <p className="text-xs text-muted-foreground text-right">{product.seo_title.length}/60</p>
                </div>
                <div className="space-y-2">
                  <Label>SEO Description</Label>
                  <Textarea value={product.seo_description} onChange={(e) => set("seo_description", e.target.value)} rows={3} className="rounded-lg" />
                  <p className="text-xs text-muted-foreground text-right">{product.seo_description.length}/160</p>
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input value={product.slug} onChange={(e) => set("slug", e.target.value)} className="rounded-lg font-mono text-xs" />
                </div>
              </SectionCard>

              <Button className="w-full rounded-lg shadow-sm" size="lg" onClick={handleSave} disabled={phase === "saving"}>
                {phase === "saving"
                  ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Downloading images & saving…</>)
                  : "Save Product"}
              </Button>
              <p className="text-xs text-muted-foreground text-center -mt-3">
                Saved as <span className="font-semibold">Draft</span> — nothing goes live until you activate it.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
