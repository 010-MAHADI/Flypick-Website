import SiteHeader from "@/components/SiteHeader";
import HeroBanner from "@/components/HeroBanner";
import DealsSection from "@/components/DealsSection";
import CategorySection from "@/components/CategorySection";
import ProductGrid from "@/components/ProductGrid";
import SiteFooter from "@/components/SiteFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <HeroBanner />
      <DealsSection />
      <CategorySection />
      <ProductGrid />
      <SiteFooter />
    </div>
  );
};

export default Index;
