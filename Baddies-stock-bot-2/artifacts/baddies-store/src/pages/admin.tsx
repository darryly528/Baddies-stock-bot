import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Trash2, RefreshCw, BarChart3, Package,
  Users, ShoppingBag, AlertTriangle, X, Box, ChevronDown, ChevronUp,
  Crown, Hammer, Clock, Ban, UserX, ShieldCheck, Search,
  MessageSquare, ArrowLeft, Inbox, Eye, Plus, Check, UserCog,
  FileWarning, CheckCircle2, XCircle, BadgeCheck, Star,
  Palette, Upload, ImageIcon, RotateCcw, EyeOff, Pipette,
  Pencil, Loader2, User,
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { applyThemeColors } from "@/lib/theme-colors";
import {
  useOwnProfile, useUpdateProfile,
  BANNER_STYLES, getBannerClass, ACCENT_COLORS,
  type BannerStyle,
} from "@/hooks/use-profile";
import {
  useStaff, useAddStaff, useChangeRole, useRemoveStaff,
  useBanRequests, useApproveBanRequest, useRejectBanRequest,
  useWarnUser, useSubmitBanRequest,
  hasMinRole, ROLE_LABEL, ROLE_COLOR,
  type AnyRole, type StaffRole, type StaffEntry, type BanRequest,
} from "@/hooks/use-staff";

// ── Types ────────────────────────────────────────────────────────────────────

type Listing = {
  id: string; seller: string; discordUserId: string | null; discordAvatar: string | null;
  paymentMethods: string[]; items: { name: string; itemType: string; imageUrl: string | null; quantity: number | string; price?: string; soldOut: boolean }[];
  customMessage?: string; createdAt: string;
};

type Stats = { totalListings: number; totalItems: number; activeItems: number; soldOutItems: number; uniqueSellers: number };
type AdminRole = { role: AnyRole | "none" };

type GuildMember = {
  id: string; username: string; displayName: string | null; avatar: string;
  guilds?: { id: string; name: string; icon: string | null }[];
  joinedAt: string | null; siteRole: AnyRole | null;
  isSuspended: boolean; isOwner: boolean; timedOutUntil: string | null;
};

type Conversation = {
  id: string; listingId: string; listingTitle: string;
  buyerId: string; buyerName: string; buyerAvatar: string | null;
  sellerId: string; sellerName: string; sellerAvatar: string | null;
  messages: { id: string; senderId: string; senderName: string; senderAvatar: string | null; content: string; timestamp: string; filtered: boolean }[];
  createdAt: string; updatedAt: string;
};

// ── Small UI helpers ──────────────────────────────────────────────────────────

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

function RoleBadge({ role }: { role: AnyRole }) {
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-bold tracking-wide", ROLE_COLOR[role])}>
      {ROLE_LABEL[role].toUpperCase()}
    </span>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onCancel}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-panel border border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
          <p className="text-white text-sm font-semibold">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/15 text-muted-foreground hover:text-white text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors">Confirm</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TimeoutModal({ member, onConfirm, onCancel }: { member: GuildMember; onConfirm: (minutes: number) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState(60);
  const options = [
    { label: "60 min", value: 60 }, { label: "6 hrs", value: 360 },
    { label: "12 hrs", value: 720 }, { label: "1 day", value: 1440 },
    { label: "3 days", value: 4320 }, { label: "7 days", value: 10080 },
    { label: "28 days", value: 40320 },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onCancel}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-panel border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <p className="text-white font-bold text-sm">Timeout {member.username}</p>
            <p className="text-xs text-muted-foreground">Select duration</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button key={o.value} onClick={() => setSelected(o.value)}
              className={cn("py-2 px-3 rounded-xl text-sm font-semibold border transition-colors",
                selected === o.value ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "border-white/10 text-muted-foreground hover:text-white hover:bg-white/5")}>
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

