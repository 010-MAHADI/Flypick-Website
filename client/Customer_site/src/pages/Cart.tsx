import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingCart, ShieldCheck, Bookmark, Undo2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useCart } from "@/context/CartContext";
import { Checkbox } from "@/components/ui/checkbox";
import { generateProductUrl } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";
import { toast } from "sonner";

const Cart = () => {
  const { items, updateQuantity, removeFromCart, toggleSelect, selectAll, setSavedForLater, selectedTotal, selectedCount, loading, selectedItems } = useCart();
  const navigate = useNavigate();

  const activeItems = items.filter((i) => !i.savedForLater);
  const savedItems = items.filter((i) => i.savedForLater);
  const allSelected = activeItems.length > 0 && activeItems.every((i) => i.selected);

  const handleSaveForLater = async (itemId: number | undefined, save: boolean) => {
    if (!itemId) return;
    try {
      await setSavedForLater(itemId, save);
      toast.success(save ? "Saved for later" : "Moved back to cart");
    } catch {
      toast.error("Could not update the item");
    }
  };

  // Calculate shipping costs from selected products
  const calculateShipping = () => {
    let totalShipping = 0;
    const shippingDetails: Array<{ method: string; cost: number; time: string }> = [];

    selectedItems.forEach((item) => {
      const product = item.product;

      if (product.freeShipping) {
        if (shippingDetails.length === 0 || !shippingDetails.some((s) => s.cost === 0)) {
          shippingDetails.push({ method: "Free Shipping", cost: 0, time: "7-15 business days" });
        }
        return;
      }

      const shippingOptions = product.variants?.shippingOptions || [];

      if (shippingOptions.length > 0) {
        let selectedOption = null;

        if (item.shippingType) {
          selectedOption = shippingOptions.find(
            (opt: any) => opt.enabled && opt.type.toLowerCase() === item.shippingType.toLowerCase()
          );
        }
        if (!selectedOption) {
          selectedOption = shippingOptions.find((opt: any) => opt.enabled);
        }

        if (selectedOption) {
          const cost = parseFloat(selectedOption.price) || 0;
          totalShipping += cost * item.quantity;

          const existingMethod = shippingDetails.find((s) => s.method === selectedOption.type);
          if (!existingMethod) {
            shippingDetails.push({
              method: selectedOption.type,
              cost: cost,
              time: `${selectedOption.estimatedDelivery || "7-15"} business days`,
            });
          }
        } else if (shippingDetails.length === 0 || !shippingDetails.some((s) => s.cost === 0)) {
          shippingDetails.push({ method: "Standard Shipping", cost: 0, time: "7-15 business days" });
        }
      } else if (shippingDetails.length === 0 || !shippingDetails.some((s) => s.cost === 0)) {
        shippingDetails.push({ method: "Standard Shipping", cost: 0, time: "7-15 business days" });
      }
    });

    return { totalShipping, shippingDetails };
  };

  const { totalShipping, shippingDetails } = calculateShipping();
  const finalTotal = selectedTotal + totalShipping;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[980px] mx-auto px-3 sm:px-4 py-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.07)] flex gap-3">
              <div className="skeleton w-20 h-20" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-3.5 w-3/4 !rounded-full" />
                <div className="skeleton h-3.5 w-1/2 !rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[980px] mx-auto px-3 sm:px-4 py-16 sm:py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-9 h-9 text-muted-foreground" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold mb-1.5">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground mb-6">Looks like you haven't added anything yet.</p>
          <Link
            to="/"
            className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full hover:opacity-90 text-sm active:scale-[0.98] transition-all"
          >
            Continue Shopping
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const handleCheckout = () => {
    if (selectedCount > 0) {
      navigate("/checkout");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1100px] mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-40 lg:pb-10">
        <h1 className="text-xl sm:text-2xl font-extrabold mb-3 sm:mb-5">
          My Cart <span className="text-muted-foreground font-semibold text-base">({activeItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
        </h1>

        <div className="grid lg:grid-cols-[1fr_340px] gap-4 sm:gap-6 items-start">
          <div className="space-y-3">
            {/* Select all */}
            <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)] px-4 py-3 flex items-center gap-3">
              <Checkbox checked={allSelected} onCheckedChange={(checked) => selectAll(!!checked)} id="select-all" />
              <label htmlFor="select-all" className="text-sm font-semibold cursor-pointer">
                Select all ({activeItems.length})
              </label>
            </div>

            {activeItems.map(({ id, product, quantity, selected, color, size }) => (
              <div
                key={id || product.id}
                className={`bg-card rounded-2xl p-3 sm:p-4 transition-all shadow-[0_1px_3px_rgba(16,24,40,0.07)] ${
                  selected ? "ring-2 ring-primary/40" : ""
                }`}
              >
                <div className="flex gap-2.5 sm:gap-4">
                  <div className="flex items-start pt-1 flex-shrink-0">
                    <Checkbox checked={selected} onCheckedChange={() => id && toggleSelect(id)} />
                  </div>

                  <Link
                    to={generateProductUrl(product)}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-muted"
                  >
                    <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={generateProductUrl(product)}
                      className="text-[13px] sm:text-sm font-medium text-foreground hover:text-primary line-clamp-2 leading-snug"
                    >
                      {product.title}
                    </Link>
                    {(color || size) && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {color && <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{color}</span>}
                        {size && <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{size}</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2.5 gap-2">
                      <div className="flex items-center bg-muted rounded-full p-0.5">
                        <button
                          onClick={() => id && updateQuantity(id, quantity - 1)}
                          className="w-7 h-7 rounded-full bg-card shadow-sm flex items-center justify-center active:scale-90 transition-transform"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs sm:text-sm font-bold w-8 text-center tabular-nums">{quantity}</span>
                        <button
                          onClick={() => id && updateQuantity(id, quantity + 1)}
                          className="w-7 h-7 rounded-full bg-card shadow-sm flex items-center justify-center active:scale-90 transition-transform"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm sm:text-base text-primary mr-1.5">
                          <TakaSign />
                          {(product.price * quantity).toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleSaveForLater(id, true)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent active:scale-90 transition-all"
                          aria-label="Save for later"
                          title="Save for later"
                        >
                          <Bookmark className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => id && removeFromCart(id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                          aria-label="Remove from cart"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Saved for later */}
            {savedItems.length > 0 && (
              <div className="pt-2">
                <h2 className="text-sm font-extrabold mb-2.5 flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-primary" />
                  Saved for later ({savedItems.length})
                </h2>
                <div className="space-y-3">
                  {savedItems.map(({ id, product, quantity, color, size }) => (
                    <div key={id || product.id} className="bg-card rounded-2xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(16,24,40,0.07)] opacity-90">
                      <div className="flex gap-3 items-center">
                        <Link
                          to={generateProductUrl(product)}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted"
                        >
                          <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={generateProductUrl(product)}
                            className="text-[13px] font-medium text-foreground hover:text-primary line-clamp-2 leading-snug"
                          >
                            {product.title}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ×{quantity}
                            {color ? ` · ${color}` : ""}
                            {size ? ` · ${size}` : ""}
                          </p>
                          <p className="font-extrabold text-sm text-primary mt-1">
                            <TakaSign />
                            {(product.price * quantity).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleSaveForLater(id, false)}
                            className="chip !text-[11px] !py-1.5"
                          >
                            <Undo2 className="w-3 h-3" /> Move to cart
                          </button>
                          <button
                            onClick={() => id && removeFromCart(id)}
                            className="chip !text-[11px] !py-1.5 !text-destructive hover:!border-destructive/40"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order summary — desktop */}
          <div className="hidden lg:block bg-card rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.07)] p-5 sticky top-24">
            <h3 className="text-lg font-extrabold mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items ({selectedCount})</span>
                <span className="font-medium"><TakaSign />{selectedTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className={totalShipping === 0 ? "text-success font-semibold" : "font-medium"}>
                  {totalShipping === 0 ? "Free" : <><TakaSign />{totalShipping.toLocaleString()}</>}
                </span>
              </div>
              {shippingDetails.length > 0 && totalShipping > 0 && (
                <div className="text-xs text-muted-foreground pl-2">
                  {shippingDetails.map((detail, index) => (
                    <div key={index}>
                      {detail.method}: <TakaSign />{detail.cost.toLocaleString()}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-border pt-3 mb-4">
              <div className="flex justify-between font-extrabold">
                <span>Total</span>
                <span className="text-primary text-lg"><TakaSign />{finalTotal.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tax excluded</p>
            </div>
            <button
              onClick={handleCheckout}
              disabled={selectedCount === 0}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout ({selectedCount})
            </button>
            {selectedCount === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">Select items to proceed</p>
            )}
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-3">
              <ShieldCheck className="w-3.5 h-3.5 text-success" /> Secure checkout · bKash · Nagad · Cards · COD
            </p>
          </div>
        </div>
      </main>

      {/* Mobile sticky checkout bar (sits above bottom nav) */}
      <div className="lg:hidden fixed bottom-[60px] left-0 right-0 bg-card border-t border-border/70 px-3 py-2.5 z-40 flex items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(16,24,40,0.08)]">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} item${selectedCount > 1 ? "s" : ""} selected` : "No items selected"}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-primary">
              <TakaSign />
              {finalTotal.toLocaleString()}
            </span>
            {totalShipping > 0 && (
              <span className="text-[10px] text-muted-foreground truncate">
                incl. <TakaSign />{totalShipping.toLocaleString()} shipping
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleCheckout}
          disabled={selectedCount === 0}
          className="bg-primary text-primary-foreground font-bold py-3 px-7 rounded-full hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-sm whitespace-nowrap"
        >
          Checkout
        </button>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Cart;
