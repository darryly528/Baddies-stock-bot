import { Router, type Request, type Response } from "express";
import { loadListings } from "./listings";
import { getBotClient } from "../bot";
import type { Guild, GuildMember } from "discord.js";
import fs from "fs";
import path from "path";

const MESSAGES_PATH = process.env["MESSAGES_PATH"] ?? path.resolve(process.cwd(), "../../messages.json");
function loadConversations() {
  try { return JSON.parse(fs.readFileSync(MESSAGES_PATH, "utf8")); } catch { return []; }
}

const router = Router();

const OWNER_USERNAME = "disgust_tf";
const VERIFIED_SELLER_ROLE_ID = process.env["LISTING_ROLE_ID"] ?? "";
const MOD_ROLE_ID_ENV = process.env["MOD_ROLE_ID"] ?? "";

export const suspendedUsers = new Set<string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAllGuilds(): Guild[] {
  const bot = getBotClient();
  if (!bot) return [];
  return [...bot.guilds.cache.values()];
}

/** Fetch a member from the first guild that has them. Returns [member, guild]. */
async function findMemberInAnyGuild(userId: string): Promise<[GuildMember, Guild] | null> {
  for (const guild of getAllGuilds()) {
    const m = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
    if (m) return [m, guild];
  }
  return null;
}

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
  for (const guild of getAllGuilds()) {
    const member = await guild.members.fetch({ user: user.id, force: false }).catch(() => null);
    if (member?.roles.cache.has(MOD_ROLE_ID_ENV)) return true;
  }
  return false;
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  isAdminUser(req).then((ok) => {
    if (ok) next();
    else res.status(403).json({ error: "Forbidden" });
  });
}

// ── Store stats ───────────────────────────────────────────────────────────────
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

// ── Listings management ───────────────────────────────────────────────────────
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

// ── Admin identity ────────────────────────────────────────────────────────────
router.get("/admin/me", async (req, res) => {
  const user = req.session?.discordUser;
  if (!user) { res.json({ role: "none" }); return; }
  if (user.username === OWNER_USERNAME) { res.json({ role: "owner" }); return; }
  const ok = await isAdminUser(req);
  res.json({ role: ok ? "admin" : "none" });
});

