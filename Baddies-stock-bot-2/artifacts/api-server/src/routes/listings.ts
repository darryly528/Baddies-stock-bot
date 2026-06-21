import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getBotClient } from "../bot";
import { getRole } from "../permissions";
import { loadProfiles } from "./profiles";

const router: IRouter = Router();

const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");

export type ListingItem = {
  name: string;
  itemType: string;
  imageUrl: string | null;
  quantity: number | string;
  price?: string;
  soldOut: boolean;
};

export type Bid = {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  amount: number;
  placedAt: string;
};

export type Listing = {
  id: string;
  seller: string;
  discordUserId: string | null;
  discordAvatar: string | null;
  paymentMethods: string[];
  paymentDetails?: Record<string, string>;
  items: ListingItem[];
  customMessage?: string;
  createdAt: string;
  listingType?: "fixed" | "auction";
  auctionEndsAt?: string;
  startingBid?: number;
  bids?: Bid[];
  frameColor?: string;
  frameImageUrl?: string | null;
};

// ── In-memory cache ───────────────────────────────────────────────────────────
let _cache: Listing[] | null = null;
let _cacheEtag = "";

function _rebuildCache(listings: Listing[]): void {
  _cache = listings;
  // Cheap hash: length + first+last id
  const ids = listings.map((l) => l.id).join(",");
  _cacheEtag = `"${listings.length}-${Buffer.from(ids).toString("base64").slice(0, 16)}"`;
}

// Warm the cache on startup and watch for external changes
try {
  _rebuildCache(JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf8")));
} catch { _cache = []; _cacheEtag = '"empty"'; }

try {
  fs.watch(LISTINGS_PATH, () => {
    try { _rebuildCache(JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf8"))); }
    catch { /* ignore transient write-in-progress reads */ }
  });
} catch { /* file might not exist yet */ }

export function loadListings(): Listing[] {
  if (_cache !== null) return _cache;
  try {
    const data = JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf8"));
    _rebuildCache(data);
    return _cache!;
  } catch {
    return [];
  }
}

function saveListings(listings: Listing[]) {
  _rebuildCache(listings);
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
}

router.get("/listings", (req, res) => {
  const listings = loadListings();
  const profiles = loadProfiles();
  const enriched = listings.map((l) => {
    const p = l.discordUserId ? profiles[l.discordUserId] : undefined;
    return {
      ...l,
      isVerifiedReseller: l.discordUserId ? getRole(l.discordUserId) === "verified_reseller" : false,
      cardStyle: p?.cardStyle ?? "default",
      sellerAccentColor: p?.accentColor ?? "#ff0080",
      sellerEdgeEffect: p?.edgeEffect ?? "none",
    };
  });
  res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=10");
  res.setHeader("ETag", _cacheEtag);
  if (req.headers["if-none-match"] === _cacheEtag) {
    res.status(304).end();
    return;
  }
  res.json(enriched);
});

const MAX_AUCTION_DAYS = 7;

router.post("/listings", (req, res) => {
  const { seller, items, paymentMethods, paymentDetails, customMessage, listingType, auctionDays, startingBid } = req.body as {
    seller: string;
    items: { name: string; itemType: string; imageUrl: string | null; quantity: number | string; price?: string }[];
    paymentMethods?: string[];
    paymentDetails?: Record<string, string>;
    customMessage?: string;
    listingType?: "fixed" | "auction";
    auctionDays?: number;
    startingBid?: number;
  };

  if (!seller || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "seller and items are required" });
    return;
  }

  const sessionUser = req.session?.discordUser ?? null;
  const isAuction = listingType === "auction";

  let auctionEndsAt: string | undefined;
  if (isAuction) {
    const days = Math.max(1, Math.min(MAX_AUCTION_DAYS, Math.round(auctionDays ?? 3)));
    const end = new Date();
    end.setDate(end.getDate() + days);
    auctionEndsAt = end.toISOString();
  }

  const listing: Listing = {
    id: randomUUID(),
    seller: seller.trim(),
    discordUserId: sessionUser?.id ?? null,
    discordAvatar: sessionUser?.avatar ?? null,
    paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [],
    paymentDetails: paymentDetails && typeof paymentDetails === "object" ? paymentDetails : undefined,
    items: items.map((i) => ({
      name: i.name,
      itemType: i.itemType,
      imageUrl: i.imageUrl ?? null,
      quantity: i.quantity,
      price: isAuction ? undefined : (i.price?.trim() || undefined),
      soldOut: false,
    })),
    customMessage: customMessage?.trim() || undefined,
    createdAt: new Date().toISOString(),
    listingType: isAuction ? "auction" : "fixed",
    ...(isAuction && {
      auctionEndsAt,
      startingBid: typeof startingBid === "number" && startingBid > 0 ? startingBid : 0,
      bids: [],
    }),
  };

  const listings = loadListings();
  listings.push(listing);
  saveListings(listings);

  res.status(201).json(listing);
});

router.post("/listings/:id/bids", (req, res) => {
  const { id } = req.params as { id: string };
  const { amount } = req.body as { amount: number };
  const sessionUser = req.session?.discordUser ?? null;

  if (!sessionUser) {
    res.status(401).json({ error: "You must be logged in to place a bid" });
    return;
  }

  if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
    res.status(400).json({ error: "Invalid bid amount" });
    return;
  }

  const listings = loadListings();
  const listing = listings.find((l) => l.id === id);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  if (listing.listingType !== "auction") {
    res.status(400).json({ error: "This listing is not an auction" });
    return;
  }

  if (!listing.auctionEndsAt || new Date(listing.auctionEndsAt) < new Date()) {
    res.status(400).json({ error: "This auction has ended" });
    return;
  }

  if (listing.discordUserId === sessionUser.id) {
    res.status(400).json({ error: "You cannot bid on your own listing" });
    return;
  }

  const bids = listing.bids ?? [];
  const highestBid = bids.length > 0 ? Math.max(...bids.map((b) => b.amount)) : (listing.startingBid ?? 0);

  if (amount <= highestBid) {
    res.status(400).json({ error: `Bid must be higher than $${highestBid.toFixed(2)}` });
    return;
  }

  const bid: Bid = {
    id: randomUUID(),
    userId: sessionUser.id,
    username: sessionUser.username,
    avatar: sessionUser.avatar ?? null,
    amount,
    placedAt: new Date().toISOString(),
  };

  listing.bids = [...bids, bid];
  saveListings(listings);

  res.status(201).json(bid);
});

