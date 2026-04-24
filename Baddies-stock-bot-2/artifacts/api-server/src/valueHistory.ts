export interface Snapshot {
  t: number;
  v: number | null;
  r: number | null;
}

interface BloxtsarChartPoint {
  date: number;
  Value: number | null;
  RAP: number | null;
}

interface CacheEntry {
  history: Snapshot[];
  fetchedAt: number;
  error?: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const cache = new Map<number, CacheEntry>();
const inflight = new Map<number, Promise<Snapshot[]>>();

const RANGE_MS: Record<string, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
  "3m": 90 * 24 * 60 * 60 * 1000,
  "6m": 180 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

function extractInitialChartData(payload: string): BloxtsarChartPoint[] | null {
  const marker = '"initialChartData":[';
  const idx = payload.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length - 1;
  let depth = 0;
  let i = start;
  while (i < payload.length) {
    const c = payload[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  if (depth !== 0) return null;
  const arr = payload.slice(start, i + 1);
  try {
    return JSON.parse(arr) as BloxtsarChartPoint[];
  } catch {
    return null;
  }
}

async function fetchHistoryFromBloxtsar(itemId: number): Promise<Snapshot[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://bloxtsar.com/baddies/item/${itemId}`, {
      headers: {
        "RSC": "1",
        "Next-Url": `/baddies/item/${itemId}`,
        "Accept": "text/x-component",
        "User-Agent": "Mozilla/5.0 (compatible; BaddiesStoreBot/1.0)",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const points = extractInitialChartData(text);
    if (!points) throw new Error("No initialChartData in payload");
    return points
      .map<Snapshot>((p) => ({ t: p.date, v: p.Value ?? null, r: p.RAP ?? null }))
      .sort((a, b) => a.t - b.t);
  } finally {
    clearTimeout(timer);
  }
}

async function loadHistory(itemId: number): Promise<Snapshot[]> {
  const cached = cache.get(itemId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && !cached.error) {
    return cached.history;
  }
  const existing = inflight.get(itemId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const history = await fetchHistoryFromBloxtsar(itemId);
      cache.set(itemId, { history, fetchedAt: Date.now() });
      return history;
    } catch (err) {
      const fallback = cached?.history ?? [];
      cache.set(itemId, {
        history: fallback,
        fetchedAt: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
      console.warn(`[history] Bloxtsar fetch failed for item ${itemId}:`, err);
      return fallback;
    } finally {
      inflight.delete(itemId);
    }
  })();
  inflight.set(itemId, p);
  return p;
}

export async function getHistory(itemId: number, range: string = "all"): Promise<Snapshot[]> {
  const arr = await loadHistory(itemId);
  if (range === "all" || !RANGE_MS[range]) return arr;
  const cutoff = Date.now() - RANGE_MS[range]!;
  const filtered = arr.filter((s) => s.t >= cutoff);
  if (filtered.length === 0 && arr.length > 0) {
    return [arr[arr.length - 1]!];
  }
  return filtered;
}
