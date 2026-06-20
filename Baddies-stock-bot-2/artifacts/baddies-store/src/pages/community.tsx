import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, Users, Heart, MessageSquare, Search, Check, X,
  Loader2, AlertTriangle, Trophy, ChevronDown, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Vouch = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar: string | null;
  toUserId: string;
  toUsername: string;
  toAvatar: string | null;
  message: string;
  rating: number;
  createdAt: string;
  updatedAt?: string;
};

type Listing = {
  id: string;
  seller: string;
  discordUserId: string | null;
  discordAvatar: string | null;
};

type TopSeller = {
  userId: string;
  username: string;
  avatar: string | null;
  count: number;
  avgRating: number;
};

// ── Star display ──────────────────────────────────────────────────────────────

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5",
            n <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "w-7 h-7 transition-colors",
              (hovered || value) >= n ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30",
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ── Vouch card ────────────────────────────────────────────────────────────────

function VouchCard({ vouch, ownId, onDelete }: { vouch: Vouch; ownId?: string; onDelete?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel border border-white/10 rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {vouch.fromAvatar ? (
            <img src={vouch.fromAvatar} alt={vouch.fromUsername}
              className="w-8 h-8 rounded-full ring-1 ring-white/15 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {vouch.fromUsername[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs font-bold text-white">{vouch.fromUsername}</span>
              <span className="text-[11px] text-muted-foreground">vouched for</span>
              <Link href={`/profile/${vouch.toUserId}`}
                className="text-xs font-bold text-primary hover:underline">{vouch.toUsername}</Link>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              {vouch.updatedAt ? "Updated " : ""}{new Date(vouch.updatedAt ?? vouch.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Stars rating={vouch.rating} />
          {onDelete && vouch.fromUserId === ownId && (
            <button onClick={onDelete}
              className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete vouch">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <blockquote className="pl-3 border-l-2 border-primary/30 text-sm text-white/80 leading-relaxed italic">
        "{vouch.message}"
      </blockquote>
      {vouch.toAvatar && (
        <div className="flex items-center gap-2">
          <img src={vouch.toAvatar} alt={vouch.toUsername} className="w-5 h-5 rounded-full opacity-60" />
          <span className="text-[11px] text-muted-foreground">→ {vouch.toUsername}</span>
        </div>
      )}
    </motion.div>
  );
}

// ── Vouch form modal ──────────────────────────────────────────────────────────

function VouchModal({
  prefill,
  onClose,
}: {
  prefill?: { userId: string; username: string; avatar: string | null };
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [sellerSearch, setSellerSearch] = useState(prefill?.username ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; username: string; avatar: string | null } | null>(prefill ?? null);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(sellerSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [sellerSearch]);

  const { data: listingsRaw, isFetching: searchFetching } = useQuery<Listing[]>({
    queryKey: ["listings-seller-search", debouncedSearch],
    queryFn: () => fetch(`/api/listings?limit=100`, { credentials: "include" }).then((r) => r.json()),
    enabled: debouncedSearch.length >= 2 && !selected,
    staleTime: 30_000,
  });
  const listings: Listing[] = Array.isArray(listingsRaw) ? listingsRaw : [];

  const filteredSellers = debouncedSearch.length >= 2 && !selected
    ? Array.from(
        new Map(
          listings
            .filter((l) => l.seller.toLowerCase().includes(debouncedSearch.toLowerCase()) && l.discordUserId)
            .map((l) => [l.discordUserId, {
              id: l.discordUserId!,
              username: l.seller,
              avatar: l.discordAvatar
                ? `https://cdn.discordapp.com/avatars/${l.discordUserId}/${l.discordAvatar}.png?size=64`
                : null,
            }])
        ).values()
      ).slice(0, 6)
    : [];

  const submitVouch = useMutation({
    mutationFn: () => fetch("/api/vouches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        toUserId: selected!.id,
        toUsername: selected!.username,
        toAvatar: selected!.avatar,
        message: message.trim(),
        rating,
      }),
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to submit vouch");
      return d;
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vouches"] });
      setSuccess(true);
      setTimeout(onClose, 1500);
    },
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
        className="glass-panel border border-white/15 rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
          <Heart className="w-4 h-4 text-primary" />
          <span className="font-bold text-white text-sm flex-1">Give a Vouch</span>
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
              {/* Seller search / selection */}
              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Seller</label>
                {selected ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-primary/20">
                    {selected.avatar ? (
                      <img src={selected.avatar} alt={selected.username} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {selected.username[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 text-sm font-bold text-white">{selected.username}</span>
                    {!prefill && (
                      <button onClick={() => { setSelected(null); setSellerSearch(""); }}
                        className="p-1 rounded-md text-muted-foreground hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        value={sellerSearch}
                        onChange={(e) => setSellerSearch(e.target.value)}
                        placeholder="Search sellers by username…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition"
                      />
                      {searchFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary animate-spin" />}
                    </div>
                    {filteredSellers.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {filteredSellers.map((s) => (
                          <button key={s.id} onClick={() => { setSelected(s); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-primary/20 text-left transition-colors">
                            {s.avatar ? (
                              <img src={s.avatar} alt={s.username} className="w-7 h-7 rounded-full shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {s.username[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-semibold text-white">{s.username}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {debouncedSearch.length >= 2 && filteredSellers.length === 0 && !searchFetching && (
                      <p className="text-xs text-muted-foreground text-center py-2">No sellers found matching "{debouncedSearch}"</p>
                    )}
                  </div>
                )}
              </div>

              {selected && (
                <>
                  {/* Rating */}
                  <div className="space-y-2">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Rating</label>
                    <StarPicker value={rating} onChange={setRating} />
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                      <span>Your Vouch</span>
                      <span className={message.length > 280 ? "text-orange-400" : ""}>{message.length}/300</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                      placeholder="Share your experience trading with this seller…"
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition resize-none"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />{error}
                    </p>
                  )}

                  {selected.id === user?.id && (
                    <p className="text-xs text-orange-400">You cannot vouch for yourself.</p>
                  )}

                  <button
                    onClick={() => submitVouch.mutate()}
                    disabled={!selected || !message.trim() || message.trim().length < 10 || submitVouch.isPending || selected.id === user?.id}
                    className="w-full py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 text-sm font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {submitVouch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                    {submitVouch.isPending ? "Submitting…" : "Submit Vouch"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"recent" | "top">("recent");
  const [vouchOpen, setVouchOpen] = useState(false);
  const [filterUser, setFilterUser] = useState<string | null>(null);

  const { data: vouchesRaw, isLoading } = useQuery<Vouch[]>({
    queryKey: ["vouches"],
    queryFn: () => fetch("/api/vouches", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const vouches: Vouch[] = Array.isArray(vouchesRaw) ? vouchesRaw : [];

  const deleteVouch = useMutation({
    mutationFn: (id: string) => fetch(`/api/vouches/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vouches"] }),
  });

  const filtered = filterUser ? vouches.filter((v) => v.toUserId === filterUser) : vouches;

  // Top sellers computation
  const topSellers: TopSeller[] = (() => {
    const map = new Map<string, { username: string; avatar: string | null; ratings: number[] }>();
    for (const v of vouches) {
      const ex = map.get(v.toUserId);
      if (ex) { ex.ratings.push(v.rating); }
      else map.set(v.toUserId, { username: v.toUsername, avatar: v.toAvatar, ratings: [v.rating] });
    }
    return [...map.entries()]
      .map(([userId, d]) => ({
        userId, username: d.username, avatar: d.avatar,
        count: d.ratings.length,
        avgRating: Math.round((d.ratings.reduce((s, r) => s + r, 0) / d.ratings.length) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating)
      .slice(0, 10);
  })();

  const totalVouched = new Set(vouches.map((v) => v.toUserId)).size;
  const avgRating = vouches.length > 0
    ? Math.round((vouches.reduce((s, v) => s + v.rating, 0) / vouches.length) * 10) / 10
    : null;

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-secondary/10" />
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-10 pb-8 relative">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_16px_rgba(255,0,128,0.2)]">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white">Community</h1>
                <p className="text-xs text-muted-foreground">Seller vouches &amp; reputation</p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex items-center gap-6 mt-6 text-sm">
            <div className="text-center">
              <p className="font-display font-extrabold text-xl text-white">{vouches.length}</p>
              <p className="text-[11px] text-muted-foreground">Total Vouches</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="font-display font-extrabold text-xl text-white">{totalVouched}</p>
              <p className="text-[11px] text-muted-foreground">Vouched Sellers</p>
            </div>
            {avgRating && (
              <>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="font-display font-extrabold text-xl text-amber-400">{avgRating}★</p>
                  <p className="text-[11px] text-muted-foreground">Avg Rating</p>
                </div>
              </>
            )}
            {user && (
              <button
                onClick={() => setVouchOpen(true)}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 text-sm font-bold transition-colors shadow-[0_0_12px_rgba(255,0,128,0.15)]"
              >
                <Heart className="w-4 h-4" />
                Give a Vouch
              </button>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 space-y-5">
        {/* Tabs + filter indicator */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-black/40 rounded-xl">
            <button
              onClick={() => { setTab("recent"); setFilterUser(null); }}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === "recent" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white")}
            >
              <MessageSquare className="w-4 h-4" />Recent
            </button>
            <button
              onClick={() => { setTab("top"); setFilterUser(null); }}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === "top" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white")}
            >
              <Trophy className="w-4 h-4" />Top Sellers
            </button>
          </div>
          {filterUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              Filtered by seller
              <button onClick={() => setFilterUser(null)} className="hover:text-white transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {!user && (
            <a href="/api/auth/discord"
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#7289da] hover:bg-[#5865F2]/30 text-sm font-semibold transition-colors">
              Log in to vouch
            </a>
          )}
        </div>

        {/* ── Recent Vouches ── */}
        {tab === "recent" && (
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-panel border border-white/10 rounded-2xl h-32 animate-pulse bg-white/5" />
              ))
            ) : filtered.length === 0 ? (
              <div className="glass-panel border border-white/10 rounded-2xl p-12 text-center space-y-3">
                <Heart className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                <p className="text-white font-bold">No vouches yet</p>
                <p className="text-muted-foreground text-sm">Be the first to vouch for a seller!</p>
                {user && (
                  <button onClick={() => setVouchOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/30 transition-colors">
                    <Heart className="w-4 h-4" />Give the first vouch
                  </button>
                )}
              </div>
            ) : (
              filtered.map((v) => (
                <VouchCard
                  key={v.id}
                  vouch={v}
                  ownId={user?.id}
                  onDelete={() => deleteVouch.mutate(v.id)}
                />
              ))
            )}
          </div>
        )}

        {/* ── Top Sellers ── */}
        {tab === "top" && (
          <div className="space-y-3">
            {topSellers.length === 0 ? (
              <div className="glass-panel border border-white/10 rounded-2xl p-12 text-center space-y-2">
                <Trophy className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                <p className="text-muted-foreground text-sm">No vouches yet — be the first to vouch for a seller.</p>
              </div>
            ) : (
              topSellers.map((seller, idx) => (
                <motion.div
                  key={seller.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-panel border border-white/10 rounded-2xl px-4 py-3.5 flex items-center gap-3"
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                    idx === 0 ? "bg-amber-500/20 text-amber-400" :
                    idx === 1 ? "bg-slate-400/20 text-slate-300" :
                    idx === 2 ? "bg-orange-600/20 text-orange-500" :
                    "bg-white/5 text-muted-foreground"
                  )}>
                    {idx + 1}
                  </div>

                  {seller.avatar ? (
                    <img src={seller.avatar} alt={seller.username}
                      className="w-9 h-9 rounded-full ring-1 ring-white/15 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {seller.username[0]?.toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/profile/${seller.userId}`}
                        className="text-sm font-bold text-white hover:text-primary transition-colors">
                        {seller.username}
                      </Link>
                      <Stars rating={Math.round(seller.avgRating)} size="sm" />
                      <span className="text-[11px] text-muted-foreground">{seller.avgRating}/5</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{seller.count} vouch{seller.count !== 1 ? "es" : ""}</p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setTab("recent"); setFilterUser(seller.userId); }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold text-muted-foreground hover:text-white transition-colors"
                    >
                      View
                    </button>
                    {user && user.id !== seller.userId && (
                      <button
                        onClick={() => setVouchOpen(true)}
                        className="px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/25 text-[11px] font-semibold text-primary hover:bg-primary/25 transition-colors"
                      >
                        Vouch
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {vouchOpen && (
          <VouchModal onClose={() => setVouchOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
