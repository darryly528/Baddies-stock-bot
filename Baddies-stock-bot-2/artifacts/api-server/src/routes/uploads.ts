import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { getBotClient } from "../bot";
import { createPendingImage, type PendingImage } from "../imageReview";

const UPLOADS_DIR = process.env["UPLOADS_DIR"] ?? path.resolve(process.cwd(), "../../uploads");
const AVATAR_DIR = path.join(UPLOADS_DIR, "avatars");
const BANNER_DIR = path.join(UPLOADS_DIR, "banners");
const BG_DIR = path.join(UPLOADS_DIR, "backgrounds");
const DM_DIR = path.join(UPLOADS_DIR, "dms");
const SHOP_DIR = path.join(UPLOADS_DIR, "shops");
[UPLOADS_DIR, AVATAR_DIR, BANNER_DIR, BG_DIR, DM_DIR, SHOP_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const PROFILES_PATH = process.env["PROFILES_PATH"] ?? path.resolve(process.cwd(), "../../profiles.json");
function loadProfiles(): Record<string, Record<string, unknown>> {
  try { return JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8")); } catch { return {}; }
}
function saveProfiles(p: Record<string, Record<string, unknown>>): void {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(p, null, 2), "utf8");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const IMAGE_REVIEW_CHANNEL_ID = process.env["IMAGE_REVIEW_CHANNEL_ID"] ?? "1517999979224895549";

async function postImageForReview(entry: PendingImage, buffer: Buffer, mimeType: string, aiFlag?: string): Promise<void> {
  try {
    const bot = getBotClient();
    if (!bot) return;
    const channel = await bot.channels.fetch(IMAGE_REVIEW_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const typeLabel = entry.type === "dm" ? "DM Image" : entry.type === "avatar" ? "Profile Avatar" : "Profile Banner";
    const ext = mimeType.split("/")[1] ?? "jpg";
    const attachName = `image.${ext}`;
    const attachment = new AttachmentBuilder(Buffer.from(buffer), { name: attachName });

    const embed = new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle(`🖼️ Image Review — ${typeLabel}`)
      .addFields(
        { name: "Uploaded by", value: `<@${entry.uploadedBy}> (${entry.uploadedByName})`, inline: true },
        ...(aiFlag ? [{ name: "AI flag", value: aiFlag.slice(0, 512), inline: false }] : []),
      )
      .setImage(`attachment://${attachName}`)
      .setFooter({ text: `ID: ${entry.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`imgapprove:${entry.id}`).setLabel("✅ Approve").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`imgreject:${entry.id}`).setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
    );

    await (channel as import("discord.js").TextChannel).send({ embeds: [embed], components: [row], files: [attachment] });
  } catch (err) {
    console.error("[imageReview] Failed to post for review:", err);
  }
}

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
    return { safe: false, reason: "Moderation check failed — image sent for manual review." };
  }
}

const router = Router();

// Serve static uploads under /api/uploads/
router.use("/uploads", (req, res, next) => {
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

  const rawType = req.query["type"] as string;
  const imageType = rawType === "banner" ? "banner" : rawType === "profileBg" ? "profileBg" : "avatar";

  // AI moderation
  const { safe, reason } = await moderateImage(req.file.buffer, req.file.mimetype);

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  const ext = extMap[req.file.mimetype] ?? "jpg";
  const dir = imageType === "banner" ? BANNER_DIR : imageType === "profileBg" ? BG_DIR : AVATAR_DIR;
  const urlField = imageType === "banner" ? "bannerImageUrl" : imageType === "profileBg" ? "profileBgUrl" : "customAvatarUrl";

  if (!safe) {
    // Send to mod review instead of auto-blocking
    const filename = `${user.id}_pending_${Date.now()}.${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const url = imageType === "profileBg" ? `/api/uploads/backgrounds/${filename}` : `/api/uploads/${imageType}s/${filename}`;
    const pending = createPendingImage({
      type: imageType as "avatar" | "banner",
      filePath,
      url,
      uploadedBy: user.id,
      uploadedByName: user.username,
      profileField: urlField as "customAvatarUrl" | "bannerImageUrl",
      aiFlag: reason,
    });

    await postImageForReview(pending, req.file.buffer, req.file.mimetype, reason);

    res.json({ ok: true, pending: true, pendingId: pending.id });
    return;
  }

  // Safe — save normally
  const filename = `${user.id}.${ext}`;
  const filePath = path.join(dir, filename);

  // Remove any existing image for this user (other extensions)
  const variants = ["jpg", "png", "webp", "gif"].filter((e) => e !== ext);
  for (const v of variants) {
    const old = path.join(dir, `${user.id}.${v}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  fs.writeFileSync(filePath, req.file.buffer);

  const url = imageType === "profileBg" ? `/api/uploads/backgrounds/${filename}` : `/api/uploads/${imageType}s/${filename}`;

  const profiles = loadProfiles();
  profiles[user.id] = { ...(profiles[user.id] ?? {}), [urlField]: url };
  saveProfiles(profiles);

  res.json({ ok: true, url });
});

// ── Upload user personal site background (client-side theme, any logged-in user) ──

const SITE_BG_DIR = path.join(UPLOADS_DIR, "site-bgs");
if (!fs.existsSync(SITE_BG_DIR)) fs.mkdirSync(SITE_BG_DIR, { recursive: true });

router.post("/uploads/user-site-bg", upload.single("file"), async (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!req.file) { res.status(400).json({ error: "No image uploaded or invalid file type (JPEG/PNG/WebP/GIF only)" }); return; }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  const ext = extMap[req.file.mimetype] ?? "jpg";
  const filename = `${user.id}.${ext}`;
  const filePath = path.join(SITE_BG_DIR, filename);

  const variants = ["jpg", "png", "webp", "gif"].filter((e) => e !== ext);
  for (const v of variants) {
    const old = path.join(SITE_BG_DIR, `${user.id}.${v}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  fs.writeFileSync(filePath, req.file.buffer);
  res.json({ ok: true, url: `/api/uploads/site-bgs/${filename}` });
});

// ── Upload DM image ───────────────────────────────────────────────────────────

router.post("/uploads/dm-image", upload.single("image"), async (req: Request, res: Response) => {
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

  const url = `/api/uploads/dms/${filename}`;

  // Always send DM images for mod review
  const pending = createPendingImage({
    type: "dm",
    filePath,
    url,
    uploadedBy: user.id,
    uploadedByName: user.username,
  });

  await postImageForReview(pending, req.file.buffer, req.file.mimetype);

  res.json({ ok: true, url, pendingId: pending.id, pending: true });
});

// ── Upload shop image (banner or logo) ───────────────────────────────────────

router.post("/uploads/shop-image", upload.single("image"), async (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!req.file) { res.status(400).json({ error: "No image uploaded or invalid file type (JPEG/PNG/WebP/GIF only)" }); return; }

  const rawType = req.query["type"] as string;
  const imageType = rawType === "logo" ? "logo" : "banner";

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  const ext = extMap[req.file.mimetype] ?? "jpg";
  const filename = `${user.id}_${imageType}_${Date.now()}.${ext}`;
  const filePath = path.join(SHOP_DIR, filename);
  fs.writeFileSync(filePath, req.file.buffer);

  const url = `/api/uploads/shops/${filename}`;
  res.json({ ok: true, url });
});

// ── Upload listing frame image ────────────────────────────────────────────────

const FRAME_DIR = path.join(UPLOADS_DIR, "frames");
if (!fs.existsSync(FRAME_DIR)) fs.mkdirSync(FRAME_DIR, { recursive: true });

router.post("/uploads/listing-frame", upload.single("image"), async (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!req.file) { res.status(400).json({ error: "No image uploaded or invalid file type (JPEG/PNG/WebP/GIF only)" }); return; }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  const ext = extMap[req.file.mimetype] ?? "jpg";
  const filename = `${user.id}_${Date.now()}.${ext}`;
  const filePath = path.join(FRAME_DIR, filename);
  fs.writeFileSync(filePath, req.file.buffer);

  res.json({ ok: true, url: `/api/uploads/frames/${filename}` });
});

// ── Remove profile image ──────────────────────────────────────────────────────

router.delete("/uploads/profile-image", (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const rawType2 = req.query["type"] as string;
  const imageType = rawType2 === "banner" ? "banner" : rawType2 === "profileBg" ? "profileBg" : "avatar";
  const dir = imageType === "banner" ? BANNER_DIR : imageType === "profileBg" ? BG_DIR : AVATAR_DIR;
  const urlField = imageType === "banner" ? "bannerImageUrl" : imageType === "profileBg" ? "profileBgUrl" : "customAvatarUrl";

  for (const ext of ["jpg", "png", "webp", "gif"]) {
    for (const variant of [`${user.id}.${ext}`, `${user.id}_pending_*.${ext}`]) {
      const old = path.join(dir, `${user.id}.${ext}`);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
  }

  const profiles = loadProfiles();
  if (profiles[user.id]) {
    profiles[user.id] = { ...profiles[user.id], [urlField]: null };
    saveProfiles(profiles);
  }

  res.json({ ok: true });
});

export default router;
