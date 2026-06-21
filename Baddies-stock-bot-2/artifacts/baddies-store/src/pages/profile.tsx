import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Check, X, Plus, Trash2, Search, Loader2, Box,
  ArrowLeft, ShoppingBag, LayoutList, Sparkles, BadgeCheck,
  ExternalLink, AlertTriangle, Upload, Heart, Flag, Crop as CropIcon, Star, AtSign, Palette,
} from "lucide-react";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { ReportModal, type ReportTarget } from "@/components/report-modal";
import { useAuth } from "@/contexts/auth-context";
import {
  useProfile, useOwnProfile, useUpdateProfile,
  BANNER_STYLES, ACCENT_COLORS, getBannerClass, CARD_STYLES, EDGE_EFFECTS,
  type BannerStyle, type CardStyle, type EdgeEffect, type FeaturedItem, type Profile,
} from "@/hooks/use-profile";
import { ROLE_LABEL, ROLE_COLOR, type AnyRole } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";
import { applyThemeColors } from "@/lib/theme-colors";

// ── Crop modal ────────────────────────────────────────────────────────────────

function getCroppedBlob(image: HTMLImageElement, pixelCrop: PixelCrop, mimeType: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.floor(pixelCrop.width * scaleX);
  canvas.height = Math.floor(pixelCrop.height * scaleY);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    Math.floor(pixelCrop.x * scaleX),
    Math.floor(pixelCrop.y * scaleY),
    Math.floor(pixelCrop.width * scaleX),
    Math.floor(pixelCrop.height * scaleY),
    0, 0, canvas.width, canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Canvas is empty")), mimeType, 0.92);
  });
}

