import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import { Clock, Flame } from "lucide-react";

const SuperDeals = () => {
  const { data: products = [], isLoading, isError } = useProducts();
  const superDealProducts = products.filter(
    (p) => p.badges.includes("SuperDeals") || p.discount >= 50
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">SuperDeals</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Ends in: 16:03:33</span>
              <span>·</span>
              <span>{superDealProducts.length} products</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading products...</div>
        ) : isError ? (
          <div className="text-center py-10 text-muted-foreground">Failed to load products.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {superDealProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default SuperDeals;
