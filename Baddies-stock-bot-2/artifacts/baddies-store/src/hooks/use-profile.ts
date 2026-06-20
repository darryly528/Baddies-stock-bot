import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const apiBase = import.meta.env.VITE_API_URL ?? "";

export type FeaturedItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  rarity: string | null;
  value?: number;
};

export type BannerStyle = "default" | "sunset" | "ocean" | "forest" | "midnight" | "fire" | "aurora" | "gold";
export type CardStyle = "default" | "neon" | "minimal" | "frost" | "dark" | "gradient";

export const CARD_STYLES: { key: CardStyle; label: string; desc: string }[] = [
  { key: "default",  label: "Default",  desc: "Classic dark glass" },
  { key: "neon",     label: "Neon",     desc: "Glowing accent border" },
  { key: "minimal",  label: "Minimal",  desc: "Clean, no glow" },
  { key: "frost",    label: "Frost",    desc: "Icy frosted glass" },
  { key: "dark",     label: "Dark",     desc: "Deep dark panel" },
  { key: "gradient", label: "Gradient", desc: "Accent top stripe" },
];

export type Profile = {
  userId: string;
  username: string;
  avatarHash: string | null;
  tagline: string;
  bio: string;
  accentColor: string;
  bannerStyle: BannerStyle;
  cardStyle: CardStyle;
  tradePreferences: string;
  featuredItems: FeaturedItem[];
  siteRole: string | null;
  listingCount?: number;
  activeListings?: Record<string, unknown>[];
  updatedAt: string | null;
  customAvatarUrl: string | null;
  bannerImageUrl: string | null;
};

export const BANNER_STYLES: { key: BannerStyle; label: string; from: string; via: string; to: string }[] = [
  { key: "default",  label: "Baddies",  from: "from-pink-600",   via: "via-purple-600",  to: "to-fuchsia-600" },
  { key: "sunset",   label: "Sunset",   from: "from-orange-500", via: "via-pink-500",    to: "to-purple-600" },
  { key: "ocean",    label: "Ocean",    from: "from-blue-600",   via: "via-cyan-500",    to: "to-teal-400" },
  { key: "forest",   label: "Forest",   from: "from-green-700",  via: "via-emerald-500", to: "to-teal-400" },
  { key: "midnight", label: "Midnight", from: "from-slate-900",  via: "via-indigo-900",  to: "to-slate-800" },
  { key: "fire",     label: "Fire",     from: "from-red-600",    via: "via-orange-500",  to: "to-yellow-400" },
  { key: "aurora",   label: "Aurora",   from: "from-teal-500",   via: "via-purple-500",  to: "to-pink-500" },
  { key: "gold",     label: "Gold",     from: "from-yellow-600", via: "via-amber-500",   to: "to-orange-400" },
];

export function getBannerClass(style: BannerStyle | string): string {
  const s = BANNER_STYLES.find((b) => b.key === style) ?? BANNER_STYLES[0];
  return `bg-gradient-to-r ${s.from} ${s.via} ${s.to}`;
}

export const ACCENT_COLORS = [
  { label: "Pink",   hex: "#ff0080" },
  { label: "Purple", hex: "#a855f7" },
  { label: "Blue",   hex: "#3b82f6" },
  { label: "Cyan",   hex: "#06b6d4" },
  { label: "Green",  hex: "#22c55e" },
  { label: "Orange", hex: "#f97316" },
  { label: "Red",    hex: "#ef4444" },
  { label: "Gold",   hex: "#eab308" },
  { label: "White",  hex: "#e2e8f0" },
];

export function useOwnProfile() {
  return useQuery<Profile>({
    queryKey: ["profile-own"],
    queryFn: () => fetch(`${apiBase}/api/profile`, { credentials: "include" }).then(async (r) => {
      if (!r.ok) throw new Error("Not authenticated");
      return r.json();
    }),
    staleTime: 60_000,
    retry: false,
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery<Profile>({
    queryKey: ["profile", userId],
    queryFn: () => fetch(`${apiBase}/api/profiles/${userId}`, { credentials: "include" }).then(async (r) => {
      if (!r.ok) throw new Error("Profile not found");
      return r.json();
    }),
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { tagline?: string; bio?: string; accentColor?: string; bannerStyle?: BannerStyle; cardStyle?: CardStyle; tradePreferences?: string; featuredItems?: FeaturedItem[] }) =>
      fetch(`${apiBase}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed to save");
        return d;
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["profile-own"] });
      qc.setQueryData(["profile-own"], (old: Profile | undefined) => old ? { ...old, ...variables } : old);
    },
  });
}