function CropModal({
  src,
  mimeType,
  aspect,
  label,
  onConfirm,
  onCancel,
}: {
  src: string;
  mimeType: string;
  aspect: number;
  label: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [processing, setProcessing] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
      width, height,
    );
    setCrop(initial);
  }, [aspect]);

  async function handleConfirm() {
    if (!completedCrop || !imgRef.current) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop, mimeType);
      onConfirm(blob);
    } catch {
      setProcessing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 14 }}
        transition={{ type: "spring", duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#18181b] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <CropIcon className="w-4 h-4 text-primary" />
          <span className="font-bold text-white text-sm flex-1">Crop {label}</span>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center bg-black/40 max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            circularCrop={aspect === 1}
            className="max-w-full max-h-full"
          >
            <img
              ref={imgRef}
              src={src}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-w-full max-h-[55vh] object-contain"
            />
          </ReactCrop>
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {aspect === 1 ? "Square crop — drag to reposition" : "Wide crop — drag to reposition"}
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground bg-white/5 hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!completedCrop || processing}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/80 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CropIcon className="w-3.5 h-3.5" />}
              {processing ? "Processing…" : "Crop & Upload"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Listing card (mini) ────────────────────────────────────────────────────────

type Listing = {
  id: string; seller: string; discordUserId: string | null; discordAvatar: string | null;
  items: { name: string; imageUrl: string | null; quantity: number | string; price?: string; soldOut: boolean }[];
  listingType?: "fixed" | "auction"; auctionEndsAt?: string;
  isVerifiedReseller?: boolean;
};

function MiniListingCard({ listing }: { listing: Listing }) {
  const active = listing.items.filter((i) => !i.soldOut);
  const first = active[0] ?? listing.items[0];
  return (
    <Link href="/listings" className="glass-panel border border-white/10 rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-colors group">
      {first?.imageUrl ? (
        <img src={first.imageUrl} alt={first.name} className="w-10 h-10 object-contain rounded-lg bg-black/40 p-0.5 shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center shrink-0">
          <Box className="w-5 h-5 text-muted-foreground/30" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate group-hover:text-primary transition-colors">
          {listing.items.map((i) => i.name).join(", ")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {active.length} active · {listing.listingType === "auction" ? "🔨 Auction" : "Buy"}
        </p>
      </div>
      {first?.price && (
        <span className="text-xs font-bold text-green-400 shrink-0">${first.price}</span>
      )}
    </Link>
  );
}

// ── Catalog search for featured items ────────────────────────────────────────

type CatalogItem = { id: string; name: string; imageUrl: string | null; rarity: string | null; value?: number };

function CatalogSearch({
  onAdd, existingIds,
}: {
  onAdd: (item: FeaturedItem) => void;
  existingIds: string[];
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [], isFetching } = useQuery<CatalogItem[]>({
    queryKey: ["catalog-search-profile", debounced],
    queryFn: () =>
      fetch(`/api/catalog?search=${encodeURIComponent(debounced)}&limit=8`, { credentials: "include" })
        .then((r) => r.json()),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search catalog items…"
          className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition"
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary animate-spin" />}
      </div>
      {debounced.length >= 2 && results.length === 0 && !isFetching && (
        <p className="text-xs text-muted-foreground text-center py-2">No items found.</p>
      )}
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {results.map((item) => {
            const already = existingIds.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => !already && onAdd({ id: item.id, name: item.name, imageUrl: item.imageUrl ?? null, rarity: item.rarity ?? null, value: item.value })}
                disabled={already}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors",
                  already
                    ? "opacity-40 cursor-not-allowed bg-white/5"
                    : "bg-white/5 hover:bg-white/10 hover:border-primary/30 border border-transparent"
                )}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-contain rounded-lg bg-black/40 p-0.5 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center shrink-0">
                    <Box className="w-4 h-4 text-muted-foreground/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.rarity ?? "—"}{item.value ? ` · $${item.value.toLocaleString()}` : ""}</p>
                </div>
                {already ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Card preview helper ───────────────────────────────────────────────────────

function accentRgbProfile(hex: string) {
  const h = (hex || "#ff0080").replace("#", "").padEnd(6, "0");
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

function MockCard({ cardStyle, accentColor, edgeEffect, username, previewImage }: {
  cardStyle: string;
  accentColor: string;
  edgeEffect: string;
  username: string;
  previewImage?: string | null;
}) {
  const a = /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#ff0080";
  const rgb = accentRgbProfile(a);
  const rgba = (o: number) => `rgba(${rgb},${o})`;

  const baseStyle: React.CSSProperties = (() => {
    switch (cardStyle) {
      case "neon":     return { border: `1px solid ${rgba(0.45)}`, boxShadow: `0 0 16px ${rgba(0.2)}` };
      case "minimal":  return { border: "1px solid rgba(255,255,255,0.05)" };
      case "frost":    return { border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.03)" };
      case "dark":     return { border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.5)" };
      case "gradient": return { border: "1px solid rgba(255,255,255,0.1)" };
      default:         return { border: "1px solid rgba(255,255,255,0.1)" };
    }
  })();

  const edgeStyle: React.CSSProperties = (() => {
    if (edgeEffect === "glow") return { boxShadow: `${baseStyle.boxShadow ? baseStyle.boxShadow + ", " : ""}0 0 24px ${rgba(0.45)}` };
    if (edgeEffect === "pulse") return {};
    return {};
  })();

  const mergedStyle: React.CSSProperties = { ...baseStyle, ...edgeStyle };

  const pulseAnim = edgeEffect === "pulse"
    ? { boxShadow: [`0 0 0px ${rgba(0)}`, `0 0 28px ${rgba(0.55)}`, `0 0 0px ${rgba(0)}`] as string[] }
    : undefined;

  return (
    <motion.div
      className="relative flex flex-col overflow-hidden rounded-2xl w-44"
      style={{ background: "rgba(10,10,18,0.85)", ...mergedStyle }}
      animate={pulseAnim}
      transition={edgeEffect === "pulse" ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : undefined}
    >
      {cardStyle === "gradient" && (
        <div className="absolute top-0 inset-x-0 h-0.5 z-10" style={{ background: a }} />
      )}

      {/* Shimmer overlay */}
      {edgeEffect === "shimmer" && (
        <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden rounded-2xl">
          <motion.div
            className="absolute top-0 bottom-0 w-12 -skew-x-12"
            style={{ background: `linear-gradient(90deg, transparent, ${rgba(0.22)}, transparent)` }}
            animate={{ x: ["-100%", "500%"] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "linear", repeatDelay: 1.2 }}
          />
        </div>
      )}

      {/* Corner accents */}
      {edgeEffect === "corner" && (
        <>
          <div className="absolute top-0 left-0 w-2 h-2 z-40 pointer-events-none" style={{ background: a, boxShadow: `0 0 8px ${rgba(0.9)}, 0 0 16px ${rgba(0.5)}`, borderRadius: "2px 0 2px 0" }} />
          <div className="absolute top-0 right-0 w-2 h-2 z-40 pointer-events-none" style={{ background: a, boxShadow: `0 0 8px ${rgba(0.9)}, 0 0 16px ${rgba(0.5)}`, borderRadius: "0 2px 0 2px" }} />
          <div className="absolute bottom-0 left-0 w-2 h-2 z-40 pointer-events-none" style={{ background: a, boxShadow: `0 0 8px ${rgba(0.9)}, 0 0 16px ${rgba(0.5)}`, borderRadius: "0 2px 0 2px" }} />
          <div className="absolute bottom-0 right-0 w-2 h-2 z-40 pointer-events-none" style={{ background: a, boxShadow: `0 0 8px ${rgba(0.9)}, 0 0 16px ${rgba(0.5)}`, borderRadius: "2px 0 2px 0" }} />
        </>
      )}

      {/* Image area */}
      <div className="relative h-24 w-full flex items-center justify-center bg-black/40 overflow-hidden">
        {previewImage ? (
          <img src={previewImage} alt="Preview" className="w-full h-full object-contain p-1 drop-shadow-xl" />
        ) : (
          <Box className="w-8 h-8 text-white/15" />
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider backdrop-blur-md bg-white/10 border border-white/20 text-white/80">Sword</span>
        </div>
        <div className="absolute top-1.5 right-1.5">
          <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-black/60 text-white/70 border border-white/10">Qty: 1</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-2.5 flex flex-col gap-1.5">
        <p className="font-bold text-xs text-white leading-tight">Dragon Blade</p>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
            style={{ background: rgba(0.2), color: a }}>
            {username[0]?.toUpperCase() ?? "?"}
          </div>
          <span className="text-[10px] text-white/40 truncate">{username}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs font-bold text-green-400">$12.99</p>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-md bg-white/5 border border-white/15 flex items-center justify-center">
              <Plus className="w-2.5 h-2.5 text-white/50" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Profile editor panel ──────────────────────────────────────────────────────

function ProfileEditor({
  profile,
  onClose,
  initialTab,
}: {
  profile: Profile;
  onClose: () => void;
  initialTab?: "about" | "theme" | "cards" | "items" | "site";
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"about" | "theme" | "cards" | "items" | "site">(initialTab ?? "about");
  const [tagline, setTagline] = useState(profile.tagline);
  const [bio, setBio] = useState(profile.bio);
  const [tradePrefs, setTradePrefs] = useState(profile.tradePreferences);
  const [accentColor, setAccentColor] = useState(profile.accentColor);
  const [bannerStyle, setBannerStyle] = useState<BannerStyle>(profile.bannerStyle);
  const [cardStyle, setCardStyle] = useState<CardStyle>((profile.cardStyle as CardStyle) ?? "default");
  const [edgeEffect, setEdgeEffect] = useState<EdgeEffect>((profile.edgeEffect as EdgeEffect) ?? "none");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const previewImageRef = useRef<HTMLInputElement>(null);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>(profile.featuredItems);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(profile.customAvatarUrl ?? null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(profile.bannerImageUrl ?? null);
  const [currentBgUrl, setCurrentBgUrl] = useState<string | null>(profile.profileBgUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const [cropState, setCropState] = useState<{
    type: "avatar" | "banner";
    src: string;
    mimeType: string;
  } | null>(null);

  const update = useUpdateProfile();

  function openCropOrUpload(type: "avatar" | "banner", file: File) {
    if (file.type === "image/gif") {
      handleImageUpload(type, file);
      return;
    }
    const src = URL.createObjectURL(file);
    setCropState({ type, src, mimeType: file.type || "image/jpeg" });
  }

  async function handleCropConfirm(blob: Blob) {
    if (!cropState) return;
    const { type, src, mimeType } = cropState;
    URL.revokeObjectURL(src);
    setCropState(null);
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const file = new File([blob], `cropped.${ext}`, { type: mimeType });
    await handleImageUpload(type, file);
  }

  function handleCropCancel() {
    if (cropState) URL.revokeObjectURL(cropState.src);
    setCropState(null);
  }

  async function handleImageUpload(type: "avatar" | "banner" | "profileBg", file: File) {
    const setUploading = type === "avatar" ? setAvatarUploading : type === "banner" ? setBannerUploading : setBgUploading;
    const setUploadError = type === "avatar" ? setAvatarUploadError : type === "banner" ? setBannerUploadError : setBgUploadError;
    const setUrl = type === "avatar" ? setCurrentAvatarUrl : type === "banner" ? setCurrentBannerUrl : setCurrentBgUrl;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const r = await fetch(`/api/uploads/profile-image?type=${type}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await r.json() as { ok?: boolean; url?: string; error?: string; pending?: boolean };
      if (!r.ok) throw new Error(data.error ?? "Upload failed");
      if (data.pending) {
        setUploadError("✅ Image submitted for mod review — it will appear once approved.");
      } else {
        setUrl(data.url ?? null);
        qc.invalidateQueries({ queryKey: ["profile-own"] });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage(type: "avatar" | "banner" | "profileBg") {
    const setUrl = type === "avatar" ? setCurrentAvatarUrl : type === "banner" ? setCurrentBannerUrl : setCurrentBgUrl;
    try {
      const r = await fetch(`/api/uploads/profile-image?type=${type}`, { method: "DELETE", credentials: "include" });
      if (r.ok) { setUrl(null); qc.invalidateQueries({ queryKey: ["profile-own"] }); }
    } catch { /* ignore */ }
  }

  // ── Site theme (client-side only, localStorage) ──
  const SITE_THEME_KEY = `user-theme-${profile.userId}`;
  type UserSiteTheme = { primary: string; secondary: string; bgUrl: string | null; bgOverlay: number; bgBlur: boolean };
  const DEFAULT_SITE_THEME: UserSiteTheme = { primary: "#ff0080", secondary: "#7c3aed", bgUrl: null, bgOverlay: 0.6, bgBlur: false };
  const [siteTheme, setSiteTheme] = useState<UserSiteTheme>(DEFAULT_SITE_THEME);
  const [siteUploading, setSiteUploading] = useState(false);
  const [siteUploadError, setSiteUploadError] = useState<string | null>(null);
  const [siteSaved, setSiteSaved] = useState(false);
  const siteFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SITE_THEME_KEY);
      if (stored) setSiteTheme(JSON.parse(stored) as UserSiteTheme);
    } catch { /* ignore */ }
  }, [SITE_THEME_KEY]);

  async function handleSiteBgUpload(file: File) {
    setSiteUploading(true); setSiteUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/uploads/user-site-bg", { method: "POST", body: fd, credentials: "include" });
      const data = await r.json() as { ok?: boolean; url?: string; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Upload failed");
      setSiteTheme((p) => ({ ...p, bgUrl: data.url! }));
    } catch (err) { setSiteUploadError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setSiteUploading(false); }
  }

  function handleSiteSave() {
    localStorage.setItem(SITE_THEME_KEY, JSON.stringify(siteTheme));
    applyThemeColors(siteTheme.primary, siteTheme.secondary);
    window.dispatchEvent(new Event("user-theme-changed"));
    setSiteSaved(true);
    setTimeout(() => setSiteSaved(false), 2500);
  }

  function handleSiteReset() {
    localStorage.removeItem(SITE_THEME_KEY);
    setSiteTheme(DEFAULT_SITE_THEME);
    window.dispatchEvent(new Event("user-theme-changed"));
  }

  async function handleSave() {
    setError(null);
    try {
      await update.mutateAsync({ tagline, bio, accentColor, bannerStyle, cardStyle, edgeEffect, tradePreferences: tradePrefs, featuredItems });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  const bannerClass = getBannerClass(bannerStyle);

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.22 }}
      className="glass-panel border border-white/15 rounded-2xl overflow-hidden flex flex-col"
      style={{ maxHeight: "calc(100vh - 120px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5 shrink-0">
        <Pencil className="w-4 h-4 text-primary" />
        <span className="font-bold text-white text-sm flex-1">Edit Profile</span>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mini preview */}
      {currentBannerUrl ? (
        <div className="h-10 w-full opacity-60 bg-cover bg-center" style={{ backgroundImage: `url(${currentBannerUrl})` }} />
      ) : (
        <div className={cn("h-10 w-full opacity-60", bannerClass)} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-2 bg-black/30 border-b border-white/10 shrink-0">
        {(["about", "theme", "cards", "items", "site"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors",
              tab === t ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white")}>
            {t === "items" ? `Items (${featuredItems.length}/6)` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === "about" && (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                <span>Tagline</span>
                <span className={tagline.length > 70 ? "text-orange-400" : ""}>{tagline.length}/80</span>
              </label>
              <input
                value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 80))}
                placeholder="Your short tagline…"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                <span>Bio</span>
                <span className={bio.length > 450 ? "text-orange-400" : ""}>{bio.length}/500</span>
              </label>
              <textarea
                value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="Tell people about yourself, your trade history, what you sell…"
                rows={4}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                <span>Trade Preferences</span>
                <span className={tradePrefs.length > 180 ? "text-orange-400" : ""}>{tradePrefs.length}/200</span>
              </label>
              <textarea
                value={tradePrefs} onChange={(e) => setTradePrefs(e.target.value.slice(0, 200))}
                placeholder="e.g. Looking to buy limiteds, selling for PayPal / Cash App…"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition resize-none"
              />
            </div>
          </>
        )}

        {tab === "theme" && (
          <>
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Banner Style</label>
              <div className="grid grid-cols-4 gap-2">
                {BANNER_STYLES.map((s) => {
                  const cls = getBannerClass(s.key);
                  return (
                    <button key={s.key} onClick={() => setBannerStyle(s.key)}
                      className={cn("h-10 rounded-xl transition-all relative overflow-hidden", cls,
                        bannerStyle === s.key ? "ring-2 ring-white scale-105" : "opacity-70 hover:opacity-100")}>
                      {bannerStyle === s.key && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      )}
                      <span className="sr-only">{s.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BANNER_STYLES.map((s) => (
                  <p key={s.key} className={cn("text-center text-[10px] transition-colors",
                    bannerStyle === s.key ? "text-white font-bold" : "text-muted-foreground")}>{s.label}</p>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Accent Color</label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button key={c.hex} onClick={() => setAccentColor(c.hex)} title={c.label}
                    className={cn("w-8 h-8 rounded-full border-2 transition-all",
                      accentColor === c.hex ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: c.hex }}>
                    <span className="sr-only">{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Custom hex:</label>
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setAccentColor(v);
                  }}
                  maxLength={7}
                  className="w-28 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-primary/50 transition"
                />
                <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: accentColor }} />
              </div>
            </div>

            {/* Custom Avatar Upload */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Custom Avatar Image</label>
              <div className="flex items-center gap-3">
                {currentAvatarUrl ? (
                  <img src={currentAvatarUrl} alt="Custom avatar" className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/40 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">None</div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50">
                    {avatarUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {avatarUploading ? "Uploading…" : "Upload"}
                  </button>
                  {currentAvatarUrl && (
                    <button type="button" onClick={() => handleRemoveImage("avatar")}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {avatarUploadError && <p className="text-xs text-red-400">{avatarUploadError}</p>}
              <p className="text-[11px] text-muted-foreground/70">Max 20MB · JPEG, PNG, WebP, GIF · GIFs upload as-is, others can be cropped</p>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) openCropOrUpload("avatar", f); e.target.value = ""; }} />
            </div>

            {/* Custom Banner Upload */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Custom Banner Image</label>
              <div className="flex items-center gap-3">
                {currentBannerUrl ? (
                  <div className="w-28 h-10 rounded-lg bg-cover bg-center ring-1 ring-white/20 shrink-0" style={{ backgroundImage: `url(${currentBannerUrl})` }} />
                ) : (
                  <div className="w-28 h-10 rounded-lg bg-white/10 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">None</div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50">
                    {bannerUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {bannerUploading ? "Uploading…" : "Upload"}
                  </button>
                  {currentBannerUrl && (
                    <button type="button" onClick={() => handleRemoveImage("banner")}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {bannerUploadError && <p className="text-xs text-red-400">{bannerUploadError}</p>}
              <p className="text-[11px] text-muted-foreground/70">Max 20MB · JPEG, PNG, WebP, GIF · GIFs upload as-is, others can be cropped</p>
              <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) openCropOrUpload("banner", f); e.target.value = ""; }} />
            </div>

            {/* Full Page Background Upload */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Full Page Background</label>
              <p className="text-[11px] text-muted-foreground/70 -mt-1">Fills your entire profile page. GIFs are supported.</p>
              <div className="flex items-center gap-3">
                {currentBgUrl ? (
                  <div className="w-28 h-14 rounded-lg bg-cover bg-center ring-1 ring-white/20 shrink-0 overflow-hidden">
                    <img src={currentBgUrl} alt="Profile background" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-28 h-14 rounded-lg bg-white/10 border border-dashed border-white/15 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">No BG</div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => bgInputRef.current?.click()} disabled={bgUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50">
                    {bgUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {bgUploading ? "Uploading…" : "Upload"}
                  </button>
                  {currentBgUrl && (
                    <button type="button" onClick={() => handleRemoveImage("profileBg")}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {bgUploadError && <p className="text-xs text-red-400">{bgUploadError}</p>}
              <p className="text-[11px] text-muted-foreground/70">Max 20MB · JPEG, PNG, WebP, GIF · Uploaded as-is (no crop)</p>
              <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload("profileBg", f); e.target.value = ""; }} />
            </div>
          </>
        )}

        {tab === "cards" && (
          <>
            {/* Live preview */}
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Live Preview</label>
              <p className="text-[11px] text-muted-foreground mt-0.5">How your listing cards appear in the store.</p>
            </div>
            <div className="flex flex-col items-center gap-2 py-1">
              <MockCard cardStyle={cardStyle} accentColor={accentColor} edgeEffect={edgeEffect} username={profile.username} previewImage={previewImage} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => previewImageRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white/5 border-white/15 text-muted-foreground hover:text-white hover:border-white/30 transition-all"
                >
                  <Upload className="w-3 h-3" />
                  {previewImage ? "Change image" : "Upload image"}
                </button>
                {previewImage && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(null)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white/5 border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all"
                  >
                    <X className="w-3 h-3" />
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={previewImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setPreviewImage(ev.target?.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Card style picker */}
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Card Style</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CARD_STYLES.map((s) => {
                const h = accentColor.replace("#", "");
                const r = parseInt(h.slice(0, 2) || "ff", 16);
                const g = parseInt(h.slice(2, 4) || "00", 16);
                const b = parseInt(h.slice(4, 6) || "80", 16);
                const ra = (a: number) => `rgba(${r},${g},${b},${a})`;
                const thumbStyle = (() => {
                  switch (s.key) {
                    case "neon":     return { border: `1px solid ${ra(0.6)}`, boxShadow: `0 0 10px ${ra(0.35)}` };
                    case "minimal":  return { border: "1px solid rgba(255,255,255,0.05)" };
                    case "frost":    return { border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)" };
                    case "dark":     return { border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.5)" };
                    case "gradient": return { border: "1px solid rgba(255,255,255,0.1)" };
                    default:         return { border: "1px solid rgba(255,255,255,0.1)" };
                  }
                })();
                return (
                  <button key={s.key} onClick={() => setCardStyle(s.key)}
                    className={cn("relative flex flex-col overflow-hidden rounded-xl transition-all",
                      cardStyle === s.key ? "ring-2 ring-white scale-105" : "opacity-55 hover:opacity-85 hover:scale-[1.03]")}
                    style={thumbStyle}
                  >
                    {s.key === "gradient" && (
                      <div className="absolute top-0 inset-x-0 h-0.5 z-10" style={{ background: accentColor }} />
                    )}
                    <div className="h-10 w-full flex items-center justify-center"
                      style={{ background: s.key === "dark" ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.42)" }}>
                      <Box className="w-4 h-4 text-white/20" />
                    </div>
                    <div className="px-2 py-1.5 space-y-1"
                      style={{ background: s.key === "frost" ? "rgba(255,255,255,0.03)" : undefined }}>
                      <div className="w-10 h-1.5 rounded-full bg-white/25" />
                      <div className="w-6 h-1 rounded-full bg-white/15" />
                    </div>
                    {cardStyle === s.key && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {CARD_STYLES.map((s) => (
                <div key={s.key} className="text-center">
                  <p className={cn("text-[10px] font-semibold transition-colors",
                    cardStyle === s.key ? "text-white" : "text-muted-foreground")}>{s.label}</p>
                  <p className={cn("text-[9px] transition-colors",
                    cardStyle === s.key ? "text-white/60" : "text-muted-foreground/60")}>{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Edge effect picker */}
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Edge Effect</label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Adds a special border animation around your cards.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EDGE_EFFECTS.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setEdgeEffect(e.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    edgeEffect === e.key
                      ? "bg-white/15 border-white/50 text-white"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                  )}
                >
                  <span>{e.icon}</span>
                  {e.label}
                </button>
              ))}
            </div>
            {edgeEffect !== "none" && (
              <p className="text-[10px] text-muted-foreground/70 italic px-1">
                {EDGE_EFFECTS.find((e) => e.key === edgeEffect)?.desc} — preview updates above.
              </p>
            )}

            <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="text-white/70 font-semibold">Tip:</span> Accent color (set in Style tab) controls the glow color for Neon, Glow, Pulse, and Shimmer effects.
              </p>
            </div>
          </>
        )}

        {tab === "items" && (
          <>
            <p className="text-xs text-muted-foreground">Showcase up to 6 favorite catalog items on your profile.</p>

            {/* Current featured */}
            {featuredItems.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {featuredItems.map((item) => (
                  <div key={item.id} className="glass-panel border border-white/10 rounded-xl p-2.5 flex items-center gap-2 relative group">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-contain rounded-lg bg-black/40 p-0.5 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center shrink-0">
                        <Box className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    )}
                    <span className="text-xs text-white truncate flex-1 leading-tight">{item.name}</span>
                    <button onClick={() => setFeaturedItems((p) => p.filter((f) => f.id !== item.id))}
                      className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {featuredItems.length < 6 && (
              <CatalogSearch
                onAdd={(item) => setFeaturedItems((p) => p.some((f) => f.id === item.id) ? p : [...p, item])}
                existingIds={featuredItems.map((f) => f.id)}
              />
            )}
            {featuredItems.length >= 6 && (
              <p className="text-xs text-muted-foreground text-center italic">Maximum 6 items reached. Remove one to add another.</p>
            )}
          </>
        )}
        {tab === "site" && (
          <div className="space-y-4">
            <p className="text-[11px] text-muted-foreground/70 bg-white/5 rounded-xl px-3 py-2 border border-white/10 leading-relaxed">
              🎨 <strong className="text-white/80">Your personal view only</strong> — colors and background you set here are saved in your browser and only visible to you.
            </p>

            {/* Primary color */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Accent Color</label>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl border border-white/20 overflow-hidden shrink-0 cursor-pointer"
                  onClick={() => { const i = document.createElement("input"); i.type = "color"; i.value = siteTheme.primary; i.oninput = () => setSiteTheme((p) => ({ ...p, primary: i.value })); i.click(); }}>
                  <div className="w-full h-full" style={{ background: siteTheme.primary }} />
                </div>
                <input type="text" value={siteTheme.primary}
                  onChange={(e) => setSiteTheme((p) => ({ ...p, primary: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                  placeholder="#ff0080" />
              </div>
            </div>

            {/* Secondary color */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Secondary Color</label>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl border border-white/20 overflow-hidden shrink-0 cursor-pointer"
                  onClick={() => { const i = document.createElement("input"); i.type = "color"; i.value = siteTheme.secondary; i.oninput = () => setSiteTheme((p) => ({ ...p, secondary: i.value })); i.click(); }}>
                  <div className="w-full h-full" style={{ background: siteTheme.secondary }} />
                </div>
                <input type="text" value={siteTheme.secondary}
                  onChange={(e) => setSiteTheme((p) => ({ ...p, secondary: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                  placeholder="#7c3aed" />
              </div>
            </div>

            {/* Gradient preview */}
            <div className="h-5 rounded-lg" style={{ background: `linear-gradient(to right, ${siteTheme.primary}, ${siteTheme.secondary})` }} />

            {/* Site background */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Site Background</label>
              <div className="flex items-center gap-3">
                {siteTheme.bgUrl ? (
                  <div className="w-20 h-11 rounded-lg ring-1 ring-white/20 overflow-hidden shrink-0">
                    <img src={siteTheme.bgUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-11 rounded-lg bg-white/10 border border-dashed border-white/15 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">No BG</div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => siteFileInputRef.current?.click()} disabled={siteUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition disabled:opacity-50">
                    {siteUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} {siteUploading ? "Uploading…" : "Upload"}
                  </button>
                  {siteTheme.bgUrl && (
                    <button onClick={() => setSiteTheme((p) => ({ ...p, bgUrl: null }))}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition">Remove</button>
                  )}
                </div>
              </div>
              {siteUploadError && <p className="text-xs text-amber-400">{siteUploadError}</p>}
              <input ref={siteFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSiteBgUpload(f); e.target.value = ""; }} />
              {siteTheme.bgUrl && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Overlay Darkness</span>
                    <span className="text-[11px] font-mono text-white">{Math.round(siteTheme.bgOverlay * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={Math.round(siteTheme.bgOverlay * 100)}
                    onChange={(e) => setSiteTheme((p) => ({ ...p, bgOverlay: Number(e.target.value) / 100 }))}
                    className="w-full accent-primary" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">Blur Background</span>
                    <button onClick={() => setSiteTheme((p) => ({ ...p, bgBlur: !p.bgBlur }))}
                      className={cn("relative w-9 h-5 rounded-full transition-colors", siteTheme.bgBlur ? "bg-primary" : "bg-white/15")}>
                      <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", siteTheme.bgBlur ? "translate-x-4" : "translate-x-0")} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Save / Reset */}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSiteSave}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
                style={{ background: `linear-gradient(135deg, ${siteTheme.primary}, ${siteTheme.secondary})` }}>
                {siteSaved ? <Check className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
                {siteSaved ? "Applied!" : "Save & Apply"}
              </button>
              <button onClick={handleSiteReset}
                className="px-4 py-2.5 rounded-xl border border-white/15 text-muted-foreground hover:text-white hover:border-white/30 text-sm font-semibold transition-all">
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10 bg-white/5 shrink-0 space-y-2">
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />{error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={update.isPending || saved}
          className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${accentColor}99, ${accentColor}55)`, borderColor: `${accentColor}60`, border: "1px solid" }}
        >
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {update.isPending ? "Saving…" : saved ? "Saved!" : "Save Profile"}
        </button>
      </div>
    </motion.div>

    <AnimatePresence>
      {cropState && (
        <CropModal
          src={cropState.src}
          mimeType={cropState.mimeType}
          aspect={cropState.type === "avatar" ? 1 : 1280 / 360}
          label={cropState.type === "avatar" ? "Avatar" : "Banner"}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </AnimatePresence>
    </>
  );
}

// ── Quick vouch modal (shown from profile view) ───────────────────────────────

function ProfileVouchModal({
  seller,
  onClose,
}: {
  seller: { userId: string; username: string; avatarHash: string | null; customAvatarUrl?: string | null };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const sellerAvatar = seller.customAvatarUrl
    ?? (seller.avatarHash ? `https://cdn.discordapp.com/avatars/${seller.userId}/${seller.avatarHash}.png?size=64` : null);

  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = useMutation({
    mutationFn: () => fetch("/api/vouches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        toUserId: seller.userId,
        toUsername: seller.username,
        toAvatar: sellerAvatar,
        message: message.trim(),
        rating,
      }),
    }).then(async (r) => {
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vouches"] }); setSuccess(true); setTimeout(onClose, 1400); },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
        className="glass-panel border border-white/15 rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
          <Heart className="w-4 h-4 text-primary" />
          <span className="font-bold text-white text-sm flex-1">Vouch for Seller</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center py-6 space-y-2">
              <Check className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-white font-bold">Vouch submitted!</p>
            </div>
          ) : (
            <>
              {/* Seller preview */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-primary/20">
                {sellerAvatar ? (
                  <img src={sellerAvatar} alt={seller.username} className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {seller.username[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-bold text-white">{seller.username}</span>
              </div>

              {/* Stars */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Rating</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)}
                      onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
                      className="transition-transform hover:scale-110">
                      <svg viewBox="0 0 24 24" className={cn("w-7 h-7 transition-colors",
                        (hovered || rating) >= n ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 fill-none")}>
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                  <span>Your Vouch</span><span className={message.length > 250 ? "text-orange-400" : ""}>{message.length}/300</span>
                </label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                  placeholder="Share your experience trading with this seller…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition resize-none" />
              </div>

              {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" />{error}</p>}

              <button onClick={() => submit.mutate()}
                disabled={!message.trim() || message.trim().length < 10 || submit.isPending}
                className="w-full py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 text-sm font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                {submit.isPending ? "Submitting…" : "Submit Vouch"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Profile view ──────────────────────────────────────────────────────────────

type MentionVouch = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar: string | null;
  toUserId: string;
  toUsername: string;
  message: string;
  rating: number;
  createdAt: string;
};

function HighlightedMessage({ text, username }: { text: string; username: string }) {
  const tag = `@${username}`;
  const idx = text.toLowerCase().indexOf(tag.toLowerCase());
  if (idx === -1) return <span className="text-sm text-white/85 leading-relaxed">{text}</span>;
  return (
    <span className="text-sm text-white/85 leading-relaxed">
      {text.slice(0, idx)}
      <span className="font-bold text-pink-400">{text.slice(idx, idx + tag.length)}</span>
      {text.slice(idx + tag.length)}
    </span>
  );
}

function ProfileView({ profile, isOwn, onEdit, onVouch, onReport }: { profile: Profile; isOwn: boolean; onEdit: () => void; onVouch?: () => void; onReport?: () => void }) {
  const discordAvatarUrl = profile.avatarHash
    ? `https://cdn.discordapp.com/avatars/${profile.userId}/${profile.avatarHash}.png?size=128`
    : null;
  const avatarUrl = profile.customAvatarUrl ?? discordAvatarUrl;
  const bannerClass = getBannerClass(profile.bannerStyle);
  const accent = profile.accentColor || "#ff0080";

  const { data: mentionData } = useQuery<{ vouches: MentionVouch[]; count: number }>({
    queryKey: ["vouch-mentions", profile.userId, profile.username],
    queryFn: () =>
      fetch(`/api/vouches/mentions/${profile.userId}?username=${encodeURIComponent(profile.username)}`, { credentials: "include" })
        .then((r) => r.json()),
    staleTime: 60_000,
  });
  const mentionVouches = mentionData?.vouches ?? [];

  return (
    <div className="space-y-6">
      {/* Banner + Avatar */}
      <div className="relative">
        {/* Banner */}
        {profile.bannerImageUrl ? (
          <div className="h-36 sm:h-44 w-full rounded-2xl overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: `url(${profile.bannerImageUrl})` }}>
            <div className="absolute inset-0 bg-black/10 rounded-2xl" />
          </div>
        ) : (
          <div className={cn("h-36 sm:h-44 w-full rounded-2xl overflow-hidden", bannerClass)}>
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, ${accent}30 0%, transparent 60%), radial-gradient(circle at 80% 50%, ${accent}20 0%, transparent 60%)`,
            }} />
          </div>
        )}

        {/* Avatar */}
        <div className="absolute -bottom-10 left-5 sm:left-8">
          {avatarUrl ? (
            <img src={avatarUrl} alt={profile.username}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-4 bg-background object-cover"
              style={{ borderColor: accent }} />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-4 bg-black/60 flex items-center justify-center text-3xl font-black text-white"
              style={{ borderColor: accent }}>
              {profile.username[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {!isOwn && onVouch && (
            <button onClick={onVouch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 border border-primary/30 backdrop-blur-sm text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
              <Heart className="w-3 h-3" />
              Vouch
            </button>
          )}
          {!isOwn && onReport && (
            <button onClick={onReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 border border-red-500/30 backdrop-blur-sm text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
              <Flag className="w-3 h-3" />
              Report
            </button>
          )}
          {isOwn && (
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 backdrop-blur-sm text-xs font-semibold text-white hover:bg-black/70 transition-colors">
              <Pencil className="w-3 h-3" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Name row */}
      <div className="pt-10 px-5 sm:px-8 space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-display font-extrabold text-2xl text-white">{profile.username}</h1>
          {profile.siteRole && profile.siteRole !== "none" && (
            <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-bold tracking-wide", ROLE_COLOR[profile.siteRole as AnyRole])}>
              {ROLE_LABEL[profile.siteRole as AnyRole]?.toUpperCase()}
            </span>
          )}
          {profile.siteRole === "verified_reseller" && (
            <BadgeCheck className="w-5 h-5 text-green-400" title="Verified Reseller" />
          )}
        </div>
        {profile.tagline && (
          <p className="text-sm italic" style={{ color: accent }}>
            {profile.tagline}
          </p>
        )}
        {profile.updatedAt && (
          <p className="text-[11px] text-muted-foreground/50">
            Profile updated {new Date(profile.updatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>

      {/* Bio + Trade Prefs */}
      {(profile.bio || profile.tradePreferences) && (
        <div className="px-5 sm:px-8 space-y-4">
          {profile.bio && (
            <div className="glass-panel border border-white/10 rounded-2xl p-4 space-y-1.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">About</p>
              <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}
          {profile.tradePreferences && (
            <div className="glass-panel border rounded-2xl p-4 space-y-1.5" style={{ borderColor: `${accent}30` }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: accent }}>
                Trade Preferences
              </p>
              <p className="text-sm text-white/90 leading-relaxed">{profile.tradePreferences}</p>
            </div>
          )}
        </div>
      )}

      {/* Featured Items */}
      {profile.featuredItems.length > 0 && (
        <div className="px-5 sm:px-8 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: accent }} />
            <h2 className="font-display font-bold text-base text-white">Featured Items</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {profile.featuredItems.map((item) => (
              <div key={item.id} className="glass-panel border border-white/10 rounded-xl p-3 flex flex-col items-center gap-2 text-center hover:border-white/20 transition-colors"
                style={{ borderColor: `${accent}20` }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-14 h-14 object-contain rounded-xl bg-black/40 p-1" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-black/40 flex items-center justify-center">
                    <Box className="w-6 h-6 text-muted-foreground/20" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-white leading-tight line-clamp-2">{item.name}</p>
                  {item.rarity && <p className="text-[10px] text-muted-foreground mt-0.5">{item.rarity}</p>}
                  {item.value && <p className="text-[10px] font-bold mt-0.5" style={{ color: accent }}>${item.value.toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Listings */}
      {(profile.activeListings ?? []).length > 0 && (
        <div className="px-5 sm:px-8 space-y-3">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-display font-bold text-base text-white">
                Active Listings <span className="text-muted-foreground font-normal text-sm">({profile.activeListings?.length})</span>
              </h2>
            </div>
            <Link href="/listings" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {(profile.activeListings ?? []).slice(0, 5).map((l) => (
              <MiniListingCard key={l.id as string} listing={l as Listing} />
            ))}
          </div>
        </div>
      )}

      {/* Tagged In (vouches that @mention this user) */}
      {mentionVouches.length > 0 && (
        <div className="px-5 sm:px-8 space-y-3">
          <div className="flex items-center gap-2">
            <AtSign className="w-4 h-4" style={{ color: accent }} />
            <h2 className="font-display font-bold text-base text-white">
              Tagged In <span className="text-muted-foreground font-normal text-sm">({mentionVouches.length})</span>
            </h2>
          </div>
          <div className="space-y-3">
            {mentionVouches.map((v) => (
              <div key={v.id} className="glass-panel border border-white/10 rounded-2xl p-4 space-y-2.5" style={{ borderColor: `${accent}18` }}>
                <div className="flex items-start gap-3">
                  {/* Voucher avatar */}
                  <Link href={`/profile/${v.fromUserId}`}>
                    {v.fromAvatar ? (
                      <img src={v.fromAvatar} alt={v.fromUsername} className="w-8 h-8 rounded-full ring-1 ring-white/20 shrink-0 hover:ring-white/40 transition-all" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {v.fromUsername[0]?.toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/profile/${v.fromUserId}`} className="text-sm font-bold text-white hover:text-primary transition-colors">
                        {v.fromUsername}
                      </Link>
                      <span className="text-[11px] text-muted-foreground">vouched for</span>
                      <Link href={`/profile/${v.toUserId}`} className="text-[11px] font-semibold text-muted-foreground hover:text-white transition-colors">
                        {v.toUsername}
                      </Link>
                      <div className="flex items-center gap-0.5 ml-auto shrink-0">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={cn("w-3 h-3", n <= v.rating ? "fill-amber-400 text-amber-400" : "text-white/10 fill-white/10")} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                      {new Date(v.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <HighlightedMessage text={v.message} username={profile.username} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for no bio/items/listings */}
      {!profile.bio && !profile.tradePreferences && profile.featuredItems.length === 0 && (profile.activeListings ?? []).length === 0 && (
        <div className="px-5 sm:px-8">
          <div className="glass-panel border border-white/10 rounded-2xl p-10 text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground text-sm">
              {isOwn ? "Set up your profile to show your bio, trading preferences, and featured items." : "This user hasn't set up their profile yet."}
            </p>
            {isOwn && (
              <button onClick={onEdit} className="text-sm font-semibold text-primary hover:underline">
                Edit profile →
              </button>
            )}
          </div>
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const isOwn = !!user && user.id === userId;

  const { data: publicProfile, isLoading: publicLoading, isError } = useProfile(userId);
  const { data: ownProfile, isLoading: ownLoading } = useOwnProfile();

  // Own profile: prefer ownProfile (from /api/profile, always works when logged in)
  // Other profile: use publicProfile
  const profile = (isOwn && ownProfile) ? ownProfile : publicProfile;

  // Only show loading if we don't have any data yet
  const isLoading = isOwn ? ownLoading : publicLoading;

  // Only show error if we truly have nothing to show
  const showError = !isLoading && !profile && (isError || !isOwn);

  const [editing, setEditing] = useState(false);
  const [editingTab, setEditingTab] = useState<"about" | "theme" | "cards" | "items">("about");
  const [vouchOpen, setVouchOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Auto-open editor when own profile is fresh/empty
  useEffect(() => {
    if (isOwn && ownProfile && !editing) {
      const isEmpty = !ownProfile.bio && !ownProfile.tagline && ownProfile.featuredItems.length === 0;
      if (isEmpty) setEditing(true);
    }
  // Only run once when ownProfile first loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwn, !!ownProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 space-y-4">
        <div className="h-36 sm:h-44 rounded-2xl bg-white/5 animate-pulse" />
        <div className="pt-8 px-5 space-y-3">
          <div className="h-7 w-40 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-xl bg-white/5 animate-pulse" />
        </div>
        <div className="px-5 space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-5 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (showError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-white font-bold text-xl">Profile not found</p>
          <p className="text-muted-foreground text-sm">This user hasn't set up a profile yet, or the ID is invalid.</p>
          <Link href="/" className="text-primary hover:underline text-sm">← Go home</Link>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="relative min-h-screen pb-20">
      {/* Full-page background */}
      {profile.profileBgUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={profile.profileBgUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </div>
      )}
      {/* Back arrow for non-own profiles */}
      {!isOwn && (
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-4">
          <button onClick={() => history.back()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Back
          </button>
        </div>
      )}

      {/* Own profile quick-edit header */}
      {isOwn && !editing && (
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-1 flex gap-2">
          <motion.button
            onClick={() => { setEditingTab("about"); setEditing(true); }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/25 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit Profile
          </motion.button>
          <motion.button
            onClick={() => { setEditingTab("theme"); setEditing(true); }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Palette className="w-4 h-4" />
            Customize Theme
          </motion.button>
        </div>
      )}

      <div className={cn("max-w-4xl mx-auto pt-3", editing ? "grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 px-3 sm:px-6" : "")}>
        {/* Profile view */}
        <div className="overflow-hidden">
          <ProfileView
            profile={profile}
            isOwn={isOwn}
            onEdit={() => setEditing(true)}
            onVouch={!isOwn && !!user ? () => setVouchOpen(true) : undefined}
            onReport={!isOwn && !!user ? () => setReportTarget({ type: "user", id: profile.userId, name: profile.username }) : undefined}
          />
        </div>

        {/* Editor panel */}
        <AnimatePresence>
          {editing && isOwn && (
            <div className="lg:sticky lg:top-20 lg:self-start px-3 sm:px-0">
              <ProfileEditor profile={ownProfile ?? profile} onClose={() => setEditing(false)} initialTab={editingTab} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Vouch modal */}
      <AnimatePresence>
        {vouchOpen && profile && (
          <ProfileVouchModal
            seller={{ userId: profile.userId, username: profile.username, avatarHash: profile.avatarHash ?? null, customAvatarUrl: profile.customAvatarUrl }}
            onClose={() => setVouchOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Report modal */}
      <AnimatePresence>
        {reportTarget && (
          <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
