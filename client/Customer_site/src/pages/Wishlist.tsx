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
      <main className="max-w-[1440px] mx-auto px-4 py-6 pb-20 sm:pb-6">
        <h1 className="text-2xl font-bold mb-6">My Wishlist ({wishlist.length})</h1>
        {wishlist.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-6">Save items you love by clicking the heart icon on any product.</p>
            <Link to="/" className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {wishlist.map((product) => (
              <div key={product.id} className="relative group/wish">
                <ProductCard product={product} />
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute top-2 right-2 z-10 bg-destructive/90 text-destructive-foreground p-1.5 rounded-full opacity-0 group-hover/wish:opacity-100 transition-opacity"
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
