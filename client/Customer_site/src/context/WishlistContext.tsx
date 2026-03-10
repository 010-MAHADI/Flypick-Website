import { createContext, useContext, useState, ReactNode } from "react";
import type { Product } from "@/hooks/useProducts";

interface WishlistContextType {
  wishlist: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: number) => void;
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: number) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem("wishlist");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const save = (items: Product[]) => {
    setWishlist(items);
    localStorage.setItem("wishlist", JSON.stringify(items));
  };

  const addToWishlist = (product: Product) => {
    if (!wishlist.find((p) => p.id === product.id)) {
      save([...wishlist, product]);
    }
  };

  const removeFromWishlist = (productId: number) => {
    save(wishlist.filter((p) => p.id !== productId));
  };

  const toggleWishlist = (product: Product) => {
    if (wishlist.find((p) => p.id === product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const isInWishlist = (productId: number) => {
    return wishlist.some((p) => p.id === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlist, addToWishlist, removeFromWishlist, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
};
