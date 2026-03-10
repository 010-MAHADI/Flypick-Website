import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import { useCategories } from "@/hooks/useCategories";
import { useShop } from "@/context/ShopContext";
import { useQueryClient } from "@tanstack/react-query";

interface SizeStock { size: string; stock: number; }
interface Specification { key: string; value: string; }
interface GuideDoc { name: string; type: string; }
interface ShippingOption { type: string; price: string; estimatedDelivery: string; enabled: boolean; freeShipping: boolean; }

const shippingTypes = ["Standard", "Express", "Free Shipping", "Flat Rate", "Calculated"];
const sizeOptions = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "28", "30", "32", "34", "36", "38", "40", "42"];
const colorOptions = ["Black", "White", "Red", "Blue", "Green", "Yellow", "Pink", "Purple", "Orange", "Gray", "Brown", "Navy"];

// Define SectionCard outside component to prevent re-renders
const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="stat-card space-y-5">
    <h2 className="section-title">{title}</h2>
    {children}
  </section>
);

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);
  
  // Get current shop from context
  const { currentShop } = useShop();
  
  // Fetch categories from API
  const { data: categoriesData = [], isLoading: categoriesLoading } = useCategories();

  // State for loading product data
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [productData, setProductData] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<string>("");  // Store category ID as string
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [regularPrice, setRegularPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  
  // Fetch product data when editing
  useEffect(() => {
    const fetchProduct = async () => {
      if (!isEditing || !id) return;
      
      setIsLoadingProduct(true);
      try {
        // Force fresh fetch by adding timestamp and cache control headers
        const response = await api.get(`/products/${id}/`, {
          params: { _t: Date.now() },
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        const product = response.data;
        
        console.log("Fetched product data:", product);
        console.log("Product fields:", {
          title: product.title,
          sku: product.sku,
          brand: product.brand,
          stock: product.stock,
          status: product.status,
          description: product.description,
        });
        setProductData(product);
        
        // Populate form fields with product data
        setTitle(product.title || "");
        setSku(product.sku || "");
        setCategory(product.category ? product.category.toString() : "");
        setBrand(product.brand || "");
        setBarcode(product.barcode || "");
        setRegularPrice(product.price?.toString() || "");
        setDiscountPrice(product.originalPrice?.toString() || "");
        setActualCost(product.actualCost?.toString() || "");
        setTags(product.badges || []);
        setDescription(product.description || "");
        setShortDescription(product.short_description || "");
        setTotalStock(product.stock?.toString() || "");
        setWeight(product.weight?.toString() || "");
        setWeightUnit(product.weight_unit || "kg");
        setStatus(product.status || "Draft");
        setIsFeatured(product.is_featured || false);
        setMetaTitle(product.meta_title || "");
        setMetaDescription(product.meta_description || "");
        setReturnPolicy(product.return_policy || "");
        setWarranty(product.warranty || "");
        
        // Load variant data if exists
        if (product.variants) {
          setHasSizes(product.variants.hasSizes || false);
          setHasColors(product.variants.hasColors || false);
          setSelectedColors(product.variants.selectedColors || []);
          setSizeStocks(product.variants.sizeStocks || []);
          
          // Load shipping options if exists
          if (product.variants.shippingOptions && Array.isArray(product.variants.shippingOptions)) {
            setShippingOptions(product.variants.shippingOptions);
          }
          
          // Load specifications if exists
          if (product.variants.specifications && Array.isArray(product.variants.specifications)) {
            setSpecifications(product.variants.specifications);
          }
          
          // Load guides if exists
          if (product.variants.guides && Array.isArray(product.variants.guides)) {
            setGuides(product.variants.guides);
          }
        }
        
        // Set existing media previews
        const existingImages = Array.isArray(product.image_gallery) && product.image_gallery.length > 0
          ? product.image_gallery
          : (product.image ? [product.image_url || product.image] : []);
        const existingVideos = Array.isArray(product.video_gallery) && product.video_gallery.length > 0
          ? product.video_gallery
          : (product.video ? [product.video_url || product.video] : []);
        setPhotos(existingImages);
        setVideos(existingVideos);
        
      } catch (error: any) {
        console.error("Failed to fetch product:", error);
        toast.error("Failed to load product data");
        navigate("/products");
      } finally {
        setIsLoadingProduct(false);
      }
    };
    
    fetchProduct();
  }, [id, isEditing, navigate]);
  
  // Set category from URL parameter on mount (only for new products)
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam && !isEditing) {
      setCategory(categoryParam);
    }
  }, [searchParams, isEditing]);
  
  const [hasSizes, setHasSizes] = useState(false);
  const [hasColors, setHasColors] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sizeStocks, setSizeStocks] = useState<SizeStock[]>([]);
  const [totalStock, setTotalStock] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([
    { type: "Standard", price: "4.99", estimatedDelivery: "5-7", enabled: true, freeShipping: false },
    { type: "Express", price: "12.99", estimatedDelivery: "2-3", enabled: false, freeShipping: false },
    { type: "Super Express", price: "24.99", estimatedDelivery: "1", enabled: false, freeShipping: false },
  ]);
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [specifications, setSpecifications] = useState<Specification[]>([{ key: "", value: "" }]);
  const [guides, setGuides] = useState<GuideDoc[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [status, setStatus] = useState("Draft");
  const [isFeatured, setIsFeatured] = useState(false);
  const [returnPolicy, setReturnPolicy] = useState("");
  const [warranty, setWarranty] = useState("");

  const addKeyword = (e?: React.MouseEvent) => { 
    e?.preventDefault(); 
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) { 
      setKeywords([...keywords, keywordInput.trim()]); 
      setKeywordInput(""); 
    } 
  };
  const addTag = (e?: React.MouseEvent) => { 
    e?.preventDefault(); 
    if (tagInput.trim() && !tags.includes(tagInput.trim())) { 
      setTags([...tags, tagInput.trim()]); 
      setTagInput(""); 
    } 
  };
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files);
    const totalPhotos = photos.length + newFiles.length;
    
    if (totalPhotos > 10) {
      toast.error("Maximum 10 photos allowed");
      return;
    }
    
    // Validate file types and sizes
    const validFiles: File[] = [];
    const validPreviews: string[] = [];
    
    newFiles.forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error(`${file.name} is too large. Max size is 10MB`);
        return;
      }
      
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    });
    
    setPhotoFiles([...photoFiles, ...validFiles]);
    setPhotos([...photos, ...validPreviews]);
  };
  
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files);
    const totalVideos = videos.length + newFiles.length;
    
    if (totalVideos > 5) {
      toast.error("Maximum 5 videos allowed");
      return;
    }
    
    // Validate file types and sizes
    const validFiles: File[] = [];
    const validPreviews: string[] = [];
    
    newFiles.forEach(file => {
      if (!file.type.startsWith('video/')) {
        toast.error(`${file.name} is not a video file`);
        return;
      }
      
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error(`${file.name} is too large. Max size is 50MB`);
        return;
      }
      
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    });
    
    setVideoFiles([...videoFiles, ...validFiles]);
    setVideos([...videos, ...validPreviews]);
  };
  
  const removePhoto = (index: number) => {
    const target = photos[index];
    if (target?.startsWith("blob:")) {
      URL.revokeObjectURL(target);
      const fileIndex = photos.slice(0, index + 1).filter((url) => url.startsWith("blob:")).length - 1;
      setPhotoFiles(photoFiles.filter((_, i) => i !== fileIndex));
    }
    setPhotos(photos.filter((_, i) => i !== index));
  };
  
  const removeVideo = (index: number) => {
    const target = videos[index];
    if (target?.startsWith("blob:")) {
      URL.revokeObjectURL(target);
      const fileIndex = videos.slice(0, index + 1).filter((url) => url.startsWith("blob:")).length - 1;
      setVideoFiles(videoFiles.filter((_, i) => i !== fileIndex));
    }
    setVideos(videos.filter((_, i) => i !== index));
  };
  const addSizeStock = () => setSizeStocks([...sizeStocks, { size: "", stock: 0 }]);
  const updateSizeStock = (i: number, field: keyof SizeStock, value: string | number) => { const u = [...sizeStocks]; u[i] = { ...u[i], [field]: value }; setSizeStocks(u); };
  const removeSizeStock = (i: number) => setSizeStocks(sizeStocks.filter((_, j) => j !== i));
  const addSpecification = () => setSpecifications([...specifications, { key: "", value: "" }]);
  const updateSpecification = (i: number, field: keyof Specification, value: string) => { const u = [...specifications]; u[i] = { ...u[i], [field]: value }; setSpecifications(u); };
  const removeSpecification = (i: number) => setSpecifications(specifications.filter((_, j) => j !== i));
  const toggleColor = (color: string) => setSelectedColors((prev) => prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!title || !regularPrice || !category) { 
      toast.error("Please fill in all required fields"); 
      return; 
    }
    
    if (!currentShop) {
      toast.error("No shop selected. Please select a shop first.");
      return;
    }
    
    try {
      const keptImageUrls = photos.filter((url) => !url.startsWith("blob:"));
      const keptVideoUrls = videos.filter((url) => !url.startsWith("blob:"));
      const uploadedImageUrls: string[] = [];
      const uploadedVideoUrls: string[] = [];

      // Prepare product data matching backend model
      const productData: any = {
        title: title,
        category: category ? parseInt(category) : null,  // Convert to integer
        sku: sku,
        brand: brand,
        barcode: barcode,
        description: description,
        short_description: shortDescription,
        price: parseFloat(regularPrice),
        originalPrice: discountPrice ? parseFloat(discountPrice) : parseFloat(regularPrice),
        actualCost: actualCost ? parseFloat(actualCost) : null,  // Add actualCost field
        discount: discountPrice ? Math.round(((parseFloat(regularPrice) - parseFloat(discountPrice)) / parseFloat(regularPrice)) * 100) : 0,
        stock: totalStock ? parseInt(totalStock) : 0,
        weight: weight ? parseFloat(weight) : null,
        weight_unit: weightUnit,
        rating: 0,
        reviews_count: 0,
        sold_count: 0,
        freeShipping: shippingOptions.some(opt => opt.freeShipping && opt.enabled),
        welcomeDeal: false,
        status: status,
        is_featured: isFeatured,
        meta_title: metaTitle,
        meta_description: metaDescription,
        return_policy: returnPolicy,
        warranty: warranty,
        badges: tags,
        variants: {
          hasSizes: hasSizes,
          hasColors: hasColors,
          selectedColors: selectedColors,
          sizeStocks: sizeStocks,
          shippingOptions: shippingOptions,
          specifications: specifications,
          guides: guides,
        },
      };
      
      // Only include shop when creating, not when updating
      if (!isEditing) {
        productData.shop = parseInt(currentShop.id);
      }
      
      console.log("Submitting product data:", productData);
      
      let savedProductId: number | string | null = null;
      
      if (isEditing && id) {
        // Update existing product
        const response = await api.put(`/products/${id}/`, productData);
        savedProductId = id;
        console.log("Product updated successfully:", response.data);
        console.log("Updated fields:", {
          title: response.data.title,
          sku: response.data.sku,
          brand: response.data.brand,
          stock: response.data.stock,
          status: response.data.status,
          description: response.data.description,
        });
        
      } else {
        // Create new product
        const response = await api.post('/products/', productData);
        savedProductId = response.data.id;
        console.log("Product created:", response.data);
      }

      if (savedProductId && photoFiles.length > 0) {
        const imageFormData = new FormData();
        photoFiles.forEach((file) => imageFormData.append('images', file));
        imageFormData.append('product_id', String(savedProductId));
        const imageUploadResponse = await api.post('/products/upload-images/', imageFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const uploaded = Array.isArray(imageUploadResponse.data?.uploaded)
          ? imageUploadResponse.data.uploaded
          : [];
        uploadedImageUrls.push(...uploaded.map((item: any) => item?.url).filter(Boolean));
      }

      if (savedProductId && videoFiles.length > 0) {
        for (const file of videoFiles) {
          const videoFormData = new FormData();
          videoFormData.append('video', file);
          videoFormData.append('product_id', String(savedProductId));
          const videoUploadResponse = await api.post('/products/upload-video/', videoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (videoUploadResponse.data?.video_url) {
            uploadedVideoUrls.push(videoUploadResponse.data.video_url);
          }
        }
      }

      if (isEditing && savedProductId) {
        await api.post(`/products/${savedProductId}/sync-media/`, {
          keep_image_urls: [...keptImageUrls, ...uploadedImageUrls],
          keep_video_urls: [...keptVideoUrls, ...uploadedVideoUrls],
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['admin_products'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      if (savedProductId) {
        await queryClient.invalidateQueries({ queryKey: ['product', savedProductId] });
      }
      await queryClient.refetchQueries({ queryKey: ['admin_products'] });

      toast.success(isEditing ? "Product updated successfully" : "Product created successfully");
      
      navigate("/products");
    } catch (error: any) {
      console.error("Failed to save product:", error);
      console.error("Error response:", error.response?.data);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error ||
                          error.response?.data?.shop?.[0] ||
                          error.response?.data?.title?.[0] ||
                          "Failed to save product. Please try again.";
      toast.error(errorMessage);
    }
  };

  const effectiveSellPrice = discountPrice ? parseFloat(discountPrice) : parseFloat(regularPrice);
  const margin = effectiveSellPrice && actualCost ? (((effectiveSellPrice - parseFloat(actualCost)) / effectiveSellPrice) * 100).toFixed(1) : null;

  // Show loading state while fetching product data
  if (isLoadingProduct) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground">Loading product data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")} className="rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Edit Product" : "Add New Product"}</h1>
          <p className="text-sm text-muted-foreground">{isEditing ? "Update product details" : "Fill in all the details to create a new product"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/products")} className="rounded-lg">Cancel</Button>
          <Button onClick={handleSubmit} className="rounded-lg shadow-sm">{isEditing ? "Update Product" : "Create Product"}</Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          <SectionCard title="Basic Information">
            <div className="space-y-2">
              <Label htmlFor="title">Product Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter product title" required className="rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. PRD-001" className="rounded-lg" /></div>
              <div className="space-y-2"><Label>Barcode / UPC</Label><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. 8901234567890" className="rounded-lg" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory} disabled={categoriesLoading}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={categoriesLoading ? "Loading categories..." : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesData.length === 0 && !categoriesLoading ? (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No categories found. Admin needs to create categories first.
                      </div>
                    ) : (
                      categoriesData.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" className="rounded-lg" /></div>
            </div>
            <div className="space-y-2">
              <Label>Product Keywords</Label>
              <div className="flex gap-2">
                <Input 
                  value={keywordInput} 
                  onChange={(e) => setKeywordInput(e.target.value)} 
                  placeholder="Add keyword" 
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }} 
                  className="rounded-lg" 
                />
                <Button type="button" variant="outline" size="sm" onClick={(e) => addKeyword(e)} className="rounded-lg">Add</Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1 rounded-md">{kw}<X className="h-3 w-3 cursor-pointer" onClick={() => setKeywords(keywords.filter((k) => k !== kw))} /></Badge>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Pricing">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Regular Price ($) *</Label><Input type="number" step="0.01" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} placeholder="0.00" required className="rounded-lg" /></div>
              <div className="space-y-2"><Label>Discount Price ($)</Label><Input type="number" step="0.01" value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} placeholder="0.00" className="rounded-lg" /></div>
              <div className="space-y-2"><Label>Actual Cost ($) <span className="text-xs text-muted-foreground">(seller only)</span></Label><Input type="number" step="0.01" value={actualCost} onChange={(e) => setActualCost(e.target.value)} placeholder="0.00" className="rounded-lg" /></div>
            </div>
            {margin && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-sm">
                Profit Margin: <span className="font-bold text-success">{margin}%</span>
                {discountPrice && regularPrice && (
                  <> · Discount: <span className="font-bold text-destructive">{((1 - parseFloat(discountPrice) / parseFloat(regularPrice)) * 100).toFixed(1)}% off</span></>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Photos & Videos">
            <div className="space-y-2">
              <Label>Product Photos</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((photo, i) => (
                  <div key={i} className="aspect-square rounded-xl border border-border bg-muted/30 overflow-hidden relative group">
                    <img src={photo} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => removePhoto(i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {i === 0 && (
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-primary text-primary-foreground text-xs font-medium">
                        Main
                      </div>
                    )}
                  </div>
                ))}
                {photos.length < 10 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <Upload className="h-6 w-6" />
                    <span className="text-xs font-medium">Add Photo</span>
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload up to 10 photos (max 10MB each). First uploaded photo is used as the main image. Supported: JPG, PNG, WebP
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Product Videos</Label>
              <div className="flex gap-3 flex-wrap">
                {videos.map((video, i) => (
                  <div key={i} className="w-32 h-20 rounded-xl border border-border bg-muted/30 overflow-hidden relative group">
                    <video src={video} className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      className="absolute top-1 right-1 p-0.5 rounded-lg bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => removeVideo(i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {videos.length < 5 && (
                  <label className="w-32 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                    <Upload className="h-5 w-5" />
                    <span className="text-xs font-medium">Add Video</span>
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload up to 5 videos (max 50MB each). Supported: MP4, WebM, MOV
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Variants">
            <div className="flex items-center justify-between">
              <Label>Enable Sizes</Label>
              <Switch checked={hasSizes} onCheckedChange={setHasSizes} />
            </div>
            {hasSizes && (
              <div className="space-y-3 pl-1">
                <Label className="text-xs text-muted-foreground">Stock by Size</Label>
                {sizeStocks.map((ss, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={ss.size} onValueChange={(v) => updateSizeStock(i, "size", v)}>
                      <SelectTrigger className="w-28 rounded-lg"><SelectValue placeholder="Size" /></SelectTrigger>
                      <SelectContent>{sizeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" className="w-24 rounded-lg" placeholder="Stock" value={ss.stock || ""} onChange={(e) => updateSizeStock(i, "stock", parseInt(e.target.value) || 0)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSizeStock(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addSizeStock} className="rounded-lg"><Plus className="h-4 w-4 mr-1" /> Add Size</Button>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Enable Colors</Label>
              <Switch checked={hasColors} onCheckedChange={setHasColors} />
            </div>
            {hasColors && (
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button key={color} type="button" onClick={() => toggleColor(color)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedColors.includes(color)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 text-secondary-foreground border-border hover:border-primary/50"
                    }`}
                  >{color}</button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Shipping & Weight">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.00" className="rounded-lg" />
                  <Select value={weightUnit} onValueChange={setWeightUnit}>
                    <SelectTrigger className="w-20 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem><SelectItem value="g">g</SelectItem><SelectItem value="lb">lb</SelectItem><SelectItem value="oz">oz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label className="text-base font-semibold">Shipping Options</Label>
              {shippingOptions.map((opt, i) => (
                <div key={i} className={`p-3 rounded-xl border transition-colors space-y-2 ${opt.enabled ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/20 opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <Switch checked={opt.enabled} onCheckedChange={(v) => { const u = [...shippingOptions]; u[i] = { ...u[i], enabled: v }; setShippingOptions(u); }} />
                    <span className="font-medium text-sm w-32">{opt.type}</span>
                    <div className={`flex items-center gap-1 ${opt.freeShipping ? "opacity-40 pointer-events-none" : ""}`}>
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input type="number" step="0.01" value={opt.freeShipping ? "0.00" : opt.price} onChange={(e) => { const u = [...shippingOptions]; u[i] = { ...u[i], price: e.target.value }; setShippingOptions(u); }} placeholder="0.00" className="rounded-lg w-24" />
                    </div>
                    <Input value={opt.estimatedDelivery} onChange={(e) => { const u = [...shippingOptions]; u[i] = { ...u[i], estimatedDelivery: e.target.value }; setShippingOptions(u); }} placeholder="Days" className="rounded-lg w-28" />
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Label className="text-xs text-muted-foreground">Free</Label>
                      <Switch checked={opt.freeShipping} onCheckedChange={(v) => { const u = [...shippingOptions]; u[i] = { ...u[i], freeShipping: v }; setShippingOptions(u); }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Description">
            <div className="space-y-2"><Label>Short Description</Label><Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Brief one-liner" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Full Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed product description..." rows={6} className="rounded-lg" /></div>
          </SectionCard>

          <SectionCard title="Specifications">
            {specifications.map((spec, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder="Attribute" value={spec.key} onChange={(e) => updateSpecification(i, "key", e.target.value)} className="rounded-lg" />
                <Input placeholder="Value" value={spec.value} onChange={(e) => updateSpecification(i, "value", e.target.value)} className="rounded-lg" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSpecification(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSpecification} className="rounded-lg"><Plus className="h-4 w-4 mr-1" /> Add Specification</Button>
          </SectionCard>

          <SectionCard title="Item Guides & Documents">
            <p className="text-sm text-muted-foreground">Upload user manuals, size guides, care instructions.</p>
            <div className="space-y-2">
              {guides.map((g, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                  <span className="text-lg">📄</span>
                  <span className="text-sm flex-1 font-medium">{g.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setGuides(guides.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <button type="button" onClick={() => setGuides([...guides, { name: `Document ${guides.length + 1}.pdf`, type: "pdf" }])} className="w-full py-3.5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                <Upload className="h-5 w-5" /><span className="text-sm font-medium">Upload Document</span>
              </button>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <SectionCard title="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem><SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Out of Stock">Out of Stock</SelectItem><SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between">
              <Label>Featured Product</Label>
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>
          </SectionCard>

          {!hasSizes && (
            <SectionCard title="Inventory">
              <div className="space-y-2"><Label>Total Stock</Label><Input type="number" value={totalStock} onChange={(e) => setTotalStock(e.target.value)} placeholder="0" className="rounded-lg" /></div>
            </SectionCard>
          )}

          <SectionCard title="Tags">
            <div className="flex gap-2">
              <Input 
                value={tagInput} 
                onChange={(e) => setTagInput(e.target.value)} 
                placeholder="Add tag" 
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }} 
                className="rounded-lg" 
              />
              <Button type="button" variant="outline" size="sm" onClick={(e) => addTag(e)} className="rounded-lg">Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 rounded-md">{t}<X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter((x) => x !== t))} /></Badge>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Policies">
            <div className="space-y-2">
              <Label>Return Policy</Label>
              <Select value={returnPolicy} onValueChange={setReturnPolicy}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select policy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-return">No Return</SelectItem><SelectItem value="7-day">7-Day</SelectItem>
                  <SelectItem value="15-day">15-Day</SelectItem><SelectItem value="30-day">30-Day</SelectItem><SelectItem value="60-day">60-Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Warranty</Label><Input value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="e.g. 1 Year" className="rounded-lg" /></div>
          </SectionCard>

          <SectionCard title="SEO">
            <div className="space-y-2">
              <Label>Meta Title</Label>
              <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="SEO title" className="rounded-lg" />
              <p className="text-xs text-muted-foreground">{metaTitle.length}/60</p>
            </div>
            <div className="space-y-2">
              <Label>Meta Description</Label>
              <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="SEO description" rows={3} className="rounded-lg" />
              <p className="text-xs text-muted-foreground">{metaDescription.length}/160</p>
            </div>
          </SectionCard>
        </div>
      </form>
    </div>
  );
}
