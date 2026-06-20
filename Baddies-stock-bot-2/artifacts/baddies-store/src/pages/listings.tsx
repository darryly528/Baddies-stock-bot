import { useState, useRef, useEffect, useCallback } from "react";
import { useListings, Listing, ListingItem, Bid, usePlaceBid, useRetractBid } from "@/hooks/use-listings";
import { useConfig } from "@/hooks/use-config";
import { useAuth } from "@/contexts/auth-context";
import {
  useConversation,
  useStartConversation,
  useSendMessage,
} from "@/hooks/use-messages";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  LayoutList,
  ShoppingBag,
  MessageCircle,
  Send,
  X,
  AlertTriangle,
  LogIn,
  ShoppingCart,
  Plus,
  Check,
  Trash2,
  Box,
  CreditCard,
  BadgeDollarSign,
  ExternalLink,
  CheckCircle2,
  Gavel,
  Clock,
  TrendingUp,
  ChevronUp,
  HandCoins,
  Flag,
  Image as ImageIcon,
  Store,
  Tag,
} from "lucide-react";
import { Link } from "wouter";
import { ReportModal, type ReportTarget } from "@/components/report-modal";
import { cn, formatNumber } from "@/lib/utils";

const PAYMENT_EMOJI: Record<string, string> = {
  "PayPal":    "https://cdn.discordapp.com/emojis/1481817468912799814.png",
  "Apple Pay": "https://cdn.discordapp.com/emojis/1481817467813888212.png",
  "Cash App":  "https://cdn.discordapp.com/emojis/1481817227975069718.png",
  "Venmo":     "https://cdn.discordapp.com/emojis/1481817470431006883.png",
  "Robux":     "/robux-logo.png",
};

interface CartEntry {
  listingId: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  item: ListingItem;
}

interface FlatItem {
  listing: Listing;
  item: ListingItem;
}

function useTimeLeft(endsAt: string | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; mins: number; secs: number; ended: boolean } | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    function calc() {
      const diff = new Date(endsAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0, ended: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor(diff / 3600000) % 24,
        mins: Math.floor(diff / 60000) % 60,
        secs: Math.floor(diff / 1000) % 60,
        ended: false,
      });
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return timeLeft;
}

interface ChatPanelProps {
  listingId: string;
  listingTitle: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  myId: string;
  prefill?: string;
  onClose: () => void;
}

