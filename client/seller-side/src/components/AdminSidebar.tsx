import {
  BarChart3,
  Bell,
  CreditCard,
  FolderTree,
  Import,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Tag,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";

const adminMainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Orders", url: "/admin-orders", icon: ShoppingCart },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Categories", url: "/categories", icon: FolderTree },
  { title: "Reviews", url: "/reviews", icon: Star },
  { title: "Sellers", url: "/sellers", icon: Store },
  { title: "Seller Requests", url: "/seller-requests", icon: UserPlus },
];

const adminCommerceNav = [
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Finance", url: "/finance", icon: Wallet },
  { title: "Refund Requests", url: "/refund-requests", icon: RotateCcw },
  { title: "Coupons", url: "/coupons", icon: Tag },
  { title: "Promotions", url: "/promotions", icon: Megaphone },
  { title: "Transactions", url: "/transactions", icon: CreditCard },
  { title: "Live Chat", url: "/chat", icon: MessageCircle },
];

const sellerMainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Products", url: "/products", icon: Package },
  { title: "Import Product", url: "/products/import", icon: Import },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Wallet", url: "/wallet", icon: Wallet },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Coupons", url: "/coupons", icon: Tag },
  { title: "Promotions", url: "/promotions", icon: Megaphone },
];

const systemNav = [
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { logout, isAdmin, user } = useAuth();
  const mainNav = isAdmin ? adminMainNav : sellerMainNav;
  const commerceNav = isAdmin ? adminCommerceNav : [];

  const renderGroup = (label: string, items: typeof mainNav) => (
    <SidebarGroup>
      {!collapsed ? (
        <SidebarGroupLabel className="mb-0.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-muted/70">
          {label}
        </SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/70 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="nav-active-glow bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                >
                  <item.icon className="h-[17px] w-[17px] shrink-0" />
                  {!collapsed ? <span>{item.title}</span> : null}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(24_90%_58%)] shadow-lg shadow-primary/25">
            <Zap className="h-4 w-4 text-primary-foreground" fill="currentColor" />
          </div>
          {!collapsed ? (
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-sidebar-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Flypick
              </h2>
              <div className="mt-0.5 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {isAdmin ? "Admin Center" : "Seller Center"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2">
        {renderGroup("Main", mainNav)}
        {commerceNav.length ? renderGroup("Commerce", commerceNav) : null}
        {renderGroup("System", systemNav)}
      </SidebarContent>

      <SidebarFooter className="space-y-1 p-3 pb-5">
        {!collapsed ? (
          <div className="mx-1 mb-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-[13px] font-bold text-primary">
                {(user?.username || user?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-sidebar-foreground">{user?.username || "User"}</p>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5 text-success" />
                  <p className="text-[10px] text-muted-foreground">{isAdmin ? "Administrator" : "Seller Account"}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/auth");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/70 transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" />
          {!collapsed ? <span>Sign Out</span> : null}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
