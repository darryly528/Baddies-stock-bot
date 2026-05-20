import { Router, type Request, type Response } from "express";
import { loadListings } from "./listings";
import { getBotClient } from "../bot";
import fs from "fs";
import path from "path";

const router = Router();

const OWNER_USERNAME = "disgust_tf";
const VERIFIED_SELLER_ROLE_ID = process.env["LISTING_ROLE_ID"] ?? "";
const MOD_ROLE_ID_ENV = process.env["MOD_ROLE_ID"] ?? "";

export const suspendedUsers = new Set<string>();

function requireOwner(req: Request, res: Response, next: () => void) {
  const user = req.session?.discordUser;
  if (!user || user.username !== OWNER_USERNAME) {
    res.status(403).json({ error: "Forbidden — owner only" });
    return;
  }
  next();
}

async function isAdminUser(req: Request): Promise<boolean> {
  const user = req.session?.discordUser;
  if (!user) return false;
  if (user.username === OWNER_USERNAME) return true;
  if (!MOD_ROLE_ID_ENV) return false;
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) return false;
  const member = await guild.members.fetch({ user: user.id, force: false }).catch(() => null);
  return !!member && member.roles.cache.has(MOD_ROLE_ID_ENV);
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  isAdminUser(req).then((ok) => {
    if (ok) next();
    else res.status(403).json({ error: "Forbidden" });
  });
}

// ── Store stats ─────────────────────────────────────────────────────────────
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

// ── Listings management ──────────────────────────────────────────────────────
router.get("/admin/listings", requireAdmin, (_req, res) => res.json(loadListings()));

router.delete("/admin/listings/:id", requireAdmin, (req, res) => {
  const { id } = req.params as { id: string };
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  let listings = loadListings();
  const before = listings.length;
  listings = listings.filter((l) => l.id !== id);
  if (listings.length === before) { res.status(404).json({ error: "Listing not found" }); return; }
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
  res.json({ ok: true });
});

router.delete("/admin/listings", requireAdmin, (_req, res) => {
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  fs.writeFileSync(LISTINGS_PATH, "[]", "utf8");
  res.json({ ok: true });
});

router.delete("/admin/listings/sold-out", requireAdmin, (_req, res) => {
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  let listings = loadListings();
  listings = listings.map((l) => ({ ...l, items: l.items.filter((i) => !i.soldOut) })).filter((l) => l.items.length > 0);
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
  res.json({ ok: true, remaining: listings.length });
});

// ── Admin identity ───────────────────────────────────────────────────────────
router.get("/admin/me", async (req, res) => {
  const user = req.session?.discordUser;
  if (!user) { res.json({ role: "none" }); return; }
  if (user.username === OWNER_USERNAME) { res.json({ role: "owner" }); return; }
  const ok = await isAdminUser(req);
  res.json({ role: ok ? "admin" : "none" });
});

// ── Members list ─────────────────────────────────────────────────────────────
router.get("/admin/members", requireAdmin, async (_req, res) => {
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) { res.status(503).json({ error: "Bot offline or not in a guild" }); return; }

  try {
    const members = await guild.members.fetch();
    const list = members
      .filter((m) => !m.user.bot)
      .map((m) => ({
        id: m.id,
        username: m.user.username,
        displayName: m.displayName !== m.user.username ? m.displayName : null,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.id}/${m.user.avatar}.png?size=64`
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`,
        roles: m.roles.cache.filter((r) => r.id !== guild.id).map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
        joinedAt: m.joinedAt?.toISOString() ?? null,
        isVerifiedSeller: VERIFIED_SELLER_ROLE_ID ? m.roles.cache.has(VERIFIED_SELLER_ROLE_ID) : false,
        isMod: MOD_ROLE_ID_ENV ? m.roles.cache.has(MOD_ROLE_ID_ENV) : false,
        isSuspended: suspendedUsers.has(m.id),
        isOwner: m.user.username === OWNER_USERNAME,
        timedOutUntil: m.communicationDisabledUntilTimestamp
          ? new Date(m.communicationDisabledUntilTimestamp).toISOString()
          : null,
      }))
      .sort((a, b) => {
        if (a.isOwner) return -1;
        if (b.isOwner) return 1;
        if (a.isMod !== b.isMod) return a.isMod ? -1 : 1;
        if (a.isVerifiedSeller !== b.isVerifiedSeller) return a.isVerifiedSeller ? -1 : 1;
        return a.username.localeCompare(b.username);
      });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Ban ───────────────────────────────────────────────────────────────────────
router.post("/admin/members/:userId/ban", requireOwner, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const { reason } = req.body as { reason?: string };
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await guild.members.ban(userId, { reason: reason ?? "Banned by owner via admin panel" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/admin/members/:userId/ban", requireOwner, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await guild.bans.remove(userId, "Unbanned by owner via admin panel");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Timeout ───────────────────────────────────────────────────────────────────
router.post("/admin/members/:userId/timeout", requireAdmin, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const { minutes } = req.body as { minutes: number };
  if (!minutes || minutes <= 0) { res.status(400).json({ error: "Invalid duration" }); return; }
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    const member = await guild.members.fetch(userId);
    const until = new Date(Date.now() + minutes * 60 * 1000);
    await member.timeout(until, "Timed out via admin panel");
    res.json({ ok: true, until: until.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/admin/members/:userId/timeout", requireAdmin, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    const member = await guild.members.fetch(userId);
    await member.timeout(null, "Timeout removed via admin panel");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Suspend (site-level) ──────────────────────────────────────────────────────
router.post("/admin/members/:userId/suspend", requireAdmin, (req, res) => {
  const { userId } = req.params as { userId: string };
  suspendedUsers.add(userId);
  res.json({ ok: true });
});

router.delete("/admin/members/:userId/suspend", requireAdmin, (req, res) => {
  const { userId } = req.params as { userId: string };
  suspendedUsers.delete(userId);
  res.json({ ok: true });
});

// ── Roles ─────────────────────────────────────────────────────────────────────
router.post("/admin/members/:userId/role/:role", requireAdmin, async (req, res) => {
  const { userId, role } = req.params as { userId: string; role: string };
  const { add } = req.body as { add: boolean };

  const roleId = role === "verified_seller" ? VERIFIED_SELLER_ROLE_ID : role === "mod" ? MOD_ROLE_ID_ENV : null;
  if (!roleId) { res.status(400).json({ error: `Role '${role}' not configured` }); return; }

  if (role === "mod") {
    const reqUser = req.session?.discordUser;
    if (reqUser?.username !== OWNER_USERNAME) {
      res.status(403).json({ error: "Only owner can assign mod role" });
      return;
    }
  }

  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    const member = await guild.members.fetch(userId);
    if (add) await member.roles.add(roleId, "Role assigned via admin panel");
    else await member.roles.remove(roleId, "Role removed via admin panel");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Kick ──────────────────────────────────────────────────────────────────────
router.post("/admin/members/:userId/kick", requireOwner, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first();
  if (!guild) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await guild.members.kick(userId, "Kicked via admin panel");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
