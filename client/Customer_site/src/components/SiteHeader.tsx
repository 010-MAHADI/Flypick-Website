import { Search, User, ShoppingCart, Heart, Menu, X, Home, Package, LogOut, Bell, LayoutGrid } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useUnreadCount } from "@/hooks/useNotifications";
import api from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import SearchSuggestions from "@/components/SearchSuggestions";

interface NavCategory {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
}

const SiteHeader = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const searchAreaRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { isLoggedIn, userName, profilePhoto, logout } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: unreadCount = 0 } = useUnreadCount();

  const isHome = location.pathname === "/";

  // Real, admin-managed categories for the quick-nav (shares the cache with
  // the homepage category section via the same query key — no extra request).
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<NavCategory[]> => {
      const response = await api.get("/products/categories/");
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data.filter((c: NavCategory) => c.is_active) : [];
    },
  });
  const navCategories = [...categories]
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0))
    .slice(0, 12);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 10) {
        setVisible(true);
      } else if (currentY < lastScrollY.current) {
        setVisible(true);
      } else if (currentY > lastScrollY.current) {
        setVisible(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the suggestion dropdown when tapping/clicking anywhere else
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const goSearch = (term: string) => {
    if (term.trim()) {
      setSuggestOpen(false);
      navigate(`/search?q=${encodeURIComponent(term.trim())}`);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goSearch(searchQuery);
  };

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    setSuggestOpen(value.trim().length > 0);
  };

  return (
    <>
      <header
        ref={searchAreaRef}
        className={`sticky top-0 z-50 bg-card/95 backdrop-blur-md shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-transform duration-300 ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        {/* ============ MOBILE (search-first, app-like) ============ */}
        <div className="md:hidden px-3 pt-2.5 pb-2">
          {/* Row 1: brand + primary actions. Search-bar icon replaces the
              logo's leading menu; cart lives in the bottom nav, so the top
              row stays uncluttered with just wishlist + notifications. */}
          <div className="flex items-center gap-1.5 mb-2">
            <button aria-label="Menu" className="p-1.5 -ml-1.5 text-foreground/80" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <Link to="/" className="flex-shrink-0 mr-auto">
              <span className="text-[22px] font-black tracking-tight text-primary leading-none">
                Fly<span className="text-foreground">pick</span>
              </span>
            </Link>
            <Link to="/wishlist" aria-label="Wishlist" className="p-2 text-foreground/70">
              <Heart className="w-[22px] h-[22px]" />
            </Link>
            <Link to="/notifications" aria-label="Notifications" className="relative p-2 text-foreground/70">
              <Bell className="w-[22px] h-[22px]" />
              {isLoggedIn && unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground text-[9px] font-bold min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* Row 2: prominent full-width search */}
          <div className="relative">
            <form
              onSubmit={handleSearch}
              className="flex items-center bg-muted rounded-full pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/40"
            >
              <Search className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Search for products, brands…"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => setSuggestOpen(searchQuery.trim().length > 0)}
                className="flex-1 px-2.5 text-sm outline-none bg-transparent min-w-0 placeholder:text-muted-foreground/80"
              />
              <button
                type="submit"
                className="bg-primary text-primary-foreground text-xs font-bold px-5 py-2 rounded-full active:scale-95 transition-transform"
              >
                Search
              </button>
            </form>
            {suggestOpen && (
              <SearchSuggestions
                query={searchQuery}
                products={products}
                onSelect={() => setSuggestOpen(false)}
                onSearch={goSearch}
              />
            )}
          </div>

          {/* Row 3: real-category quick nav on home */}
          {isHome && navCategories.length > 0 && (
            <div className="snap-rail mt-2.5 -mx-3 px-3">
              {navCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/search?category=${cat.id}`}
                  className="chip snap-start flex-shrink-0"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ============ DESKTOP ============ */}
        <div className="hidden md:block">
          <div className="max-w-[1440px] mx-auto px-6 py-3.5 flex items-center gap-8">
            <Link to="/" className="flex-shrink-0">
              <span className="text-2xl font-black tracking-tight text-primary">
                Fly<span className="text-foreground">pick</span>
              </span>
            </Link>

            <div className="relative flex-1 max-w-2xl">
              <form
                onSubmit={handleSearch}
                className="flex items-center bg-muted rounded-full pl-5 pr-1.5 py-1 focus-within:ring-2 focus-within:ring-primary/40 transition-shadow"
              >
                <input
                  type="text"
                  placeholder="Search products, brands and categories…"
                  value={searchQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => setSuggestOpen(searchQuery.trim().length > 0)}
                  className="flex-1 py-2 text-sm outline-none bg-transparent min-w-0 placeholder:text-muted-foreground/80"
                />
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground p-2.5 rounded-full hover:opacity-90 transition-opacity"
                  aria-label="Search"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
              {suggestOpen && (
                <SearchSuggestions
                  query={searchQuery}
                  products={products}
                  onSelect={() => setSuggestOpen(false)}
                  onSearch={goSearch}
                />
              )}
            </div>

            <div className="flex items-center gap-1 ml-auto">
              <NotificationBell />
              <Link
                to="/wishlist"
                className="p-2.5 rounded-full text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5" />
              </Link>
              <Link
                to="/cart"
                className="relative p-2.5 rounded-full text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground text-[10px] font-bold min-w-[17px] h-[17px] px-0.5 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Link>
              <Link
                to={isLoggedIn ? "/account" : "/auth"}
                className="flex items-center gap-2.5 ml-2 pl-2 pr-4 py-1.5 rounded-full hover:bg-muted transition-colors"
              >
                {isLoggedIn && profilePhoto ? (
                  <img src={profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                    <User className="w-4 h-4 text-accent-foreground" />
                  </span>
                )}
                <span className="text-left leading-tight">
                  <span className="block text-[10px] text-muted-foreground">{isLoggedIn ? "Welcome" : "Account"}</span>
                  <span className="block text-xs font-bold text-foreground max-w-[110px] truncate">
                    {isLoggedIn ? userName : "Sign in / Register"}
                  </span>
                </span>
              </Link>
            </div>
          </div>

          {/* Desktop category bar */}
          <div className="border-t border-border/70">
            <div className="max-w-[1440px] mx-auto px-6 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
              <Link
                to="/search?q="
                className="flex items-center gap-2 px-4 py-2.5 font-semibold text-sm flex-shrink-0 text-foreground hover:text-primary transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                All Categories
              </Link>
              {navCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/search?category=${cat.id}`}
                  className="px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap flex-shrink-0 text-foreground/70 hover:text-primary transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-foreground/50 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute top-0 left-0 w-[300px] max-w-[85vw] h-full bg-card shadow-2xl overflow-y-auto"
            style={{ animation: "slideInLeft 0.25s ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 pb-5 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-black">
                  Fly<span className="text-primary-foreground/80">pick</span>
                </span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {isLoggedIn && profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-11 h-11 rounded-full object-cover ring-2 ring-white/40" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{isLoggedIn ? `Hi, ${userName}` : "Welcome to Flypick"}</p>
                  {!isLoggedIn && (
                    <Link
                      to="/auth"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-xs underline underline-offset-2 text-primary-foreground/90"
                    >
                      Sign in / Register
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="p-2">
              {isLoggedIn ? (
                <>
                  <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">My Account</span>
                  </Link>
                  <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">My Orders</span>
                  </Link>
                  <Link to="/notifications" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted">
                    <Heart className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Wishlist</span>
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                      navigate("/");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 text-destructive"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Sign in / Register</span>
                  </Link>
                  <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted">
                    <Heart className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Wishlist</span>
                  </Link>
                </>
              )}
            </div>

            <div className="border-t border-border p-2">
              <p className="px-4 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Categories</p>
              {navCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/search?category=${cat.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted rounded-xl"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/70 md:hidden safe-bottom">
        <div className="flex items-stretch justify-around">
          {[
            { to: "/", icon: Home, label: "Home", match: (p: string) => p === "/" },
            { to: "/search?q=", icon: Search, label: "Search", match: (p: string) => p === "/search" },
            { to: "/cart", icon: ShoppingCart, label: "Cart", match: (p: string) => p === "/cart" },
            { to: "/orders", icon: Package, label: "Orders", match: (p: string) => p === "/orders" },
            { to: isLoggedIn ? "/account" : "/auth", icon: User, label: "Account", match: (p: string) => p === "/account" || p === "/auth" },
          ].map((item) => {
            const active = item.match(location.pathname);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 relative ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${active ? "bg-primary opacity-100" : "opacity-0"}`} />
                <span className="relative">
                  <item.icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                  {item.label === "Cart" && totalItems > 0 && (
                    <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[9px] font-bold min-w-[15px] h-[15px] px-0.5 rounded-full flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default SiteHeader;
