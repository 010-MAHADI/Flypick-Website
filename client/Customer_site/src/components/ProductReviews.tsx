import { Star, ThumbsUp, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/hooks/useProducts";
import { useReviews, useMarkHelpful } from "@/hooks/useReviews";

interface Props {
  product: Product;
}

const ProductReviews = ({ product }: Props) => {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useReviews(product.id);
  const markHelpful = useMarkHelpful();

  const reviews = data?.reviews || [];
  const reviewCount = data?.count || 0;
  const averageRating = data?.averageRating || 0;
  const visibleReviews = showAll ? reviews : reviews.slice(0, 3);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold">Reviews</h3>
          <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-5 h-5 ${i < Math.floor(averageRating) ? "fill-star text-star" : "text-border"}`} />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{reviewCount} ratings</span>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <p className="text-sm text-muted-foreground py-4">Loading reviews...</p>}

      {/* Reviews list */}
      {!isLoading && reviews.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No reviews yet. Be the first to review this product!</p>
      )}

      <div className="divide-y divide-border">
        {visibleReviews.map((review) => (
          <div key={review.id} className="py-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-xs">👤</span>
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-star text-star" : "text-border"}`} />
                ))}
              </div>
            </div>
            {review.color && <p className="text-xs text-muted-foreground mb-2">{review.color}</p>}
            <p className="text-sm text-foreground mb-2">{review.text}</p>

            {/* Review images */}
            {review.images && review.images.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {review.images.map((img, i) => (
                  <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={typeof img === 'string' ? img : img.image} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {review.user_name || review.user} | {review.date || (review.created_at ? new Date(review.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "")}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => markHelpful.mutate({ reviewId: review.id, productId: product.id })}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Helpful ({review.helpful})
                </button>
                <button className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showAll && reviews.length > 3 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAll(true)}
            className="px-8 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            View more
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductReviews;