// ── Members list — aggregated across ALL guilds ───────────────────────────────
router.get("/admin/members", requireAdmin, async (_req, res) => {
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline or not in any guild" }); return; }

  try {
    // Use the bot's in-memory cache — works without the privileged GuildMembers intent.
    // The cache is populated from slash command interactions, message events, and
    // individual member fetches (e.g. when a listing is created).
    const merged = new Map<string, {
      id: string;
      username: string;
      displayName: string | null;
      avatar: string;
      guilds: { id: string; name: string; icon: string | null }[];
      isVerifiedSeller: boolean;
      isMod: boolean;
      isSuspended: boolean;
      isOwner: boolean;
      timedOutUntil: string | null;
      joinedAt: string | null;
    }>();

    for (const guild of guilds) {
      for (const [, m] of guild.members.cache) {
        if (m.user.bot) continue;

        const avatarUrl = m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.id}/${m.user.avatar}.png?size=64`
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`;

        const guildEntry = {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ size: 32 }),
        };

        const isVerified = VERIFIED_SELLER_ROLE_ID ? m.roles.cache.has(VERIFIED_SELLER_ROLE_ID) : false;
        const isMod = MOD_ROLE_ID_ENV ? m.roles.cache.has(MOD_ROLE_ID_ENV) : false;
        const timedOut = m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now()
          ? new Date(m.communicationDisabledUntilTimestamp).toISOString()
          : null;

        if (merged.has(m.id)) {
          const existing = merged.get(m.id)!;
          existing.guilds.push(guildEntry);
          existing.isVerifiedSeller = existing.isVerifiedSeller || isVerified;
          existing.isMod = existing.isMod || isMod;
          if (timedOut && !existing.timedOutUntil) existing.timedOutUntil = timedOut;
        } else {
          merged.set(m.id, {
            id: m.id,
            username: m.user.username,
            displayName: m.displayName !== m.user.username ? m.displayName : null,
            avatar: avatarUrl,
            guilds: [guildEntry],
            isVerifiedSeller: isVerified,
            isMod,
            isSuspended: suspendedUsers.has(m.id),
            isOwner: m.user.username === OWNER_USERNAME,
            timedOutUntil: timedOut,
            joinedAt: m.joinedAt?.toISOString() ?? null,
          });
        }
      }
    }

    for (const entry of merged.values()) {
      entry.isSuspended = suspendedUsers.has(entry.id);
    }

    const list = [...merged.values()].sort((a, b) => {
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

// ── Member search — uses Discord's search API, no privileged intent needed ───
router.get("/admin/members/search", requireAdmin, async (req, res) => {
  const q = ((req.query as Record<string, string>).q ?? "").trim();
  if (!q) { res.json([]); return; }

  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }

  try {
    const merged = new Map<string, object>();

    await Promise.all(
      guilds.map(async (guild) => {
        const results = await guild.members.search({ query: q, limit: 25 }).catch(() => null);
        if (!results) return;
        for (const [, m] of results) {
          if (m.user.bot) continue;
          const avatarUrl = m.user.avatar
            ? `https://cdn.discordapp.com/avatars/${m.id}/${m.user.avatar}.png?size=64`
            : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`;
          const guildEntry = { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 32 }) };
          const isVerified = VERIFIED_SELLER_ROLE_ID ? m.roles.cache.has(VERIFIED_SELLER_ROLE_ID) : false;
          const isMod = MOD_ROLE_ID_ENV ? m.roles.cache.has(MOD_ROLE_ID_ENV) : false;
          const timedOut = m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now()
            ? new Date(m.communicationDisabledUntilTimestamp).toISOString()
            : null;
          if (merged.has(m.id)) {
            const existing = merged.get(m.id) as Record<string, unknown>;
            (existing.guilds as unknown[]).push(guildEntry);
            existing.isVerifiedSeller = existing.isVerifiedSeller || isVerified;
            existing.isMod = existing.isMod || isMod;
          } else {
            merged.set(m.id, {
              id: m.id,
              username: m.user.username,
              displayName: m.displayName !== m.user.username ? m.displayName : null,
              avatar: avatarUrl,
              guilds: [guildEntry],
              isVerifiedSeller: isVerified,
              isMod,
              isSuspended: suspendedUsers.has(m.id),
              isOwner: m.user.username === OWNER_USERNAME,
              timedOutUntil: timedOut,
              joinedAt: m.joinedAt?.toISOString() ?? null,
            });
          }
        }
      })
    );

    const list = [...merged.values()].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      if (a.isOwner) return -1;
      if (b.isOwner) return 1;
      if (a.isMod !== b.isMod) return a.isMod ? -1 : 1;
      return (a.username as string).localeCompare(b.username as string);
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Guilds list (for info display) ───────────────────────────────────────────
router.get("/admin/guilds", requireAdmin, (_req, res) => {
  const guilds = getAllGuilds().map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL({ size: 64 }),
    memberCount: g.memberCount,
  }));
  res.json(guilds);
});

// ── Ban — from every guild ────────────────────────────────────────────────────
router.post("/admin/members/:userId/ban", requireOwner, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const { reason } = req.body as { reason?: string };
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  const msg = reason ?? "Banned by owner via admin panel";
  try {
    await Promise.all(guilds.map((g) => g.members.ban(userId, { reason: msg }).catch(() => null)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/admin/members/:userId/ban", requireOwner, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await Promise.all(guilds.map((g) => g.bans.remove(userId, "Unbanned by owner via admin panel").catch(() => null)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Timeout — in every guild they're a member of ──────────────────────────────
router.post("/admin/members/:userId/timeout", requireAdmin, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const { minutes } = req.body as { minutes: number };
  if (!minutes || minutes <= 0) { res.status(400).json({ error: "Invalid duration" }); return; }
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  const until = new Date(Date.now() + minutes * 60 * 1000);
  try {
    let applied = 0;
    await Promise.all(guilds.map(async (guild) => {
      const m = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
      if (m) { await m.timeout(until, "Timed out via admin panel"); applied++; }
    }));
    res.json({ ok: true, applied, until: until.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/admin/members/:userId/timeout", requireAdmin, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await Promise.all(guilds.map(async (guild) => {
      const m = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
      if (m) await m.timeout(null, "Timeout removed via admin panel");
    }));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Suspend (site-level) ──────────────────────────────────────────────────────
router.post("/admin/members/:userId/suspend", requireAdmin, (req, res) => {
  suspendedUsers.add((req.params as { userId: string }).userId);
  res.json({ ok: true });
});

router.delete("/admin/members/:userId/suspend", requireAdmin, (req, res) => {
  suspendedUsers.delete((req.params as { userId: string }).userId);
  res.json({ ok: true });
});

// ── Roles — apply in every guild where the role exists ───────────────────────
router.post("/admin/members/:userId/role/:role", requireAdmin, async (req, res) => {
  const { userId, role } = req.params as { userId: string; role: string };
  const { add } = req.body as { add: boolean };

  const roleId = role === "verified_seller" ? VERIFIED_SELLER_ROLE_ID : role === "mod" ? MOD_ROLE_ID_ENV : null;
  if (!roleId) { res.status(400).json({ error: `Role '${role}' not configured` }); return; }

  if (role === "mod" && req.session?.discordUser?.username !== OWNER_USERNAME) {
    res.status(403).json({ error: "Only owner can assign mod role" });
    return;
  }

  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }

  try {
    let applied = 0;
    await Promise.all(guilds.map(async (guild) => {
      if (!guild.roles.cache.has(roleId)) return; // role doesn't exist in this guild
      const m = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
      if (!m) return;
      if (add) await m.roles.add(roleId, "Role assigned via admin panel");
      else await m.roles.remove(roleId, "Role removed via admin panel");
      applied++;
    }));
    res.json({ ok: true, applied });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Admin: view any user's conversations ─────────────────────────────────────
router.get("/admin/dms/:userId", requireAdmin, (req, res) => {
  const { userId } = req.params as { userId: string };
  const all = loadConversations() as any[];
  const convs = all
    .filter((c: any) => c.buyerId === userId || c.sellerId === userId)
    .sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt));
  res.json(convs);
});

// ── Kick — from every guild ───────────────────────────────────────────────────
router.post("/admin/members/:userId/kick", requireOwner, async (req, res) => {
  const { userId } = req.params as { userId: string };
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await Promise.all(guilds.map((g) => g.members.kick(userId, "Kicked via admin panel").catch(() => null)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
