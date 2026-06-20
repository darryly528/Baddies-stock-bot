import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { getRole } from "../permissions";
import { loadListings } from "./listings";

const PROFILES_PATH = process.env["PROFILES_PATH"] ?? path.resolve(process.cwd(), "../../profiles.json");

export type FeaturedItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  rarity: string | null;
  value?: number;
};

type ProfileData = {
  tagline: string;
  bio: string;
  accentColor: string;
  bannerStyle: string;
  cardStyle: string;
  tradePreferences: string;
  featuredItems: FeaturedItem[];
  username: string;
  avatarHash: string | null;
  updatedAt: string;
  customAvatarUrl: string | null;
  bannerImageUrl: string | null;
};

type ProfilesStore = Record<string, ProfileData>;

export function loadProfiles(): ProfilesStore {
  try { return JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8")); } catch { return {}; }
}
function saveProfiles(p: ProfilesStore): void {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(p, null, 2), "utf8");
}

const VALID_BANNER_STYLES = ["default", "sunset", "ocean", "forest", "midnight", "fire", "aurora", "gold"];
const VALID_CARD_STYLES = ["default", "neon", "minimal", "frost", "dark", "gradient"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const router = Router();

// ── Own profile ───────────────────────────────────────────────────────────────

router.get("/profile", (req: Request, res: Response) => {
  const u = req.session?.discordUser;
  if (!u) { res.status(401).json({ error: "Not authenticated" }); return; }
  const p = loadProfiles()[u.id] ?? {};
  res.json({
    userId: u.id, username: u.username, avatarHash: u.avatar ?? null,
    tagline: p.tagline ?? "", bio: p.bio ?? "",
    accentColor: p.accentColor ?? "#ff0080", bannerStyle: p.bannerStyle ?? "default",
    cardStyle: p.cardStyle ?? "default",
    tradePreferences: p.tradePreferences ?? "", featuredItems: p.featuredItems ?? [],
    siteRole: getRole(u.id, u.username), updatedAt: p.updatedAt ?? null,
    customAvatarUrl: p.customAvatarUrl ?? null,
    bannerImageUrl: p.bannerImageUrl ?? null,
  });
});

router.patch("/profile", (req: Request, res: Response) => {
  const u = req.session?.discordUser;
  if (!u) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { tagline, bio, accentColor, bannerStyle, cardStyle, tradePreferences, featuredItems } = req.body as Partial<ProfileData & { featuredItems: FeaturedItem[] }>;
  const profiles = loadProfiles();
  const ex = profiles[u.id] ?? {} as Partial<ProfileData>;

  profiles[u.id] = {
    username: u.username, avatarHash: u.avatar ?? null,
    tagline:          typeof tagline === "string"          ? tagline.slice(0, 80)          : (ex.tagline ?? ""),
    bio:              typeof bio === "string"               ? bio.slice(0, 500)             : (ex.bio ?? ""),
    accentColor:      typeof accentColor === "string" && HEX_RE.test(accentColor) ? accentColor : (ex.accentColor ?? "#ff0080"),
    bannerStyle:      typeof bannerStyle === "string" && VALID_BANNER_STYLES.includes(bannerStyle) ? bannerStyle : (ex.bannerStyle ?? "default"),
    cardStyle:        typeof cardStyle === "string" && VALID_CARD_STYLES.includes(cardStyle) ? cardStyle : (ex.cardStyle ?? "default"),
    tradePreferences: typeof tradePreferences === "string" ? tradePreferences.slice(0, 200) : (ex.tradePreferences ?? ""),
    featuredItems:    Array.isArray(featuredItems) ? (featuredItems as FeaturedItem[]).slice(0, 6) : (ex.featuredItems ?? []),
    updatedAt: new Date().toISOString(),
    customAvatarUrl: ex.customAvatarUrl ?? null,
    bannerImageUrl: ex.bannerImageUrl ?? null,
  };

  saveProfiles(profiles);
  res.json({ ok: true });
});

// ── Public profile ────────────────────────────────────────────────────────────

router.get("/profiles/:userId", (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const profiles = loadProfiles();
  const p = profiles[userId];
  const listings = loadListings();
  const userListings = listings.filter((l) => l.discordUserId === userId);
  const siteRole = getRole(userId, p?.username);

  if (!p) {
    const src = userListings[0];
    if (!src) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json({
      userId, username: src.seller, avatarHash: src.discordAvatar,
      tagline: "", bio: "", accentColor: "#ff0080", bannerStyle: "default",
      tradePreferences: "", featuredItems: [], siteRole,
      listingCount: userListings.length, activeListings: userListings, updatedAt: null,
    });
    return;
  }

  res.json({
    userId, username: p.username, avatarHash: p.avatarHash,
    tagline: p.tagline, bio: p.bio, accentColor: p.accentColor,
    bannerStyle: p.bannerStyle, cardStyle: p.cardStyle ?? "default",
    tradePreferences: p.tradePreferences,
    featuredItems: p.featuredItems, siteRole,
    listingCount: userListings.length, activeListings: userListings, updatedAt: p.updatedAt,
    customAvatarUrl: p.customAvatarUrl ?? null,
    bannerImageUrl: p.bannerImageUrl ?? null,
  });
});

export default router;
