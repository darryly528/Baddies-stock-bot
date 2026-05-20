import { Router, type Request, type Response } from "express";
import { loadListings } from "./listings";
import fs from "fs";
import path from "path";

const router = Router();

const ADMIN_USERNAME = "disgust_tf";

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = req.session?.discordUser;
  if (!user || user.username !== ADMIN_USERNAME) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.get("/admin/stats", requireAdmin, (req, res) => {
  const listings = loadListings();
  const totalItems = listings.reduce((sum, l) => sum + l.items.length, 0);
  const activeItems = listings.reduce((sum, l) => sum + l.items.filter((i) => !i.soldOut).length, 0);
  const sellers = new Set(listings.map((l) => l.discordUserId ?? l.seller));

  res.json({
    totalListings: listings.length,
    totalItems,
    activeItems,
    soldOutItems: totalItems - activeItems,
    uniqueSellers: sellers.size,
  });
});

router.get("/admin/listings", requireAdmin, (_req, res) => {
  res.json(loadListings());
});

router.delete("/admin/listings/:id", requireAdmin, (req, res) => {
  const { id } = req.params as { id: string };
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  let listings = loadListings();
  const before = listings.length;
  listings = listings.filter((l) => l.id !== id);
  if (listings.length === before) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
  res.json({ ok: true });
});

router.delete("/admin/listings", requireAdmin, (_req, res) => {
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  fs.writeFileSync(LISTINGS_PATH, "[]", "utf8");
  res.json({ ok: true });
});

router.delete("/admin/listings/sold-out", requireAdmin, (req, res) => {
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  let listings = loadListings();
  listings = listings.map((l) => ({
    ...l,
    items: l.items.filter((i) => !i.soldOut),
  })).filter((l) => l.items.length > 0);
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
  res.json({ ok: true, remaining: listings.length });
});

export default router;
