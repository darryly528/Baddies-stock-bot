import fs from "fs";
import path from "path";
import type { CatalogItem } from "./catalogUpdater";

const HISTORY_PATH = path.resolve(process.cwd(), "../../value-history.json");

export interface Snapshot {
  t: number;
  v: number | null;
  r: number | null;
}

type HistoryStore = Record<string, Snapshot[]>;

let store: HistoryStore = {};
let loaded = false;

function load(): HistoryStore {
  if (loaded) return store;
  try {
    const raw = fs.readFileSync(HISTORY_PATH, "utf8");
    store = JSON.parse(raw) as HistoryStore;
    console.log(`[history] Loaded value history for ${Object.keys(store).length} items.`);
  } catch {
    store = {};
  }
  loaded = true;
  return store;
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(HISTORY_PATH, JSON.stringify(store));
    } catch (err) {
      console.error("[history] Save failed:", err);
    }
  }, 1000);
}

export function recordSnapshots(items: CatalogItem[]): void {
  load();
  const now = Date.now();
  let added = 0;
  for (const item of items) {
    const key = String(item.itemId);
    const arr = store[key] ?? (store[key] = []);
    const last = arr[arr.length - 1];
    if (!last || last.v !== item.value || last.r !== item.rap) {
      arr.push({ t: now, v: item.value, r: item.rap });
      added++;
    }
  }
  if (added > 0) {
    console.log(`[history] Recorded ${added} new snapshot(s).`);
    scheduleSave();
  }
}

const RANGE_MS: Record<string, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
  "3m": 90 * 24 * 60 * 60 * 1000,
  "6m": 180 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

export function getHistory(itemId: number, range: string = "all"): Snapshot[] {
  load();
  const arr = store[String(itemId)] ?? [];
  if (range === "all" || !RANGE_MS[range]) return arr;
  const cutoff = Date.now() - RANGE_MS[range]!;
  const filtered = arr.filter((s) => s.t >= cutoff);
  if (filtered.length === 0 && arr.length > 0) {
    return [arr[arr.length - 1]!];
  }
  return filtered;
}
