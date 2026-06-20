import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

const UPLOADS_DIR = path.resolve(process.cwd(), "../../uploads");
const AVATAR_DIR = path.join(UPLOADS_DIR, "avatars");
const BANNER_DIR = path.join(UPLOADS_DIR, "banners");
const DM_DIR = path.join(UPLOADS_DIR, "dms");
[UPLOADS_DIR, AVATAR_DIR, BANNER_DIR, DM_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const PROFILES_PATH = process.env["PROFILES_PATH"] ?? path.resolve(process.cwd(), "../../profiles.json");
function loadProfiles(): Record<string, Record<string, unknown>> {
  try { return JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8")); } catch { return {}; }
}
function saveProfiles(p: Record<string, Record<string, unknown>>): void {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(p, null, 2), "utf8");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

async function moderateImage(buffer: Buffer, mimeType: string): Promise<{ safe: boolean; reason: string }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.warn("[moderation] OPENAI_API_KEY not set — image moderation skipped");
    return { safe: true, reason: "" };
  }

  const client = new OpenAI({ apiKey });
  const base64 = buffer.toString("base64");

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a content moderation system for a teen-friendly Roblox trading marketplace (ages 13-18). Analyze this profile image and determine if it is appropriate for this audience. Respond with JSON only (no markdown): {"safe":true/false,"reason":"brief explanation if unsafe"}

UNSAFE if it contains: nudity or sexual content, graphic violence or gore, drug/alcohol promotion, hate symbols or extremist content, personal info (phone numbers, addresses), or anything clearly inappropriate for teens.
SAFE if it is: profile selfies (clothed), game screenshots, Roblox avatars, logos, artwork, abstract designs, anime, memes without adult content, animals, nature.`,
          },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "low" } },
        ],
      }],
      max_tokens: 80,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? '{"safe":false,"reason":"No response"}';
    const result = JSON.parse(text) as { safe?: boolean; reason?: string };
    return { safe: !!result.safe, reason: result.reason ?? "" };
  } catch (err) {
    console.error("[moderation] Error calling OpenAI:", err);
    return { safe: false, reason: "Moderation check failed. Please try again." };
  }
}

const router = Router();

// Serve static uploads under /api/uploads/
router.use("/uploads", (req, res, next) => {
  // Only allow GET for uploads
  if (req.method !== "GET") { next(); return; }
  const filePath = path.join(UPLOADS_DIR, req.path);
  if (!filePath.startsWith(UPLOADS_DIR)) { res.status(403).end(); return; }
  res.sendFile(filePath, (err) => { if (err) next(); });
});

// ── Upload profile image ────────────────────────────────────────────────────────

router.post("/uploads/profile-image", upload.single("image"), async (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!req.file) { res.status(400).json({ error: "No image uploaded or invalid file type (JPEG/PNG/WebP/GIF only)" }); return; }

  const imageType = (req.query["type"] as string) === "banner" ? "banner" : "avatar";

  // AI moderation
  const { safe, reason } = await moderateImage(req.file.buffer, req.file.mimetype);
  if (!safe) {
    res.status(422).json({ error: `Image rejected by content moderation: ${reason || "Not appropriate for teens."}` });
    return;
  }

  // Determine extension
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  const ext = extMap[req.file.mimetype] ?? "jpg";
  const filename = `${user.id}.${ext}`;
  const dir = imageType === "banner" ? BANNER_DIR : AVATAR_DIR;
  const filePath = path.join(dir, filename);

  // Remove any existing image for this user (other extensions)
  const variants = ["jpg", "png", "webp", "gif"].filter((e) => e !== ext);
  for (const v of variants) {
    const old = path.join(dir, `${user.id}.${v}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  fs.writeFileSync(filePath, req.file.buffer);

  const urlField = imageType === "banner" ? "bannerImageUrl" : "customAvatarUrl";
  const url = `/api/uploads/${imageType}s/${filename}`;

  // Update profile record
  const profiles = loadProfiles();
  profiles[user.id] = { ...(profiles[user.id] ?? {}), [urlField]: url };
  saveProfiles(profiles);

  res.json({ ok: true, url });
});

// ── Upload DM image ───────────────────────────────────────────────────────────

router.post("/uploads/dm-image", upload.single("image"), (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!req.file) { res.status(400).json({ error: "No image uploaded or invalid file type" }); return; }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  const ext = extMap[req.file.mimetype] ?? "jpg";
  const filename = `${user.id}_${Date.now()}.${ext}`;
  const filePath = path.join(DM_DIR, filename);
  fs.writeFileSync(filePath, req.file.buffer);

  res.json({ ok: true, url: `/api/uploads/dms/${filename}` });
});

// ── Remove profile image ──────────────────────────────────────────────────────

router.delete("/uploads/profile-image", (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const imageType = (req.query["type"] as string) === "banner" ? "banner" : "avatar";
  const dir = imageType === "banner" ? BANNER_DIR : AVATAR_DIR;
  const urlField = imageType === "banner" ? "bannerImageUrl" : "customAvatarUrl";

  // Remove all extensions
  for (const ext of ["jpg", "png", "webp", "gif"]) {
    const old = path.join(dir, `${user.id}.${ext}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  const profiles = loadProfiles();
  if (profiles[user.id]) {
    profiles[user.id] = { ...profiles[user.id], [urlField]: null };
    saveProfiles(profiles);
  }

  res.json({ ok: true });
});

export default router;
