import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");

export type ListingItem = {
  name: string;
  itemType: string;
  imageUrl: string | null;
  quantity: number | string;
  soldOut: boolean;
};

export type Listing = {
  id: string;
  seller: string;
  items: ListingItem[];
  createdAt: string;
};

function loadListings(): Listing[] {
  try {
    return JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveListings(listings: Listing[]) {
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
}

router.get("/listings", (_req, res) => {
  const listings = loadListings();
  res.json(listings);
});

router.post("/listings", (req, res) => {
  const { seller, items } = req.body as {
    seller: string;
    items: { name: string; itemType: string; imageUrl: string | null; quantity: number | string }[];
  };

  if (!seller || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "seller and items are required" });
    return;
  }

  const listing: Listing = {
    id: randomUUID(),
    seller: seller.trim(),
    items: items.map((i) => ({
      name: i.name,
      itemType: i.itemType,
      imageUrl: i.imageUrl ?? null,
      quantity: i.quantity,
      soldOut: false,
    })),
    createdAt: new Date().toISOString(),
  };

  const listings = loadListings();
  listings.push(listing);
  saveListings(listings);

  res.status(201).json(listing);
});

router.patch("/listings/:id/items/:itemName/sold", (req, res) => {
  const { id, itemName } = req.params as { id: string; itemName: string };
  const { soldQty } = req.body as { soldQty?: number };

  const listings = loadListings();
  const listing = listings.find((l) => l.id === id);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
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
  const listings = loadListings();
  const idx = listings.findIndex((l) => l.id === id);

  if (idx === -1) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  listings.splice(idx, 1);
  saveListings(listings);
  res.json({ ok: true });
});

export default router;
