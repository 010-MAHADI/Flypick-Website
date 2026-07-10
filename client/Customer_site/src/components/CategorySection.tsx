import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  image_url: string | null;
  parent: number | null;
  is_active: boolean;
  sort_order: number;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop";

const CategorySection = () => {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const response = await api.get("/products/categories/");
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data.filter((cat: Category) => cat.is_active) : [];
    },
  });

  const displayCategories = [...categories]
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0))
    .slice(0, 12);

  if (!isLoading && displayCategories.length === 0) return null;

  return (
    <section className="section-shell py-4 sm:py-8">
      <div className="section-head">
        <h2 className="section-title">Categories</h2>
        <Link to="/search?q=" className="section-link">
          View all ›
        </Link>
      </div>

      {isLoading ? (
        <div className="snap-rail sm:grid sm:grid-cols-6 lg:grid-cols-12 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 w-[72px] sm:w-auto">
              <div className="skeleton w-16 h-16 sm:w-20 sm:h-20 !rounded-2xl" />
              <div className="skeleton h-2.5 w-12 !rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        /* Mobile: swipeable rail · Desktop: grid */
        <div className="snap-rail sm:grid sm:grid-cols-6 lg:grid-cols-12 sm:gap-4">
          {displayCategories.map((category) => (
            <Link
              key={category.id}
              to={`/search?category=${category.id}`}
              className="flex flex-col items-center gap-2 group flex-shrink-0 w-[72px] sm:w-auto snap-start"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-card shadow-[0_1px_3px_rgba(16,24,40,0.08)] group-hover:shadow-[0_6px_16px_rgba(16,24,40,0.14)] group-active:scale-95 transition-all overflow-hidden p-1.5">
                <img
                  src={category.image_url || FALLBACK_IMAGE}
                  alt={category.name}
                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />
              </div>
              <span className="text-[11px] sm:text-xs text-center text-foreground/70 group-hover:text-primary font-semibold leading-tight line-clamp-2">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default CategorySection;
