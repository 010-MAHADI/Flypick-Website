import { ChevronRight, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { generateProductUrl } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";

/** Countdown to local midnight — flash deals reset daily. */
const useMidnightCountdown = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hours: pad(Math.floor(diff / 3_600_000)),
    minutes: pad(Math.floor((diff % 3_600_000) / 60_000)),
    seconds: pad(Math.floor((diff % 60_000) / 1000)),
  };
};

const DealsSection = () => {
  const { data: products = [], isLoading } = useProducts();
  const { hours, minutes, seconds } = useMidnightCountdown();

  const deals = [...products]
    .filter((p) => p.discount > 0)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 10);

  if (!isLoading && deals.length === 0) return null;

  return (
    <section className="section-shell py-4 sm:py-8">
      <div className="section-head">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <h2 className="section-title flex items-center gap-1.5">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-secondary fill-secondary" />
            Flash Deals
          </h2>
          <div className="flex items-center gap-1" aria-label="Deal ends in">
            {[hours, minutes, seconds].map((unit, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="bg-foreground text-background text-[11px] sm:text-xs font-bold rounded-md px-1.5 py-0.5 tabular-nums">
                  {unit}
                </span>
                {i < 2 && <span className="text-xs font-bold text-foreground/50">:</span>}
              </span>
            ))}
          </div>
        </div>
        <Link to="/super-deals" className="section-link flex-shrink-0">
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="snap-rail">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[136px] sm:w-[176px] flex-shrink-0">
              <div className="skeleton aspect-square mb-2" />
              <div className="skeleton h-3 w-3/4 !rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="snap-rail -mx-3 px-3 sm:mx-0 sm:px-0">
          {deals.map((p) => (
            <Link
              key={p.id}
              to={generateProductUrl(p)}
              className="w-[136px] sm:w-[176px] flex-shrink-0 snap-start bg-card rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.07)] md:hover:shadow-[0_10px_28px_rgba(16,24,40,0.13)] transition-shadow group"
            >
              <div className="relative aspect-square bg-muted overflow-hidden">
                <img
                  src={p.image}
                  alt={p.title}
                  className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <span className="absolute top-2 left-2 badge-discount shadow-sm">-{p.discount}%</span>
              </div>
              <div className="p-2.5">
                <p className="text-sm font-extrabold text-primary">
                  <TakaSign />
                  {p.price.toLocaleString()}
                </p>
                <p className="price-original">
                  <TakaSign />
                  {p.originalPrice.toLocaleString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default DealsSection;
