import { useShop } from "@/context/ShopContext";
import { useNavigate } from "react-router-dom";
import { Store, Plus, Edit, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function ShopManagement() {
  const { shops, currentShop, deleteShop } = useShop();
  const navigate = useNavigate();

  const handleDelete = (shopId: string, shopName: string) => {
    if (shops.length === 1) {
      toast.error("Cannot delete your only shop");
      return;
    }
    deleteShop(shopId);
    toast.success(`${shopName} deleted successfully`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Your Shops</h3>
          <p className="text-sm text-muted-foreground">
            Manage your shops and switch between them
          </p>
        </div>
        <Button onClick={() => navigate("/create-shop")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Shop
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shops.map((shop) => (
          <Card key={shop.id} className="p-4 relative">
            {currentShop?.id === shop.id && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </Badge>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                {shop.logo}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm mb-1">{shop.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {shop.description}
                </p>
                <Badge variant="outline" className="text-xs">
                  {shop.category}
                </Badge>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => navigate("/shop-selector")}
              >
                <Store className="h-3 w-3 mr-1" />
                Switch
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={shops.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Shop</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{shop.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(shop.id, shop.name)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
