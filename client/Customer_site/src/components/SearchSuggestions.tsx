import { Search, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Product } from "@/hooks/useProducts";
import { generateProductUrl } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";

interface SearchSuggestionsProps {
  query: string;
  products: Product[];
  onSelect: () => void;
  onSearch: (term: string) => void;
}

/** Bold the part of the title that matches the query. */
const Highlight = ({ text, query }: { text: string; query: string }) => {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-foreground">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
};

/**
 * Instant search suggestions — filters the already-cached product list
 * client-side, so results appear from the very first keystroke.
 */
const SearchSuggestions = ({ query, products, onSelect, onSearch }: SearchSuggestionsProps) => {
  const trimmed = query.trim().toLowerCase();

  const { productMatches, categoryMatches } = useMemo(() => {
    if (!trimmed) return { productMatches: [] as Product[], categoryMatches: [] as string[] };

    const scored = products
      .map((p) => {
        const title = p.title.toLowerCase();
        let score = 0;
        if (title.startsWith(trimmed)) score = 4;
        else if (title.split(/\s+/).some((w) => w.startsWith(trimmed))) score = 3;
        else if (title.includes(trimmed)) score = 2;
        else if (p.category.toLowerCase().includes(trimmed) || p.store.toLowerCase().includes(trimmed)) score = 1;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.p.rating - a.p.rating);

    const cats = Array.from(
      new Set(
        products
          .map((p) => p.category)
          .filter((c) => c && c.toLowerCase().includes(trimmed))
      )
    ).slice(0, 3);

    return { productMatches: scored.slice(0, 6).map((x) => x.p), categoryMatches: cats };
  }, [products, trimmed]);

  if (!trimmed) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-2xl shadow-[0_12px_40px_rgba(16,24,40,0.18)] border border-border/60 overflow-hidden z-[80]">
      {/* Category shortcuts */}
      {categoryMatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3 pb-1">
          {categoryMatches.map((cat) => (
            <button
              key={cat}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSearch(cat); onSelect(); }}
              className="chip !text-[11px] !py-1"
            >
              <TrendingUp className="w-3 h-3" />
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Product matches */}
      {productMatches.length > 0 ? (
        <ul className="py-1.5 max-h-[min(420px,60vh)] overflow-y-auto">
          {productMatches.map((p) => (
            <li key={p.id}>
              <Link
                to={generateProductUrl(p)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onSelect}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
              >
                <span className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-foreground/75 truncate">
                    <Highlight text={p.title} query={trimmed} />
                  </span>
                  <span className="text-[11px] text-muted-foreground">{p.category}</span>
                </span>
                <span className="flex-shrink-0 text-[13px] font-bold text-primary">
                  <TakaSign />
                  {p.price.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-[13px] text-muted-foreground">No matching products — try a different keyword.</p>
      )}

      {/* See-all row */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { onSearch(query.trim()); onSelect(); }}
        className="w-full flex items-center gap-2 px-4 py-3 border-t border-border/70 text-[13px] font-semibold text-primary hover:bg-accent/60 transition-colors"
      >
        <Search className="w-4 h-4" />
        Search for “{query.trim()}”
      </button>
    </div>
  );
};

export default SearchSuggestions;
