import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Pencil, Check, X, Plus, Trash2, Search, Loader2, Box,
  ArrowLeft, ShoppingBag, LayoutList, Sparkles, BadgeCheck,
  ExternalLink, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useProfile, useOwnProfile, useUpdateProfile,
  BANNER_STYLES, ACCENT_COLORS, getBannerClass,
  type BannerStyle, type FeaturedItem, type Profile,
} from "@/hooks/use-profile";
import { ROLE_LABEL, ROLE_COLOR, type AnyRole } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

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
          {active.length} active · {listing.listingType === "auction" ? "🔨 Auction" : "Fixed"}
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

// ── Profile editor panel ──────────────────────────────────────────────────────

function ProfileEditor({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"about" | "style" | "items">("about");
  const [tagline, setTagline] = useState(profile.tagline);
  const [bio, setBio] = useState(profile.bio);
  const [tradePrefs, setTradePrefs] = useState(profile.tradePreferences);
  const [accentColor, setAccentColor] = useState(profile.accentColor);
  const [bannerStyle, setBannerStyle] = useState<BannerStyle>(profile.bannerStyle);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>(profile.featuredItems);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useUpdateProfile();

  async function handleSave() {
    setError(null);
    try {
      await update.mutateAsync({ tagline, bio, accentColor, bannerStyle, tradePreferences: tradePrefs, featuredItems });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  const bannerClass = getBannerClass(bannerStyle);

  return (
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
      <div className={cn("h-10 w-full opacity-60", bannerClass)} style={{ background: undefined }} />

      {/* Tabs */}
      <div className="flex gap-1 p-2 bg-black/30 border-b border-white/10 shrink-0">
        {(["about", "style", "items"] as const).map((t) => (
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

        {tab === "style" && (
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
  );
}

// ── Profile view ──────────────────────────────────────────────────────────────

function ProfileView({ profile, isOwn, onEdit }: { profile: Profile; isOwn: boolean; onEdit: () => void }) {
  const avatarUrl = profile.avatarHash
    ? `https://cdn.discordapp.com/avatars/${profile.userId}/${profile.avatarHash}.png?size=128`
    : null;
  const bannerClass = getBannerClass(profile.bannerStyle);
  const accent = profile.accentColor || "#ff0080";

  return (
    <div className="space-y-6">
      {/* Banner + Avatar */}
      <div className="relative">
        {/* Banner */}
        <div className={cn("h-36 sm:h-44 w-full rounded-2xl overflow-hidden", bannerClass)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, ${accent}30 0%, transparent 60%), radial-gradient(circle at 80% 50%, ${accent}20 0%, transparent 60%)`,
          }} />
        </div>

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

        {/* Edit button */}
        {isOwn && (
          <button onClick={onEdit}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 backdrop-blur-sm text-xs font-semibold text-white hover:bg-black/70 transition-colors">
            <Pencil className="w-3 h-3" />
            Edit Profile
          </button>
        )}
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
  const { data: ownProfile } = useOwnProfile();

  const profile = isOwn && ownProfile ? ownProfile : publicProfile;
  const isLoading = publicLoading;

  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 space-y-4">
        {/* Skeleton */}
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

  if (isError || !profile) {
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

  return (
    <div className="min-h-screen pb-20">
      {/* Back arrow for non-own profiles */}
      {!isOwn && (
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-4">
          <button onClick={() => history.back()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Back
          </button>
        </div>
      )}

      <div className={cn("max-w-4xl mx-auto pt-3", editing ? "grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 px-3 sm:px-6" : "")}>
        {/* Profile view */}
        <div className="overflow-hidden">
          <ProfileView profile={profile} isOwn={isOwn} onEdit={() => setEditing(true)} />
        </div>

        {/* Editor panel */}
        <AnimatePresence>
          {editing && isOwn && (
            <div className="lg:sticky lg:top-20 lg:self-start px-3 sm:px-0">
              <ProfileEditor profile={ownProfile ?? profile} onClose={() => setEditing(false)} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
