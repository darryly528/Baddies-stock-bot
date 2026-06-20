import fs from "fs";
import path from "path";

const CATALOG_PATH = path.resolve(process.cwd(), "../../catalog.json");
const UPDATE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const BLOXTSAR_BASE = "https://bloxtsar.com/api/baddies/catalog";
const TOTAL_PAGES = 55;
const PAGE_LIMIT = 40;

export type CatalogItem = {
  itemId: number;
  name: string;
  rarity: string;
  imageUrl: string | null;
  value: number | null;
  rap: number | null;
  category: string | null;
  tradeable: boolean;
  itemType: string;
  acronym: string | null;
  demand: string | null;
  trend: string | null;
};

export const catalog: CatalogItem[] = [];

const _updateCallbacks: Array<() => void> = [];
export function onCatalogUpdate(cb: () => void): void {
  _updateCallbacks.push(cb);
}

function loadFromDisk(): void {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, "utf8");
    const parsed: CatalogItem[] = JSON.parse(raw);
    const items = deduplicateById(parsed);
    catalog.splice(0, catalog.length, ...items);
    console.log(`[catalog] Loaded ${catalog.length} items from disk.`);
  } catch {
    console.warn("[catalog] Could not load catalog.json from disk.");
  }
}

async function fetchAllPages(): Promise<CatalogItem[]> {
  const allItems: CatalogItem[] = [];
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    try {
      const url = `${BLOXTSAR_BASE}?page=${page}&limit=${PAGE_LIMIT}&sort=value_desc`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[catalog] Page ${page} returned HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as unknown;
      let items: CatalogItem[] = [];
      if (Array.isArray(data)) {
        items = data as CatalogItem[];
      } else if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj["data"])) items = obj["data"] as CatalogItem[];
        else if (Array.isArray(obj["items"])) items = obj["items"] as CatalogItem[];
      }
      allItems.push(...items);
    } catch (err) {
      console.warn(`[catalog] Error fetching page ${page}:`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return allItems;
}

function deduplicateById(items: CatalogItem[]): CatalogItem[] {
  const seen = new Map<number, CatalogItem>();
  for (const item of items) {
    if (!seen.has(item.itemId)) {
      seen.set(item.itemId, item);
    }
  }
  return Array.from(seen.values());
}

export async function runCatalogUpdateNow(): Promise<{ count: number; updatedAt: string }> {
  await runUpdate();
  return { count: catalog.length, updatedAt: new Date().toISOString() };
}

async function runUpdate(): Promise<void> {
  console.log("[catalog] Starting update from bloxtsar.com...");
  try {
    const raw = await fetchAllPages();
    if (raw.length === 0) {
      console.warn("[catalog] Update returned 0 items — keeping existing catalog.");
      return;
    }
    const items = deduplicateById(raw);
    if (raw.length !== items.length) {
      console.log(`[catalog] Deduplicated ${raw.length - items.length} duplicate item(s).`);
    }
    catalog.splice(0, catalog.length, ...items);
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(items, null, 2));
    for (const cb of _updateCallbacks) cb();
    console.log(`[catalog] Updated catalog with ${items.length} items.`);
  } catch (err) {
    console.error("[catalog] Update failed:", err);
  }
}

export function startCatalogUpdater(): void {
  loadFromDisk();
  runUpdate().catch((err) => console.error("[catalog] Initial update error:", err));
  setInterval(() => {
    runUpdate().catch((err) => console.error("[catalog] Scheduled update error:", err));
  }, UPDATE_INTERVAL_MS);
  console.log(`[catalog] Scheduled automatic updates every ${UPDATE_INTERVAL_MS / 3600000}h.`);
}
