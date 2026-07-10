import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Link2, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";

interface ProductSource {
  id: number;
  url: string;
  source_site: string;
  is_primary: boolean;
  label: string;
  sync_enabled: boolean;
  last_checked_at: string | null;
  sync_status: string;
  last_result: string;
  last_seen_price: string | null;
  last_seen_stock_status: string;
  created_at: string;
}

interface LastImport {
  status: string;
  result_summary: Record<string, unknown> | null;
  created_at: string;
}

const statusStyles: Record<string, string> = {
  never: "bg-muted text-muted-foreground",
  ok: "bg-emerald-500/15 text-emerald-500",
  stock_changed: "bg-amber-500/15 text-amber-500",
  price_changed: "bg-amber-500/15 text-amber-500",
  unavailable: "bg-red-500/15 text-red-500",
  removed: "bg-red-500/15 text-red-500",
  error: "bg-red-500/15 text-red-500",
};

const statusLabels: Record<string, string> = {
  never: "Never synced",
  ok: "OK",
  stock_changed: "Stock changed",
  price_changed: "Price changed",
  unavailable: "Source unavailable",
  removed: "Product removed",
  error: "Error",
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

/**
 * Admin-only panel on the product edit page: shows where an imported product
 * came from, its sync health, and lets admins manage alternative source URLs.
 */
export function SourceInformation({ productId }: { productId: string }) {
  const [sources, setSources] = useState<ProductSource[]>([]);
  const [lastImport, setLastImport] = useState<LastImport | null>(null);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/importer/products/${productId}/sources/`);
      setSources(response.data.sources || []);
      setLastImport(response.data.last_import || null);
    } catch {
      // non-admin or product without sources — keep the panel empty
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const addSource = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      await api.post(`/importer/products/${productId}/sources/`, { url: newUrl.trim() });
      setNewUrl("");
      toast.success("Source URL added");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Could not add the source URL");
    } finally {
      setAdding(false);
    }
  };

  const removeSource = async (id: number) => {
    try {
      await api.delete(`/importer/product-sources/${id}/`);
      toast.success("Source removed");
      await load();
    } catch {
      toast.error("Could not remove the source");
    }
  };

  const syncNow = async (id: number) => {
    setSyncingId(id);
    try {
      const response = await api.post(`/importer/product-sources/${id}/sync/`, {}, { timeout: 180000 });
      const outcome = response.data?.outcome;
      if (outcome === "ok") toast.success("Sync complete — no significant change");
      else if (outcome === "changed") toast.warning("Sync detected changes — notifications sent");
      else toast.error(`Sync result: ${statusLabels[outcome] || outcome}`);
      await load();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  if (loading || (!sources.length && !lastImport)) return null;

  return (
    <section className="stat-card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title !mb-0">Source Information</h2>
        <Badge variant="outline" className="rounded-md text-xs gap-1">
          <ShieldCheck className="h-3 w-3" /> Admins only
        </Badge>
      </div>

      <div className="space-y-3">
        {sources.map((source, index) => (
          <div key={source.id} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={source.is_primary ? "default" : "secondary"} className="rounded-md text-xs">
                {source.is_primary ? "Primary Source" : `Alternative Source #${index}`}
              </Badge>
              {source.source_site && (
                <Badge variant="outline" className="rounded-md text-xs">{source.source_site}</Badge>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[source.sync_status] || statusStyles.never}`}>
                {statusLabels[source.sync_status] || source.sync_status}
              </span>
              {!source.sync_enabled && (
                <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">Auto-sync off</span>
              )}
              <div className="ml-auto flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Sync now"
                  disabled={syncingId !== null} onClick={() => syncNow(source.id)}>
                  {syncingId === source.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Remove source"
                  onClick={() => removeSource(source.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
            <a href={source.url} target="_blank" rel="noreferrer"
              className="text-xs text-primary hover:underline break-all flex items-center gap-1">
              <ExternalLink className="h-3 w-3 shrink-0" /> {source.url}
            </a>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <span>Added: {formatDate(source.created_at)}</span>
              <span>Last sync: {formatDate(source.last_checked_at)}</span>
              <span>Seen price: {source.last_seen_price ?? "—"}</span>
              <span>Seen stock: {source.last_seen_stock_status || "—"}</span>
            </div>
            {source.last_result && (
              <p className="text-xs text-muted-foreground">Last result: {source.last_result}</p>
            )}
          </div>
        ))}
      </div>

      {lastImport && (
        <p className="text-xs text-muted-foreground">
          Last import: {lastImport.status} · {formatDate(lastImport.created_at)}
          {lastImport.result_summary?.images_saved !== undefined &&
            ` · ${lastImport.result_summary.images_saved} image(s) saved`}
        </p>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Add alternative source URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://…" className="rounded-lg pl-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }} />
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={adding} onClick={addSource}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Source URLs are never shown to customers. The primary source is re-checked automatically every few days.
        </p>
      </div>
    </section>
  );
}
