import { Router, type Request, type Response, type NextFunction } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { getRole, hasMinRole } from "../permissions";

const THEME_PATH = path.resolve(process.env["THEME_PATH"] ?? path.resolve(process.cwd(), "../../theme.json"));
const UPLOADS_DIR = path.resolve(process.env["UPLOADS_DIR"] ?? path.resolve(process.cwd(), "../../uploads"));
const THEME_DIR = path.join(UPLOADS_DIR, "theme");

if (!fs.existsSync(THEME_DIR)) fs.mkdirSync(THEME_DIR, { recursive: true });

export const DEFAULT_THEME = {
  primaryColor: "#ff0080",
  secondaryColor: "#7c3aed",
  bgUrl: null as string | null,
  bgOverlay: 0.6,
  bgBlur: false,
};

export function loadTheme(): typeof DEFAULT_THEME {
  try { return { ...DEFAULT_THEME, ...JSON.parse(fs.readFileSync(THEME_PATH, "utf8")) }; }
  catch { return { ...DEFAULT_THEME }; }
}

function saveTheme(theme: object) {
  fs.writeFileSync(THEME_PATH, JSON.stringify(theme, null, 2), "utf8");
}

function sessionRole(req: Request) {
  const u = req.session?.discordUser;
  if (!u) return null;
  return getRole(u.id, u.username);
}

function requireMinRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = sessionRole(req);
    if (!hasMinRole(role, minRole as Parameters<typeof hasMinRole>[1])) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

router.get("/theme", (_req, res) => {
  res.json(loadTheme());
});

router.post("/theme", requireMinRole("admin"), (req, res) => {
  const current = loadTheme();
  const { primaryColor, secondaryColor, bgUrl, bgOverlay, bgBlur } = req.body as Record<string, string | number | boolean | null>;
  const updated = {
    ...current,
    ...(primaryColor !== undefined && { primaryColor }),
    ...(secondaryColor !== undefined && { secondaryColor }),
    ...(bgUrl !== undefined && { bgUrl }),
    ...(bgOverlay !== undefined && { bgOverlay: Number(bgOverlay) }),
    ...(bgBlur !== undefined && { bgBlur: Boolean(bgBlur) }),
  };
  saveTheme(updated);
  res.json({ ok: true, theme: updated });
});

router.post("/uploads/theme-bg", requireMinRole("admin"), upload.single("file"), (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const ext = req.file.mimetype === "image/gif" ? "gif"
    : req.file.mimetype === "image/png" ? "png"
    : req.file.mimetype === "image/webp" ? "webp"
    : "jpg";
  const filename = `site-bg-${Date.now()}.${ext}`;
  const filePath = path.join(THEME_DIR, filename);
  fs.writeFileSync(filePath, req.file.buffer);
  res.json({ ok: true, url: `/api/uploads/theme/${filename}` });
});

router.get("/uploads/theme/:filename", (req, res, next) => {
  const filename = path.basename(req.params["filename"] ?? "");
  const filePath = path.join(THEME_DIR, filename);
  if (!fs.existsSync(filePath)) { next(); return; }
  res.sendFile(filePath, (err) => { if (err) next(); });
});

export default router;
