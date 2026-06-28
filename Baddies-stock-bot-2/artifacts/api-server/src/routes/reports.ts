import { Router } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getBotClient } from "../bot";
import { getRole, hasMinRole } from "../permissions";

const router = Router();

const REPORTS_PATH = process.env["REPORTS_PATH"] ?? path.resolve(process.cwd(), "../../reports.json");

function loadReports(): object[] {
  try { return JSON.parse(fs.readFileSync(REPORTS_PATH, "utf8")); } catch { return []; }
}
function saveReports(r: object[]) {
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(r, null, 2), "utf8");
}

function requireMinRole(minRole: string) {
  return (req: any, res: any, next: any) => {
    const u = req.session?.discordUser;
    if (!u) { res.status(401).json({ error: "Not authenticated" }); return; }
    const role = getRole(u.id, u.username) ?? "none";
    if (!hasMinRole(role as any, minRole as any)) { res.status(403).json({ error: "Forbidden" }); return; }
    next();
  };
}

router.post("/report", (req: any, res: any) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { targetType, targetId, targetName, reason, context } = req.body as {
    targetType: string;
    targetId: string;
    targetName: string;
    reason: string;
    context?: string;
  };

  if (!reason?.trim()) { res.status(400).json({ error: "Reason required" }); return; }

  const report = {
    id: randomUUID(),
    reporterId: user.id,
    reporterName: user.username,
    targetType,
    targetId,
    targetName,
    reason: reason.trim(),
    context: context ?? null,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  const reports = loadReports();
  reports.push(report);
  saveReports(reports);

  try {
    const bot = getBotClient();
    if (bot) {
      const auditChannelId = process.env["AUDIT_CHANNEL_ID"];
      if (auditChannelId) {
        const channel = bot.channels.cache.get(auditChannelId) as any;
        if (channel?.send) {
          channel.send(
            `🚩 **New Report**\n` +
            `**Reporter:** ${user.username} (${user.id})\n` +
            `**Target:** ${targetName} (${targetType} · ${targetId})\n` +
            `**Reason:** ${reason.trim()}` +
            (context ? `\n**Context:** ${context.slice(0, 200)}` : "")
          ).catch(() => {});
        }
      }
    }
  } catch {}

  res.json({ ok: true });
});

router.get("/admin/reports", requireMinRole("mod"), (_req: any, res: any) => {
  const reports = loadReports() as any[];
  res.json(reports.slice().reverse());
});

router.delete("/admin/reports/:id", requireMinRole("mod"), (req: any, res: any) => {
  const { id } = req.params;
  const reports = loadReports() as any[];
  const idx = reports.findIndex((r: any) => r.id === id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  reports.splice(idx, 1);
  saveReports(reports);
  res.json({ ok: true });
});

export default router;
