import fs from "fs";
import path from "path";

const SHOPS_PATH = process.env["SHOPS_PATH"] ?? path.resolve(process.cwd(), "../../shops.json");

export type ShopStatus = "pending" | "approved" | "rejected";

export interface ShopApplication {
  userId: string;
  username: string;
  shopName: string;
  tagline: string;
  categories: string;
  bannerUrl?: string;
  logoUrl?: string;
  accentColor?: string;
  status: ShopStatus;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  rejectionReason?: string;
}

type ShopsStore = Record<string, ShopApplication>;

export function loadShops(): ShopsStore {
  try { return JSON.parse(fs.readFileSync(SHOPS_PATH, "utf8")); } catch { return {}; }
}
export function saveShops(s: ShopsStore): void {
  fs.writeFileSync(SHOPS_PATH, JSON.stringify(s, null, 2), "utf8");
}

export function upsertShopApplication(data: {
  userId: string;
  username: string;
  shopName: string;
  tagline: string;
  categories: string;
  bannerUrl?: string;
  logoUrl?: string;
  accentColor?: string;
}): ShopApplication {
  const shops = loadShops();
  const existing = shops[data.userId];
  const app: ShopApplication = {
    ...data,
    status: "pending",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  shops[data.userId] = app;
  saveShops(shops);
  return app;
}

export function approveShop(userId: string, reviewerId: string, reviewerName: string): { ok: boolean; app?: ShopApplication } {
  const shops = loadShops();
  if (!shops[userId]) return { ok: false };
  shops[userId]!.status = "approved";
  shops[userId]!.reviewedBy = reviewerId;
  shops[userId]!.reviewedByName = reviewerName;
  shops[userId]!.updatedAt = new Date().toISOString();
  delete shops[userId]!.rejectionReason;
  saveShops(shops);
  return { ok: true, app: shops[userId] };
}

export function rejectShop(userId: string, reviewerId: string, reviewerName: string, reason?: string): { ok: boolean; app?: ShopApplication } {
  const shops = loadShops();
  if (!shops[userId]) return { ok: false };
  shops[userId]!.status = "rejected";
  shops[userId]!.reviewedBy = reviewerId;
  shops[userId]!.reviewedByName = reviewerName;
  shops[userId]!.updatedAt = new Date().toISOString();
  if (reason) shops[userId]!.rejectionReason = reason;
  saveShops(shops);
  return { ok: true, app: shops[userId] };
}
