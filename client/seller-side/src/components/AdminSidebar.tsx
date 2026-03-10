import {
  BarChart3,
  Bell,
  CreditCard,
  FolderTree,
  Image,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  UserPlus,
  Users,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const adminMainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Products", url: "/products", icon: Package },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Categories", url: "/categories", icon: FolderTree },
  { title: "Reviews", url: "/reviews", icon: Star },
  { title: "Sellers", url: "/sellers", icon: Store },
  { title: "Seller Requests", url: "/seller-requests", icon: UserPlus },
];

const adminCommerceNav = [
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Coupons", url: "/coupons", icon: Tag },
  { title: "Banners", url: "/banners", icon: Image },
  { title: "Promotions", url: "/promotions", icon: Megaphone },
  { title: "Transactions", url: "/transactions", icon: CreditCard },
];

const sellerMainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Products", url: "/products", icon: Package },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
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
  const { logout, isAdmin } = useAuth();

  const mainNav = isAdmin ? adminMainNav : sellerMainNav;
  const commerceNav = isAdmin ? adminCommerceNav : [];

  const renderGroup = (label: string, items: typeof mainNav) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-[0.1em] font-bold mb-1">
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
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
      <SidebarHeader className="p-5 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
            <Sparkles className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-[15px] font-bold text-sidebar-accent-foreground tracking-tight">Flypick</h2>
              <p className="text-[11px] text-sidebar-muted font-medium">Seller Center</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        {renderGroup("Main", mainNav)}
        {commerceNav.length > 0 && renderGroup("Commerce", commerceNav)}
        {renderGroup("System", systemNav)}
      </SidebarContent>

      <SidebarFooter className="p-3 pb-5">
        <button
          onClick={() => {
            logout();
            navigate("/auth");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