function ChatPanel({ listingId, listingTitle, sellerId, sellerName, sellerAvatar, myId, prefill, onClose }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [firstDraft, setFirstDraft] = useState(prefill ?? "");
  const [started, setStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const startConv = useStartConversation();
  const sendMsg = useSendMessage(conversationId);
  const { data: conv, isLoading: convLoading } = useConversation(conversationId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length]);

  async function handleStart() {
    if (!firstDraft.trim()) return;
    setStartError(null);
    try {
      const result = await startConv.mutateAsync({
        listingId,
        listingTitle,
        sellerId,
        sellerName,
        sellerAvatar,
        firstMessage: firstDraft.trim(),
      });
      setConversationId(result.conversationId);
      setStarted(true);
      setFirstDraft("");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start conversation");
    }
  }

  async function handleSend() {
    if (!draft.trim() || !conversationId) return;
    const text = draft.trim();
    setDraft("");
    try {
      await sendMsg.mutateAsync(text);
    } catch {
      setDraft(text);
    }
  }

  const sellerAvatarUrl = sellerId && sellerAvatar
    ? `https://cdn.discordapp.com/avatars/${sellerId}/${sellerAvatar}.png?size=64`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      className="fixed inset-x-2 bottom-20 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 w-auto sm:w-full sm:max-w-sm flex flex-col glass-panel rounded-2xl border border-white/15 shadow-2xl overflow-hidden"
      style={{ maxHeight: "min(75vh, 520px)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 flex-shrink-0">
        {sellerAvatarUrl ? (
          <img src={sellerAvatarUrl} alt={sellerName} className="w-8 h-8 rounded-full ring-2 ring-primary/30" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            {sellerName[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{sellerName}</p>
          <p className="text-xs text-muted-foreground truncate">{listingTitle}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {!started && !conversationId ? (
          <div className="text-center py-6 space-y-2">
            <MessageCircle className="w-10 h-10 text-primary/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Start a conversation with <span className="text-white font-semibold">{sellerName}</span>
            </p>
          </div>
        ) : convLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          conv?.messages.map((msg) => {
            const isMe = msg.senderId === myId;
            const avatarUrl = msg.senderId && msg.senderAvatar
              ? `https://cdn.discordapp.com/avatars/${msg.senderId}/${msg.senderAvatar}.png?size=64`
              : null;
            return (
              <div key={msg.id} className={cn("flex gap-2 items-end", isMe ? "flex-row-reverse" : "flex-row")}>
                {!isMe && (
                  avatarUrl ? (
                    <img src={avatarUrl} alt={msg.senderName} className="w-6 h-6 rounded-full flex-shrink-0 mb-1" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0 mb-1">
                      {msg.senderName[0]?.toUpperCase()}
                    </div>
                  )
                )}
                <div className={cn("max-w-[80%] space-y-0.5", isMe ? "items-end" : "items-start")}>
                  {msg.filtered ? (
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm",
                      isMe ? "bg-primary/20 text-primary/60 rounded-br-sm" : "bg-white/10 text-muted-foreground rounded-bl-sm"
                    )}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span className="italic text-xs">Message filtered</span>
                    </div>
                  ) : (
                    <div className={cn(
                      "px-3 py-2 rounded-2xl text-sm break-words",
                      isMe
                        ? "bg-gradient-to-br from-primary to-secondary text-white rounded-br-sm"
                        : "bg-white/10 text-white rounded-bl-sm"
                    )}>
                      {msg.content}
                    </div>
                  )}
                  <p className={cn("text-[10px] text-muted-foreground px-1", isMe ? "text-right" : "text-left")}>
                    {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t border-white/10 p-3 space-y-2">
        {startError && (
          <p className="text-red-400 text-xs px-1">{startError}</p>
        )}
        {!conversationId ? (
          <div className="flex gap-2">
            <input
              value={firstDraft}
              onChange={(e) => setFirstDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleStart()}
              placeholder="Type your first message…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
            <button
              onClick={handleStart}
              disabled={!firstDraft.trim() || startConv.isPending}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white disabled:opacity-40 transition-opacity flex-shrink-0"
            >
              {startConv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Message…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sendMsg.isPending}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white disabled:opacity-40 transition-opacity flex-shrink-0"
            >
              {sendMsg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/50 text-center">Messages are moderated. Be respectful.</p>
      </div>
    </motion.div>
  );
}

function AuctionCountdown({ endsAt }: { endsAt: string }) {
  const t = useTimeLeft(endsAt);
  if (!t) return null;
  if (t.ended) return <span className="text-red-400 font-bold text-xs">Ended</span>;
  if (t.days > 0) return <span className="font-mono text-amber-300 text-xs font-bold">{t.days}d {t.hours}h left</span>;
  if (t.hours > 0) return <span className="font-mono text-amber-300 text-xs font-bold">{t.hours}h {t.mins}m left</span>;
  return <span className="font-mono text-red-400 text-xs font-bold animate-pulse">{t.mins}m {t.secs}s left</span>;
}

function BidModal({
  listing,
  user,
  onClose,
  onLoginPrompt,
}: {
  listing: Listing;
  user: { id: string; username: string; avatar: string | null } | null;
  onClose: () => void;
  onLoginPrompt: () => void;
}) {
  const [bidInput, setBidInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const placeBid = usePlaceBid();
  const retractBid = useRetractBid();

  const bids = [...(listing.bids ?? [])].sort((a, b) => b.amount - a.amount);
  const highestBid = bids.length > 0 ? bids[0].amount : null;
  const floor = highestBid ?? (listing.startingBid ?? 0);
  const myBid = user ? bids.find((b) => b.userId === user.id) : undefined;
  const t = useTimeLeft(listing.auctionEndsAt);
  const ended = t?.ended ?? false;
  const isOwn = user?.id === listing.discordUserId;

  async function handleBid() {
    if (!user) { onClose(); onLoginPrompt(); return; }
    const amount = parseFloat(bidInput);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return; }
    setError(null);
    try {
      await placeBid.mutateAsync({ listingId: listing.id, amount });
      setBidInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bid");
    }
  }

  async function handleRetract() {
    if (!myBid) return;
    try {
      await retractBid.mutateAsync({ listingId: listing.id, bidId: myBid.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retract bid");
    }
  }

  const firstItem = listing.items[0];
  const sellerAvatarUrl = listing.discordUserId && listing.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="glass-panel rounded-2xl border border-amber-500/25 shadow-2xl w-full max-w-md overflow-hidden"
        style={{ maxHeight: "min(90vh, 680px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-amber-400" />
            <span className="font-display font-bold text-white">Live Auction</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              {bids.length} bid{bids.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(min(90vh, 680px) - 60px)" }}>
          {/* Item info */}
          <div className="px-5 py-4 flex items-center gap-4 border-b border-white/10">
            {firstItem?.imageUrl ? (
              <img src={firstItem.imageUrl} alt={firstItem.name} className="w-16 h-16 object-contain rounded-xl bg-black/40 p-1 flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-black/40 flex items-center justify-center flex-shrink-0">
                <Box className="w-8 h-8 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-base leading-tight">{listing.items.map((i) => i.name).join(", ")}</p>
              <div className="flex items-center gap-2 mt-1">
                {sellerAvatarUrl ? (
                  <img src={sellerAvatarUrl} alt={listing.seller} className="w-4 h-4 rounded-full" />
                ) : null}
                <span className="text-xs text-muted-foreground">{listing.seller}</span>
                {listing.isVerifiedReseller && (
                  <span title="Verified Reseller" className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" />VERIFIED
                  </span>
                )}
              </div>
              {listing.auctionEndsAt && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <AuctionCountdown endsAt={listing.auctionEndsAt} />
                </div>
              )}
            </div>
          </div>

          {/* Current bid */}
          <div className="px-5 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {highestBid ? "Current highest bid" : listing.startingBid ? "Starting bid" : "No bids yet"}
                </p>
                <p className="text-2xl font-display font-extrabold text-amber-300">
                  {highestBid != null
                    ? `$${highestBid.toFixed(2)}`
                    : listing.startingBid
                    ? `$${listing.startingBid.toFixed(2)}`
                    : "Free bid"}
                </p>
              </div>
              {myBid && (
                <div className="text-right">
                  <p className="text-xs text-green-400 font-semibold">Your bid: ${myBid.amount.toFixed(2)}</p>
                  {myBid.amount === highestBid && (
                    <p className="text-[10px] text-green-400/70 mt-0.5">You're winning!</p>
                  )}
                </div>
              )}
            </div>

            {/* Place bid */}
            {!ended && !isOwn && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Min bid: <span className="text-amber-300 font-semibold">${(floor + 0.01).toFixed(2)}</span>
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      value={bidInput}
                      onChange={(e) => { setBidInput(e.target.value); setError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && handleBid()}
                      placeholder={(floor + 0.01).toFixed(2)}
                      step="0.01"
                      min={floor + 0.01}
                      className="w-full bg-black/40 border border-amber-500/30 focus:border-amber-500/60 rounded-xl pl-7 pr-3 py-2.5 text-sm text-white outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <button
                    onClick={() => user ? handleBid() : (onClose(), onLoginPrompt())}
                    disabled={placeBid.isPending}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-[0_0_16px_rgba(245,158,11,0.35)] whitespace-nowrap"
                  >
                    {placeBid.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                    Place Bid
                  </button>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                {myBid && (
                  <button
                    onClick={handleRetract}
                    disabled={retractBid.isPending}
                    className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    {retractBid.isPending ? "Retracting…" : "Retract my bid"}
                  </button>
                )}
              </div>
            )}
            {ended && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold">
                This auction has ended
              </div>
            )}
            {isOwn && !ended && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground">
                This is your listing
              </div>
            )}
          </div>

          {/* Bid history */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Bid history ({bids.length})
            </p>
            {bids.length === 0 ? (
              <div className="text-center py-6">
                <Gavel className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No bids yet — be the first!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bids.map((bid, i) => {
                  const bidAvatarUrl = bid.userId && bid.avatar
                    ? `https://cdn.discordapp.com/avatars/${bid.userId}/${bid.avatar}.png?size=64`
                    : null;
                  const isWinner = i === 0;
                  const isMyBid = user?.id === bid.userId;
                  return (
                    <div
                      key={bid.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
                        isWinner
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-white/5 border-white/10"
                      )}
                    >
                      {isWinner && <ChevronUp className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                      {bidAvatarUrl ? (
                        <img src={bidAvatarUrl} alt={bid.username} className="w-7 h-7 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                          {bid.username[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-semibold truncate", isMyBid ? "text-primary" : "text-white")}>
                          {bid.username} {isMyBid && <span className="text-xs font-normal text-primary/70">(you)</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(bid.placedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <p className={cn("font-bold text-sm flex-shrink-0", isWinner ? "text-amber-300" : "text-white/70")}>
                        ${bid.amount.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function accentRgb(hex: string) {
  const h = (hex || "#ff0080").replace("#", "").padEnd(6, "0");
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

function getCardStyleProps(cardStyle: string | undefined, accent: string | undefined) {
  const a = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#ff0080";
  const rgb = accentRgb(a);
  const rgba = (o: number) => `rgba(${rgb},${o})`;

  switch (cardStyle) {
    case "neon":
      return {
        baseClass: "border transition-all duration-200",
        style: { borderColor: rgba(0.35) } as React.CSSProperties,
        whileHover: { borderColor: a, boxShadow: `0 0 28px ${rgba(0.45)}` },
        showStripe: false,
      };
    case "minimal":
      return {
        baseClass: "border border-white/5 transition-all duration-200",
        style: {} as React.CSSProperties,
        whileHover: {},
        showStripe: false,
      };
    case "frost":
      return {
        baseClass: "border border-white/20 transition-all duration-200",
        style: { background: "rgba(255,255,255,0.025)" } as React.CSSProperties,
        whileHover: { borderColor: "rgba(255,255,255,0.45)", boxShadow: "0 0 20px rgba(255,255,255,0.08)" },
        showStripe: false,
      };
    case "dark":
      return {
        baseClass: "border border-white/[0.06] transition-all duration-200",
        style: { background: "rgba(0,0,0,0.35)" } as React.CSSProperties,
        whileHover: { borderColor: rgba(0.45), boxShadow: `0 0 18px ${rgba(0.25)}` },
        showStripe: false,
      };
    case "gradient":
      return {
        baseClass: "border border-white/10 transition-all duration-200",
        style: {} as React.CSSProperties,
        whileHover: { borderColor: rgba(0.35), boxShadow: `0 0 22px ${rgba(0.3)}` },
        showStripe: true,
      };
    default:
      return {
        baseClass: "border border-white/10 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(255,0,128,0.15)] transition-all duration-200",
        style: {} as React.CSSProperties,
        whileHover: {},
        showStripe: false,
      };
  }
}

function getEdgeEffectProps(effect?: string, accent?: string) {
  if (!effect || effect === "none") return { addStyle: {} as React.CSSProperties, pulseAnimate: undefined as undefined | Record<string, string[]>, overlayKind: "none" as "none" | "shimmer" | "corner" };
  const a = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#ff0080";
  const rgb = accentRgb(a);
  const rgba = (o: number) => `rgba(${rgb},${o})`;
  if (effect === "glow") return { addStyle: { boxShadow: `0 0 24px ${rgba(0.42)}` } as React.CSSProperties, pulseAnimate: undefined, overlayKind: "none" as const };
  if (effect === "pulse") return { addStyle: {} as React.CSSProperties, pulseAnimate: { boxShadow: [`0 0 0px ${rgba(0)}`, `0 0 30px ${rgba(0.55)}`, `0 0 0px ${rgba(0)}`] }, overlayKind: "none" as const };
  if (effect === "shimmer") return { addStyle: {} as React.CSSProperties, pulseAnimate: undefined, overlayKind: "shimmer" as const };
  if (effect === "corner") return { addStyle: {} as React.CSSProperties, pulseAnimate: undefined, overlayKind: "corner" as const };
  return { addStyle: {} as React.CSSProperties, pulseAnimate: undefined, overlayKind: "none" as const };
}

function EdgeEffectOverlay({ effect, accent }: { effect?: string; accent?: string }) {
  const a = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#ff0080";
  const rgb = accentRgb(a);
  const rgba = (o: number) => `rgba(${rgb},${o})`;
  if (effect === "shimmer") {
    return (
      <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden rounded-2xl">
        <motion.div
          className="absolute top-0 bottom-0 w-20 -skew-x-12"
          style={{ background: `linear-gradient(90deg, transparent, ${rgba(0.16)}, transparent)` }}
          animate={{ x: ["-100%", "500%"] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 1.5 }}
        />
      </div>
    );
  }
  if (effect === "corner") {
    const cs: React.CSSProperties = { position: "absolute", width: 8, height: 8, background: a, boxShadow: `0 0 10px ${rgba(0.9)}, 0 0 20px ${rgba(0.5)}`, zIndex: 40, pointerEvents: "none" };
    return (
      <>
        <div style={{ ...cs, top: 0, left: 0, borderRadius: "2px 0 2px 0" }} />
        <div style={{ ...cs, top: 0, right: 0, borderRadius: "0 2px 0 2px" }} />
        <div style={{ ...cs, bottom: 0, left: 0, borderRadius: "0 2px 0 2px" }} />
        <div style={{ ...cs, bottom: 0, right: 0, borderRadius: "2px 0 2px 0" }} />
      </>
    );
  }
  return null;
}

function AuctionCard({
  flat,
  isOwn,
  onBid,
}: {
  flat: FlatItem;
  isOwn: boolean;
  onBid: () => void;
}) {
  const { listing, item } = flat;
  const avatarUrl = listing.discordUserId && listing.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
    : null;
  const bids = listing.bids ?? [];
  const highestBid = bids.length > 0 ? Math.max(...bids.map((b) => b.amount)) : null;
  const t = useTimeLeft(listing.auctionEndsAt);
  const ended = t?.ended ?? false;

  const urgentTimer = t && !t.ended && t.days === 0 && t.hours < 2;
  const isDefaultStyle = !listing.cardStyle || listing.cardStyle === "default";
  const stProps = (!ended && !isDefaultStyle)
    ? getCardStyleProps(listing.cardStyle, listing.sellerAccentColor)
    : null;
  const edgeProps = ended ? { addStyle: {} as React.CSSProperties, pulseAnimate: undefined, overlayKind: "none" as const } : getEdgeEffectProps(listing.sellerEdgeEffect, listing.sellerAccentColor);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
      }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 25 }, ...(stProps?.whileHover ?? {}) }}
      animate={edgeProps.pulseAnimate}
      transition={edgeProps.pulseAnimate ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : undefined}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl glass-panel",
        ended
          ? "border border-white/10 opacity-70 transition-all duration-200"
          : isDefaultStyle
          ? "border border-amber-500/25 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all duration-200"
          : stProps!.baseClass
      )}
      style={{ ...(stProps?.style ?? {}), ...edgeProps.addStyle }}
    >
      {stProps?.showStripe && !ended && (
        <div className="absolute top-0 inset-x-0 h-0.5 z-30" style={{ background: listing.sellerAccentColor ?? "#ff0080" }} />
      )}
      <EdgeEffectOverlay effect={edgeProps.overlayKind} accent={listing.sellerAccentColor} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80 z-10 pointer-events-none" />

      <div className="relative h-32 sm:h-44 w-full p-3 sm:p-5 flex items-center justify-center bg-black/40">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="object-contain w-full h-full drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500 ease-out relative z-0"
            loading="lazy"
          />
        ) : (
          <Box className="w-12 h-12 text-muted-foreground/40 relative z-0" />
        )}

        {/* Auction badge */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 backdrop-blur-md">
          <Gavel className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] sm:text-[10px] font-bold text-amber-300 uppercase tracking-wider">
            {ended ? "Ended" : "Auction"}
          </span>
        </div>

        {/* Bid count */}
        <div className="absolute top-2 right-2 z-20">
          <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-md bg-black/60 text-white/70 backdrop-blur-md border border-white/10">
            {bids.length} bid{bids.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="relative z-20 p-3 sm:p-4 flex flex-col gap-2 flex-grow">
        <h3 className="font-display font-bold text-sm sm:text-base text-white leading-tight line-clamp-2 group-hover:text-amber-300 transition-colors">
          {item.name}
        </h3>

        {/* Seller */}
        <div className="flex items-center gap-1.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={listing.seller} className="w-5 h-5 rounded-full ring-1 ring-white/20 flex-shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-400 flex-shrink-0">
              {listing.seller[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground truncate">{listing.seller}</span>
          {listing.isVerifiedReseller && (
            <span title="Verified Reseller" className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-bold flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" />
            </span>
          )}
        </div>

        {/* Timer */}
        {listing.auctionEndsAt && !ended && (
          <div className={cn("flex items-center gap-1", urgentTimer ? "text-red-400" : "text-amber-400")}>
            <Clock className="w-3 h-3 flex-shrink-0" />
            <AuctionCountdown endsAt={listing.auctionEndsAt} />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto">
          <div>
            {highestBid != null ? (
              <div>
                <p className="text-[10px] text-muted-foreground">Current bid</p>
                <p className="text-sm font-bold text-amber-300">${highestBid.toFixed(2)}</p>
              </div>
            ) : listing.startingBid ? (
              <div>
                <p className="text-[10px] text-muted-foreground">Starting at</p>
                <p className="text-sm font-bold text-amber-300/70">${listing.startingBid.toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No min bid</p>
            )}
          </div>

          {!isOwn && !ended && (
            <button
              onClick={onBid}
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all duration-200 shrink-0 bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-500/60"
            >
              <Gavel className="w-3 h-3" />
              <span className="hidden sm:inline">Bid</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ListingItemCard({
  flat,
  inCart,
  onToggle,
  isOwn,
  onOffer,
  onReport,
}: {
  flat: FlatItem;
  inCart: boolean;
  onToggle: () => void;
  isOwn: boolean;
  onOffer: () => void;
  onReport?: () => void;
}) {
  const { listing, item } = flat;
  const avatarUrl = listing.discordUserId && listing.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
    : null;

  const stProps = getCardStyleProps(listing.cardStyle, listing.sellerAccentColor);
  const edgeProps = getEdgeEffectProps(listing.sellerEdgeEffect, listing.sellerAccentColor);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
      }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 25 }, ...stProps.whileHover }}
      animate={edgeProps.pulseAnimate}
      transition={edgeProps.pulseAnimate ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : undefined}
      className={cn("group relative flex flex-col overflow-hidden rounded-2xl glass-panel", stProps.baseClass)}
      style={{ ...stProps.style, ...edgeProps.addStyle }}
    >
      {stProps.showStripe && (
        <div className="absolute top-0 inset-x-0 h-0.5 z-30" style={{ background: listing.sellerAccentColor ?? "#ff0080" }} />
      )}
      <EdgeEffectOverlay effect={edgeProps.overlayKind} accent={listing.sellerAccentColor} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80 z-10 pointer-events-none" />

      <div className="relative h-32 sm:h-44 w-full p-3 sm:p-5 flex items-center justify-center bg-black/40">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="object-contain w-full h-full drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500 ease-out relative z-0"
            loading="lazy"
          />
        ) : (
          <Box className="w-12 h-12 text-muted-foreground/40 relative z-0" />
        )}
        <div className="absolute top-2 left-2 z-20">
          <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-md uppercase tracking-wider backdrop-blur-md bg-white/10 border border-white/20 text-white/80">
            {item.itemType}
          </span>
        </div>
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-md bg-black/60 text-white/70 backdrop-blur-md border border-white/10">
            Qty: {item.quantity}
          </span>
        </div>
      </div>

      <div className="relative z-20 p-3 sm:p-4 flex flex-col gap-2 flex-grow">
        <h3 className={cn("font-display font-bold text-sm sm:text-base text-white leading-tight line-clamp-2 transition-colors",
          listing.cardStyle === "default" || !listing.cardStyle ? "group-hover:text-primary" : "group-hover:text-white/90")}>
          {item.name}
        </h3>

        <div className="flex items-center gap-2 mt-auto">
          {avatarUrl ? (
            <img src={avatarUrl} alt={listing.seller} className="w-5 h-5 rounded-full ring-1 ring-white/20 flex-shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
              {listing.seller[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground truncate">{listing.seller}</span>
          {listing.isVerifiedReseller && (
            <span title="Verified Reseller" className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-bold flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" />
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            {item.price ? (
              <p className="text-sm sm:text-base font-bold text-green-400">${item.price}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Ask seller</p>
            )}
          </div>

          {!isOwn && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Report button */}
              {onReport && (
                <button
                  onClick={onReport}
                  className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 py-1.5 rounded-lg border transition-all duration-200 bg-white/5 text-red-400/60 border-white/15 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40"
                  title="Report listing"
                >
                  <Flag className="w-3 h-3" />
                </button>
              )}

              {/* Offer button */}
              <button
                onClick={onOffer}
                className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 py-1.5 rounded-lg border transition-all duration-200 bg-white/5 text-white/60 border-white/15 hover:bg-secondary/20 hover:text-secondary hover:border-secondary/40"
                title="Make an offer"
              >
                <HandCoins className="w-3 h-3" />
                <span className="hidden sm:inline">Offer</span>
              </button>

              {/* Add to cart */}
              <button
                onClick={onToggle}
                className={cn(
                  "flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-200",
                  inCart
                    ? "bg-primary/20 text-primary border-primary/40 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40"
                    : "bg-white/5 text-white/70 border-white/15 hover:bg-primary/20 hover:text-primary hover:border-primary/40"
                )}
              >
                {inCart ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span className="hidden sm:inline">In Cart</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span className="hidden sm:inline">Add</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CartDrawer({
  cart,
  onRemove,
  onClear,
  onMessage,
  onBuyItem,
  onCheckout,
  onClose,
  user,
  onLoginPrompt,
}: {
  cart: CartEntry[];
  onRemove: (listingId: string, itemName: string) => void;
  onClear: () => void;
  onMessage: (entry: CartEntry) => void;
  onBuyItem: (entry: CartEntry) => void;
  onCheckout: () => void;
  onClose: () => void;
  user: { id: string } | null;
  onLoginPrompt: () => void;
}) {
  const sellerGroups = cart.reduce<Record<string, CartEntry[]>>((acc, e) => {
    acc[e.sellerId] = acc[e.sellerId] ?? [];
    acc[e.sellerId].push(e);
    return acc;
  }, {});

  const totalPriced = cart.filter((e) => e.item.price).reduce((sum, e) => sum + parseFloat(e.item.price!), 0);
  const hasAnyPrice = cart.some((e) => e.item.price);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative h-full w-full max-w-sm glass-panel border-l border-white/10 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-lg text-white">Cart</h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
              {cart.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Your cart is empty.</p>
              <p className="text-muted-foreground/60 text-xs">Click items on the listings page to add them.</p>
            </div>
          ) : (
            Object.entries(sellerGroups).map(([sellerId, entries]) => {
              const first = entries[0];
              const avatarUrl = first.sellerAvatar
                ? `https://cdn.discordapp.com/avatars/${sellerId}/${first.sellerAvatar}.png?size=64`
                : null;

              return (
                <div key={sellerId} className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={first.sellerName} className="w-6 h-6 rounded-full ring-1 ring-white/20" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                          {first.sellerName[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-white/70">{first.sellerName}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (!user) { onLoginPrompt(); return; }
                        onMessage(first);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border border-white/10 transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Message all
                    </button>
                  </div>

                  {entries.map((e) => (
                    <div key={e.item.name} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-black/30">
                      {e.item.imageUrl ? (
                        <img src={e.item.imageUrl} alt={e.item.name} className="w-9 h-9 object-contain flex-shrink-0" />
                      ) : (
                        <Box className="w-9 h-9 text-muted-foreground/30 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{e.item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">Qty: {e.item.quantity}</span>
                          {e.item.price && (
                            <span className="text-[11px] text-green-400 font-bold">${e.item.price}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            if (!user) { onLoginPrompt(); return; }
                            onBuyItem(e);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity whitespace-nowrap shadow-[0_0_10px_rgba(255,0,128,0.3)]"
                        >
                          <CreditCard className="w-3 h-3" />
                          Buy
                        </button>
                        <button
                          onClick={() => onRemove(e.listingId, e.item.name)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="flex-shrink-0 border-t border-white/10 p-4 space-y-3 bg-background/60 backdrop-blur-sm">
            {hasAnyPrice && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {cart.length} item{cart.length !== 1 ? "s" : ""}
                  {cart.some((e) => !e.item.price) && <span className="text-muted-foreground/60 ml-1">(some TBD)</span>}
                </span>
                <span className="font-bold text-green-400">
                  ${totalPriced.toFixed(2)}
                  {cart.some((e) => !e.item.price) && <span className="text-muted-foreground/60 text-xs">+</span>}
                </span>
              </div>
            )}
            <button
              onClick={() => {
                if (!user) { onLoginPrompt(); return; }
                onCheckout();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm shadow-[0_0_20px_rgba(255,0,128,0.35)] hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <BadgeDollarSign className="w-4 h-4" />
              Buy All ({cart.length} item{cart.length !== 1 ? "s" : ""})
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Shops view ────────────────────────────────────────────────────────────────

interface SellerShop {
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  listings: Listing[];
  itemCount: number;
  paymentMethods: string[];
  accentColor: string;
  sampleImages: (string | null)[];
}

function ShopsView({ listings, onMessage, user, onLoginPrompt }: {
  listings: Listing[];
  onMessage: (listing: Listing, item: ListingItem) => void;
  user: { id: string } | null;
  onLoginPrompt: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const shops = Object.values(
    listings.reduce<Record<string, SellerShop>>((acc, listing) => {
      const key = listing.discordUserId ?? listing.seller;
      if (!acc[key]) {
        acc[key] = {
          sellerId: listing.discordUserId ?? listing.seller,
          sellerName: listing.seller,
          sellerAvatar: listing.discordAvatar,
          listings: [],
          itemCount: 0,
          paymentMethods: [],
          accentColor: listing.sellerAccentColor ?? "#ff0080",
          sampleImages: [],
        };
      }
      acc[key].listings.push(listing);
      listing.items.filter((i) => !i.soldOut).forEach((item) => {
        acc[key].itemCount++;
        if (acc[key].sampleImages.length < 4) acc[key].sampleImages.push(item.imageUrl ?? null);
      });
      listing.paymentMethods.forEach((m) => {
        if (!acc[key].paymentMethods.includes(m)) acc[key].paymentMethods.push(m);
      });
      return acc;
    }, {})
  ).sort((a, b) => b.itemCount - a.itemCount);

  if (shops.length === 0) {
    return (
      <div className="text-center py-24 glass-panel rounded-3xl">
        <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">No shops open</h3>
        <p className="text-muted-foreground">Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {shops.map((shop) => {
        const isExpanded = expanded === shop.sellerId;
        const accent = shop.accentColor;
        const avatarUrl = shop.sellerAvatar
          ?? `https://cdn.discordapp.com/embed/avatars/0.png`;
        const totalItems = shop.listings.reduce((s, l) => s + l.items.filter((i) => !i.soldOut).length, 0);

        return (
          <motion.div
            key={shop.sellerId}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-white/10 rounded-2xl overflow-hidden"
            style={{ borderColor: `${accent}22` }}
          >
            {/* Shop header */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${shop.sellerId}`}>
                  <img
                    src={avatarUrl}
                    alt={shop.sellerName}
                    className="w-11 h-11 rounded-full ring-2 shrink-0 object-cover hover:opacity-80 transition-opacity"
                    style={{ ringColor: accent, borderColor: accent }}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }}
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${shop.sellerId}`} className="font-bold text-white hover:text-primary transition-colors text-sm truncate block">
                    {shop.sellerName}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    {totalItems} item{totalItems !== 1 ? "s" : ""} · {shop.listings.length} listing{shop.listings.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Link
                  href={`/profile/${shop.sellerId}`}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all hover:opacity-90"
                  style={{ borderColor: `${accent}50`, color: accent, background: `${accent}14` }}
                >
                  <ExternalLink className="w-3 h-3" />
                  Profile
                </Link>
              </div>

              {/* Item thumbnails */}
              {shop.sampleImages.length > 0 && (
                <div className="flex gap-1.5">
                  {shop.sampleImages.slice(0, 4).map((img, i) => (
                    img ? (
                      <img key={i} src={img} alt="" className="w-12 h-12 rounded-lg object-contain bg-black/30 p-0.5" />
                    ) : (
                      <div key={i} className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                        <Box className="w-5 h-5 text-muted-foreground/20" />
                      </div>
                    )
                  ))}
                  {totalItems > 4 && (
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-muted-foreground">
                      +{totalItems - 4}
                    </div>
                  )}
                </div>
              )}

              {/* Payment methods */}
              {shop.paymentMethods.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {shop.paymentMethods.slice(0, 5).map((m) => (
                    <div key={m} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-muted-foreground">
                      {PAYMENT_EMOJI[m] ? (
                        <img src={PAYMENT_EMOJI[m]} alt={m} className="w-3 h-3 object-contain" />
                      ) : null}
                      {m}
                    </div>
                  ))}
                </div>
              )}

              {/* Toggle items button */}
              <button
                onClick={() => setExpanded(isExpanded ? null : shop.sellerId)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  borderColor: isExpanded ? `${accent}50` : "rgba(255,255,255,0.1)",
                  color: isExpanded ? accent : "var(--muted-foreground)",
                  background: isExpanded ? `${accent}12` : "transparent",
                }}
              >
                <Tag className="w-3 h-3" />
                {isExpanded ? "Hide items" : `Browse ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
              </button>
            </div>

            {/* Expanded item list */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/10 px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
                    {shop.listings.flatMap((l) =>
                      l.items.filter((i) => !i.soldOut).map((item) => (
                        <div key={`${l.id}-${item.name}`} className="flex items-center gap-2.5 py-1.5">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-9 h-9 rounded-lg object-contain bg-black/30 p-0.5 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                              <Box className="w-4 h-4 text-muted-foreground/20" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                            {item.price && (
                              <p className="text-[11px] text-green-400 font-bold">${item.price}</p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (!user) { onLoginPrompt(); return; }
                              onMessage(l, item);
                            }}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all hover:opacity-90"
                            style={{ borderColor: `${accent}40`, color: accent, background: `${accent}14` }}
                          >
                            <MessageCircle className="w-3 h-3" />
                            Buy
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function usePresencePing() {
  const [activeUsers, setActiveUsers] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        const res = await fetch("/api/presence/ping", { method: "POST", credentials: "include" });
        if (!cancelled && res.ok) {
          const data = await res.json() as { count: number };
          setActiveUsers(Math.max(1, data.count));
        }
      } catch {}
    }

    ping();
    const id = setInterval(ping, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return activeUsers;
}

export default function ListingsPage() {
  const activeUsers = usePresencePing();
  const refetchInterval = Math.max(5_000, Math.round(60_000 / Math.sqrt(activeUsers)));

  const { data: listings = [], isLoading } = useListings(refetchInterval);
  const { data: config } = useConfig();
  const { user } = useAuth();

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "auctions" | "fixed" | "shops">("all");
  const [chatTarget, setChatTarget] = useState<{
    listingId: string;
    listingTitle: string;
    sellerId: string;
    sellerName: string;
    sellerAvatar: string | null;
    prefill?: string;
  } | null>(null);
  const [bidTarget, setBidTarget] = useState<Listing | null>(null);
  const [ticketSuccess, setTicketSuccess] = useState<{ inviteUrl: string } | null>(null);
  const [ticketPending, setTicketPending] = useState(false);
  const [joinGuildModal, setJoinGuildModal] = useState<{ inviteUrl: string; pendingEntries: CartEntry[] } | null>(null);
  const [joinCheckPending, setJoinCheckPending] = useState(false);
  const [joinCheckFailed, setJoinCheckFailed] = useState(false);
  const [onboardingModal, setOnboardingModal] = useState<{ pendingEntries: CartEntry[]; inviteUrl: string } | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);

  const activeListings = [...listings].reverse().filter((l) => l.items.some((i) => !i.soldOut));

  const filteredListings = activeListings.filter((l) => {
    if (activeFilter === "auctions") return l.listingType === "auction";
    if (activeFilter === "fixed") return l.listingType !== "auction";
    return true;
  });

  const flatItems: FlatItem[] = filteredListings.flatMap((listing) =>
    listing.items.filter((i) => !i.soldOut).map((item) => ({ listing, item }))
  );

  const auctionCount = activeListings.filter((l) => l.listingType === "auction").length;

  function isInCart(listingId: string, itemName: string) {
    return cart.some((e) => e.listingId === listingId && e.item.name === itemName);
  }

  function toggleCart(flat: FlatItem) {
    const { listing, item } = flat;
    if (isInCart(listing.id, item.name)) {
      setCart((prev) => prev.filter((e) => !(e.listingId === listing.id && e.item.name === item.name)));
    } else {
      setCart((prev) => [
        ...prev,
        {
          listingId: listing.id,
          sellerId: listing.discordUserId ?? listing.seller,
          sellerName: listing.seller,
          sellerAvatar: listing.discordAvatar,
          item,
        },
      ]);
    }
  }

  function openOffer(flat: FlatItem) {
    if (!user) { setLoginPrompt(true); return; }
    const { listing, item } = flat;
    setChatTarget({
      listingId: listing.id,
      listingTitle: item.name,
      sellerId: listing.discordUserId ?? listing.seller,
      sellerName: listing.seller,
      sellerAvatar: listing.discordAvatar,
      prefill: `Hi! I'd like to make an offer for ${item.name}${item.price ? ` (listed at $${item.price})` : ""}. My offer: $`,
    });
  }

  function openChatFromCart(entry: CartEntry) {
    if (!user) { setLoginPrompt(true); return; }
    const sellerItems = cart.filter((e) => e.sellerId === entry.sellerId);
    const itemList = sellerItems.map((e) => `• ${e.item.name}${e.item.price ? ` ($${e.item.price})` : ""}`).join("\n");
    setChatTarget({
      listingId: entry.listingId,
      listingTitle: `${entry.sellerName}'s Stock`,
      sellerId: entry.sellerId,
      sellerName: entry.sellerName,
      sellerAvatar: entry.sellerAvatar,
      prefill: `Hi! I'm interested in buying:\n${itemList}`,
    });
    setCartOpen(false);
  }

  async function createTicket(entries: CartEntry[]) {
    setTicketPending(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: entries.map((e) => ({
            name: e.item.name,
            price: e.item.price,
            quantity: typeof e.item.quantity === "number" ? e.item.quantity : 1,
            sellerName: e.sellerName,
            sellerId: e.sellerId,
          })),
        }),
      });
      const data = await res.json();
      if (data.error === "notInGuild") {
        setJoinGuildModal({ inviteUrl: data.inviteUrl, pendingEntries: entries });
        return;
      }
      setTicketSuccess({ inviteUrl: data.inviteUrl ?? "https://discord.gg/eB6ksCQPWP" });
    } catch {
      setTicketSuccess({ inviteUrl: config?.discordInviteUrl ?? "https://discord.gg/eB6ksCQPWP" });
    } finally {
      setTicketPending(false);
    }
  }

  async function openTicket(entries: CartEntry[]) {
    if (!user) { setLoginPrompt(true); return; }
    setCartOpen(false);
    setTicketPending(true);
    try {
      const check = await fetch("/api/guild/member-check").then((r) => r.json()) as { inGuild: boolean; inviteUrl: string };
      if (!check.inGuild) {
        setJoinGuildModal({ inviteUrl: check.inviteUrl, pendingEntries: entries });
        setTicketPending(false);
        return;
      }
    } catch {
      setTicketPending(false);
      return;
    }
    setTicketPending(false);
    setOnboardingModal({ pendingEntries: entries, inviteUrl: config?.discordInviteUrl ?? "https://discord.gg/eB6ksCQPWP" });
  }

  async function handleIveJoined() {
    if (!joinGuildModal) return;
    setJoinCheckPending(true);
    setJoinCheckFailed(false);
    try {
      const check = await fetch("/api/guild/member-check").then((r) => r.json()) as { inGuild: boolean; inviteUrl: string };
      if (check.inGuild) {
        const entries = joinGuildModal.pendingEntries;
        const inviteUrl = check.inviteUrl;
        setJoinGuildModal(null);
        setJoinCheckFailed(false);
        setOnboardingModal({ pendingEntries: entries, inviteUrl });
      } else {
        setJoinCheckFailed(true);
      }
    } catch {
      setJoinCheckFailed(true);
    } finally {
      setJoinCheckPending(false);
    }
  }

  function buyItem(entry: CartEntry) {
    openTicket([entry]);
  }

  function checkout() {
    openTicket(cart);
  }

  return (
    <div className="min-h-screen pb-12 relative overflow-x-hidden">
      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-8 sm:pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass-panel border-primary/30 text-primary mb-4 sm:mb-6 shadow-[0_0_30px_rgba(255,0,128,0.2)]">
            <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-[10px] sm:text-sm font-semibold tracking-wide uppercase">All Listings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 mb-3 sm:mb-4">
            Browse <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">Listings</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-xl mx-auto px-2">
            Buy items directly or bid on live auctions.
          </p>
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 glass-panel rounded-2xl p-1.5 max-w-sm mx-auto">
          {([
            { key: "all", label: "All" },
            { key: "auctions", label: `Auctions${auctionCount > 0 ? ` (${auctionCount})` : ""}` },
            { key: "fixed", label: "Buy" },
            { key: "shops", label: "Shops" },
          ] as const).map(({ key, label }) => (
            <motion.button
              key={key}
              onClick={() => setActiveFilter(key)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors",
                activeFilter === key ? "text-white" : "text-muted-foreground hover:text-white"
              )}
            >
              {activeFilter === key && (
                <motion.span
                  layoutId="listings-filter-pill"
                  className={cn(
                    "absolute inset-0 rounded-xl",
                    key === "auctions"
                      ? "bg-gradient-to-r from-amber-500 to-amber-600"
                      : key === "shops"
                      ? "bg-gradient-to-r from-violet-500 to-indigo-500"
                      : "bg-gradient-to-r from-primary to-secondary"
                  )}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {key === "auctions" && <Gavel className="w-3 h-3" />}
                {key === "shops" && <Store className="w-3 h-3" />}
                {label}
              </span>
            </motion.button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : activeFilter === "shops" ? (
          <ShopsView
            listings={activeListings}
            onMessage={(listing, item) => {
              if (!user) { setLoginPrompt(true); return; }
              setChatTarget({
                listingId: listing.id,
                listingTitle: item.name,
                sellerId: listing.discordUserId ?? listing.seller,
                sellerName: listing.seller,
                sellerAvatar: listing.discordAvatar,
                prefill: `Hi! I'd like to buy ${item.name}${item.price ? ` (listed at $${item.price})` : ""}. Is it still available?`,
              });
            }}
            user={user}
            onLoginPrompt={() => setLoginPrompt(true)}
          />
        ) : flatItems.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-3xl">
            <LayoutList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {activeFilter === "auctions" ? "No active auctions" : "No active listings"}
            </h3>
            <p className="text-muted-foreground">Check back soon.</p>
          </div>
        ) : (
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5"
          >
            {flatItems.map((flat) => {
              const isOwn = !!user && user.id === flat.listing.discordUserId;
              const isAuction = flat.listing.listingType === "auction";

              if (isAuction) {
                return (
                  <AuctionCard
                    key={`${flat.listing.id}-${flat.item.name}`}
                    flat={flat}
                    isOwn={isOwn}
                    onBid={() => {
                      if (!user) { setLoginPrompt(true); return; }
                      setBidTarget(flat.listing);
                    }}
                  />
                );
              }

              return (
                <ListingItemCard
                  key={`${flat.listing.id}-${flat.item.name}`}
                  flat={flat}
                  inCart={isInCart(flat.listing.id, flat.item.name)}
                  onToggle={() => toggleCart(flat)}
                  isOwn={isOwn}
                  onOffer={() => openOffer(flat)}
                  onReport={user ? () => setReportTarget({ type: "listing", id: flat.listing.id, name: flat.listing.items[0]?.name ?? flat.listing.id }) : undefined}
                />
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Floating cart button */}
      <AnimatePresence>
        {flatItems.some((f) => f.listing.listingType !== "auction") && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-24 sm:bottom-8 right-4 sm:right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-[0_0_24px_rgba(255,0,128,0.4)] flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <ShoppingCart className="w-6 h-6" />
            {cart.length > 0 && (
              <motion.span
                key={cart.length}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-white text-primary text-[11px] font-extrabold flex items-center justify-center shadow"
              >
                {cart.length}
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bid Modal */}
      <AnimatePresence>
        {bidTarget && (
          <BidModal
            listing={bidTarget}
            user={user}
            onClose={() => setBidTarget(null)}
            onLoginPrompt={() => { setBidTarget(null); setLoginPrompt(true); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <CartDrawer
            cart={cart}
            onRemove={(lid, name) => setCart((p) => p.filter((e) => !(e.listingId === lid && e.item.name === name)))}
            onClear={() => setCart([])}
            onMessage={openChatFromCart}
            onBuyItem={buyItem}
            onCheckout={checkout}
            onClose={() => setCartOpen(false)}
            user={user}
            onLoginPrompt={() => { setCartOpen(false); setLoginPrompt(true); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loginPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setLoginPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center border border-white/15 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <LogIn className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="font-display font-bold text-xl text-white mb-2">Login Required</h3>
              <p className="text-muted-foreground text-sm mb-6">
                You need to log in with Discord to do that.
              </p>
              <a
                href="/api/auth/discord"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.030z"/>
                </svg>
                Login with Discord
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatTarget && user && (
          <ChatPanel
            key={chatTarget.listingId + (chatTarget.prefill ?? "")}
            listingId={chatTarget.listingId}
            listingTitle={chatTarget.listingTitle}
            sellerId={chatTarget.sellerId}
            sellerName={chatTarget.sellerName}
            sellerAvatar={chatTarget.sellerAvatar}
            myId={user.id}
            prefill={chatTarget.prefill}
            onClose={() => setChatTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ticketPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-white font-semibold">
                {joinCheckPending ? "Verifying membership…" : "Checking server…"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {joinGuildModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center border border-white/15 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(88,101,242,0.3)]">
                <svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.030z"/>
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-bold text-xl text-white">Join the Server First</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  You need to be a member of our Discord server to open a trade ticket.
                </p>
              </div>
              {joinCheckFailed && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                >
                  You don't appear to be in the server yet. Make sure you joined with the same Discord account, then try again.
                </motion.p>
              )}
              <div className="flex flex-col gap-2">
                <a
                  href={joinGuildModal.inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.030z"/>
                  </svg>
                  Join Discord Server
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={handleIveJoined}
                  disabled={joinCheckPending}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold text-sm transition-colors disabled:opacity-60"
                >
                  {joinCheckPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  ) : (
                    <><Check className="w-4 h-4" /> I've Joined — Continue</>
                  )}
                </button>
                <button
                  onClick={() => { setJoinGuildModal(null); setJoinCheckFailed(false); }}
                  className="py-2 px-4 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {onboardingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel rounded-2xl p-8 max-w-sm w-full border border-amber-500/25 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(245,158,11,0.2)]">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
              <div className="space-y-2 text-center">
                <h3 className="font-display font-bold text-xl text-white">Complete Onboarding First</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Discord requires new members to complete <strong className="text-white">server onboarding</strong> — accept the rules and pick your roles — before you can view private channels.
                </p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2 text-sm text-amber-200 leading-relaxed">
                <p className="font-semibold text-amber-300">⚠️ Important</p>
                <p>Your ticket will be created now, but <strong>you won't be able to see it</strong> until you finish onboarding in the Discord server.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const { pendingEntries } = onboardingModal;
                    setOnboardingModal(null);
                    createTicket(pendingEntries);
                  }}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary/80 text-white font-bold text-sm transition-colors shadow-[0_0_20px_rgba(255,0,128,0.3)]"
                >
                  <Check className="w-4 h-4" />
                  I Understand — Create My Ticket
                </button>
                <button
                  onClick={() => setOnboardingModal(null)}
                  className="py-2.5 px-4 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ticketSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setTicketSuccess(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center border border-white/15 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(34,197,94,0.25)]"
              >
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </motion.div>
              <div className="space-y-2">
                <h3 className="font-display font-bold text-xl text-white">Ticket Created!</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your purchase ticket has been opened in our Discord. Join the server to complete your trade.
                </p>
              </div>
              <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 text-left space-y-1">
                <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3" />
                  Screenshot your payment!
                </p>
                <p className="text-amber-200/80">Take a screenshot of your payment confirmation before completing the trade. This protects you in case of any disputes.</p>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={ticketSuccess.inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.030z"/>
                  </svg>
                  Open Discord Server
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setTicketSuccess(null)}
                  className="py-2.5 px-4 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
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