router.delete("/listings/:id/bids/:bidId", (req, res) => {
  const { id, bidId } = req.params as { id: string; bidId: string };
  const sessionUser = req.session?.discordUser ?? null;

  if (!sessionUser) {
    res.status(401).json({ error: "You must be logged in" });
    return;
  }

  const listings = loadListings();
  const listing = listings.find((l) => l.id === id);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const bids = listing.bids ?? [];
  const bid = bids.find((b) => b.id === bidId);

  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }

  if (bid.userId !== sessionUser.id) {
    res.status(403).json({ error: "You can only retract your own bids" });
    return;
  }

  listing.bids = bids.filter((b) => b.id !== bidId);
  saveListings(listings);

  res.json({ ok: true });
});

router.patch("/listings/:id/items/:itemName/sold", (req, res) => {
  const { id, itemName } = req.params as { id: string; itemName: string };
  const { soldQty } = req.body as { soldQty?: number };

  const sessionUserId = req.session?.discordUser?.id ?? null;
  const listings = loadListings();
  const listing = listings.find((l) => l.id === id);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  if (listing.discordUserId && listing.discordUserId !== sessionUserId) {
    res.status(403).json({ error: "You can only update your own listings" });
    return;
  }

  const item = listing.items.find((i) => i.name === decodeURIComponent(itemName));
  if (!item) {
    res.status(404).json({ error: "Item not found in listing" });
    return;
  }

  if (soldQty !== undefined && typeof item.quantity === "number") {
    const remaining = Math.max(0, item.quantity - soldQty);
    if (remaining === 0) {
      item.soldOut = true;
    } else {
      item.quantity = remaining;
    }
  } else {
    item.soldOut = true;
  }

  saveListings(listings);
  res.json(listing);
});

router.delete("/listings/:id", (req, res) => {
  const { id } = req.params as { id: string };
  const sessionUserId = req.session?.discordUser?.id ?? null;
  const listings = loadListings();
  const idx = listings.findIndex((l) => l.id === id);

  if (idx === -1) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const listing = listings[idx];
  if (listing.discordUserId && listing.discordUserId !== sessionUserId) {
    res.status(403).json({ error: "You can only delete your own listings" });
    return;
  }

  listings.splice(idx, 1);
  saveListings(listings);
  res.json({ ok: true });
});

router.patch("/listings/:id/frame", (req, res) => {
  const { id } = req.params as { id: string };
  const sessionUserId = req.session?.discordUser?.id ?? null;
  if (!sessionUserId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { frameColor, frameImageUrl } = req.body as { frameColor?: string; frameImageUrl?: string | null };

  const listings = loadListings();
  const listing = listings.find((l) => l.id === id);
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.discordUserId !== sessionUserId) { res.status(403).json({ error: "You can only edit your own listings" }); return; }

  if (typeof frameColor === "string") listing.frameColor = frameColor || undefined;
  if (frameImageUrl !== undefined) listing.frameImageUrl = frameImageUrl ?? null;

  saveListings(listings);
  res.json({ ok: true, frameColor: listing.frameColor, frameImageUrl: listing.frameImageUrl });
});

router.post("/listings/:id/notify-seller", async (req, res) => {
  const { id } = req.params as { id: string };
  const listings = loadListings();
  const listing = listings.find((l) => l.id === id);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  if (!listing.discordUserId) {
    res.json({ ok: false, reason: "Seller has no linked Discord account" });
    return;
  }

  const bot = getBotClient();
  if (!bot) {
    res.json({ ok: false, reason: "Bot is not online" });
    return;
  }

  const buyer = req.session?.discordUser;
  const buyerName = buyer ? `**@${buyer.username}**` : "Someone";
  const itemList = listing.items
    .filter((i) => !i.soldOut)
    .slice(0, 8)
    .map((i) => `• ${i.name}`)
    .join("\n");

  try {
    const sellerUser = await bot.users.fetch(listing.discordUserId);
    await sellerUser.send(
      `📢 **Someone wants to buy from your listing!**\n\n` +
      `${buyerName} is interested in your items on **Baddies Store**:\n${itemList}\n\n` +
      `Head to the store or your Discord server to complete the trade.`
    );
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ ok: false, reason: msg });
  }
});

export default router;
