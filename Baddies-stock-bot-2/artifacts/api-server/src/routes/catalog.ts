import { Router, type IRouter } from "express";
import { catalog, runCatalogUpdateNow } from "../catalogUpdater";
import { getHistory } from "../valueHistory";

const router: IRouter = Router();

router.get("/catalog/items/:itemId/history", async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  if (!Number.isFinite(itemId)) {
    res.status(400).json({ error: "Invalid itemId" });
    return;
  }
  const range = ((req.query["range"] as string) ?? "all").toLowerCase();
  const item = catalog.find((c) => c.itemId === itemId);
  try {
    const history = await getHistory(itemId, range);
    res.json({ itemId, name: item?.name ?? null, range, history });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch history",
    });
  }
});

let refreshInFlight: Promise<{ count: number; updatedAt: string }> | null = null;

router.post("/catalog/refresh", async (_req, res) => {
  try {
    if (!refreshInFlight) {
      refreshInFlight = runCatalogUpdateNow().finally(() => {
        refreshInFlight = null;
      });
    }
    const result = await refreshInFlight;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Refresh failed" });
  }
});

// ── Catalog search/filter cache (keyed by query string) ──────────────────────
const _filterCache = new Map<string, { result: object; ts: number }>();
const FILTER_TTL_MS = 20_000;

// Invalidate filter cache when catalog updates
import { onCatalogUpdate } from "../catalogUpdater";
onCatalogUpdate(() => _filterCache.clear());

router.get("/catalog/items", (req, res) => {
  const search   = ((req.query["search"]   as string) ?? "").toLowerCase().trim();
  const itemType = ((req.query["itemType"] as string) ?? "");
  const category = ((req.query["category"] as string) ?? "");
  const page     = Math.max(1, parseInt((req.query["page"]  as string) ?? "1")  || 1);
  const limit    = Math.min(100, Math.max(1, parseInt((req.query["limit"] as string) ?? "40") || 40));

  const cacheKey = `${search}|${itemType}|${category}|${page}|${limit}`;
  const cached = _filterCache.get(cacheKey);

  res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=30");

  if (cached && Date.now() - cached.ts < FILTER_TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    res.json(cached.result);
    return;
  }

  let filtered = catalog;
  if (search)   filtered = filtered.filter((i) => i.name.toLowerCase().includes(search));
  if (itemType) filtered = filtered.filter((i) => i.itemType === itemType);
  if (category) filtered = filtered.filter((i) => i.category === category);

  const total      = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const items      = filtered.slice((page - 1) * limit, page * limit);
  const result     = { items, total, page, limit, totalPages };

  _filterCache.set(cacheKey, { result, ts: Date.now() });
  // Trim cache if it grows large
  if (_filterCache.size > 500) {
    const oldest = [..._filterCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
    for (const [k] of oldest) _filterCache.delete(k);
  }

  res.setHeader("X-Cache", "MISS");
  res.json(result);
});

let _categoriesCache: object | null = null;
onCatalogUpdate(() => { _categoriesCache = null; });

router.get("/catalog/categories", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  if (_categoriesCache) { res.json(_categoriesCache); return; }
  const itemTypes  = [...new Set(catalog.map((i) => i.itemType).filter(Boolean))].sort();
  const categories = [...new Set(catalog.map((i) => i.category).filter(Boolean))].sort() as string[];
  _categoriesCache = { itemTypes, categories };
  res.json(_categoriesCache);
});

export default router;
