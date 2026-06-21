import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const VOUCHES_PATH = process.env["VOUCHES_PATH"] ?? path.resolve(process.cwd(), "../../vouches.json");

type Vouch = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar: string | null;
  toUserId: string;
  toUsername: string;
  toAvatar: string | null;
  message: string;
  rating: number;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
};

function loadVouches(): Vouch[] {
  try { return JSON.parse(fs.readFileSync(VOUCHES_PATH, "utf8")); } catch { return []; }
}
function saveVouches(v: Vouch[]): void {
  fs.writeFileSync(VOUCHES_PATH, JSON.stringify(v, null, 2), "utf8");
}

const router = Router();

// ── Get all vouches (paginated) ───────────────────────────────────────────────

router.get("/vouches", (_req, res) => {
  const vouches = loadVouches();
  const sorted = [...vouches].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(sorted);
});

// ── Get vouches for a specific user ──────────────────────────────────────────

router.get("/vouches/user/:userId", (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const vouches = loadVouches();
  const userVouches = vouches
    .filter((v) => v.toUserId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const avgRating = userVouches.length > 0
    ? Math.round((userVouches.reduce((s, v) => s + v.rating, 0) / userVouches.length) * 10) / 10
    : null;
  res.json({ vouches: userVouches, count: userVouches.length, avgRating });
});

// ── Get vouches that mention a user by @username ──────────────────────────────

router.get("/vouches/mentions/:userId", (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const username = (req.query["username"] as string | undefined)?.trim().toLowerCase();
  if (!username) { res.status(400).json({ error: "username query param required" }); return; }

  const vouches = loadVouches();
  const pattern = `@${username}`;
  const mentions = vouches
    .filter((v) => v.message.toLowerCase().includes(pattern) && v.toUserId !== userId && v.fromUserId !== userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ vouches: mentions, count: mentions.length });
});

// ── Post a vouch ──────────────────────────────────────────────────────────────

router.post("/vouches", (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Login required to leave a vouch" }); return; }

  const { toUserId, toUsername, toAvatar, message, rating, imageUrl } = req.body as {
    toUserId?: string; toUsername?: string; toAvatar?: string | null;
    message?: string; rating?: number; imageUrl?: string | null;
  };

  if (!toUserId?.trim() || !toUsername?.trim()) {
    res.status(400).json({ error: "toUserId and toUsername are required" }); return;
  }
  if (toUserId === user.id) {
    res.status(400).json({ error: "You cannot vouch for yourself" }); return;
  }
  if (!message?.trim() || message.trim().length < 10) {
    res.status(400).json({ error: "Message must be at least 10 characters" }); return;
  }
  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    res.status(400).json({ error: "Rating must be 1–5 stars" }); return;
  }

  const vouches = loadVouches();

  // Update existing vouch if this user already vouched for this seller
  const existing = vouches.findIndex((v) => v.fromUserId === user.id && v.toUserId === toUserId);
  const avatarHash = (user as { avatar?: string }).avatar ?? null;
  const fromAvatar = avatarHash
    ? `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=64` : null;

  const cleanImageUrl = imageUrl?.trim() || null;

  if (existing >= 0) {
    vouches[existing] = {
      ...vouches[existing],
      message: message.trim().slice(0, 300),
      rating,
      fromAvatar,
      toAvatar: toAvatar ?? null,
      toUsername,
      imageUrl: cleanImageUrl,
      updatedAt: new Date().toISOString(),
    };
    saveVouches(vouches);
    res.json({ ok: true, vouch: vouches[existing], updated: true });
    return;
  }

  const vouch: Vouch = {
    id: randomUUID(),
    fromUserId: user.id,
    fromUsername: user.username,
    fromAvatar,
    toUserId: toUserId.trim(),
    toUsername: toUsername.trim(),
    toAvatar: toAvatar ?? null,
    message: message.trim().slice(0, 300),
    rating,
    imageUrl: cleanImageUrl,
    createdAt: new Date().toISOString(),
  };

  vouches.push(vouch);
  saveVouches(vouches);
  res.json({ ok: true, vouch, updated: false });
});

// ── Delete own vouch ──────────────────────────────────────────────────────────

router.delete("/vouches/:vouchId", (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { vouchId } = req.params as { vouchId: string };

  const vouches = loadVouches();
  const idx = vouches.findIndex((v) => v.id === vouchId);
  if (idx < 0) { res.status(404).json({ error: "Vouch not found" }); return; }
  if (vouches[idx].fromUserId !== user.id) { res.status(403).json({ error: "Not your vouch" }); return; }

  vouches.splice(idx, 1);
  saveVouches(vouches);
  res.json({ ok: true });
});

export default router;
