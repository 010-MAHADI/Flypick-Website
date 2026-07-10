import { useSearchParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { SlidersHorizontal, X, Star, Truck, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import api from "@/lib/api";
import TakaSign from "@/components/TakaSign";

const SORT_OPTIONS = [
  { value: "best-match", label: "Best Match" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
  { value: "rating", label: "Top Rated" },
  { value: "orders", label: "Most Orders" },
];

const Search = () => {
  const { data: products = [], isLoading, isError } = useProducts();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category");
  const [sortBy, setSortBy] = useState("best-match");
  const [showFilters, setShowFilters] = useState(false);

  const { data: category } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: async () => {
      if (!categoryId) return null;
      const response = await api.get(`/products/categories/${categoryId}/`);
      return response.data;
    },
    enabled: !!categoryId,
  });

  // Filter state
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [onlyDeals, setOnlyDeals] = useState(false);

  const toggleBadge = (b: string) =>
    setSelectedBadges((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  const activeFilterCount = [
    priceMin || priceMax,
    freeShipping,
    minRating > 0,
    selectedBadges.length > 0,
    onlyDeals,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setFreeShipping(false);
    setMinRating(0);
    setSelectedBadges([]);
    setOnlyDeals(false);
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (categoryId && p.category_id !== parseInt(categoryId)) return false;
      if (
        query &&
        !p.title.toLowerCase().includes(query.toLowerCase()) &&
        !p.category.toLowerCase().includes(query.toLowerCase()) &&
        !p.store.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      if (priceMin && p.price < Number(priceMin)) return false;
      if (priceMax && p.price > Number(priceMax)) return false;
      if (freeShipping && !p.freeShipping) return false;
      if (minRating > 0 && p.rating < minRating) return false;
      if (selectedBadges.length > 0 && !selectedBadges.some((b) => p.badges.includes(b))) return false;
      if (onlyDeals && !p.welcomeDeal) return false;
      return true;
    });
  }, [products, categoryId, query, priceMin, priceMax, freeShipping, minRating, selectedBadges, onlyDeals]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        case "rating":
          return b.rating - a.rating;
        case "orders":
          return b.reviews - a.reviews;
        default:
          return 0;
      }
    });
  }, [filtered, sortBy]);

  const filterPanel = (
    <>
      {/* Price Range */}
      <div>
        <p className="text-xs font-bold text-foreground mb-2">Price Range (৳)</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Min"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="number"
            inputMode="numeric"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Max"
          />
        </div>
      </div>

      {/* Rating */}
      <div>
        <p className="text-xs font-bold text-foreground mb-2">Minimum Rating</p>
        <div className="flex gap-2">
          {[3, 4, 4.5].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(minRating === r ? 0 : r)}
              className={`chip ${minRating === r ? "chip-active" : ""}`}
            >
              <Star className="w-3.5 h-3.5 fill-star text-star" />
              {r}+
            </button>
          ))}
        </div>
      </div>

      {/* Labels */}
      <div>
        <p className="text-xs font-bold text-foreground mb-2">Labels</p>
        <div className="flex gap-2 flex-wrap">
          {["Choice", "Sale"].map((b) => (
            <button key={b} onClick={() => toggleBadge(b)} className={`chip ${selectedBadges.includes(b) ? "chip-active" : ""}`}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Shipping & Deals */}
      <div>
        <p className="text-xs font-bold text-foreground mb-2">Offers</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFreeShipping(!freeShipping)} className={`chip ${freeShipping ? "chip-active" : ""}`}>
            <Truck className="w-3.5 h-3.5" /> Free Shipping
          </button>
          <button onClick={() => setOnlyDeals(!onlyDeals)} className={`chip ${onlyDeals ? "chip-active" : ""}`}>
            <Tag className="w-3.5 h-3.5" /> Welcome Deals
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="section-shell py-3 sm:py-6 pb-mobile-nav md:pb-10">
        {/* Header + toolbar */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-extrabold truncate">
              {category ? category.name : query ? `"${query}"` : "All Products"}
            </h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground">{sorted.length} items</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowFilters(true)}
              className={`chip !py-2 ${activeFilterCount > 0 ? "chip-active" : ""}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4.5 h-4.5 min-w-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs sm:text-sm font-semibold border border-border rounded-full px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(priceMin || priceMax) && (
              <span className="chip chip-active !text-[11px]">
                <TakaSign />
                {priceMin || "0"} – <TakaSign />
                {priceMax || "∞"}
                <button onClick={() => { setPriceMin(""); setPriceMax(""); }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {freeShipping && (
              <span className="chip chip-active !text-[11px]">
                Free Shipping
                <button onClick={() => setFreeShipping(false)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {minRating > 0 && (
              <span className="chip chip-active !text-[11px]">
                {minRating}★ & up
                <button onClick={() => setMinRating(0)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedBadges.map((b) => (
              <span key={b} className="chip chip-active !text-[11px]">
                {b}
                <button onClick={() => toggleBadge(b)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {onlyDeals && (
              <span className="chip chip-active !text-[11px]">
                Deals Only
                <button onClick={() => setOnlyDeals(false)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button onClick={clearFilters} className="text-[11px] font-semibold text-destructive px-2 hover:underline">
              Clear all
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton aspect-square mb-2" />
                <div className="skeleton h-3 w-full !rounded-full mb-1.5" />
                <div className="skeleton h-3 w-2/3 !rounded-full" />
              </div>
            ))}
          </div>
        )}
        {isError && <div className="text-center py-10 text-muted-foreground text-sm">Failed to load products.</div>}

        {/* Results */}
        {!isLoading && !isError && (
          sorted.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-3xl mb-3">🔍</p>
              <p className="font-bold text-foreground mb-1">No products found</p>
              <p className="text-sm text-muted-foreground mb-4">Try different keywords or remove some filters.</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-sm font-semibold text-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
              {sorted.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )
        )}
      </main>

      {/* Filters — bottom sheet on mobile, modal panel on desktop */}
      {showFilters && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setShowFilters(false)} />
          <div
            className="relative w-full md:max-w-lg bg-card rounded-t-3xl md:rounded-3xl p-5 pb-8 md:pb-6 z-10 max-h-[85vh] overflow-y-auto"
            style={{ animation: "slideUp 0.25s ease-out" }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 md:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold">Filters</h3>
              <div className="flex items-center gap-4">
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs font-semibold text-destructive hover:underline">
                    Clear all
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-5">{filterPanel}</div>

            <button
              onClick={() => setShowFilters(false)}
              className="w-full mt-6 text-sm font-bold bg-primary text-primary-foreground py-3.5 rounded-full active:scale-[0.98] hover:opacity-90 transition-all"
            >
              Show {sorted.length} results
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
};

export default Search;
