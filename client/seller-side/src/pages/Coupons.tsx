import { useState } from "react";
import { Copy, Plus, Trash2, Package, Tag, Users, ShoppingCart, Edit, Play, Pause } from "lucide-react";
import { toast } from "sonner";

import { 
  useCoupons, 
  useCreateCoupon, 
  useUpdateCoupon,
  useToggleCouponStatus,
  useDeleteCoupon, 
  useSellerProducts,
  useSellerCategories,
  type CouponDiscountType,
  type CouponType 
} from "@/hooks/useCoupons";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export default function Coupons() {
  const { currentShop } = useShop();
  const { data: coupons = [], isLoading } = useCoupons(currentShop?.id);
  const { data: products = [], isLoading: productsLoading } = useSellerProducts(currentShop?.id);
  const { data: categories = [], isLoading: categoriesLoading } = useSellerCategories(currentShop?.id);
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const toggleCouponStatus = useToggleCouponStatus();
  const deleteCoupon = useDeleteCoupon();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percent");
  const [couponType, setCouponType] = useState<CouponType>("all_products");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!currentShop) {
      toast.error("No shop selected. Please select a shop first.");
      return;
    }
    
    const formData = new FormData(event.currentTarget);
    
    const payload: any = {
      discount_type: discountType,
      discount_value: Number(formData.get("discountValue") || 0),
      coupon_type: couponType,
      max_uses: Number(formData.get("maxUses") || 0),
      expires_at: String(formData.get("expiresAt") || ""),
      min_order_amount: Number(formData.get("minOrderAmount") || 0),
      is_active: true,
    };

    // Only include code for new coupons
    if (!editingCoupon) {
      payload.code = String(formData.get("code") || "").toUpperCase();
    }

    // Add specific fields based on coupon type
    if (couponType === "specific_products") {
      // Only validate if products are available
      if (products.length > 0 && selectedProducts.length === 0) {
        toast.error("Please select at least one product");
        return;
      }
      if (selectedProducts.length > 0) {
        payload.product_ids = selectedProducts;
      }
    } else if (couponType === "category") {
      // Only validate if categories are available
      if (categories.length > 0 && !selectedCategory) {
        toast.error("Please select a category");
        return;
      }
      if (selectedCategory) {
        payload.category = selectedCategory;
      }
    }

    try {
      if (editingCoupon) {
        await updateCoupon.mutateAsync({ id: editingCoupon.id, payload });
        toast.success("Coupon updated");
      } else {
        await createCoupon.mutateAsync(payload);
        toast.success("Coupon created");
      }
      handleCloseDialog();
    } catch (error: any) {
      console.error("Coupon operation error:", error);
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          (editingCoupon ? "Failed to update coupon" : "Failed to create coupon");
      toast.error(errorMessage);
    }
  };

  const handleEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setDiscountType(coupon.discount_type);
    setCouponType(coupon.coupon_type);
    setSelectedCategory(coupon.category);
    setSelectedProducts(coupon.selected_products?.map((p: any) => p.id) || []);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCoupon(null);
    setDiscountType("percent");
    setCouponType("all_products");
    setSelectedProducts([]);
    setSelectedCategory(undefined);
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await toggleCouponStatus.mutateAsync(id);
      toast.success("Coupon status updated");
    } catch {
      toast.error("Failed to update coupon status");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCoupon.mutateAsync(id);
      toast.success("Coupon deleted");
    } catch {
      toast.error("Failed to delete coupon");
    }
  };

  const handleProductToggle = (productId: number) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const getCouponTypeIcon = (type: CouponType) => {
    switch (type) {
      case "all_products": return <Package className="h-4 w-4" />;
      case "specific_products": return <Tag className="h-4 w-4" />;
      case "category": return <ShoppingCart className="h-4 w-4" />;
      case "first_order": return <Users className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getCouponTypeLabel = (type: CouponType) => {
    switch (type) {
      case "all_products": return "All Products";
      case "specific_products": return "Specific Products";
      case "category": return "Category";
      case "first_order": return "First Order Only";
      default: return type;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header !mb-0">
          <h1>Coupons</h1>
          <p>{coupons.length} coupons</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (open) {
            setDialogOpen(true);
          } else {
            handleCloseDialog();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-lg">
              <Plus className="h-4 w-4 mr-1.5" /> Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input 
                    name="code" 
                    required
                    className="rounded-lg" 
                    placeholder="SAVE20"
                    defaultValue={editingCoupon?.code || ""}
                    disabled={!!editingCoupon} // Don't allow editing code
                  />
                </div>
                <div className="space-y-2">
                  <Label>Coupon Type</Label>
                  <Select value={couponType} onValueChange={(value) => setCouponType(value as CouponType)}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_products">All Products</SelectItem>
                      <SelectItem value="specific_products">Specific Products</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="first_order">First Order Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {couponType === "specific_products" && (
                <div className="space-y-2">
                  <Label>Select Products</Label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {productsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading products...</p>
                    ) : products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No products available</p>
                    ) : (
                      <div className="space-y-2">
                        {products.map((product) => (
                          <div key={product.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`product-${product.id}`}
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={() => handleProductToggle(product.id)}
                            />
                            <label
                              htmlFor={`product-${product.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                            >
                              {product.name} - ${product.price}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedProducts.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedProducts.length} product(s) selected
                    </p>
                  )}
                </div>
              )}

              {couponType === "category" && (
                <div className="space-y-2">
                  <Label>Select Category</Label>
                  {categoriesLoading ? (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">Loading categories...</p>
                    </div>
                  ) : (
                    <Select 
                      value={selectedCategory?.toString()} 
                      onValueChange={(value) => setSelectedCategory(Number(value))}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={discountType} onValueChange={(value) => setDiscountType(value as CouponDiscountType)}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="shipping">Free Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value</Label>
                  <Input
                    name="discountValue"
                    type="number"
                    step="0.01"
                    required={discountType !== "shipping"}
                    defaultValue={editingCoupon?.discount_value || (discountType === "shipping" ? "0" : "")}
                    className="rounded-lg"
                    placeholder={discountType === "percent" ? "20" : "50"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Order Amount</Label>
                  <Input 
                    name="minOrderAmount" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingCoupon?.min_order_amount || "0"}
                    className="rounded-lg" 
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Uses</Label>
                  <Input 
                    name="maxUses" 
                    type="number" 
                    required
                    className="rounded-lg" 
                    placeholder="100"
                    defaultValue={editingCoupon?.max_uses || ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expires</Label>
                <Input 
                  name="expiresAt" 
                  type="date" 
                  required
                  className="rounded-lg"
                  defaultValue={editingCoupon?.expires_at || ""}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button"
                  className="rounded-lg" 
                  disabled={createCoupon.isPending || updateCoupon.isPending}
                  onClick={async (e) => {
                    const form = e.currentTarget.closest('form') as HTMLFormElement;
                    if (form) {
                      const formEvent = {
                        preventDefault: () => {},
                        currentTarget: form
                      } as React.FormEvent<HTMLFormElement>;
                      await handleAdd(formEvent);
                    }
                  }}
                >
                  {createCoupon.isPending || updateCoupon.isPending ? (
                    <>Loading...</>
                  ) : (
                    editingCoupon ? 'Update' : 'Create'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading coupons...</div>
      ) : (
        <div className="stat-card overflow-x-auto p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="pl-5">Code</th>
                <th>Type</th>
                <th>Discount</th>
                <th>Usage</th>
                <th>Min Order</th>
                <th>Expires</th>
                <th>Status</th>
                <th className="w-32 pr-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="pl-5">
                    <code className="bg-muted/60 px-2.5 py-1 rounded-md text-xs font-mono font-semibold">
                      {coupon.code}
                    </code>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {getCouponTypeIcon(coupon.coupon_type)}
                      <span className="text-sm">{getCouponTypeLabel(coupon.coupon_type)}</span>
                    </div>
                    {coupon.coupon_type === "category" && coupon.category_name && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {coupon.category_name}
                      </Badge>
                    )}
                    {coupon.coupon_type === "specific_products" && coupon.selected_products.length > 0 && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {coupon.selected_products.length} products
                      </Badge>
                    )}
                  </td>
                  <td className="font-semibold">{coupon.discount}</td>
                  <td className="text-muted-foreground">
                    {coupon.uses} / {coupon.max_uses}
                  </td>
                  <td className="text-muted-foreground">
                    ${coupon.min_order_amount}
                  </td>
                  <td className="text-muted-foreground">{coupon.expires_at}</td>
                  <td>
                    <span
                      className={
                        coupon.status === "Active"
                          ? "status-badge status-badge--success"
                          : "status-badge status-badge--destructive"
                      }
                    >
                      {coupon.status}
                    </span>
                  </td>
                  <td className="flex gap-1 pr-5">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-blue-600"
                      title="Edit coupon"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(coupon.id)}
                      className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${
                        coupon.is_active ? 'text-orange-600' : 'text-green-600'
                      }`}
                      title={coupon.is_active ? 'Pause coupon' : 'Activate coupon'}
                    >
                      {coupon.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(coupon.code);
                        toast.success("Copied");
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive"
                      title="Delete coupon"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td className="pl-5 py-8 text-muted-foreground" colSpan={8}>
                    No coupons found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

