import { Heart, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { useWishlist } from "@/context/WishlistContext";

const Wishlist = () => {
  const { wishlist, removeFromWishlist } = useWishlist();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="section-shell py-3 sm:py-6 pb-mobile-nav md:pb-10">
        <h1 className="text-xl sm:text-2xl font-extrabold mb-3 sm:mb-5">
          My Wishlist{" "}
          <span className="text-muted-foreground font-semibold text-base">({wishlist.length})</span>
        </h1>

        {wishlist.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)]">
            <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
              <Heart className="w-9 h-9 text-accent-foreground" />
            </div>
            <h2 className="text-lg font-extrabold mb-1.5">Your wishlist is empty</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              Tap the ♥ on any product to save it here for later.
            </p>
            <Link
              to="/"
              className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full hover:opacity-90 text-sm active:scale-[0.98] transition-all"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
            {wishlist.map((product) => (
              <div key={product.id} className="relative">
                <ProductCard product={product} />
                {/* Always visible — hover-only actions don't work on touch screens */}
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-card shadow-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Wishlist;
