import { Router, type Request, type Response } from "express";
import { loadListings } from "./listings";
import { getBotClient } from "../bot";
import {
  getRole, hasMinRole, getStaff,
  OWNER_USERNAME, type AnyRole,
} from "../permissions";
import type { Guild, GuildMember } from "discord.js";
import fs from "fs";
import path from "path";
import { sendAuditLog } from "../audit";

const MESSAGES_PATH = process.env["MESSAGES_PATH"] ?? path.resolve(process.cwd(), "../../messages.json");
function loadConversations() {
  try { return JSON.parse(fs.readFileSync(MESSAGES_PATH, "utf8")); } catch { return []; }
}

const router = Router();

export const suspendedUsers = new Set<string>();

// ── Permission helpers ────────────────────────────────────────────────────────

function sessionRole(req: Request): AnyRole | null {
  const u = req.session?.discordUser;
  if (!u) return null;
  return getRole(u.id, u.username);
}

function requireMinRole(minRole: AnyRole) {
  return (req: Request, res: Response, next: () => void) => {
    const role = sessionRole(req);
    if (!hasMinRole(role, minRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

// ── Guild helpers ─────────────────────────────────────────────────────────────

function getAllGuilds(): Guild[] {
  const bot = getBotClient();
  if (!bot) return [];
  return [...bot.guilds.cache.values()];
}

async function findMemberInAnyGuild(userId: string): Promise<[GuildMember, Guild] | null> {
  for (const guild of getAllGuilds()) {
    const m = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
    if (m) return [m, guild];
  }
  return null;
}

// ── Admin identity ────────────────────────────────────────────────────────────

router.get("/admin/me", (req, res) => {
  const u = req.session?.discordUser;
  if (!u) { res.json({ role: "none" }); return; }
  const role = getRole(u.id, u.username) ?? "none";
  res.json({ role });
});

// ── Store stats ───────────────────────────────────────────────────────────────

router.get("/admin/stats", requireMinRole("admin"), (_req, res) => {
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

router.get("/admin/listings", requireMinRole("admin"), (_req, res) => res.json(loadListings()));

router.delete("/admin/listings/:id", requireMinRole("admin"), (req, res) => {
  const { id } = req.params as { id: string };
  const actor = req.session!.discordUser!;
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  let listings = loadListings();
  const before = listings.length;
  listings = listings.filter((l) => l.id !== id);
  if (listings.length === before) { res.status(404).json({ error: "Listing not found" }); return; }
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
  void sendAuditLog({ action: "LISTING_DELETE", actorId: actor.id, actorUsername: actor.username, details: `Listing ID: ${id}` });
  res.json({ ok: true });
});

router.delete("/admin/listings", requireMinRole("admin"), (req, res) => {
  const actor = req.session!.discordUser!;
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  fs.writeFileSync(LISTINGS_PATH, "[]", "utf8");
  void sendAuditLog({ action: "LISTINGS_CLEAR", actorId: actor.id, actorUsername: actor.username, details: "All listings cleared" });
  res.json({ ok: true });
});

router.delete("/admin/listings/sold-out", requireMinRole("admin"), (req, res) => {
  const actor = req.session!.discordUser!;
  const LISTINGS_PATH = process.env["LISTINGS_PATH"] ?? path.resolve(process.cwd(), "../../listings.json");
  let listings = loadListings();
  listings = listings.map((l) => ({ ...l, items: l.items.filter((i) => !i.soldOut) })).filter((l) => l.items.length > 0);
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2), "utf8");
  void sendAuditLog({ action: "LISTINGS_PURGE_SOLDOUT", actorId: actor.id, actorUsername: actor.username, details: `${listings.length} listing(s) remaining after purge` });
  res.json({ ok: true, remaining: listings.length });
});

// ── Members list ──────────────────────────────────────────────────────────────

router.get("/admin/members", requireMinRole("mod"), async (_req, res) => {
  const guilds = getAllGuilds();
  const staff = getStaff();
  const staffMap = new Map(staff.map((s) => [s.userId, s]));

  if (guilds.length === 0) {
    // Return only staff members when bot is offline
    const list = staff.map((s) => ({
      id: s.userId, username: s.username, displayName: null,
      avatar: `https://cdn.discordapp.com/embed/avatars/0.png`,
      guilds: [], isOwner: false, isSuspended: suspendedUsers.has(s.userId),
      timedOutUntil: null, joinedAt: null,
      siteRole: s.role as AnyRole,
    }));
    res.json(list);
    return;
  }

  try {
    const merged = new Map<string, {
      id: string; username: string; displayName: string | null; avatar: string;
      guilds: { id: string; name: string; icon: string | null }[];
      isSuspended: boolean; isOwner: boolean; timedOutUntil: string | null;
      joinedAt: string | null; siteRole: AnyRole | null;
    }>();

    for (const guild of guilds) {
      for (const [, m] of guild.members.cache) {
        if (m.user.bot) continue;
        const avatarUrl = m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.id}/${m.user.avatar}.png?size=64`
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`;
        const guildEntry = { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 32 }) };
        const timedOut = m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now()
          ? new Date(m.communicationDisabledUntilTimestamp).toISOString() : null;
        const siteRole: AnyRole | null = m.user.username === OWNER_USERNAME ? "owner"
          : (staffMap.get(m.id)?.role as AnyRole) ?? null;

        if (merged.has(m.id)) {
          const ex = merged.get(m.id)!;
          ex.guilds.push(guildEntry);
          if (timedOut && !ex.timedOutUntil) ex.timedOutUntil = timedOut;
        } else {
          merged.set(m.id, {
            id: m.id, username: m.user.username,
            displayName: m.displayName !== m.user.username ? m.displayName : null,
            avatar: avatarUrl, guilds: [guildEntry],
            isSuspended: suspendedUsers.has(m.id),
            isOwner: m.user.username === OWNER_USERNAME,
            timedOutUntil: timedOut, joinedAt: m.joinedAt?.toISOString() ?? null,
            siteRole,
          });
        }
      }
    }

    for (const entry of merged.values()) {
      entry.isSuspended = suspendedUsers.has(entry.id);
    }

    const list = [...merged.values()].sort((a, b) => {
      const ra = a.siteRole ? ["owner","co-owner","admin","mod","verified_reseller"].indexOf(a.siteRole) : 99;
      const rb = b.siteRole ? ["owner","co-owner","admin","mod","verified_reseller"].indexOf(b.siteRole) : 99;
      if (ra !== rb) return ra - rb;
      return a.username.localeCompare(b.username);
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Member search ─────────────────────────────────────────────────────────────

router.get("/admin/members/search", requireMinRole("mod"), async (req, res) => {
  const q = ((req.query as Record<string, string>).q ?? "").trim();
  if (!q) { res.json([]); return; }
  const guilds = getAllGuilds();
  const staff = getStaff();
  const staffMap = new Map(staff.map((s) => [s.userId, s]));

  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }

  try {
    const merged = new Map<string, object>();
    await Promise.all(guilds.map(async (guild) => {
      const results = await guild.members.search({ query: q, limit: 25 }).catch(() => null);
      if (!results) return;
      for (const [, m] of results) {
        if (m.user.bot) continue;
        const avatarUrl = m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.id}/${m.user.avatar}.png?size=64`
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`;
        const timedOut = m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now()
          ? new Date(m.communicationDisabledUntilTimestamp).toISOString() : null;
        const siteRole: AnyRole | null = m.user.username === OWNER_USERNAME ? "owner"
          : (staffMap.get(m.id)?.role as AnyRole) ?? null;
        const guildEntry = { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 32 }) };

        if (merged.has(m.id)) {
          (merged.get(m.id) as Record<string, unknown[]>).guilds.push(guildEntry);
        } else {
          merged.set(m.id, {
            id: m.id, username: m.user.username,
            displayName: m.displayName !== m.user.username ? m.displayName : null,
            avatar: avatarUrl, guilds: [guildEntry],
            isSuspended: suspendedUsers.has(m.id),
            isOwner: m.user.username === OWNER_USERNAME,
            timedOutUntil: timedOut, joinedAt: m.joinedAt?.toISOString() ?? null,
            siteRole,
          });
        }
      }
    }));
    res.json([...merged.values()]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Discord user lookup by ID (for staff assignment) ─────────────────────────
// Uses the Discord REST API directly so it works even when the gateway bot
// client is not connected — only requires DISCORD_BOT_TOKEN to be set.

router.get("/admin/members/lookup", requireMinRole("mod"), async (req, res) => {
  const userId = ((req.query as Record<string, string>).userId ?? "").trim();
  if (!/^\d{15,21}$/.test(userId)) {
    res.status(400).json({ error: "Invalid Discord user ID format — must be a numeric snowflake ID" }); return;
  }

  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    res.status(503).json({ error: "No bot token configured — add DISCORD_BOT_TOKEN to enable lookup. You can still add staff manually." });
    return;
  }

  try {
    const apiRes = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${token}`, "User-Agent": "Baddies-Store/1.0" },
    });

    if (apiRes.status === 404) {
      res.status(404).json({ error: "User not found on Discord — verify the ID is correct" }); return;
    }
    if (!apiRes.ok) {
      const body = await apiRes.json().catch(() => ({})) as Record<string, unknown>;
      res.status(apiRes.status).json({ error: `Discord API error: ${(body["message"] as string | undefined) ?? apiRes.statusText}` }); return;
    }

    const user = await apiRes.json() as { id: string; username: string; avatar: string | null; global_name: string | null };
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`;

    // Check guild membership via the live bot client if available
    let inGuild = false;
    const bot = getBotClient();
    if (bot) {
      for (const guild of bot.guilds.cache.values()) {
        const m = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
        if (m) { inGuild = true; break; }
      }
    }

    res.json({ id: user.id, username: user.global_name ?? user.username, avatar: avatarUrl, inGuild });
  } catch (err) {
    res.status(500).json({ error: `Lookup failed: ${String(err)}` });
  }
});

// ── Guilds ────────────────────────────────────────────────────────────────────

router.get("/admin/guilds", requireMinRole("admin"), (_req, res) => {
  const guilds = getAllGuilds().map((g) => ({
    id: g.id, name: g.name, icon: g.iconURL({ size: 64 }), memberCount: g.memberCount,
  }));
  res.json(guilds);
});

// ── Ban ───────────────────────────────────────────────────────────────────────

router.post("/admin/members/:userId/ban", requireMinRole("admin"), async (req, res) => {
  const { userId } = req.params as { userId: string };
  const { reason, targetUsername } = req.body as { reason?: string; targetUsername?: string };
  const actor = req.session!.discordUser!;
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  const msg = reason ?? "Banned via admin panel";
  try {
    await Promise.all(guilds.map((g) => g.members.ban(userId, { reason: msg }).catch(() => null)));
    void sendAuditLog({ action: "BAN", actorId: actor.id, actorUsername: actor.username, targetId: userId, targetUsername, details: reason });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/admin/members/:userId/ban", requireMinRole("admin"), async (req, res) => {
  const { userId } = req.params as { userId: string };
  const actor = req.session!.discordUser!;
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await Promise.all(guilds.map((g) => g.bans.remove(userId, "Unbanned via admin panel").catch(() => null)));
    void sendAuditLog({ action: "UNBAN", actorId: actor.id, actorUsername: actor.username, targetId: userId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Timeout ───────────────────────────────────────────────────────────────────

router.post("/admin/members/:userId/timeout", requireMinRole("admin"), async (req, res) => {
  const { userId } = req.params as { userId: string };
  const { minutes, targetUsername } = req.body as { minutes: number; targetUsername?: string };
  const actor = req.session!.discordUser!;
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
    void sendAuditLog({ action: "TIMEOUT", actorId: actor.id, actorUsername: actor.username, targetId: userId, targetUsername, details: `${minutes} minute(s) — until ${until.toUTCString()}` });
    res.json({ ok: true, applied, until: until.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/admin/members/:userId/timeout", requireMinRole("admin"), async (req, res) => {
  const { userId } = req.params as { userId: string };
  const actor = req.session!.discordUser!;
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await Promise.all(guilds.map(async (guild) => {
      const m = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
      if (m) await m.timeout(null, "Timeout removed via admin panel");
    }));
    void sendAuditLog({ action: "TIMEOUT_REMOVE", actorId: actor.id, actorUsername: actor.username, targetId: userId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Suspend ───────────────────────────────────────────────────────────────────

router.post("/admin/members/:userId/suspend", requireMinRole("admin"), (req, res) => {
  const { userId } = req.params as { userId: string };
  const actor = req.session!.discordUser!;
  suspendedUsers.add(userId);
  void sendAuditLog({ action: "SUSPEND", actorId: actor.id, actorUsername: actor.username, targetId: userId });
  res.json({ ok: true });
});

router.delete("/admin/members/:userId/suspend", requireMinRole("admin"), (req, res) => {
  const { userId } = req.params as { userId: string };
  const actor = req.session!.discordUser!;
  suspendedUsers.delete(userId);
  void sendAuditLog({ action: "UNSUSPEND", actorId: actor.id, actorUsername: actor.username, targetId: userId });
  res.json({ ok: true });
});

// ── Kick ──────────────────────────────────────────────────────────────────────

router.post("/admin/members/:userId/kick", requireMinRole("co-owner"), async (req, res) => {
  const { userId } = req.params as { userId: string };
  const { targetUsername } = req.body as { targetUsername?: string };
  const actor = req.session!.discordUser!;
  const guilds = getAllGuilds();
  if (guilds.length === 0) { res.status(503).json({ error: "Bot offline" }); return; }
  try {
    await Promise.all(guilds.map((g) => g.members.kick(userId, "Kicked via admin panel").catch(() => null)));
    void sendAuditLog({ action: "KICK", actorId: actor.id, actorUsername: actor.username, targetId: userId, targetUsername });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── DM viewer — co-owner+ only ────────────────────────────────────────────────

router.get("/admin/dms/:userId", requireMinRole("co-owner"), (req, res) => {
  const { userId } = req.params as { userId: string };
  const all = loadConversations() as Record<string, unknown>[];
  const convs = all
    .filter((c) => c["buyerId"] === userId || c["sellerId"] === userId)
    .sort((a, b) => String(b["updatedAt"]).localeCompare(String(a["updatedAt"])));
  res.json(convs);
});

export default router;
