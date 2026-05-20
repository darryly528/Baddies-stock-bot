import { Router } from "express";

const router = Router();

const SESSION_TTL_MS = 90_000;
const activeUsers = new Map<string, number>();

function pruneStale() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [key, ts] of activeUsers) {
    if (ts < cutoff) activeUsers.delete(key);
  }
}

function getKey(req: any): string {
  const sessionId = req.sessionID as string | undefined;
  if (sessionId) return `s:${sessionId}`;
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip ?? "unknown";
  return `ip:${ip}`;
}

router.post("/presence/ping", (req, res) => {
  pruneStale();
  const key = getKey(req);
  activeUsers.set(key, Date.now());
  res.json({ count: activeUsers.size });
});

router.get("/presence", (_req, res) => {
  pruneStale();
  res.json({ count: activeUsers.size });
});

export default router;
