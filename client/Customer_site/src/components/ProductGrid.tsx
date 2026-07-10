import { useProducts } from "@/hooks/useProducts";
import ProductCard from "./ProductCard";

const GridSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i}>
        <div className="skeleton aspect-square mb-2" />
        <div className="skeleton h-3 w-full !rounded-full mb-1.5" />
        <div className="skeleton h-3 w-2/3 !rounded-full" />
      </div>
    ))}
  </div>
);

const ProductGrid = () => {
  const { data: products, isLoading, isError } = useProducts();

  return (
    <section className="section-shell py-4 sm:py-8 pb-mobile-nav md:pb-10">
      <div className="section-head">
        <h2 className="section-title">Just For You</h2>
      </div>

      {isLoading && <GridSkeleton />}
      {isError && (
        <div className="p-10 text-center text-muted-foreground text-sm">Failed to load products. Pull to refresh.</div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
          {(products || []).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductGrid;