function WarnModal({ member, onConfirm, onCancel }: { member: GuildMember; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onCancel}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-panel border border-yellow-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <FileWarning className="w-6 h-6 text-yellow-400 shrink-0" />
          <div>
            <p className="text-white font-bold text-sm">Warn {member.username}</p>
            <p className="text-xs text-muted-foreground">Reason is recorded on their profile</p>
          </div>
        </div>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for warning…"
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-yellow-500/50 resize-none"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/15 text-muted-foreground hover:text-white text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
            className="flex-1 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30 text-sm font-semibold transition-colors disabled:opacity-40">
            Send Warning
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BanRequestModal({ member, onConfirm, onCancel }: { member: GuildMember; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onCancel}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-panel border border-orange-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Ban className="w-6 h-6 text-orange-400 shrink-0" />
          <div>
            <p className="text-white font-bold text-sm">Request Ban — {member.username}</p>
            <p className="text-xs text-muted-foreground">Sent to Admin for approval</p>
          </div>
        </div>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for ban request…"
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-orange-500/50 resize-none"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/15 text-muted-foreground hover:text-white text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
            className="flex-1 py-2 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 text-sm font-semibold transition-colors disabled:opacity-40">
            Submit Request
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── DM Viewer Modal ───────────────────────────────────────────────────────────

function DMViewerModal({ member, onClose }: { member: GuildMember; onClose: () => void }) {
  const [openConv, setOpenConv] = useState<Conversation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["admin-conversations", member.id],
    queryFn: () => fetch(`/api/admin/dms/${member.id}`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 10_000,
  });
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [openConv?.messages?.length]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 16 }} transition={{ duration: 0.2 }}
        className="glass-panel border border-white/15 rounded-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ height: "min(640px, calc(100vh - 80px))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 shrink-0">
          {openConv ? (
            <button onClick={() => setOpenConv(null)} className="p-1 rounded-lg text-muted-foreground hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          ) : (
            <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          )}
          <img src={member.avatar} alt={member.username} className="w-7 h-7 rounded-full ring-1 ring-white/20 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{openConv ? openConv.listingTitle : `${member.username}'s messages`}</p>
            {openConv && <p className="text-xs text-muted-foreground truncate">{openConv.buyerName} → {openConv.sellerName}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Read-only</span>
          </div>
          {openConv && <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-white transition-colors ml-1"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {!openConv && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3 space-y-2">
                {isLoading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />) :
                  conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Inbox className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-white font-semibold">No conversations</p>
                      <p className="text-xs text-muted-foreground mt-1">{member.username} has no message history.</p>
                    </div>
                  ) : conversations.map((conv) => {
                    const isBuyer = conv.buyerId === member.id;
                    const otherName = isBuyer ? conv.sellerName : conv.buyerName;
                    const otherId = isBuyer ? conv.sellerId : conv.buyerId;
                    const otherAvatar = isBuyer ? conv.sellerAvatar : conv.buyerAvatar;
                    const otherAvatarUrl = otherId && otherAvatar ? `https://cdn.discordapp.com/avatars/${otherId}/${otherAvatar}.png?size=64` : null;
                    const lastMsg = conv.messages[conv.messages.length - 1];
                    return (
                      <button key={conv.id} onClick={() => setOpenConv(conv)}
                        className="w-full glass-panel rounded-xl p-3 border border-white/10 hover:border-primary/30 text-left flex items-start gap-3 transition-colors group">
                        {otherAvatarUrl
                          ? <img src={otherAvatarUrl} alt={otherName} className="w-9 h-9 rounded-full shrink-0 ring-1 ring-white/20" />
                          : <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{otherName[0]?.toUpperCase()}</div>}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 justify-between">
                            <p className="text-sm font-semibold text-white truncate">{isBuyer ? `You → ${otherName}` : `${otherName} → You`}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(conv.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          </div>
                          <p className="text-xs text-primary/70 truncate">{conv.listingTitle}</p>
                          {lastMsg && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{lastMsg.filtered ? "— filtered message —" : lastMsg.content}</p>}
                        </div>
                        <MessageSquare className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/50 shrink-0 mt-0.5 transition-colors" />
                      </button>
                    );
                  })}
              </motion.div>
            )}
            {openConv && (
              <motion.div key="thread" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.18 }} className="p-4 space-y-3">
                {openConv.messages.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No messages in this conversation.</p>
                  : openConv.messages.map((msg) => {
                    const isViewedUser = msg.senderId === member.id;
                    const avatarUrl = msg.senderId && msg.senderAvatar ? `https://cdn.discordapp.com/avatars/${msg.senderId}/${msg.senderAvatar}.png?size=64` : null;
                    return (
                      <div key={msg.id} className={cn("flex gap-2 items-end", isViewedUser ? "flex-row-reverse" : "flex-row")}>
                        {!isViewedUser && (avatarUrl ? <img src={avatarUrl} alt={msg.senderName} className="w-6 h-6 rounded-full shrink-0" />
                          : <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{msg.senderName[0]?.toUpperCase()}</div>)}
                        <div className={cn("max-w-[78%] space-y-0.5", isViewedUser ? "items-end" : "items-start")}>
                          <p className={cn("text-[10px] text-muted-foreground px-1", isViewedUser ? "text-right" : "text-left")}>{msg.senderName}</p>
                          {msg.filtered ? (
                            <div className={cn("flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs", isViewedUser ? "bg-primary/20 text-primary/60 rounded-br-sm" : "bg-white/10 text-muted-foreground rounded-bl-sm")}>
                              <AlertTriangle className="w-3 h-3" /><span className="italic">Message filtered</span>
                            </div>
                          ) : (
                            <div className={cn("px-3 py-2 rounded-2xl text-sm break-words", isViewedUser ? "bg-gradient-to-br from-primary to-secondary text-white rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm")}>
                              {msg.content}
                            </div>
                          )}
                          <p className={cn("text-[10px] text-muted-foreground/60 px-1", isViewedUser ? "text-right" : "text-left")}>
                            {new Date(msg.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                <div ref={bottomRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="shrink-0 border-t border-white/10 px-4 py-2 bg-white/5 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">
            {openConv ? `${openConv.messages.length} message${openConv.messages.length !== 1 ? "s" : ""} — admin view only` : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""} total`}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

const ASSIGNABLE_ROLES: { value: StaffRole; label: string }[] = [
  { value: "co-owner",          label: "Co-Owner" },
  { value: "admin",             label: "Admin" },
  { value: "mod",               label: "Mod" },
  { value: "verified_reseller", label: "Verified Reseller" },
];

const ROLE_RANK_MAP: Record<AnyRole, number> = { "owner": 4, "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0 };

function StaffTab({ callerRole }: { callerRole: AnyRole }) {
  const { data: staff = [], isLoading } = useStaff();
  const addStaff = useAddStaff();
  const changeRole = useChangeRole();
  const removeStaff = useRemoveStaff();

  const [newId, setNewId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("mod");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [debouncedLookupId, setDebouncedLookupId] = useState("");

  // Accept 15–21 digits to handle edge-case snowflakes without false negatives
  const isValidDiscordId = /^\d{15,21}$/.test(newId.trim());

  useEffect(() => {
    if (!isValidDiscordId) { setDebouncedLookupId(""); return; }
    const t = setTimeout(() => setDebouncedLookupId(newId.trim()), 700);
    return () => clearTimeout(t);
  }, [newId, isValidDiscordId]);

  const { data: lookedUpMember, isFetching: lookupFetching, isError: lookupFailed, error: lookupError } = useQuery<
    { id: string; username: string; avatar: string; inGuild: boolean },
    Error
  >({
    queryKey: ["member-lookup", debouncedLookupId],
    queryFn: () => fetch(`/api/admin/members/lookup?userId=${debouncedLookupId}`, { credentials: "include" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`); return d; }),
    enabled: debouncedLookupId.length >= 15,
    retry: false,
    staleTime: 60_000,
  });

  const callerRank = ROLE_RANK_MAP[callerRole];
  const assignable = ASSIGNABLE_ROLES.filter((r) => ROLE_RANK_MAP[r.value] < callerRank);

  async function handleAdd() {
    if (!newId.trim() || !newUsername.trim()) return;
    setAddError(null);
    try {
      await addStaff.mutateAsync({ userId: newId.trim(), username: newUsername.trim(), role: newRole });
      setNewId(""); setNewUsername("");
      setAddSuccess(true); setTimeout(() => setAddSuccess(false), 2000);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add staff member");
    }
  }

  const sorted = [...staff].sort((a, b) => (ROLE_RANK_MAP[b.role] ?? 0) - (ROLE_RANK_MAP[a.role] ?? 0));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Add form */}
      {assignable.length > 0 && (
        <div className="glass-panel border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-white text-sm">Add Staff Member</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Discord User ID</label>
              <input
                value={newId} onChange={(e) => setNewId(e.target.value)}
                placeholder="e.g. 123456789012345678"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Username</label>
              <input
                value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. username123"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition"
              />
            </div>
          </div>

          {/* Live Discord user lookup */}
          <AnimatePresence>
            {isValidDiscordId && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                {lookupFetching && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <RefreshCw className="w-3 h-3 animate-spin text-primary" />Looking up Discord user…
                  </div>
                )}
                {lookedUpMember && !lookupFetching && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-primary/20">
                    <img src={lookedUpMember.avatar} alt={lookedUpMember.username} className="w-9 h-9 rounded-full ring-1 ring-white/15 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{lookedUpMember.username}</p>
                      <p className="text-[11px] text-muted-foreground">{lookedUpMember.inGuild ? "✓ In server" : "Not in server · can still assign role"}</p>
                    </div>
                    {newUsername !== lookedUpMember.username ? (
                      <button onClick={() => setNewUsername(lookedUpMember.username)}
                        className="px-2.5 py-1 rounded-lg bg-primary/20 border border-primary/30 text-[11px] font-bold text-primary hover:bg-primary/30 transition-colors shrink-0">
                        Use Name
                      </button>
                    ) : (
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                    )}
                  </div>
                )}
                {lookupFailed && !lookupFetching && debouncedLookupId.length >= 15 && (() => {
                  const msg = lookupError?.message ?? "";
                  const isOffline = /offline|unavailable|bot/i.test(msg);
                  const isNotFound = /not found|404/i.test(msg);
                  return (
                    <div className={`text-xs px-3 py-2 rounded-xl border ${isOffline ? "text-amber-400 bg-amber-500/5 border-amber-500/15" : "text-red-400 bg-red-500/5 border-red-500/15"}`}>
                      {isOffline
                        ? "⚠️ Bot is offline — ID looks valid, enter the username manually and save."
                        : isNotFound
                          ? "No Discord account found for this ID — double-check and try again."
                          : `Lookup failed: ${msg || "unknown error"} — you can still add manually.`}
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 items-end">
            <div className="space-y-1 flex-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Role</label>
              <select
                value={newRole} onChange={(e) => setNewRole(e.target.value as StaffRole)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-primary/50 transition"
              >
                {assignable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button
              onClick={handleAdd}
              disabled={!newId.trim() || !newUsername.trim() || addStaff.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 text-sm font-bold transition-colors disabled:opacity-40"
            >
              {addSuccess ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {addSuccess ? "Added!" : "Add"}
            </button>
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
        </div>
      )}

      {/* Staff list */}
      <div className="space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Current Staff <span className="text-muted-foreground font-normal">({sorted.length})</span>
        </h3>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse border border-white/5" />)}</div>
        ) : sorted.length === 0 ? (
          <div className="glass-panel border border-white/10 rounded-2xl p-10 text-center">
            <UserCog className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No staff members added yet.</p>
          </div>
        ) : (
          sorted.map((s) => {
            const canModify = ROLE_RANK_MAP[s.role] < callerRank;
            return (
              <div key={s.userId} className={cn("glass-panel border rounded-xl px-4 py-3 flex items-center gap-3",
                s.role === "co-owner" ? "border-purple-500/20" : s.role === "admin" ? "border-primary/20" : "border-white/10")}>
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {s.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{s.username}</span>
                    <RoleBadge role={s.role} />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">{s.userId}</p>
                </div>
                {canModify && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      defaultValue={s.role}
                      onChange={(e) => changeRole.mutate({ userId: s.userId, role: e.target.value as StaffRole })}
                      className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground focus:outline-none focus:border-primary/40 transition"
                    >
                      {assignable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button
                      onClick={() => removeStaff.mutate(s.userId)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Role guide */}
      <div className="glass-panel border border-white/5 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Role Permissions</p>
        <div className="space-y-2 text-xs text-muted-foreground">
          {[
            { role: "owner" as AnyRole, perms: "Full access — all actions, manage all staff, monitor messages live" },
            { role: "co-owner" as AnyRole, perms: "Same as Owner — can monitor messages live, kick, manage staff below Co-Owner" },
            { role: "admin" as AnyRole, perms: "Ban, warn, timeout, delete listings, manage Mod & Verified Reseller roles" },
            { role: "mod" as AnyRole, perms: "Warn users, submit ban requests for Admin approval" },
            { role: "verified_reseller" as AnyRole, perms: "Shows ✓ Verified badge next to seller name on listings" },
          ].map(({ role, perms }) => (
            <div key={role} className="flex gap-2">
              <RoleBadge role={role} />
              <span className="flex-1">{perms}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Ban Requests Tab ──────────────────────────────────────────────────────────

function BanRequestsTab() {
  const { data: requests = [], isLoading, refetch } = useBanRequests();
  const approve = useApproveBanRequest();
  const reject = useRejectBanRequest();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function doApprove(id: string) {
    setBusyId(id);
    try { await approve.mutateAsync(id); } finally { setBusyId(null); }
  }
  async function doReject(id: string) {
    setBusyId(id);
    try { await reject.mutateAsync(id); } finally { setBusyId(null); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-bold text-white flex items-center gap-2 flex-1">
          <Ban className="w-4 h-4 text-orange-400" />
          Pending Ban Requests
          {requests.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 font-semibold">{requests.length}</span>
          )}
        </h3>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse border border-white/5" />)}</div>
      ) : requests.length === 0 ? (
        <div className="glass-panel border border-white/10 rounded-2xl p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500/30 mx-auto mb-3" />
          <p className="text-white font-semibold">No pending requests</p>
          <p className="text-xs text-muted-foreground mt-1">All ban requests have been handled.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="glass-panel border border-orange-500/15 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{r.targetUsername}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold">TARGET</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">{r.targetUserId}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">Reason</p>
                <p className="text-sm text-white">{r.reason}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Requested by <span className="text-white font-semibold">{r.requestedByUsername}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => doReject(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/15 text-muted-foreground hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    <XCircle className="w-3.5 h-3.5" />Reject
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => doApprove(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-40"
                  >
                    <Ban className="w-3.5 h-3.5" />Approve & Ban
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({
  member, callerRole,
  onBan, onTimeout, onRemoveTimeout, onSuspend, onUnsuspend,
  onKick, onViewDMs, onWarn, onBanRequest,
  busy,
}: {
  member: GuildMember; callerRole: AnyRole;
  onBan: () => void; onTimeout: () => void; onRemoveTimeout: () => void;
  onSuspend: () => void; onUnsuspend: () => void;
  onKick: () => void; onViewDMs: () => void; onWarn: () => void; onBanRequest: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTimedOut = !!member.timedOutUntil && new Date(member.timedOutUntil) > new Date();
  const canViewDMs = hasMinRole(callerRole, "co-owner");
  const canBanDirect = hasMinRole(callerRole, "admin");
  const canModerate = hasMinRole(callerRole, "admin");
  const canWarn = hasMinRole(callerRole, "mod");
  const canRequestBan = hasMinRole(callerRole, "mod") && !hasMinRole(callerRole, "admin");
  const canKick = hasMinRole(callerRole, "co-owner");

  // Cannot act on someone with equal/higher rank
  const memberRank = member.siteRole ? (ROLE_RANK_MAP[member.siteRole] ?? -1) : -1;
  const callerRank = ROLE_RANK_MAP[callerRole] ?? 0;
  const canActOn = !member.isOwner && memberRank < callerRank;

  const borderColor = member.isOwner ? "border-amber-500/30"
    : member.siteRole === "co-owner" ? "border-purple-500/20"
    : member.siteRole === "admin" ? "border-primary/20"
    : member.siteRole === "mod" ? "border-blue-500/15"
    : "border-white/10";

  return (
    <div className={cn("glass-panel border rounded-xl overflow-hidden transition-colors", borderColor)}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={canViewDMs ? onViewDMs : undefined}
          className={cn("flex items-center gap-3 flex-1 min-w-0 text-left", canViewDMs && "group cursor-pointer")}>
          <div className="relative shrink-0">
            <img src={member.avatar} alt={member.username}
              className={cn("w-9 h-9 rounded-full ring-1 ring-white/20 transition-all", canViewDMs && "group-hover:ring-primary/50")} />
            {member.isOwner && <Crown className="w-3.5 h-3.5 text-amber-400 absolute -top-1 -right-1 drop-shadow" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("text-sm font-bold text-white truncate", canViewDMs && "group-hover:text-primary transition-colors")}>
                {member.username}
              </span>
              {member.displayName && <span className="text-xs text-muted-foreground">({member.displayName})</span>}
              {member.siteRole && <RoleBadge role={member.siteRole} />}
              {member.isSuspended && <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-bold bg-red-500/15 border-red-500/40 text-red-400">SUSPENDED</span>}
              {isTimedOut && <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-bold bg-amber-500/15 border-amber-500/40 text-amber-400">TIMED OUT</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {member.guilds && member.guilds.length > 0
                ? `${member.guilds.length} server${member.guilds.length !== 1 ? "s" : ""}`
                : member.joinedAt ? `Joined ${new Date(member.joinedAt).toLocaleDateString()}` : "Unknown"}
              {" · "}<span className="font-mono opacity-60">{member.id}</span>
            </p>
          </div>
        </button>

        {canViewDMs && (
          <button onClick={onViewDMs} title="View messages"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0">
            <MessageSquare className="w-4 h-4" />
          </button>
        )}

        <button onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }} className="overflow-hidden border-t border-white/10">
            <div className="px-4 py-3 space-y-3">
              {member.guilds && member.guilds.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Shared Servers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.guilds.map((g) => (
                      <span key={g.id} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                        {g.icon && <img src={g.icon} alt={g.name} className="w-3.5 h-3.5 rounded-full" />}
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {canActOn && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {/* Warn — mod+ */}
                    {canWarn && (
                      <button disabled={busy} onClick={onWarn}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-500/20 text-muted-foreground hover:border-yellow-500/40 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-40">
                        <FileWarning className="w-3 h-3" />Warn
                      </button>
                    )}

                    {/* Timeout — admin+ */}
                    {canModerate && (
                      isTimedOut ? (
                        <button disabled={busy} onClick={onRemoveTimeout}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
                          <Clock className="w-3 h-3" />Remove Timeout
                        </button>
                      ) : (
                        <button disabled={busy} onClick={onTimeout}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/20 text-muted-foreground hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40">
                          <Clock className="w-3 h-3" />Timeout
                        </button>
                      )
                    )}

                    {/* Suspend — admin+ */}
                    {canModerate && (
                      member.isSuspended ? (
                        <button disabled={busy} onClick={onUnsuspend}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
                          <UserX className="w-3 h-3" />Lift Suspension
                        </button>
                      ) : (
                        <button disabled={busy} onClick={onSuspend}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/20 text-muted-foreground hover:border-orange-500/40 hover:text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-40">
                          <UserX className="w-3 h-3" />Suspend
                        </button>
                      )
                    )}

                    {/* Kick — co-owner+ */}
                    {canKick && (
                      <button disabled={busy} onClick={onKick}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/20 text-muted-foreground hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                        <Hammer className="w-3 h-3" />Kick
                      </button>
                    )}

                    {/* Ban — admin+ */}
                    {canBanDirect && (
                      <button disabled={busy} onClick={onBan}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-600/30 bg-red-500/5 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                        <Ban className="w-3 h-3" />Ban
                      </button>
                    )}

                    {/* Request Ban — mod only (not admin+) */}
                    {canRequestBan && (
                      <button disabled={busy} onClick={onBanRequest}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/30 bg-orange-500/5 text-orange-400 hover:bg-orange-500/15 transition-colors disabled:opacity-40">
                        <Ban className="w-3 h-3" />Request Ban
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!canActOn && (
                <p className="text-xs text-muted-foreground/60 italic">
                  {member.isOwner ? "This is the server owner — actions disabled." : "You cannot take actions against this user's rank."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Theme Tab ────────────────────────────────────────────────────────────────

type SiteTheme = {
  primaryColor: string;
  secondaryColor: string;
  bgUrl: string | null;
  bgOverlay: number;
  bgBlur: boolean;
};

const DEFAULT_THEME: SiteTheme = {
  primaryColor: "#ff0080",
  secondaryColor: "#7c3aed",
  bgUrl: null,
  bgOverlay: 0.6,
  bgBlur: false,
};

function ThemeTab() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: saved, isLoading } = useQuery<SiteTheme>({
    queryKey: ["site-theme"],
    queryFn: () => fetch("/api/theme").then((r) => r.json()),
    staleTime: 10_000,
  });

  const [local, setLocal] = useState<SiteTheme>(DEFAULT_THEME);
  useEffect(() => { if (saved) setLocal(saved); }, [saved]);

  // Sub-tab: "site" or "profile"
  const [section, setSection] = useState<"site" | "profile">("site");

  // Profile state
  const { data: ownProfile } = useOwnProfile();
  const updateProfile = useUpdateProfile();
  const [pTagline, setPTagline] = useState("");
  const [pBio, setPBio] = useState("");
  const [pTradePrefs, setPTradePrefs] = useState("");
  const [pAccentColor, setPAccentColor] = useState("#ff0080");
  const [pBannerStyle, setPBannerStyle] = useState<BannerStyle>("default");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [currentBgUrl, setCurrentBgUrl] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ownProfile) return;
    setPTagline(ownProfile.tagline ?? "");
    setPBio(ownProfile.bio ?? "");
    setPTradePrefs(ownProfile.tradePreferences ?? "");
    setPAccentColor(ownProfile.accentColor ?? "#ff0080");
    setPBannerStyle((ownProfile.bannerStyle as BannerStyle) ?? "default");
    setCurrentAvatarUrl(ownProfile.customAvatarUrl ?? null);
    setCurrentBannerUrl(ownProfile.bannerImageUrl ?? null);
    setCurrentBgUrl(ownProfile.profileBgUrl ?? null);
  }, [ownProfile?.userId]);

  async function handleProfileSave() {
    setProfileSaving(true);
    try {
      await updateProfile.mutateAsync({ tagline: pTagline, bio: pBio, tradePreferences: pTradePrefs, accentColor: pAccentColor, bannerStyle: pBannerStyle });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch { /* handled by mutation */ }
    finally { setProfileSaving(false); }
  }

  async function handleProfileImageUpload(type: "avatar" | "banner" | "profileBg", file: File) {
    const setUploading = type === "avatar" ? setAvatarUploading : type === "banner" ? setBannerUploading : setBgUploading;
    const setError = type === "avatar" ? setAvatarUploadError : type === "banner" ? setBannerUploadError : setBgUploadError;
    const setUrl = type === "avatar" ? setCurrentAvatarUrl : type === "banner" ? setCurrentBannerUrl : setCurrentBgUrl;
    setUploading(true); setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const r = await fetch(`/api/uploads/profile-image?type=${type}`, { method: "POST", credentials: "include", body: form });
      const data = await r.json() as { ok?: boolean; url?: string; error?: string; pending?: boolean };
      if (!r.ok) throw new Error(data.error ?? "Upload failed");
      if (data.pending) setError("✅ Submitted for review — will appear once approved");
      else setUrl(data.url ?? null);
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  async function handleRemoveProfileImage(type: "avatar" | "banner" | "profileBg") {
    const setUrl = type === "avatar" ? setCurrentAvatarUrl : type === "banner" ? setCurrentBannerUrl : setCurrentBgUrl;
    const r = await fetch(`/api/uploads/profile-image?type=${type}`, { method: "DELETE", credentials: "include" });
    if (r.ok) setUrl(null);
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) { showToast("Only image files allowed", false); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/uploads/theme-bg", { method: "POST", body: fd, credentials: "include" });
      const data = await r.json();
      if (data.ok) {
        setLocal((prev) => ({ ...prev, bgUrl: data.url }));
        showToast("Background uploaded!");
      } else {
        showToast(data.error ?? "Upload failed", false);
      }
    } catch { showToast("Upload failed", false); }
    finally { setUploading(false); }
  }

  async function pickColor(field: "primaryColor" | "secondaryColor") {
    if (!("EyeDropper" in window)) return;
    try {
      const eyeDropper = new (window as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
      const { sRGBHex } = await eyeDropper.open();
      setLocal((p) => ({ ...p, [field]: sRGBHex }));
    } catch { /* user cancelled */ }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(local),
      });
      const data = await r.json();
      if (data.ok) {
        qc.setQueryData(["site-theme"], data.theme);
        applyThemeColors(data.theme.primaryColor, data.theme.secondaryColor);
        showToast("Theme saved! Changes are live.");
      } else {
        showToast(data.error ?? "Failed to save", false);
      }
    } catch { showToast("Failed to save", false); }
    finally { setSaving(false); }
  }

  function handleReset() {
    setLocal({ ...DEFAULT_THEME });
  }

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
    </div>
  );

  const hasChanges = JSON.stringify(local) !== JSON.stringify(saved);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* Sub-tab navigation */}
      <div className="flex gap-1 p-1 glass-panel rounded-xl border border-white/10">
        <button onClick={() => setSection("site")}
          className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors",
            section === "site" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white")}>
          <Palette className="w-3.5 h-3.5" /> Site Theme
        </button>
        <button onClick={() => setSection("profile")}
          className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors",
            section === "profile" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white")}>
          <User className="w-3.5 h-3.5" /> My Profile
        </button>
      </div>

      {section === "profile" ? (
        <div className="space-y-5">
          {/* About */}
          <div className="glass-panel border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-white flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" /> About You</h3>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                <span>Tagline</span><span className={pTagline.length > 70 ? "text-orange-400" : ""}>{pTagline.length}/80</span>
              </label>
              <input value={pTagline} onChange={(e) => setPTagline(e.target.value.slice(0, 80))}
                placeholder="Your short tagline…"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                <span>Bio</span><span className={pBio.length > 450 ? "text-orange-400" : ""}>{pBio.length}/500</span>
              </label>
              <textarea value={pBio} onChange={(e) => setPBio(e.target.value.slice(0, 500))}
                placeholder="Tell people about yourself, your trade history, what you sell…"
                rows={4}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex justify-between">
                <span>Trade Preferences</span><span className={pTradePrefs.length > 180 ? "text-orange-400" : ""}>{pTradePrefs.length}/200</span>
              </label>
              <textarea value={pTradePrefs} onChange={(e) => setPTradePrefs(e.target.value.slice(0, 200))}
                placeholder="e.g. Looking to buy limiteds, selling for PayPal / Cash App…"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition resize-none" />
            </div>
          </div>

          {/* Style */}
          <div className="glass-panel border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-white flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> Style</h3>

            {/* Banner style */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Banner Style</label>
              <div className="grid grid-cols-4 gap-2">
                {BANNER_STYLES.map((s) => (
                  <button key={s.key} onClick={() => setPBannerStyle(s.key)}
                    className={cn("h-10 rounded-xl transition-all relative overflow-hidden", getBannerClass(s.key),
                      pBannerStyle === s.key ? "ring-2 ring-white scale-105" : "opacity-60 hover:opacity-90")}>
                    {pBannerStyle === s.key && <div className="absolute inset-0 flex items-center justify-center"><Check className="w-4 h-4 text-white drop-shadow" /></div>}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BANNER_STYLES.map((s) => (
                  <p key={s.key} className={cn("text-center text-[10px]", pBannerStyle === s.key ? "text-white font-bold" : "text-muted-foreground")}>{s.label}</p>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Profile Accent Color</label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button key={c.hex} onClick={() => setPAccentColor(c.hex)} title={c.label}
                    className={cn("w-8 h-8 rounded-full border-2 transition-all", pAccentColor === c.hex ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: c.hex }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Custom:</label>
                <input type="text" value={pAccentColor}
                  onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPAccentColor(v); }}
                  maxLength={7}
                  className="w-28 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-primary/50 transition" />
                <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: pAccentColor }} />
              </div>
            </div>

            {/* Avatar */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Avatar Image</label>
              <div className="flex items-center gap-3">
                {currentAvatarUrl
                  ? <img src={currentAvatarUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/40" />
                  : <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-muted-foreground">None</div>}
                <div className="flex gap-2">
                  <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition disabled:opacity-50">
                    {avatarUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {avatarUploading ? "Uploading…" : "Upload"}
                  </button>
                  {currentAvatarUrl && <button onClick={() => handleRemoveProfileImage("avatar")}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition">Remove</button>}
                </div>
              </div>
              {avatarUploadError && <p className="text-xs text-amber-400">{avatarUploadError}</p>}
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProfileImageUpload("avatar", f); e.target.value = ""; }} />
            </div>

            {/* Banner */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Banner Image</label>
              <div className="flex items-center gap-3">
                {currentBannerUrl
                  ? <div className="w-28 h-10 rounded-lg bg-cover bg-center ring-1 ring-white/20" style={{ backgroundImage: `url(${currentBannerUrl})` }} />
                  : <div className="w-28 h-10 rounded-lg bg-white/10 flex items-center justify-center text-[10px] text-muted-foreground">None</div>}
                <div className="flex gap-2">
                  <button onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition disabled:opacity-50">
                    {bannerUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {bannerUploading ? "Uploading…" : "Upload"}
                  </button>
                  {currentBannerUrl && <button onClick={() => handleRemoveProfileImage("banner")}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition">Remove</button>}
                </div>
              </div>
              {bannerUploadError && <p className="text-xs text-amber-400">{bannerUploadError}</p>}
              <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProfileImageUpload("banner", f); e.target.value = ""; }} />
            </div>

            {/* Profile page background — separate from site-wide background */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Profile Page Background</label>
              <p className="text-[11px] text-muted-foreground/60">Fills only <em>your profile page</em> — separate from the site-wide background in Site Theme.</p>
              <div className="flex items-center gap-3">
                {currentBgUrl ? (
                  <div className="w-28 h-14 rounded-lg ring-1 ring-white/20 overflow-hidden shrink-0">
                    <img src={currentBgUrl} alt="Profile background" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-28 h-14 rounded-lg bg-white/10 border border-dashed border-white/15 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">No BG</div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => bgInputRef.current?.click()} disabled={bgUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition disabled:opacity-50">
                    {bgUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {bgUploading ? "Uploading…" : "Upload"}
                  </button>
                  {currentBgUrl && (
                    <button onClick={() => handleRemoveProfileImage("profileBg")}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition">Remove</button>
                  )}
                </div>
              </div>
              {bgUploadError && <p className="text-xs text-amber-400">{bgUploadError}</p>}
              <p className="text-[11px] text-muted-foreground/50">Max 20MB · JPEG, PNG, WebP, GIF · uploaded as-is (no crop)</p>
              <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProfileImageUpload("profileBg", f); e.target.value = ""; }} />
            </div>
          </div>

          {/* Save profile */}
          <button onClick={handleProfileSave} disabled={profileSaving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 text-white"
            style={{ background: `linear-gradient(135deg, ${local.primaryColor}, ${local.secondaryColor})` }}>
            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : profileSaved ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {profileSaving ? "Saving…" : profileSaved ? "Saved!" : "Save Profile"}
          </button>
        </div>
      ) : (<>

      {/* Color pickers */}
      <div className="glass-panel border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> Brand Colors
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Primary */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Accent Color</label>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/20 shrink-0">
                <input
                  type="color"
                  value={local.primaryColor}
                  onChange={(e) => setLocal((p) => ({ ...p, primaryColor: e.target.value }))}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                />
                <div className="absolute inset-0 rounded-xl" style={{ background: local.primaryColor }} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={local.primaryColor}
                    onChange={(e) => setLocal((p) => ({ ...p, primaryColor: e.target.value }))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                    placeholder="#ff0080"
                  />
                  {"EyeDropper" in window && (
                    <button
                      onClick={() => pickColor("primaryColor")}
                      title="Pick color from screen"
                      className="p-2 rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:border-white/30 transition-colors shrink-0"
                    >
                      <Pipette className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Buttons, sliders, highlights, badges, links</p>
              </div>
            </div>
          </div>

          {/* Secondary */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Secondary Color</label>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/20 shrink-0">
                <input
                  type="color"
                  value={local.secondaryColor}
                  onChange={(e) => setLocal((p) => ({ ...p, secondaryColor: e.target.value }))}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                />
                <div className="absolute inset-0 rounded-xl" style={{ background: local.secondaryColor }} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={local.secondaryColor}
                    onChange={(e) => setLocal((p) => ({ ...p, secondaryColor: e.target.value }))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                    placeholder="#7c3aed"
                  />
                  {"EyeDropper" in window && (
                    <button
                      onClick={() => pickColor("secondaryColor")}
                      title="Pick color from screen"
                      className="p-2 rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:border-white/30 transition-colors shrink-0"
                    >
                      <Pipette className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Gradients, accents</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live gradient preview */}
        <div className="h-8 rounded-xl" style={{ background: `linear-gradient(to right, ${local.primaryColor}, ${local.secondaryColor})` }} />
      </div>

      {/* Background image */}
      <div className="glass-panel border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" /> Site Background
        </h3>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden flex items-center justify-center",
            dragging ? "border-primary bg-primary/10" : "border-white/15 hover:border-white/30 hover:bg-white/3"
          )}
        >
          {local.bgUrl ? (
            <>
              <img src={local.bgUrl} alt="background preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              <div className="relative z-10 text-center">
                <Upload className="w-6 h-6 text-white mx-auto mb-1 drop-shadow" />
                <p className="text-xs font-semibold text-white drop-shadow">Click or drag to replace</p>
              </div>
            </>
          ) : (
            <div className="text-center">
              {uploading ? (
                <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              )}
              <p className="text-sm font-medium text-muted-foreground">
                {uploading ? "Uploading…" : "Drop image/GIF here or click to browse"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG, GIF, WEBP — max 15 MB</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />

        {/* Remove background button */}
        {local.bgUrl && (
          <button
            onClick={() => setLocal((p) => ({ ...p, bgUrl: null }))}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Remove background
          </button>
        )}

        {/* Overlay opacity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" /> Overlay Darkness
            </label>
            <span className="text-xs font-mono text-white">{Math.round(local.bgOverlay * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(local.bgOverlay * 100)}
            onChange={(e) => setLocal((p) => ({ ...p, bgOverlay: Number(e.target.value) / 100 }))}
            className="w-full accent-primary"
          />
          <p className="text-[10px] text-muted-foreground">Higher = darker overlay over the background image</p>
        </div>

        {/* Background blur */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Blur Background</p>
            <p className="text-[10px] text-muted-foreground">Softens the background image</p>
          </div>
          <button
            onClick={() => setLocal((p) => ({ ...p, bgBlur: !p.bgBlur }))}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors",
              local.bgBlur ? "bg-primary" : "bg-white/15"
            )}
          >
            <span className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
              local.bgBlur ? "translate-x-5" : "translate-x-0"
            )} />
          </button>
        </div>
      </div>

      {/* Live preview badge */}
      {local.bgUrl && (
        <div className="relative h-40 rounded-2xl overflow-hidden border border-white/10">
          <img src={local.bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: local.bgBlur ? "blur(4px) scale(1.05)" : "none" }} />
          <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${local.bgOverlay})` }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="font-display font-extrabold text-2xl" style={{ color: local.primaryColor }}>Preview</p>
              <p className="text-white/70 text-sm">This is how your background will look</p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
          style={{ background: `linear-gradient(135deg, ${local.primaryColor}, ${local.secondaryColor})`, color: "white" }}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Saving…" : hasChanges ? "Save & Apply Theme" : "Theme Saved"}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-white/15 text-muted-foreground hover:text-white hover:border-white/30 text-sm font-semibold transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2",
              toast.ok ? "bg-green-500/20 border-green-500/30 text-green-300" : "bg-red-500/20 border-red-500/30 text-red-300")}>
            {toast.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
      </>)}
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  type TabKey = "listings" | "members" | "staff" | "requests" | "theme";
  const [tab, setTab] = useState<TabKey>("members");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [timeoutTarget, setTimeoutTarget] = useState<GuildMember | null>(null);
  const [warnTarget, setWarnTarget] = useState<GuildMember | null>(null);
  const [banRequestTarget, setBanRequestTarget] = useState<GuildMember | null>(null);
  const [dmTarget, setDmTarget] = useState<GuildMember | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const warnUser = useWarnUser();
  const submitBanRequest = useSubmitBanRequest();

  const { data: adminMe } = useQuery<AdminRole>({
    queryKey: ["admin-me"],
    queryFn: () => fetch("/api/admin/me", { credentials: "include" }).then((r) => r.json()),
    enabled: !!user,
    refetchInterval: 8_000,
    staleTime: 5_000,
  });

  const callerRole: AnyRole | null = (adminMe?.role && adminMe.role !== "none") ? adminMe.role as AnyRole : null;
  const isAdmin = hasMinRole(callerRole, "admin");
  const isCoOwnerOrAbove = hasMinRole(callerRole, "co-owner");
  const isModOrAbove = hasMinRole(callerRole, "mod");

  // When role loads, jump to first accessible tab if the current one isn't visible
  useEffect(() => {
    if (!callerRole) return;
    const ROLE_RANK: Record<string, number> = { owner: 4, "co-owner": 3, admin: 2, mod: 1, verified_reseller: 0 };
    const minRoles: Record<TabKey, string> = { members: "mod", requests: "mod", listings: "admin", staff: "mod", theme: "admin" };
    const rank = ROLE_RANK[callerRole] ?? 0;
    if ((ROLE_RANK[minRoles[tab]] ?? 99) > rank) {
      const first = (["members", "requests", "listings", "staff", "theme"] as TabKey[]).find(
        (k) => (ROLE_RANK[minRoles[k]] ?? 99) <= rank
      );
      if (first) setTab(first);
    }
  }, [callerRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats", { credentials: "include" }).then((r) => { if (!r.ok) throw new Error("Forbidden"); return r.json(); }),
    enabled: isAdmin,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery<Listing[]>({
    queryKey: ["admin-listings"],
    queryFn: () => fetch("/api/admin/listings", { credentials: "include" }).then((r) => r.json()),
    enabled: isAdmin,
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(memberSearch.trim()), 350);
    return () => clearTimeout(id);
  }, [memberSearch]);

  const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery<GuildMember[]>({
    queryKey: ["admin-members"],
    queryFn: () => fetch("/api/admin/members", { credentials: "include" }).then((r) => r.json()),
    enabled: isModOrAbove && tab === "members",
    staleTime: 30_000,
  });

  const { data: searchResults, isFetching: searchFetching } = useQuery<GuildMember[]>({
    queryKey: ["admin-members-search", debouncedSearch],
    queryFn: () => fetch(`/api/admin/members/search?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" }).then((r) => r.json()),
    enabled: isModOrAbove && tab === "members" && debouncedSearch.length >= 2,
    staleTime: 10_000,
  });

  const { data: banRequests = [] } = useQuery<BanRequest[]>({
    queryKey: ["admin-ban-requests"],
    queryFn: () => fetch("/api/admin/ban-requests", { credentials: "include" }).then((r) => r.json()),
    enabled: isModOrAbove,
    refetchInterval: 30_000,
  });

  const isSearching = memberSearch.trim().length >= 2;
  const filteredMembers = useMemo(() => {
    if (isSearching && searchResults) return searchResults;
    if (isSearching) return [];
    return members;
  }, [members, searchResults, isSearching]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function setBusy(id: string, v: boolean) {
    setBusyIds((prev) => { const n = new Set(prev); v ? n.add(id) : n.delete(id); return n; });
  }

  async function memberAction(userId: string, fn: () => Promise<Response>) {
    setBusy(userId, true);
    try {
      const r = await fn();
      const data = await r.json();
      if (data.ok) { showToast("Done!"); qc.invalidateQueries({ queryKey: ["admin-members"] }); }
      else showToast(data.error ?? "Failed", false);
    } catch { showToast("Request failed", false); }
    finally { setBusy(userId, false); }
  }

  const deleteListing = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/listings/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  const clearAll = useMutation({
    mutationFn: () => fetch("/api/admin/listings", { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  const clearSoldOut = useMutation({
    mutationFn: () => fetch("/api/admin/listings/sold-out", { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  function ask(message: string, action: () => void) { setConfirm({ message, action }); }

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

  const tabs: { key: TabKey; label: string; icon: any; minRole: AnyRole }[] = [
    { key: "members", label: "Members", icon: Users, minRole: "mod" },
    { key: "requests", label: `Requests${banRequests.length > 0 ? ` (${banRequests.length})` : ""}`, icon: Ban, minRole: "mod" },
    { key: "listings", label: "Listings", icon: ShoppingBag, minRole: "admin" },
    { key: "staff", label: "Staff", icon: UserCog, minRole: "mod" },
    { key: "theme", label: "Theme", icon: Palette, minRole: "admin" },
  ];

  const visibleTabs = tabs.filter((t) => hasMinRole(callerRole, t.minRole));

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl border flex items-center justify-center shadow-lg",
            callerRole === "owner" ? "bg-amber-500/20 border-amber-500/30 shadow-amber-500/20"
              : callerRole === "co-owner" ? "bg-purple-500/20 border-purple-500/30 shadow-purple-500/20"
              : "bg-primary/20 border-primary/30 shadow-primary/20"
          )}>
            {callerRole === "owner" || callerRole === "co-owner" ? <Crown className="w-5 h-5 text-amber-400" /> : <Shield className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white">Admin Panel</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              Logged in as <span className="font-semibold text-white">{user.username}</span>
              {callerRole && <RoleBadge role={callerRole} />}
            </p>
          </div>
        </motion.div>

        {/* Stats — admin+ only */}
        {isAdmin && (
          statsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-panel border border-white/10 rounded-2xl p-5 h-20 animate-pulse bg-white/5" />)}
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
          ) : null
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-black/40 rounded-xl w-fit flex-wrap">
          {visibleTabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === t.key ? "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(255,0,128,0.15)]" : "text-muted-foreground hover:text-white")}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── LISTINGS TAB ── */}
        {tab === "listings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <button onClick={() => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                <RefreshCw className="w-4 h-4" />Refresh
              </button>
              <button onClick={() => ask("Remove all sold-out items from listings?", () => clearSoldOut.mutate())}
                disabled={clearSoldOut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-sm font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" />Clear Sold-Out
              </button>
              <button onClick={() => ask("Delete ALL listings? This cannot be undone.", () => clearAll.mutate())}
                disabled={clearAll.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                <AlertTriangle className="w-4 h-4" />Clear All Listings
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-display font-bold text-white">
                All Listings <span className="text-muted-foreground text-base font-normal">({listings.length})</span>
              </h2>
              {listingsLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-panel border border-white/10 rounded-xl h-16 animate-pulse bg-white/5" />)}</div>
              ) : listings.length === 0 ? (
                <div className="glass-panel border border-white/10 rounded-2xl p-12 text-center text-muted-foreground">No listings found.</div>
              ) : (
                <div className="space-y-2">
                  {listings.map((listing) => {
                    const avatarUrl = listing.discordUserId && listing.discordAvatar
                      ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64` : null;
                    const activeCount = listing.items.filter((i) => !i.soldOut).length;
                    const isExpanded = expandedId === listing.id;
                    return (
                      <div key={listing.id} className="glass-panel border border-white/10 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          {avatarUrl
                            ? <img src={avatarUrl} alt={listing.seller} className="w-8 h-8 rounded-full ring-1 ring-white/20 shrink-0" />
                            : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{listing.seller[0]?.toUpperCase()}</div>}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white">{listing.seller}</span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-semibold">{activeCount} active</span>
                              {listing.items.some((i) => i.soldOut) && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                                  {listing.items.filter((i) => i.soldOut).length} sold
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{new Date(listing.createdAt).toLocaleString()} · {listing.id.slice(0, 8)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button onClick={() => ask(`Delete ${listing.seller}'s listing?`, () => deleteListing.mutate(listing.id))}
                              disabled={deleteListing.isPending}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }} className="overflow-hidden border-t border-white/10">
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
                <input type="text" placeholder="Search by name… (live)" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition" />
                {searchFetching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary animate-spin" />}
                {memberSearch && !searchFetching && (
                  <button onClick={() => setMemberSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button onClick={() => refetchMembers()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                <RefreshCw className="w-4 h-4" />Refresh
              </button>
            </div>

            {!isSearching && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                <span>Showing members the bot has seen. Use search to find any server member by username.</span>
              </div>
            )}

            {membersLoading && !isSearching ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-panel border border-white/10 rounded-xl h-16 animate-pulse bg-white/5" />)}</div>
            ) : filteredMembers.length === 0 ? (
              <div className="glass-panel border border-white/10 rounded-2xl p-10 text-center">
                <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{isSearching ? `No members match "${memberSearch}"` : "No cached members yet."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    callerRole={callerRole ?? "mod"}
                    busy={busyIds.has(member.id)}
                    onViewDMs={() => setDmTarget(member)}
                    onWarn={() => setWarnTarget(member)}
                    onBanRequest={() => setBanRequestTarget(member)}
                    onBan={() => ask(`Ban ${member.username} from all servers?`, () =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/ban`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ reason: "Banned via admin panel" }) }))
                    )}
                    onTimeout={() => setTimeoutTarget(member)}
                    onRemoveTimeout={() =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/timeout`, { method: "DELETE", credentials: "include" }))
                    }
                    onSuspend={() => ask(`Suspend ${member.username} from the site?`, () =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/suspend`, { method: "POST", credentials: "include" }))
                    )}
                    onUnsuspend={() =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/suspend`, { method: "DELETE", credentials: "include" }))
                    }
                    onKick={() => ask(`Kick ${member.username} from all servers?`, () =>
                      memberAction(member.id, () => fetch(`/api/admin/members/${member.id}/kick`, { method: "POST", credentials: "include" }))
                    )}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── STAFF TAB ── */}
        {tab === "staff" && callerRole && (
          <StaffTab callerRole={callerRole} />
        )}

        {/* ── BAN REQUESTS TAB ── */}
        {tab === "requests" && <BanRequestsTab />}

        {/* ── THEME TAB ── */}
        {tab === "theme" && <ThemeTab />}

      </div>

      {/* Modals */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal message={confirm.message}
            onConfirm={() => { confirm.action(); setConfirm(null); }}
            onCancel={() => setConfirm(null)} />
        )}
        {timeoutTarget && (
          <TimeoutModal member={timeoutTarget}
            onConfirm={(minutes) => {
              const m = timeoutTarget;
              setTimeoutTarget(null);
              memberAction(m.id, () => fetch(`/api/admin/members/${m.id}/timeout`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ minutes }) }));
            }}
            onCancel={() => setTimeoutTarget(null)} />
        )}
        {warnTarget && (
          <WarnModal member={warnTarget}
            onConfirm={async (reason) => {
              const m = warnTarget;
              setWarnTarget(null);
              try {
                await warnUser.mutateAsync({ userId: m.id, reason });
                showToast(`Warning sent to ${m.username}`);
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Failed to warn", false);
              }
            }}
            onCancel={() => setWarnTarget(null)} />
        )}
        {banRequestTarget && (
          <BanRequestModal member={banRequestTarget}
            onConfirm={async (reason) => {
              const m = banRequestTarget;
              setBanRequestTarget(null);
              try {
                await submitBanRequest.mutateAsync({ userId: m.id, targetUsername: m.username, reason });
                showToast("Ban request submitted for Admin approval");
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Failed", false);
              }
            }}
            onCancel={() => setBanRequestTarget(null)} />
        )}
        {dmTarget && (
          <DMViewerModal member={dmTarget} onClose={() => setDmTarget(null)} />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2",
              toast.ok ? "bg-green-500/20 border-green-500/30 text-green-300" : "bg-red-500/20 border-red-500/30 text-red-300")}>
            {toast.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
