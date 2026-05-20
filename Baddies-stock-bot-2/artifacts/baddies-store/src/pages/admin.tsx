import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Trash2, RefreshCw, BarChart3, Package,
  Users, ShoppingBag, AlertTriangle, X, Box, ChevronDown, ChevronUp,
  Crown, Hammer, Clock, Ban, UserX, Star, ShieldCheck, Search,
  CheckCircle2, Loader2, ChevronRight
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const OWNER_USERNAME = "disgust_tf";

// ── Types ────────────────────────────────────────────────────────────────────

type Listing = {
  id: string;
  seller: string;
  discordUserId: string | null;
  discordAvatar: string | null;
  paymentMethods: string[];
  items: { name: string; itemType: string; imageUrl: string | null; quantity: number | string; price?: string; soldOut: boolean }[];
  customMessage?: string;
  createdAt: string;
};

type Stats = {
  totalListings: number;
  totalItems: number;
  activeItems: number;
  soldOutItems: number;
  uniqueSellers: number;
};

type AdminRole = { role: "owner" | "admin" | "none" };

type GuildMember = {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string;
  roles: { id: string; name: string; color: string }[];
  joinedAt: string | null;
  isVerifiedSeller: boolean;
  isMod: boolean;
  isSuspended: boolean;
  isOwner: boolean;
  timedOutUntil: string | null;
};

type ActionResult = { ok: boolean; error?: string };

