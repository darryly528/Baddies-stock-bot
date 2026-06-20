import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const BLOCKS_PATH = process.env["BLOCKS_PATH"] ?? path.resolve(process.cwd(), "../../blocks.json");

function loadBlocks(): Record<string, string[]> {
  try { return JSON.parse(fs.readFileSync(BLOCKS_PATH, "utf8")); } catch { return {}; }
}

function saveBlocks(b: Record<string, string[]>) {
  fs.writeFileSync(BLOCKS_PATH, JSON.stringify(b, null, 2), "utf8");
}

function requireSession(req: any, res: any, next: any) {
  if (!req.session?.discordUser) { res.status(401).json({ error: "Not authenticated" }); return; }
  next();
}

router.get("/blocks", requireSession, (req: any, res: any) => {
  const userId = req.session.discordUser.id;
  const blocks = loadBlocks();
  res.json({ blocked: blocks[userId] ?? [] });
});

router.post("/blocks/:userId", requireSession, (req: any, res: any) => {
  const myId = req.session.discordUser.id;
  const targetId = req.params.userId;
  if (myId === targetId) { res.status(400).json({ error: "Cannot block yourself." }); return; }
  const blocks = loadBlocks();
  if (!blocks[myId]) blocks[myId] = [];
  if (!blocks[myId].includes(targetId)) blocks[myId].push(targetId);
  saveBlocks(blocks);
  res.json({ ok: true });
});

router.delete("/blocks/:userId", requireSession, (req: any, res: any) => {
  const myId = req.session.discordUser.id;
  const targetId = req.params.userId;
  const blocks = loadBlocks();
  if (blocks[myId]) {
    blocks[myId] = blocks[myId].filter((id: string) => id !== targetId);
    saveBlocks(blocks);
  }
  res.json({ ok: true });
});

export { loadBlocks };
export default router;
