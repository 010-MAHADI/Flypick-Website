import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Bell, Search, ChevronDown, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Outlet, useNavigate } from "react-router-dom";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AdminLayout() {
  const navigate = useNavigate();
  const { shops, currentShop, isLoading, setCurrentShop } = useShop();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (!isLoading && !currentShop && user?.role === "Seller") {
      navigate("/shop-selector");
    }
  }, [currentShop, isLoading, navigate, user?.role]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentShop) {
    return null;
  }

  const canManageShops = user?.role === "Seller";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b bg-card px-6 shrink-0 sticky top-0 z-10 backdrop-blur-xl bg-card/80">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              
              {canManageShops ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 h-9">
                      <span className="text-lg">{currentShop.logo}</span>
                      <div className="text-left hidden sm:block">
                        <span className="text-sm font-semibold">{currentShop.name}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel>Your Shops</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {shops.map((shop) => (
                      <DropdownMenuItem
                        key={shop.id}
                        onClick={() => setCurrentShop(shop)}
                        className={`cursor-pointer ${
                          currentShop.id === shop.id ? "bg-primary/10" : ""
                        }`}
                      >
                        <span className="text-lg mr-2">{shop.logo}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{shop.name}</p>
                          <p className="text-xs text-muted-foreground">{shop.category}</p>
                        </div>
                        {currentShop.id === shop.id && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/shop-selector")}>
                      <Store className="h-4 w-4 mr-2" />
                      Manage Shops
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" className="gap-2 h-9 cursor-default">
                  <span className="text-lg">{currentShop.logo}</span>
                  <div className="text-left hidden sm:block">
                    <span className="text-sm font-semibold">{currentShop.name}</span>
                  </div>
                </Button>
              )}

              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search anything..."
                  className="w-72 pl-10 h-9 bg-muted/50 border-0 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/notifications")} className="relative rounded-lg p-2.5 hover:bg-muted transition-colors">
                <Bell className="h-[18px] w-[18px] text-muted-foreground" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
              </button>
              <div className="h-6 w-px bg-border mx-1" />
              <button onClick={() => navigate("/settings")} className="flex items-center gap-2.5 rounded-lg p-1.5 pr-3 hover:bg-muted transition-colors">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm">
                  {(user?.username || user?.email || "A").charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="text-sm font-medium leading-none">{user?.username || "User"}</span>
                  <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                    {isAdmin ? "Main Admin" : "Seller"}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