// ── Small components ─────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="glass-panel border border-white/10 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-display font-extrabold text-white">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-panel border border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
          <p className="text-white text-sm font-semibold">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/15 text-muted-foreground hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors">Confirm</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TimeoutModal({ member, onConfirm, onCancel }: { member: GuildMember; onConfirm: (minutes: number) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState(60);
  const options = [
    { label: "60 minutes", value: 60 },
    { label: "6 hours", value: 360 },
    { label: "12 hours", value: 720 },
    { label: "1 day", value: 1440 },
    { label: "3 days", value: 4320 },
    { label: "7 days", value: 10080 },
    { label: "28 days", value: 40320 },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-panel border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <p className="text-white font-bold text-sm">Timeout {member.username}</p>
            <p className="text-xs text-muted-foreground">Select duration</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => setSelected(o.value)}
              className={cn(
                "py-2 px-3 rounded-xl text-sm font-semibold border transition-colors",
                selected === o.value
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "border-white/10 text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/15 text-muted-foreground hover:text-white text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={() => onConfirm(selected)} className="flex-1 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-sm font-semibold transition-colors">Apply Timeout</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RoleBadge({ label, color }: { label: string; color: string }) {
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-bold tracking-wide", color)}>{label}</span>;
}

// ── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  adminRole,
  onBan,
  onTimeout,
  onRemoveTimeout,
  onSuspend,
  onUnsuspend,
  onToggleRole,
  onKick,
  busy,
}: {
  member: GuildMember;
  adminRole: "owner" | "admin";
  onBan: () => void;
  onTimeout: () => void;
  onRemoveTimeout: () => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
  onToggleRole: (role: "verified_seller" | "mod", add: boolean) => void;
  onKick: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTimedOut = !!member.timedOutUntil && new Date(member.timedOutUntil) > new Date();

  return (
    <div className={cn(
      "glass-panel border rounded-xl overflow-hidden transition-colors",
      member.isOwner ? "border-amber-500/30" : member.isMod ? "border-primary/20" : "border-white/10"
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative shrink-0">
          <img src={member.avatar} alt={member.username} className="w-9 h-9 rounded-full ring-1 ring-white/20" />
          {member.isOwner && (
            <Crown className="w-3.5 h-3.5 text-amber-400 absolute -top-1 -right-1 drop-shadow" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-white truncate">{member.username}</span>
            {member.displayName && <span className="text-xs text-muted-foreground">({member.displayName})</span>}
            {member.isOwner && <RoleBadge label="OWNER" color="bg-amber-500/15 border-amber-500/40 text-amber-300" />}
            {member.isMod && !member.isOwner && <RoleBadge label="ADMIN" color="bg-primary/15 border-primary/40 text-primary" />}
            {member.isVerifiedSeller && <RoleBadge label="VERIFIED" color="bg-green-500/15 border-green-500/40 text-green-400" />}
            {member.isSuspended && <RoleBadge label="SUSPENDED" color="bg-red-500/15 border-red-500/40 text-red-400" />}
            {isTimedOut && <RoleBadge label="TIMED OUT" color="bg-amber-500/15 border-amber-500/40 text-amber-400" />}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {member.joinedAt ? `Joined ${new Date(member.joinedAt).toLocaleDateString()}` : "Unknown join date"}
            {" · "}<span className="font-mono opacity-60">{member.id}</span>
          </p>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="px-4 py-3 space-y-3">
              {/* Role toggles */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Roles</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy || member.isOwner}
                    onClick={() => onToggleRole("verified_seller", !member.isVerifiedSeller)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40",
                      member.isVerifiedSeller
                        ? "bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/10"
                        : "border-white/15 text-muted-foreground hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Star className="w-3 h-3" />
                    {member.isVerifiedSeller ? "Remove Verified Seller" : "Make Verified Seller"}
                  </button>

                  {adminRole === "owner" && !member.isOwner && (
                    <button
                      disabled={busy}
                      onClick={() => onToggleRole("mod", !member.isMod)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40",
                        member.isMod
                          ? "bg-primary/20 border-primary/40 text-primary hover:bg-primary/10"
                          : "border-white/15 text-muted-foreground hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {member.isMod ? "Remove Admin" : "Make Admin"}
                    </button>
                  )}
                </div>
              </div>

              {/* Moderation actions */}
              {!member.isOwner && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Moderation</p>
                  <div className="flex flex-wrap gap-2">
                    {isTimedOut ? (
                      <button
                        disabled={busy}
                        onClick={onRemoveTimeout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                      >
                        <Clock className="w-3 h-3" />
                        Remove Timeout
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={onTimeout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/20 text-muted-foreground hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                      >
                        <Clock className="w-3 h-3" />
                        Timeout
                      </button>
                    )}

                    {member.isSuspended ? (
                      <button
                        disabled={busy}
                        onClick={onUnsuspend}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-40"
                      >
                        <UserX className="w-3 h-3" />
                        Lift Suspension
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={onSuspend}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/20 text-muted-foreground hover:border-orange-500/40 hover:text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-40"
                      >
                        <UserX className="w-3 h-3" />
                        Suspend from Site
                      </button>
                    )}

                    {adminRole === "owner" && (
                      <>
                        <button
                          disabled={busy}
                          onClick={onKick}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/20 text-muted-foreground hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          <Hammer className="w-3 h-3" />
                          Kick
                        </button>
                        <button
                          disabled={busy}
                          onClick={onBan}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-600/30 bg-red-500/5 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                        >
                          <Ban className="w-3 h-3" />
                          Ban from Server
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {member.isOwner && (
                <p className="text-xs text-amber-400/70 italic">This is the server owner — actions disabled.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"listings" | "members">("listings");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [timeoutTarget, setTimeoutTarget] = useState<GuildMember | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const isOwner = user?.username === OWNER_USERNAME;

  const { data: adminMe } = useQuery<AdminRole>({
    queryKey: ["admin-me"],
    queryFn: () => fetch("/api/admin/me").then((r) => r.json()),
    enabled: !!user,
  });

  const isAdmin = adminMe?.role === "owner" || adminMe?.role === "admin";

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => { if (!r.ok) throw new Error("Forbidden"); return r.json(); }),
    enabled: isAdmin,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery<Listing[]>({
    queryKey: ["admin-listings"],
    queryFn: () => fetch("/api/admin/listings").then((r) => r.json()),
    enabled: isAdmin,
  });

  const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery<GuildMember[]>({
    queryKey: ["admin-members"],
    queryFn: () => fetch("/api/admin/members").then((r) => r.json()),
    enabled: isAdmin && tab === "members",
    staleTime: 30_000,
  });

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return members;
    return members.filter((m) =>
      m.username.toLowerCase().includes(q) ||
      (m.displayName ?? "").toLowerCase().includes(q) ||
      m.id.includes(q)
    );
  }, [members, memberSearch]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function setBusy(id: string, v: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      v ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function memberAction(userId: string, fn: () => Promise<Response>) {
    setBusy(userId, true);
    try {
      const r = await fn();
      const data = await r.json() as ActionResult;
      if (data.ok) {
        showToast("Done!", true);
        qc.invalidateQueries({ queryKey: ["admin-members"] });
      } else {
        showToast(data.error ?? "Failed", false);
      }
    } catch {
      showToast("Request failed", false);
    } finally {
      setBusy(userId, false);
    }
  }

  const deleteListing = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/listings/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  const clearAll = useMutation({
    mutationFn: () => fetch("/api/admin/listings", { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  const clearSoldOut = useMutation({
    mutationFn: () => fetch("/api/admin/listings/sold-out", { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  function ask(message: string, action: () => void) {
    setConfirm({ message, action });
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">You must be logged in to access this page.</p>
          <Link href="/" className="text-primary hover:underline text-sm">Go home</Link>
        </div>
      </div>
    );
  }

  if (adminMe && adminMe.role === "none") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-red-400/40 mx-auto" />
          <p className="text-white font-bold text-xl">Access Denied</p>
          <p className="text-muted-foreground text-sm">This page is restricted.</p>
          <Link href="/" className="text-primary hover:underline text-sm">Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl border flex items-center justify-center shadow-lg",
            isOwner
              ? "bg-amber-500/20 border-amber-500/30 shadow-amber-500/20"
              : "bg-primary/20 border-primary/30 shadow-primary/20"
          )}>
            {isOwner ? <Crown className="w-5 h-5 text-amber-400" /> : <Shield className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">
              Logged in as <span className={cn("font-semibold", isOwner ? "text-amber-400" : "text-primary")}>{user.username}</span>
              {" "}
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full border font-bold",
                isOwner ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-primary/15 border-primary/40 text-primary"
              )}>
                {isOwner ? "OWNER" : "ADMIN"}
              </span>
            </p>
          </div>
        </motion.div>

        {/* Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-panel border border-white/10 rounded-2xl p-5 h-20 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : stats ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={ShoppingBag} label="Listings" value={stats.totalListings} color="bg-primary/20 text-primary" />
            <StatCard icon={Package} label="Total Items" value={stats.totalItems} color="bg-blue-500/20 text-blue-400" />
            <StatCard icon={BarChart3} label="Active Items" value={stats.activeItems} color="bg-green-500/20 text-green-400" />
            <StatCard icon={X} label="Sold Out" value={stats.soldOutItems} color="bg-orange-500/20 text-orange-400" />
            <StatCard icon={Users} label="Sellers" value={stats.uniqueSellers} color="bg-purple-500/20 text-purple-400" />
          </motion.div>
        ) : null}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-black/40 rounded-xl w-fit">
          {(["listings", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === t
                  ? "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(255,0,128,0.15)]"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              {t === "listings" ? <ShoppingBag className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              {t === "listings" ? "Listings" : "Members"}
            </button>
          ))}
        </div>

        {/* ── LISTINGS TAB ── */}
        {tab === "listings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />Refresh
              </button>
              <button
                onClick={() => ask("Remove all sold-out items from listings?", () => clearSoldOut.mutate())}
                disabled={clearSoldOut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-sm font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />Clear Sold-Out
              </button>
              <button
                onClick={() => ask("Delete ALL listings? This cannot be undone.", () => clearAll.mutate())}
                disabled={clearAll.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" />Clear All Listings
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-display font-bold text-white">
                All Listings <span className="text-muted-foreground text-base font-normal">({listings.length})</span>
              </h2>
              {listingsLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass-panel border border-white/10 rounded-xl h-16 animate-pulse bg-white/5" />
                ))}</div>
              ) : listings.length === 0 ? (
                <div className="glass-panel border border-white/10 rounded-2xl p-12 text-center text-muted-foreground">No listings found.</div>
              ) : (
                <div className="space-y-2">
                  {listings.map((listing) => {
                    const avatarUrl = listing.discordUserId && listing.discordAvatar
                      ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
                      : null;
                    const activeCount = listing.items.filter((i) => !i.soldOut).length;
                    const isExpanded = expandedId === listing.id;
                    return (
                      <div key={listing.id} className="glass-panel border border-white/10 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          {avatarUrl
                            ? <img src={avatarUrl} alt={listing.seller} className="w-8 h-8 rounded-full ring-1 ring-white/20 shrink-0" />
                            : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{listing.seller[0]?.toUpperCase()}</div>
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white">{listing.seller}</span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-semibold">{activeCount} active</span>
                              {listing.items.some((i) => i.soldOut) && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">{listing.items.filter((i) => i.soldOut).length} sold</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{new Date(listing.createdAt).toLocaleString()} · {listing.id.slice(0, 8)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setExpandedId(isExpanded ? null : listing.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button onClick={() => ask(`Delete ${listing.seller}'s listing?`, () => deleteListing.mutate(listing.id))} disabled={deleteListing.isPending} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }} className="overflow-hidden border-t border-white/10"
                            >
                              <div className="px-4 py-3 space-y-1.5">
                                {listing.items.map((item, i) => (
                                  <div key={i} className={`flex items-center gap-3 py-1.5 ${item.soldOut ? "opacity-40" : ""}`}>
                                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-7 h-7 object-contain shrink-0" /> : <Box className="w-7 h-7 text-muted-foreground/30 shrink-0" />}
                                    <span className="text-sm text-white flex-1">{item.name}</span>
                                    <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                                    {item.price && <span className="text-xs text-green-400 font-bold">${item.price}</span>}
                                    {item.soldOut && <span className="text-[10px] text-orange-400 font-semibold">SOLD</span>}
                                  </div>
                                ))}
                                {listing.customMessage && (
                                  <p className="text-xs text-muted-foreground italic pt-1 border-t border-white/5 mt-2">"{listing.customMessage}"</p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === "members" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or ID…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
                />
              </div>
              <button
                onClick={() => refetchMembers()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />Refresh
              </button>
              <p className="text-xs text-muted-foreground">
                {filteredMembers.length} / {members.length} members
              </p>
            </div>

            {membersLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-panel border border-white/10 rounded-xl h-16 animate-pulse bg-white/5" />
              ))}</div>
            ) : members.length === 0 ? (
              <div className="glass-panel border border-white/10 rounded-2xl p-12 text-center text-muted-foreground">
                No members found — make sure the bot is online.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    adminRole={adminMe?.role === "owner" ? "owner" : "admin"}
                    busy={busyIds.has(member.id)}
                    onBan={() => ask(`Ban ${member.username} from the server? This cannot be undone.`, () =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/ban`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Banned via admin panel" }) }))
                    )}
                    onKick={() => ask(`Kick ${member.username} from the server?`, () =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/kick`, { method: "POST" }))
                    )}
                    onTimeout={() => setTimeoutTarget(member)}
                    onRemoveTimeout={() => memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/timeout`, { method: "DELETE" }))}
                    onSuspend={() => ask(`Suspend ${member.username} from the store?`, () =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/suspend`, { method: "POST" }))
                    )}
                    onUnsuspend={() => memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/suspend`, { method: "DELETE" }))}
                    onToggleRole={(role, add) => memberAction(member.id, () =>
                      fetch(`/api/admin/members/${member.id}/role/${role}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ add }) })
                    )}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold shadow-lg",
              toast.ok
                ? "bg-green-500/20 border-green-500/40 text-green-300"
                : "bg-red-500/20 border-red-500/40 text-red-300"
            )}
          >
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            message={confirm.message}
            onConfirm={() => { confirm.action(); setConfirm(null); }}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      {/* Timeout modal */}
      <AnimatePresence>
        {timeoutTarget && (
          <TimeoutModal
            member={timeoutTarget}
            onConfirm={(minutes) => {
              const target = timeoutTarget;
              setTimeoutTarget(null);
              memberAction(target.id, () =>
                fetch(`/api/admin/members/${target.id}/timeout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minutes }) })
              );
            }}
            onCancel={() => setTimeoutTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
