import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, Edit, Download, BarChart3, TrendingUp, TrendingDown, Eye, ShoppingCart, DollarSign, Star, X, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useProductsAdmin, type Product } from "@/hooks/useProductsAdmin";
import { useShop } from "@/context/ShopContext";

const defaultProducts: Product[] = [];

const statusClass: Record<string, string> = {
  Active: "status-badge status-badge--success",
  Draft: "status-badge status-badge--warning",
  "Out of Stock": "status-badge status-badge--destructive",
};

export default function Products() {
  const navigate = useNavigate();
  const { currentShop } = useShop();
  const { data: products = defaultProducts, isLoading } = useProductsAdmin(currentShop?.id);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [analysisProduct, setAnalysisProduct] = useState<Product | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const categories = [...new Set(products.map((p) => p.category))];

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading products...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Products</h1>
          <p>{products.length} total products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg">
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button size="sm" className="rounded-lg shadow-sm" onClick={() => navigate("/products/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Product
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-lg" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] rounded-lg">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((product) => (
          <div key={product.id} className="group stat-card relative overflow-hidden flex flex-col p-0">
            {/* Image area */}
            <div className="relative aspect-square bg-gradient-to-br from-muted/60 to-muted/30 flex items-center justify-center overflow-hidden">
              {product.image ? (
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<span class="text-6xl">📦</span>';
                  }}
                />
              ) : (
                <span className="text-6xl">📦</span>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-foreground/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                <Button size="sm" variant="secondary" className="gap-1.5 rounded-lg shadow-lg" onClick={() => setAnalysisProduct(product)}>
                  <BarChart3 className="h-4 w-4" /> Analyse
                </Button>
                <Button size="sm" className="gap-1.5 rounded-lg shadow-lg" onClick={() => navigate(`/products/${product.id}/edit`)}>
                  <Edit className="h-4 w-4" /> Edit
                </Button>
              </div>
              {/* Status badge */}
              <span className={`absolute top-3 left-3 ${statusClass[product.status]}`}>{product.status}</span>
            </div>
            {/* Info */}
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-semibold text-sm line-clamp-2 mb-1">{product.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{product.sku} · {product.category}</p>
              <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/60">
                <span className="font-bold text-base">${product.price.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground font-medium">{product.stock} in stock</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No products found.</p>
        </div>
      )}

      {/* Analysis Dialog */}
      <Dialog open={!!analysisProduct} onOpenChange={() => setAnalysisProduct(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" /> Product Analysis
            </DialogTitle>
          </DialogHeader>
          {analysisProduct && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                {analysisProduct.image ? (
                  <img 
                    src={analysisProduct.image} 
                    alt={analysisProduct.name}
                    className="w-16 h-16 object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const placeholder = document.createElement('span');
                      placeholder.className = 'text-4xl';
                      placeholder.textContent = '📦';
                      e.currentTarget.parentElement!.appendChild(placeholder);
                    }}
                  />
                ) : (
                  <span className="text-4xl">📦</span>
                )}
                <div>
                  <h3 className="font-semibold text-sm">{analysisProduct.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{analysisProduct.sku}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: ShoppingCart, label: "Units Sold", value: analysisProduct.sold?.toLocaleString() },
                  { icon: DollarSign, label: "Revenue", value: `$${analysisProduct.revenue?.toLocaleString()}` },
                  { icon: Eye, label: "Views", value: analysisProduct.views?.toLocaleString() },
                  { icon: Star, label: "Rating", value: `${analysisProduct.rating} / 5` },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium"><item.icon className="h-3.5 w-3.5" /> {item.label}</div>
                    <p className="text-lg font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-2">
                <h4 className="text-sm font-semibold">Performance Trend</h4>
                <div className="flex items-center gap-2">
                  {(analysisProduct.trend ?? 0) >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-success" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  )}
                  <span className={`text-xl font-bold ${(analysisProduct.trend ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                    {(analysisProduct.trend ?? 0) >= 0 ? "+" : ""}{analysisProduct.trend}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs last month</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-2">
                <h4 className="text-sm font-semibold">Conversion Rate</h4>
                <p className="text-xl font-bold text-primary">
                  {((analysisProduct.sold ?? 0) / (analysisProduct.views ?? 1) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {analysisProduct.sold?.toLocaleString()} orders from {analysisProduct.views?.toLocaleString()} views
                </p>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 rounded-lg" onClick={() => { setAnalysisProduct(null); navigate(`/products/${analysisProduct.id}/edit`); }}>
                  <Edit className="h-4 w-4 mr-1.5" /> Edit Product
                </Button>
                <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setAnalysisProduct(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
