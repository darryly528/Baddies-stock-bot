import { Router } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getBotClient } from "../bot";

const router = Router();

const REPORTS_PATH = process.env["REPORTS_PATH"] ?? path.resolve(process.cwd(), "../../reports.json");

function loadReports(): object[] {
  try { return JSON.parse(fs.readFileSync(REPORTS_PATH, "utf8")); } catch { return []; }
}
function saveReports(r: object[]) {
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(r, null, 2), "utf8");
}

router.post("/report", (req: any, res: any) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { targetType, targetId, targetName, reason } = req.body as {
    targetType: string;
    targetId: string;
    targetName: string;
    reason: string;
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
            `**Reason:** ${reason.trim()}`
          ).catch(() => {});
        }
      }
    }
  } catch {}

  res.json({ ok: true });
});

export default router;
