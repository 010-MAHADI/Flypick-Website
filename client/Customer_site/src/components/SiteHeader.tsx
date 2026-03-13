import { Search, Camera, User, ShoppingCart, Heart, Menu, X, Home, Package, LogOut, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useUnreadCount } from "@/hooks/useNotifications";
import NotificationBell from "@/components/NotificationBell";

const SiteHeader = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { isLoggedIn, userName, profilePhoto, logout } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: unreadCount = 0 } = useUnreadCount();

  const categories = Array.from(
    new Set(
      products
        .map((product) => product.category)
        .filter((category) => Boolean(category))
    )
  ).slice(0, 12);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      <header className={`sticky top-0 z-50 bg-card border-b border-border transition-transform duration-300 ${visible ? "translate-y-0" : "-translate-y-full"}`}>
        {/* Top bar */}
        <div className="max-w-[1440px] mx-auto px-3 md:px-6 py-2.5 md:py-3 flex items-center gap-3 md:gap-5">
          <button className="md:hidden p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link to="/" className="flex-shrink-0">
            <span className="text-xl md:text-2xl font-black tracking-tight text-primary">Fly<span className="text-foreground">pick</span></span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl flex items-center border-2 border-primary rounded-full overflow-hidden">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 md:px-4 py-1.5 md:py-2 text-sm outline-none bg-transparent min-w-0"
            />
            <button type="button" className="p-1.5 md:p-2 text-muted-foreground hover:text-foreground hidden sm:block">
              <Camera className="w-5 h-5" />
            </button>
            <button type="submit" className="bg-primary text-primary-foreground px-3 md:px-5 py-2 md:py-2.5 hover:opacity-90 transition-opacity">
              <Search className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </form>

          <div className="hidden md:flex items-center gap-5 text-sm">
            <NotificationBell />
            <Link to="/wishlist" className="text-muted-foreground hover:text-foreground">
              <Heart className="w-5 h-5" />
            </Link>
          </div>

          {/* Mobile notification bell */}
          <div className="md:hidden">
            <Link to="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              {isLoggedIn && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </div>

          <Link to="/cart" className="relative text-muted-foreground hover:text-foreground">
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>

          <Link to={isLoggedIn ? "/account" : "/auth"} className="hidden md:flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <User className="w-5 h-5" />
            <div className="text-left">
              <div className="text-xs text-muted-foreground">Welcome</div>
              <div className="text-xs font-semibold text-foreground">{isLoggedIn ? userName : "Sign in / Register"}</div>
            </div>
          </Link>
        </div>

        {/* Desktop category bar */}
        <div className="hidden md:block border-t border-border bg-card">
          <div className="max-w-[1440px] mx-auto px-4 flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setShowCategories(!showCategories)}
              className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-t-md font-medium text-sm flex-shrink-0"
            >
              <Menu className="w-4 h-4" />
              All Categories
            </button>
            {categories.map((cat, i) => (
              <Link
                key={cat}
                to={`/search?q=${encodeURIComponent(cat)}`}
                className={`px-3 py-2.5 text-sm whitespace-nowrap flex-shrink-0 ${i === 0 ? 'nav-category-active' : 'nav-category'}`}
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-foreground/50 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute top-0 left-0 w-72 h-full bg-card shadow-xl overflow-y-auto animate-slide-in-right"
            style={{ animationName: "slideInLeft" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center gap-3">
              {isLoggedIn && profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
              <div>
                <span className="text-xl font-black text-primary">Fly<span className="text-foreground">pick</span></span>
                {isLoggedIn && <p className="text-xs text-muted-foreground">Hi, {userName}</p>}
              </div>
            </div>
            <div className="p-2">
              {isLoggedIn ? (
                <>
                  <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">My Account</span>
                  </Link>
                  <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">My Orders</span>
                  </Link>
                  <Link to="/notifications" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted">
                    <Heart className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Wishlist</span>
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); navigate("/"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 text-destructive"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Sign in / Register</span>
                  </Link>
                  <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted">
                    <Heart className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Wishlist</span>
                  </Link>
                </>
              )}
            </div>
            <div className="border-t border-border p-2">
              <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Categories</p>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  to={`/search?q=${encodeURIComponent(cat)}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-lg"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
        <div className="flex items-center justify-around py-2">
          {[
            { to: "/", icon: Home, label: "Home", match: (p: string) => p === "/" },
            { to: "/search?q=", icon: Search, label: "Search", match: (p: string) => p === "/search" },
            { to: "/cart", icon: ShoppingCart, label: "Cart", match: (p: string) => p === "/cart" },
            { to: "/orders", icon: Package, label: "Orders", match: (p: string) => p === "/orders" },
            { to: isLoggedIn ? "/account" : "/auth", icon: User, label: "Account", match: (p: string) => p === "/account" || p === "/auth" },
          ].map((item) => {
            const active = item.match(location.pathname);
            return (
              <Link key={item.label} to={item.to} className={`flex flex-col items-center gap-0.5 relative ${active ? "text-primary" : "text-muted-foreground"}`}>
                <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                {item.label === "Cart" && totalItems > 0 && (
                  <span className="absolute -top-1 right-1 bg-primary text-primary-foreground text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
                <span className={`text-[10px] ${active ? "font-semibold" : ""}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default SiteHeader;
