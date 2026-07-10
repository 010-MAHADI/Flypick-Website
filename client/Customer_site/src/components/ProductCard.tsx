import { Star, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "@/hooks/useProducts";
import { generateProductUrl } from "@/lib/slugify";
import { useWishlist } from "@/context/WishlistContext";
import TakaSign from "@/components/TakaSign";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const liked = isInWishlist(product.id);
  const hasDiscount = product.discount > 0 && product.originalPrice > product.price;

  return (
    <Link to={generateProductUrl(product)} className="product-card group">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {hasDiscount && (
          <span className="absolute top-2 left-2 badge-discount shadow-sm">-{product.discount}%</span>
        )}
        <button
          aria-label="Add to wishlist"
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product);
          }}
          className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-sm active:scale-90 transition-transform"
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-primary text-primary" : "text-foreground/60"}`} />
        </button>
        {product.welcomeDeal && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-primary to-secondary text-primary-foreground text-[10px] font-bold px-2 py-1 text-center tracking-wide">
            WELCOME DEAL
          </div>
        )}
      </div>

      <div className="p-2.5 sm:p-3">
        <h3 className="text-[13px] sm:text-sm text-foreground/90 line-clamp-2 leading-snug min-h-[2.4em] mb-1.5">
          {product.title}
        </h3>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="price-current text-base sm:text-lg text-primary">
            <TakaSign />
            {product.price.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="price-original">
              <TakaSign />
              {product.originalPrice.toLocaleString()}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {product.rating > 0 && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-foreground/70">
              <Star className="w-3 h-3 fill-star text-star" />
              {product.rating}
            </span>
          )}
          <span>{product.sold} sold</span>
          {product.badges.includes("Choice") && <span className="badge-choice ml-auto">Choice</span>}
        </div>

        {product.freeShipping && <p className="badge-free-shipping mt-1">Free shipping</p>}
      </div>
    </Link>
  );
};

export default ProductCard;
