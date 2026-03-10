import { useProducts } from "@/hooks/useProducts";
import ProductCard from "./ProductCard";

const ProductGrid = () => {
  const { data: products, isLoading, isError } = useProducts();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading products...</div>;
  if (isError) return <div className="p-8 text-center text-muted-foreground">Failed to load products.</div>;
  return (
    <section className="max-w-[1440px] mx-auto px-4 py-8 pb-24 md:pb-8">
      <h2 className="section-title mb-6">More to love</h2>
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-2 sm:gap-3 [column-fill:_balance]">
        {(products || []).map((product) => (
          <div key={product.id} className="break-inside-avoid mb-2 sm:mb-3 overflow-hidden">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProductGrid;
