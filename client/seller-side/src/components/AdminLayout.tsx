import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Globe2, Moon, Search, Store, Sun } from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";
import {
  useMarkAllNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { notificationIcon, notificationTime, notificationTone } from "@/pages/Notifications";

export function AdminLayout() {
  const navigate = useNavigate();
  const { shops, currentShop, isLoading, setCurrentShop } = useShop();
  const { user, isAdmin } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const { data: recentNotifications = [] } = useNotifications({ limit: 5 });
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!isLoading && !currentShop && user?.role === "Seller") {
      navigate("/shop-selector");
    }
  }, [currentShop, isLoading, navigate, user?.role]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = savedTheme ? savedTheme === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("theme", nextDark ? "dark" : "light");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !currentShop) {
    return null;
  }

  const canManageShops = user?.role === "Seller";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-[60px] items-center justify-between border-b bg-card/80 px-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="mx-1 h-5 w-px bg-border" />

              {canManageShops && currentShop ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-lg px-3 text-sm font-medium">
                      <span className="text-base leading-none">{currentShop.logo}</span>
                      <span className="hidden max-w-[140px] truncate sm:block">{currentShop.name}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Your Shops</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {shops.map((shop) => (
                      <DropdownMenuItem key={shop.id} onClick={() => setCurrentShop(shop)} className="cursor-pointer">
                        <span className="mr-2.5 text-base">{shop.logo}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold">{shop.name}</p>
                          <p className="text-[11px] text-muted-foreground">{shop.category}</p>
                        </div>
                        {currentShop.id === shop.id ? <div className="ml-2 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/shop-selector")}>
                      <Store className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Manage Shops</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : isAdmin ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm font-medium">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden text-sm font-semibold sm:block">Marketplace</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm font-medium">
                  <span className="text-base">{currentShop?.logo}</span>
                  <span className="hidden text-sm font-semibold sm:block">{currentShop?.name}</span>
                </div>
              )}

              <div className="relative ml-1 hidden lg:block">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="h-8 w-64 rounded-lg border-0 bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {isDark ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Bell className="h-[17px] w-[17px]" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-card">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 rounded-xl p-0">
                  <div className="flex items-center justify-between px-4 py-3">
                    <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary hover:underline underline-offset-2"
                        onClick={() => markAllRead.mutate()}
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <DropdownMenuSeparator className="my-0" />
                  {recentNotifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      <Bell className="mx-auto mb-2 h-6 w-6 opacity-30" />
                      No notifications yet
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto py-1">
                      {recentNotifications.map((n) => {
                        const Icon = notificationIcon(n);
                        return (
                          <DropdownMenuItem
                            key={n.id}
                            className="flex cursor-pointer items-start gap-3 px-4 py-2.5"
                            onClick={() => navigate("/notifications")}
                          >
                            <div className={`mt-0.5 rounded-lg p-1.5 ${notificationTone(n)}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`truncate text-xs ${n.is_read ? "font-medium text-muted-foreground" : "font-semibold"}`}>
                                  {n.title}
                                </p>
                                {!n.is_read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{n.message}</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground/70">{notificationTime(n)}</p>
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  )}
                  <DropdownMenuSeparator className="my-0" />
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-center text-xs font-semibold text-primary transition-colors hover:bg-muted"
                    onClick={() => navigate("/notifications")}
                  >
                    View all notifications
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="mx-1 h-4 w-px bg-border" />

              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-3 transition-colors hover:bg-muted"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[hsl(24_90%_58%)] text-[11px] font-bold text-primary-foreground shadow-sm">
                  {(user?.username || user?.email || "A").charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-[13px] font-semibold leading-tight">{user?.username || "User"}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                    {isAdmin ? "Administrator" : "Seller"}
                  </p>
                </div>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-background p-5 lg:p-7">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
