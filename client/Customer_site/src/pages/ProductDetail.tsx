import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, Heart, Share2, Truck, ShieldCheck, RotateCcw, ChevronRight, Minus, Plus, Zap, Store, X, BadgeCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProduct, useProductByPath, useProducts } from "@/hooks/useProducts";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import ProductSpecifications from "@/components/ProductSpecifications";
import ProductDescription from "@/components/ProductDescription";
import ProductCoupons from "@/components/ProductCoupons";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { extractProductId, generateProductUrl, slugify } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";

const ProductDetail = () => {
  const { id, category, slug } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const legacyProductId = !id ? extractProductId(window.location.pathname)?.toString() : null;
  // Every canonical product URL ends in "-<id>", so pull the id straight from
  // the slug. This keeps product resolution working no matter what the
  // category segment says (so the category label can change freely).
  const slugProductId = !id && !legacyProductId && slug ? slug.match(/-(\d+)$/)?.[1] ?? null : null;
  const effectiveId = id || legacyProductId || slugProductId || "";
  const categorySlug = category ? slugify(category) : "";
  const productSlug = slug ? slugify(slug) : "";
  // Only resolve by path for legacy links that carry no id in the slug.
  const shouldResolveByPath = !effectiveId && !!categorySlug && !!productSlug;

  const { data: resolvedProduct, isLoading: isPathLoading, error: pathError } = useProductByPath(
    shouldResolveByPath ? categorySlug : "",
    shouldResolveByPath ? productSlug : "",
  );
  const { data: fetchedProduct, isLoading: isProductLoading, error: productError } = useProduct(effectiveId);
  const product = fetchedProduct || resolvedProduct;
  const error = productError || pathError;
  const { data: allProducts = [] } = useProducts();
  const [quantity, setQuantity] = useState(1);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const liked = product ? isInWishlist(product.id) : false;
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [pendingAction, setPendingAction] = useState<"cart" | "buy" | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<string>("");
  const { addToCart, setBuyNowItem } = useCart();

  useEffect(() => {
    if (!product) return;
    const canonicalPath = generateProductUrl(product);
    if (window.location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [navigate, product]);

  const reviewsRef = useRef<HTMLDivElement>(null);
  const specsRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const isLoading = isProductLoading || (shouldResolveByPath && isPathLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="section-shell py-4 grid lg:grid-cols-2 gap-6">
          <div className="skeleton aspect-square" />
          <div className="space-y-3">
            <div className="skeleton h-6 w-3/4 !rounded-full" />
            <div className="skeleton h-6 w-1/2 !rounded-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <p className="text-3xl">😕</p>
          <p className="font-bold">Product not found</p>
          <Link to="/" className="text-sm font-semibold text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const productImages = product.image_gallery && product.image_gallery.length > 0 ? product.image_gallery : [product.image];
  const productVideos = product.video_gallery || [];
  const totalMedia = productImages.length + productVideos.length;

  const shippingOptions =
    product.variants?.shippingOptions && product.variants.shippingOptions.length > 0
      ? product.variants.shippingOptions.filter((opt: any) => opt.enabled)
      : [{ type: "Standard", price: product.freeShipping ? "0" : "50", estimatedDelivery: "3-5", enabled: true, freeShipping: product.freeShipping }];

  if (!selectedShipping && shippingOptions.length > 0) {
    setSelectedShipping(shippingOptions[0].type.toLowerCase());
  }

  const hasColors = !!(product.variants?.hasColors && product.variants?.selectedColors && product.variants.selectedColors.length > 0);
  const hasSizes = !!(product.variants?.hasSizes && product.variants?.sizeStocks && product.variants.sizeStocks.length > 0);
  const hasDiscount = product.discount > 0 && product.originalPrice > product.price;
  const inStock = product.stock === undefined || product.stock > 0;
  const savings = hasDiscount ? product.originalPrice - product.price : 0;
  const subtotal = product.price * quantity;

  const selectedShippingOption =
    shippingOptions.find((opt: any) => opt.type.toLowerCase() === selectedShipping) || shippingOptions[0];

  const relatedProducts = (allProducts || []).filter((p) => p.id !== product.id).slice(0, 12);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && selectedImage < totalMedia - 1) setSelectedImage(selectedImage + 1);
      else if (diff < 0 && selectedImage > 0) setSelectedImage(selectedImage - 1);
    }
  };

  const sections = [
    { label: `Reviews (${product.reviews})`, ref: reviewsRef },
    { label: "Specifications", ref: specsRef },
    { label: "Description", ref: descRef },
    { label: "More to love", ref: moreRef },
  ];
  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const triggerAction = (action: "cart" | "buy") => {
    if (!isLoggedIn) {
      toast({ title: "Login required", description: "Please login to continue shopping.", variant: "destructive" });
      localStorage.setItem("redirect_after_login", window.location.pathname);
      navigate("/auth");
      return;
    }
    if (hasColors || hasSizes) {
      setPendingAction(action);
      setShowConfirmSheet(true);
      return;
    }
    executeAction(action);
  };

  const executeAction = async (action: "cart" | "buy") => {
    if (!isLoggedIn) {
      toast({ title: "Login required", description: "Please login to continue shopping.", variant: "destructive" });
      localStorage.setItem("redirect_after_login", window.location.pathname);
      navigate("/auth");
      return;
    }
    const color = selectedColor || "";
    const size = selectedSize || "";
    const shippingType = selectedShipping || "";

    if (action === "cart") {
      try {
        await addToCart(product, quantity, color, size, shippingType);
        toast({
          title: "Added to cart",
          description: `${product.title} (x${quantity})${color ? ` - ${color}` : ""}${size ? `, Size ${size}` : ""}`,
        });
      } catch {
        toast({ title: "Failed to add to cart", description: "Please try again", variant: "destructive" });
      }
    } else {
      setBuyNowItem({ product, quantity, color, size, shippingType });
      navigate("/checkout");
    }
    setShowConfirmSheet(false);
    setPendingAction(null);
  };

  const handleConfirm = () => {
    const needsColorSelection = hasColors && !selectedColor;
    const needsSizeSelection = hasSizes && !selectedSize;
    if (needsColorSelection || needsSizeSelection) {
      toast({
        title: "Please select options",
        description: `Please select ${needsColorSelection ? "a color" : ""}${needsColorSelection && needsSizeSelection ? " and " : ""}${needsSizeSelection ? "a size" : ""} to continue.`,
        variant: "destructive",
      });
      return;
    }
    if (pendingAction) executeAction(pendingAction);
  };

  const handleShare = async () => {
    const shareData = { title: product.title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast({ title: "Link copied", description: "Product link copied to clipboard." });
      }
    } catch {
      /* user cancelled */
    }
  };

  /* ---------- shared building blocks ---------- */

  const VariantChips = () => (
    <>
      {hasColors && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">
            Color: <span className={selectedColor ? "text-primary" : "text-muted-foreground"}>{selectedColor || "Select"}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            {product.variants!.selectedColors!.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all active:scale-95 ${
                  color === selectedColor
                    ? "border-primary bg-accent text-accent-foreground shadow-sm"
                    : "border-border bg-card text-foreground/80 hover:border-primary/40"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}
      {hasSizes && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">
            Size: <span className={selectedSize ? "text-primary" : "text-muted-foreground"}>{selectedSize || "Select"}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            {product.variants!.sizeStocks!.map((sizeStock) => (
              <button
                key={sizeStock.size}
                onClick={() => setSelectedSize(sizeStock.size)}
                disabled={sizeStock.stock === 0}
                className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all active:scale-95 ${
                  sizeStock.size === selectedSize
                    ? "border-primary bg-accent text-accent-foreground shadow-sm"
                    : sizeStock.stock === 0
                    ? "border-border text-muted-foreground opacity-40 cursor-not-allowed line-through"
                    : "border-border bg-card text-foreground/80 hover:border-primary/40"
                }`}
              >
                {sizeStock.size}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const ShippingSelector = () => (
    <div className="space-y-2">
      {shippingOptions.map((option: any, index: number) => {
        const active = selectedShipping === option.type.toLowerCase();
        return (
          <button
            key={index}
            onClick={() => setSelectedShipping(option.type.toLowerCase())}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
              active ? "border-primary bg-accent/60" : "border-border hover:border-primary/30"
            }`}
          >
            {option.type.toLowerCase().includes("express") || option.type.toLowerCase().includes("super") ? (
              <Zap className="w-4 h-4 text-secondary flex-shrink-0" />
            ) : (
              <Truck className="w-4 h-4 text-success flex-shrink-0" />
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold">
                {option.type} ·{" "}
                {option.freeShipping ? (
                  <span className="text-success">Free</span>
                ) : (
                  <>
                    <TakaSign />
                    {option.price}
                  </>
                )}
              </span>
              <span className="block text-[11px] text-muted-foreground">{option.estimatedDelivery} business days</span>
            </span>
            <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? "border-primary" : "border-border"}`}>
              {active && <span className="w-2 h-2 rounded-full bg-primary" />}
            </span>
          </button>
        );
      })}
    </div>
  );

  const QuantityStepper = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 bg-muted rounded-full p-1">
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="w-8 h-8 rounded-full bg-card shadow-sm flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Decrease quantity"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-bold w-9 text-center tabular-nums">{quantity}</span>
        <button
          onClick={() => setQuantity(quantity + 1)}
          disabled={product.stock !== undefined && quantity >= product.stock}
          className="w-8 h-8 rounded-full bg-card shadow-sm flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          aria-label="Increase quantity"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {product.stock !== undefined && (
        <p className={`text-xs font-semibold ${inStock ? "text-success" : "text-destructive"}`}>
          {inStock ? `${product.stock} in stock` : "Out of stock"}
        </p>
      )}
    </div>
  );

  const PolicyRows = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      <div className="flex items-start gap-2.5 text-[12.5px]">
        <RotateCcw className="w-4 h-4 text-foreground/50 mt-0.5 flex-shrink-0" />
        <span className="text-foreground/75">
          {product.return_policy ? `${product.return_policy} return & refund — full refund on easy returns.` : "Return & refund policy applies."}
        </span>
      </div>
      <div className="flex items-start gap-2.5 text-[12.5px]">
        <ShieldCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
        <span className="text-foreground/75">{product.warranty ? `${product.warranty} warranty included.` : "Secure payment & buyer protection."}</span>
      </div>
    </div>
  );

  const StoreRow = () => (
    <Link to={`/search?q=${encodeURIComponent(product.store)}`} className="flex items-center gap-3 group">
      <span className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
        <Store className="w-5 h-5 text-accent-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold truncate group-hover:text-primary transition-colors">{product.store}</span>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <BadgeCheck className="w-3 h-3 text-success" /> Official Store · 98% positive
        </span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );

  /* Bold price strip — the visual anchor of the page */
  const PriceStrip = () => (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-secondary text-primary-foreground px-4 py-3.5 sm:px-5 shadow-md">
      <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" />
      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0">
          {product.welcomeDeal && (
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground/85 mb-0.5">Welcome Deal</p>
          )}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[28px] sm:text-4xl font-black leading-none">
              <TakaSign />
              {product.price.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-sm text-primary-foreground/70 line-through font-medium">
                <TakaSign />
                {product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>
          {hasDiscount && (
            <p className="text-[11px] font-semibold text-primary-foreground/90 mt-1">
              You save <TakaSign />
              {savings.toLocaleString()}
            </p>
          )}
        </div>
        {hasDiscount && (
          <span className="flex-shrink-0 bg-white text-primary text-sm font-black px-2.5 py-1.5 rounded-xl shadow-sm">
            -{product.discount}%
          </span>
        )}
      </div>
    </div>
  );

  const RatingRow = () => (
    <div className="flex items-center gap-2 flex-wrap text-[12.5px]">
      {product.rating > 0 ? (
        <span className="inline-flex items-center gap-1 bg-star/15 text-foreground font-bold px-2 py-1 rounded-lg">
          <Star className="w-3.5 h-3.5 fill-star text-star" />
          {product.rating}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground font-semibold px-2 py-1 rounded-lg">New</span>
      )}
      <button onClick={() => scrollTo(reviewsRef)} className="text-muted-foreground hover:text-primary transition-colors">
        {product.reviews > 0 ? `${product.reviews} reviews` : "No reviews yet"}
      </button>
      <span className="text-border">•</span>
      <span className="text-muted-foreground">{product.sold} sold</span>
      {product.badges.includes("Choice") && <span className="badge-choice">Choice</span>}
      {product.freeShipping && <span className="badge-free-shipping font-bold">Free shipping</span>}
    </div>
  );

  const ctaButtons = (size: "sm" | "lg") => (
    <div className={`grid grid-cols-2 gap-2.5 ${size === "lg" ? "" : ""}`}>
      <button
        onClick={() => triggerAction("cart")}
        disabled={!inStock}
        className={`border-2 border-primary text-primary font-bold rounded-full hover:bg-accent transition-colors disabled:opacity-40 ${
          size === "lg" ? "py-3 text-sm" : "py-2.5 text-sm"
        }`}
      >
        Add to cart
      </button>
      <button
        onClick={() => triggerAction("buy")}
        disabled={!inStock}
        className={`bg-primary text-primary-foreground font-bold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 shadow-md shadow-primary/25 ${
          size === "lg" ? "py-3 text-sm" : "py-2.5 text-sm"
        }`}
      >
        {inStock ? "Buy now" : "Out of stock"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="max-w-[1440px] mx-auto lg:px-6 lg:py-6">
        {/* Breadcrumb — desktop only */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/search?q=${encodeURIComponent(product.category)}`} className="hover:text-primary">{product.category}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground/70 truncate max-w-[320px]">{product.title}</span>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,44%)_minmax(0,1fr)_360px] lg:gap-7 lg:items-start">
          {/* ---------------- GALLERY ---------------- */}
          <div className="min-w-0 lg:sticky lg:top-24">
            <div
              className="relative bg-muted overflow-hidden lg:rounded-2xl aspect-square"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {selectedImage < productImages.length ? (
                <img src={productImages[selectedImage]} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <video src={productVideos[selectedImage - productImages.length]} controls className="w-full h-full object-cover" autoPlay />
              )}

              {totalMedia > 1 && (
                <span className="absolute bottom-8 lg:bottom-3 right-3 bg-foreground/60 text-background text-[11px] font-bold px-2.5 py-1 rounded-full tabular-nums backdrop-blur-sm">
                  {selectedImage + 1}/{totalMedia}
                </span>
              )}
              {hasDiscount && (
                <span className="absolute top-3 left-3 badge-discount !text-sm !px-2 !py-1 shadow-md">-{product.discount}%</span>
              )}

              <div className="absolute top-3 right-3 flex flex-col gap-2 lg:hidden">
                <button
                  onClick={() => toggleWishlist(product)}
                  aria-label="Wishlist"
                  className="w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm shadow-md flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Heart className={`w-[18px] h-[18px] ${liked ? "fill-primary text-primary" : "text-foreground/70"}`} />
                </button>
                <button
                  onClick={handleShare}
                  aria-label="Share"
                  className="w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm shadow-md flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Share2 className="w-[18px] h-[18px] text-foreground/70" />
                </button>
              </div>
            </div>

            {/* Thumbnails — desktop (below gallery) */}
            {totalMedia > 1 && (
              <div className="hidden lg:flex gap-2 overflow-x-auto no-scrollbar mt-3">
                {productImages.map((img, i) => (
                  <button
                    key={`img-${i}`}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 ring-2 transition-all ${
                      i === selectedImage ? "ring-primary" : "ring-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {productVideos.map((video, i) => (
                  <button
                    key={`vid-${i}`}
                    onClick={() => setSelectedImage(productImages.length + i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative ring-2 transition-all ${
                      productImages.length + i === selectedImage ? "ring-primary" : "ring-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <video src={video} className="w-full h-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---------------- INFO (middle column) ---------------- */}
          {/* On mobile this sheet overlaps the gallery bottom for an app feel */}
          <div className="min-w-0 relative z-10 -mt-5 lg:mt-0 rounded-t-3xl lg:rounded-none bg-background pt-4 lg:pt-0 px-3 lg:px-0">
            {/* Thumbnails — mobile (inside the sheet) */}
            {totalMedia > 1 && (
              <div className="flex lg:hidden gap-2 overflow-x-auto no-scrollbar mb-3.5">
                {productImages.map((img, i) => (
                  <button
                    key={`m-img-${i}`}
                    onClick={() => setSelectedImage(i)}
                    className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-2 transition-all ${
                      i === selectedImage ? "ring-primary" : "ring-transparent opacity-60"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {productVideos.map((video, i) => (
                  <button
                    key={`m-vid-${i}`}
                    onClick={() => setSelectedImage(productImages.length + i)}
                    className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative ring-2 transition-all ${
                      productImages.length + i === selectedImage ? "ring-primary" : "ring-transparent opacity-60"
                    }`}
                  >
                    <video src={video} className="w-full h-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <PriceStrip />

            <h1 className="text-[15px] sm:text-lg lg:text-xl font-semibold text-foreground leading-snug mt-3.5">{product.title}</h1>

            <div className="mt-2.5">
              <RatingRow />
            </div>

            <div className="mt-4">
              <ProductCoupons productId={product.id.toString()} />
            </div>

            <div className="mt-4">
              <VariantChips />
            </div>

            {/* Mobile / tablet: shipping + policies + store + quantity
                (desktop gets these inside the buy box instead) */}
            <div className="lg:hidden space-y-3 mt-1">
              <div className="bg-card rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <p className="text-sm font-bold mb-3">Delivery</p>
                <ShippingSelector />
                <div className="border-t border-border/70 mt-4 pt-3.5">
                  <PolicyRows />
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <StoreRow />
              </div>

              <div className="bg-card rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold">Quantity</p>
                  <p className="text-sm font-bold text-primary">
                    <TakaSign />
                    {subtotal.toLocaleString()}
                  </p>
                </div>
                <QuantityStepper />
              </div>
            </div>
          </div>

          {/* ---------------- BUY BOX (desktop) ---------------- */}
          <aside className="hidden lg:block lg:sticky lg:top-24">
            <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(16,24,40,0.08)] p-5">
              <p className="text-sm font-bold mb-3">Delivery</p>
              <ShippingSelector />

              <div className="border-t border-border/70 mt-4 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold">Quantity</p>
                </div>
                <QuantityStepper />
              </div>

              <div className="flex items-center justify-between border-t border-border/70 mt-4 pt-4 mb-4">
                <span className="text-sm text-muted-foreground">
                  Subtotal{" "}
                  {selectedShippingOption && !selectedShippingOption.freeShipping && Number(selectedShippingOption.price) > 0 && (
                    <span className="text-[11px]">(+ shipping)</span>
                  )}
                </span>
                <span className="text-xl font-black text-primary">
                  <TakaSign />
                  {subtotal.toLocaleString()}
                </span>
              </div>

              {ctaButtons("lg")}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => toggleWishlist(product)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary py-2.5 rounded-full bg-muted transition-colors"
                >
                  <Heart className={`w-4 h-4 ${liked ? "fill-primary text-primary" : ""}`} /> Wishlist
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary py-2.5 rounded-full bg-muted transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>

              <div className="border-t border-border/70 mt-4 pt-4">
                <PolicyRows compact />
              </div>

              <div className="border-t border-border/70 mt-4 pt-4">
                <StoreRow />
              </div>
            </div>
          </aside>
        </div>

        {/* ---------------- SECTION TABS + CONTENT ---------------- */}
        <div className="sticky top-[104px] lg:top-[120px] z-30 bg-background/95 backdrop-blur-sm mt-6 border-b border-border">
          <div className="flex gap-1 overflow-x-auto no-scrollbar px-3 lg:px-0">
            {sections.map((section) => (
              <button
                key={section.label}
                onClick={() => scrollTo(section.ref)}
                className="text-[13px] font-semibold whitespace-nowrap px-3 py-3 text-muted-foreground hover:text-primary transition-colors"
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 lg:px-0">
          <div ref={reviewsRef} className="pt-6 scroll-mt-[170px]">
            <ProductReviews product={product} />
          </div>

          <div ref={specsRef} className="pt-6 border-t border-border mt-6 scroll-mt-[170px]">
            <ProductSpecifications product={product} />
          </div>

          <div ref={descRef} className="pt-6 border-t border-border mt-6 scroll-mt-[170px]">
            <ProductDescription product={product} />
          </div>

          <div ref={moreRef} className="pt-6 border-t border-border mt-6 scroll-mt-[170px] pb-28 lg:pb-10">
            <div className="section-head">
              <h2 className="section-title">More to love</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3.5">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />

      {/* Mobile sticky CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[55] bg-card border-t border-border/70 lg:hidden safe-bottom">
        <div className="flex items-center gap-2 p-2.5">
          <button
            onClick={() => toggleWishlist(product)}
            aria-label="Wishlist"
            className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          >
            <Heart className={`w-5 h-5 ${liked ? "fill-primary text-primary" : "text-foreground/60"}`} />
          </button>
          <button
            onClick={() => triggerAction("cart")}
            disabled={!inStock}
            className="flex-1 border-2 border-primary text-primary font-bold py-2.5 rounded-full text-sm active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            Add to cart
          </button>
          <button
            onClick={() => triggerAction("buy")}
            disabled={!inStock}
            className="flex-[1.2] bg-primary text-primary-foreground font-bold py-2.5 rounded-full text-sm active:scale-[0.98] transition-transform disabled:opacity-40 shadow-md shadow-primary/25"
          >
            {inStock ? (
              <>
                Buy now · <TakaSign />
                {subtotal.toLocaleString()}
              </>
            ) : (
              "Out of stock"
            )}
          </button>
        </div>
      </div>

      {/* Variant confirmation sheet */}
      {showConfirmSheet && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => { setShowConfirmSheet(false); setPendingAction(null); }} />
          <div
            className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 z-10"
            style={{ animation: "slideUp 0.25s ease-out" }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
            <button
              onClick={() => { setShowConfirmSheet(false); setPendingAction(null); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex gap-3 mb-5 pb-4 border-b border-border">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                <img src={product.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-2">{product.title}</p>
                <p className="text-xl font-black text-primary mt-1">
                  <TakaSign />
                  {product.price.toLocaleString()}
                </p>
              </div>
            </div>

            <VariantChips />

            <button
              onClick={handleConfirm}
              className={`w-full font-bold py-3.5 rounded-full transition-all active:scale-[0.98] mt-2 ${
                pendingAction === "buy"
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border-2 border-primary text-primary hover:bg-accent"
              }`}
            >
              {pendingAction === "buy" ? "Buy now" : "Add to cart"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
