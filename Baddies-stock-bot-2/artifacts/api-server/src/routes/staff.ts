import { Router, type Request, type Response } from "express";
import {
  getStaff, setStaffMember, removeStaffMember,
  getBanRequests, addBanRequest, updateBanRequestStatus,
  getWarnings, addWarning, removeWarning,
  getRole, hasMinRole, OWNER_USERNAME,
  type StaffRole, type AnyRole,
} from "../permissions";
import { getBotClient } from "../bot";
import type { Guild } from "discord.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function getAllGuilds(): Guild[] {
  const bot = getBotClient();
  if (!bot) return [];
  return [...bot.guilds.cache.values()];
}

// ── Staff CRUD (owner manages everything, co-owner can manage up to admin) ────

router.get("/admin/staff", requireMinRole("admin"), (_req, res) => {
  res.json(getStaff());
});

router.post("/admin/staff", requireMinRole("admin"), (req: Request, res: Response) => {
  const callerRole = sessionRole(req)!;
  const { userId, username, role } = req.body as { userId: string; username: string; role: StaffRole };

  if (!userId || !username || !role) {
    res.status(400).json({ error: "userId, username, and role are required" });
    return;
  }

  const validRoles: StaffRole[] = ["co-owner", "admin", "mod", "verified_reseller"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    return;
  }

  // Only owner can assign co-owner or admin; admin+ can assign mod/verified
  const roleRanks: Record<StaffRole, number> = { "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0 };
  const callerRanks: Record<AnyRole, number> = { "owner": 4, "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0 };

  if (roleRanks[role] >= callerRanks[callerRole]) {
    res.status(403).json({ error: "You cannot assign a role equal to or above your own" });
    return;
  }

  const callerId = req.session!.discordUser!.id;
  setStaffMember(userId, role, callerId, username);
  res.json({ ok: true, userId, role, username });
});

router.patch("/admin/staff/:userId/role", requireMinRole("admin"), (req: Request, res: Response) => {
  const callerRole = sessionRole(req)!;
  const { userId } = req.params as { userId: string };
  const { role } = req.body as { role: StaffRole };

  if (!role) { res.status(400).json({ error: "role is required" }); return; }

  const roleRanks: Record<StaffRole, number> = { "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0 };
  const callerRanks: Record<AnyRole, number> = { "owner": 4, "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0 };

  if (roleRanks[role] >= callerRanks[callerRole]) {
    res.status(403).json({ error: "You cannot assign a role equal to or above your own" });
    return;
  }

  const staff = getStaff();
  const target = staff.find((s) => s.userId === userId);
  if (!target) { res.status(404).json({ error: "Staff member not found" }); return; }

  const callerId = req.session!.discordUser!.id;
  setStaffMember(userId, role, callerId, target.username);
  res.json({ ok: true, userId, role });
});

router.delete("/admin/staff/:userId", requireMinRole("admin"), (req: Request, res: Response) => {
  const callerRole = sessionRole(req)!;
  const { userId } = req.params as { userId: string };

  const staff = getStaff();
  const target = staff.find((s) => s.userId === userId);
  if (!target) { res.status(404).json({ error: "Staff member not found" }); return; }

  const roleRanks: Record<StaffRole, number> = { "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0 };
  const callerRanks: Record<AnyRole, number> = { "owner": 4, "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0 };

  if (roleRanks[target.role] >= callerRanks[callerRole]) {
    res.status(403).json({ error: "You cannot remove someone with a rank equal to or above your own" });
    return;
  }

  removeStaffMember(userId);
  res.json({ ok: true });
});

// ── Ban requests ──────────────────────────────────────────────────────────────

router.get("/admin/ban-requests", requireMinRole("admin"), (_req, res) => {
  res.json(getBanRequests().filter((r) => r.status === "pending"));
});

router.post("/admin/members/:userId/ban-request", requireMinRole("mod"), (req: Request, res: Response) => {
  const caller = req.session!.discordUser!;
  const callerRole = sessionRole(req)!;
  const { userId } = req.params as { userId: string };
  const { targetUsername, reason } = req.body as { targetUsername?: string; reason?: string };

  if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

  // Admins+ can ban directly — only mods need the approval flow
  if (hasMinRole(callerRole, "admin")) {
    res.status(400).json({ error: "You have permission to ban directly. Use the ban endpoint instead." });
    return;
  }

  const req2 = addBanRequest({
    requestedBy: caller.id,
    requestedByUsername: caller.username,
    targetUserId: userId,
    targetUsername: targetUsername ?? userId,
    reason: reason.trim(),
  });

  res.json({ ok: true, request: req2 });
});

router.post("/admin/ban-requests/:reqId/approve", requireMinRole("admin"), async (req: Request, res: Response) => {
  const { reqId } = req.params as { reqId: string };
  const request = updateBanRequestStatus(reqId, "approved");
  if (!request) { res.status(404).json({ error: "Ban request not found" }); return; }

  const guilds = getAllGuilds();
  if (guilds.length > 0) {
    await Promise.all(guilds.map((g) => g.members.ban(request.targetUserId, { reason: `Approved ban: ${request.reason}` }).catch(() => null)));
  }

  res.json({ ok: true });
});

router.delete("/admin/ban-requests/:reqId", requireMinRole("admin"), (req: Request, res: Response) => {
  const { reqId } = req.params as { reqId: string };
  const request = updateBanRequestStatus(reqId, "rejected");
  if (!request) { res.status(404).json({ error: "Ban request not found" }); return; }
  res.json({ ok: true });
});

// ── Warnings ──────────────────────────────────────────────────────────────────

router.get("/admin/members/:userId/warnings", requireMinRole("mod"), (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  res.json(getWarnings(userId));
});

router.post("/admin/members/:userId/warn", requireMinRole("mod"), (req: Request, res: Response) => {
  const caller = req.session!.discordUser!;
  const { userId } = req.params as { userId: string };
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

  const warning = addWarning(userId, {
    reason: reason.trim(),
    issuedBy: caller.id,
    issuedByUsername: caller.username,
  });
  res.json({ ok: true, warning });
});

router.delete("/admin/members/:userId/warnings/:warningId", requireMinRole("admin"), (req: Request, res: Response) => {
  const { userId, warningId } = req.params as { userId: string; warningId: string };
  const removed = removeWarning(userId, warningId);
  if (!removed) { res.status(404).json({ error: "Warning not found" }); return; }
  res.json({ ok: true });
});

export default router;
