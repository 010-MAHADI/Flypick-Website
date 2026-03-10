import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Sparkles, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";

const MAX_SHOPS = 5;

export default function ShopSelector() {
  const { user } = useAuth();
  const { shops, currentShop, setCurrentShop, isLoading } = useShop();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === "Admin") {
      navigate("/", { replace: true });
    }
  }, [navigate, user?.role]);

  useEffect(() => {
    if (currentShop && shops.length > 0) {
      navigate("/", { replace: true });
    }
  }, [currentShop, shops.length, navigate]);

  const handleSelectShop = (shop: any) => {
    setCurrentShop(shop);
    navigate("/");
  };

  const handleCreateShop = () => {
    navigate("/create-shop");
  };

  const canCreateShop = shops.length < MAX_SHOPS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Select Your Shop</h1>
          <p className="text-muted-foreground">Choose a shop to manage. You can create up to 5 shops.</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
            <p className="mt-4 text-muted-foreground">Loading shops...</p>
          </div>
        ) : shops.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {shops.map((shop) => (
              <Card
                key={shop.id}
                className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group"
                onClick={() => handleSelectShop(shop)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {shop.logo}
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold text-lg">{shop.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{shop.description}</p>
                    <Badge variant="outline" className="mt-2">
                      {shop.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all">
                    <span>Open Shop</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 mb-6">
            <Store className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Shops Yet</h3>
            <p className="text-muted-foreground mb-6">Create your first shop to get started</p>
          </div>
        )}

        {canCreateShop ? (
          <Card className="p-6 border-dashed border-2 hover:border-primary/50 transition-all cursor-pointer group" onClick={handleCreateShop}>
            <div className="flex items-center justify-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg">Create New Shop</h3>
                <p className="text-sm text-muted-foreground">Set up a new shop to start selling</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 border-dashed border-2">
            <p className="text-center text-sm text-muted-foreground">
              Shop limit reached. You can create up to {MAX_SHOPS} shops.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
