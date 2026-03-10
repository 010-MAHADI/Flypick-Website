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
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const response = await api.get('/products/categories/');
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data.filter((cat: Category) => cat.is_active) : [];
    },
  });

  // Sort by sort_order and limit to 12
  const displayCategories = [...categories]
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0))
    .slice(0, 12);

  return (
    <section className="max-w-[1440px] mx-auto px-4 py-8">
      <h2 className="section-title mb-6">Shop by Category</h2>
      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground">Loading categories...</div>
      ) : displayCategories.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">No categories found.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-4">
          {displayCategories.map((category) => (
            <Link
              key={category.id}
              to={`/search?category=${category.id}`}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-border group-hover:border-primary transition-colors bg-muted overflow-hidden">
                <img
                  src={category.image_url || FALLBACK_IMAGE}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />
              </div>
              <span className="text-xs text-center text-muted-foreground group-hover:text-foreground font-medium leading-tight">
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


