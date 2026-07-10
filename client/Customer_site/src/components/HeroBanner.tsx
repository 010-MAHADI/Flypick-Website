import { ArrowRight, Truck, ShieldCheck, RotateCcw, BadgeCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";

const TRUST_ITEMS = [
  { icon: Truck, label: "Fast Delivery", sub: "All over Bangladesh" },
  { icon: BadgeCheck, label: "100% Authentic", sub: "Quality guaranteed" },
  { icon: RotateCcw, label: "Easy Returns", sub: "7-day return policy" },
  { icon: ShieldCheck, label: "Secure Payment", sub: "bKash · Nagad · Cards" },
];

const HeroBanner = () => {
  const { data: products = [] } = useProducts();
  // Showcase the deepest-discounted products inside the hero
  const heroPicks = [...products]
    .filter((p) => p.discount > 0)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 3);

  return (
    <section className="section-shell pt-3 sm:pt-5">
      {/* Promo banner */}
      <div className="hero-banner relative overflow-hidden rounded-2xl sm:rounded-3xl text-white">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -right-4 top-24 w-32 h-32 rounded-full bg-white/10" />

        <div className="relative flex items-center gap-4 px-5 py-6 sm:px-10 sm:py-10">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-sm font-bold uppercase tracking-[0.18em] text-white/80 mb-1.5">
              Mega Sale · Limited time
            </p>
            <h1 className="text-2xl sm:text-5xl font-black leading-tight mb-1 sm:mb-2">
              Up to <span className="text-yellow-300">60% off</span>
            </h1>
            <p className="text-xs sm:text-base text-white/85 mb-4 sm:mb-6 max-w-md">
              Top tech, gadgets and everyday essentials — delivered to your door.
            </p>
            <Link
              to="/super-deals"
              className="inline-flex items-center gap-1.5 bg-white text-primary text-xs sm:text-sm font-extrabold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg active:scale-95 hover:gap-2.5 transition-all"
            >
              Shop the sale <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Floating product picks */}
          {heroPicks.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3">
              {heroPicks.map((p, i) => (
                <Link
                  key={p.id}
                  to="/super-deals"
                  className={`relative rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-xl flex-shrink-0 ${
                    i === 0 ? "w-20 h-20 sm:w-36 sm:h-36" : "w-14 h-14 sm:w-28 sm:h-28 hidden md:block"
                  }`}
                >
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute bottom-0 left-0 right-0 bg-primary/95 text-[9px] sm:text-[11px] font-extrabold text-center py-0.5">
                    -{p.discount}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trust strip */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3 mt-2.5 sm:mt-4">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.label}
            className="bg-card rounded-xl sm:rounded-2xl px-1.5 py-2.5 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row items-center sm:gap-3 gap-1 text-center sm:text-left shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
          >
            <item.icon className="w-4 h-4 sm:w-6 sm:h-6 text-primary flex-shrink-0" strokeWidth={1.9} />
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[13px] font-bold text-foreground leading-tight">{item.label}</p>
              <p className="hidden sm:block text-[11px] text-muted-foreground truncate">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HeroBanner;
