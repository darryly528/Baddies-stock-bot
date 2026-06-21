import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Image as ImageIcon,
  Store,
  Tag,
  Pencil,
  Users,
  Star,
  Heart,
} from "lucide-react";
import { Link } from "wouter";
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
  const auctionAccent = listing.frameColor ?? (listing.sellerDefaultFrameColor || listing.sellerAccentColor);
  const stProps = (!ended && !isDefaultStyle)
    ? getCardStyleProps(listing.cardStyle, auctionAccent)
    : null;
  const edgeProps = ended ? { addStyle: {} as React.CSSProperties, pulseAnimate: undefined, overlayKind: "none" as const } : getEdgeEffectProps(listing.sellerEdgeEffect, auctionAccent);

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
        <div className="absolute top-0 inset-x-0 h-0.5 z-30" style={{ background: auctionAccent ?? "#ff0080" }} />
      )}
      <EdgeEffectOverlay effect={edgeProps.overlayKind} accent={auctionAccent} />
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
        <Link href={listing.discordUserId ? `/profile/${listing.discordUserId}` : "#"}
          onClick={(e) => !listing.discordUserId && e.preventDefault()}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity w-fit max-w-full">
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
        </Link>

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
}: {
  flat: FlatItem;
  inCart: boolean;
  onToggle: () => void;
  isOwn: boolean;
  onOffer: () => void;
}) {
  const { listing, item } = flat;
  const avatarUrl = listing.discordUserId && listing.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
    : null;

  const effectiveAccent = listing.frameColor ?? (listing.sellerDefaultFrameColor || listing.sellerAccentColor);
  const stProps = getCardStyleProps(listing.cardStyle, effectiveAccent);
  const edgeProps = getEdgeEffectProps(listing.sellerEdgeEffect, effectiveAccent);

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
        <div className="absolute top-0 inset-x-0 h-0.5 z-30" style={{ background: effectiveAccent ?? "#ff0080" }} />
      )}
      <EdgeEffectOverlay effect={edgeProps.overlayKind} accent={effectiveAccent} />
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

        <Link href={listing.discordUserId ? `/profile/${listing.discordUserId}` : "#"}
          onClick={(e) => !listing.discordUserId && e.preventDefault()}
          className="flex items-center gap-2 mt-auto hover:opacity-80 transition-opacity w-fit max-w-full">
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
        </Link>

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

// ── Create Shop Modal ─────────────────────────────────────────────────────────

type ShopStatus = "pending" | "approved" | "rejected";
interface ShopApplication {
  userId: string; username: string; shopName: string;
  tagline: string; categories: string; status: ShopStatus;
  bannerUrl?: string; logoUrl?: string; accentColor?: string;
  rejectionReason?: string;
  members?: string[];
}

const SHOP_PALETTE = [
  "#a855f7", "#7c3aed", "#3b82f6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#f97316", "#ffffff",
];

function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#000" : "#fff";
}

function ShopImageUpload({
  label, type, value, onChange,
}: { label: string; type: "banner" | "logo"; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`/api/uploads/shop-image?type=${type}`, {
        method: "POST", credentials: "include", body: fd,
      });
      const d = await r.json() as { ok?: boolean; url?: string; error?: string };
      if (d.url) onChange(d.url);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const isBanner = type === "banner";

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-xl border border-dashed border-white/20 hover:border-violet-500/50 transition-colors overflow-hidden group",
          isBanner ? "h-24" : "h-20 w-20"
        )}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-[10px] font-semibold text-white">Change</p>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-white/3">
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            ) : (
              <>
                <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground/60">{isBanner ? "Drop or click" : "Upload"}</p>
                <p className="text-[9px] text-muted-foreground/40">PNG · JPG · GIF</p>
              </>
            )}
          </div>
        )}
        {uploading && value && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      {value && (
        <button onClick={() => onChange("")} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
          Remove
        </button>
      )}
    </div>
  );
}

function CreateShopModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [shopName, setShopName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#a855f7");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/shops/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          shopName: shopName.trim(),
          tagline: tagline.trim(),
          categories: "",
          bannerUrl: bannerUrl || undefined,
          logoUrl: logoUrl || undefined,
          accentColor,
        }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Failed to submit");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="w-full max-w-lg glass-panel border border-white/15 rounded-2xl overflow-hidden"
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Store className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Create a Shop</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {([1, 2] as const).map((s) => (
                  <div key={s} className={cn("h-1 rounded-full transition-all", s === step ? "w-5 bg-violet-500" : s < step ? "w-3 bg-violet-500/50" : "w-3 bg-white/15")} />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">Step {step} of 2</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}
              className="p-6 space-y-5">
              <div className="text-center space-y-1">
                <p className="text-white font-semibold">What's your shop called?</p>
                <p className="text-[12px] text-muted-foreground">Give your shop a name customers will remember</p>
              </div>

              <div className="space-y-2">
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value.slice(0, 40))}
                  placeholder="e.g. Baddies Emporium"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-lg font-semibold text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition text-center"
                />
                <p className="text-[10px] text-muted-foreground/60 text-right">{shopName.length}/40</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Short tagline</label>
                <input value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 80))}
                  placeholder="A sentence about what you sell…"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-violet-500/50 transition" />
              </div>

              <button
                onClick={() => { if (!shopName.trim()) return; setStep(2); }}
                disabled={!shopName.trim()}
                className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, var(--color-primary), var(--gradient-end, var(--color-secondary)))" }}>
                Next — Design your shop →
              </button>
            </motion.div>
          ) : (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}
              className="p-6 space-y-5">
              <div className="text-center space-y-1">
                <p className="text-white font-semibold">Design <span style={{ color: accentColor }}>{shopName}</span></p>
                <p className="text-[12px] text-muted-foreground">Add a banner, logo, and brand color — images & GIFs welcome</p>
              </div>

              {/* Live preview card */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${accentColor}40` }}>
                <div className="h-16 bg-white/5 relative overflow-hidden">
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)` }}>
                      <p className="text-[10px] text-white/30">Banner preview</p>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 flex items-center gap-2.5" style={{ background: `${accentColor}08` }}>
                  <div className="w-8 h-8 rounded-full border-2 overflow-hidden shrink-0" style={{ borderColor: accentColor }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${accentColor}30`, color: accentColor }}>
                        {shopName[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{shopName}</p>
                    {tagline && <p className="text-[10px] text-muted-foreground truncate">{tagline}</p>}
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Verified
                  </div>
                </div>
              </div>

              {/* Upload controls */}
              <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                <ShopImageUpload label="Banner (image or GIF)" type="banner" value={bannerUrl} onChange={setBannerUrl} />
                <ShopImageUpload label="Logo" type="logo" value={logoUrl} onChange={setLogoUrl} />
              </div>

              {/* Color picker */}
              <div className="space-y-2">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Brand color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SHOP_PALETTE.map((c) => (
                    <button key={c} onClick={() => setAccentColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: accentColor === c ? "white" : "transparent" }} />
                  ))}
                  <label className="relative w-6 h-6 rounded-full overflow-hidden cursor-pointer border-2 border-white/20 hover:scale-110 transition-transform"
                    title="Custom color">
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    <div className="w-full h-full flex items-center justify-center text-[8px] font-bold"
                      style={{ background: accentColor, color: "white", textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>+</div>
                  </label>
                </div>
              </div>

              {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" />{error}</p>}

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-white/15 text-sm font-semibold text-muted-foreground hover:text-white hover:border-white/30 transition-colors">
                  ← Back
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, var(--color-primary), var(--gradient-end, var(--color-secondary)))" }}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                  {submitting ? "Submitting…" : "Submit for Review"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center">Admins will review your application before it goes live</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Edit shop modal ────────────────────────────────────────────────────────────

function EditShopModal({ shop, onClose, onSuccess }: { shop: ShopApplication; onClose: () => void; onSuccess: (updated: ShopApplication) => void }) {
  const [shopName, setShopName] = useState(shop.shopName);
  const [tagline, setTagline] = useState(shop.tagline ?? "");
  const [bannerUrl, setBannerUrl] = useState(shop.bannerUrl ?? "");
  const [logoUrl, setLogoUrl] = useState(shop.logoUrl ?? "");
  const [accentColor, setAccentColor] = useState(shop.accentColor ?? "#a855f7");
  const [activeTab, setActiveTab] = useState<"branding" | "info">("branding");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!shopName.trim()) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/shops/mine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shopName: shopName.trim(), tagline: tagline.trim(), bannerUrl: bannerUrl || undefined, logoUrl: logoUrl || undefined, accentColor }),
      });
      const d = await r.json() as { ok?: boolean; shop?: ShopApplication; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Failed to save");
      onSuccess(d.shop!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ border: `1.5px solid ${accentColor}50`, background: "rgba(10,10,20,0.97)" }}
        initial={{ scale: 0.93, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.93, opacity: 0, y: 16 }}>

        {/* Banner hero */}
        <div className="relative h-32 overflow-hidden">
          {bannerUrl ? (
            <img src={bannerUrl} alt="banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${accentColor}60 0%, ${accentColor}20 60%, #0a0a14 100%)` }} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(10,10,20,0.95) 100%)" }} />

          {/* Shop identity overlay */}
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <div className="w-12 h-12 rounded-xl border-2 overflow-hidden shrink-0 shadow-lg" style={{ borderColor: accentColor }}>
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-black" style={{ background: `${accentColor}40`, color: accentColor }}>
                  {shopName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight drop-shadow">{shopName || "Your Shop"}</p>
              {tagline && <p className="text-[11px] text-white/60">{tagline}</p>}
            </div>
          </div>

          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white/70 hover:text-white transition-colors backdrop-blur-sm">
            <X className="w-4 h-4" />
          </button>

          {/* Title chip */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{ background: `${accentColor}30`, color: accentColor, border: `1px solid ${accentColor}50` }}>
            <Store className="w-3 h-3" />
            Shop Editor
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: `${accentColor}25` }}>
          {(["branding", "info"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all"
              style={activeTab === tab
                ? { color: accentColor, borderBottom: `2px solid ${accentColor}`, background: `${accentColor}10` }
                : { color: "rgba(255,255,255,0.4)", borderBottom: "2px solid transparent" }}>
              {tab === "branding" ? "🎨 Branding" : "📝 Info"}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === "branding" ? (
              <motion.div key="branding" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                {/* Images */}
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Images</p>
                  <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                    <ShopImageUpload label="Banner (image or GIF)" type="banner" value={bannerUrl} onChange={setBannerUrl} />
                    <ShopImageUpload label="Logo / Avatar" type="logo" value={logoUrl} onChange={setLogoUrl} />
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Brand color</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ background: `${accentColor}20`, color: accentColor }}>{accentColor}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {SHOP_PALETTE.map((c) => (
                      <button key={c} onClick={() => setAccentColor(c)}
                        className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                        style={{ background: c, borderColor: accentColor === c ? "white" : "transparent", boxShadow: accentColor === c ? `0 0 8px ${c}` : "none" }} />
                    ))}
                    <label className="relative w-7 h-7 rounded-full overflow-hidden cursor-pointer border-2 border-white/20 hover:scale-110 transition-transform" title="Custom color">
                      <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: accentColor, color: "white", textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>+</div>
                    </label>
                  </div>
                  {/* Color preview strip */}
                  <div className="h-1.5 rounded-full mt-1" style={{ background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})` }} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="info" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Shop name</label>
                  <input value={shopName} onChange={(e) => setShopName(e.target.value.slice(0, 40))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 text-sm font-bold text-white placeholder-muted-foreground focus:outline-none transition"
                    style={{ border: `1.5px solid ${accentColor}30` }}
                    onFocus={(e) => (e.target.style.borderColor = `${accentColor}80`)}
                    onBlur={(e) => (e.target.style.borderColor = `${accentColor}30`)} />
                  <p className="text-[10px] text-muted-foreground/50 text-right">{shopName.length}/40</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Tagline</label>
                  <input value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 80))}
                    placeholder="What do you sell? Keep it short and memorable…"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 text-sm text-white placeholder-muted-foreground focus:outline-none transition"
                    style={{ border: `1.5px solid ${accentColor}30` }}
                    onFocus={(e) => (e.target.style.borderColor = `${accentColor}80`)}
                    onBlur={(e) => (e.target.style.borderColor = `${accentColor}30`)} />
                  <p className="text-[10px] text-muted-foreground/50 text-right">{tagline.length}/80</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" />{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 flex gap-3 border-t" style={{ borderColor: `${accentColor}20` }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-muted-foreground hover:text-white hover:border-white/25 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !shopName.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 4px 20px ${accentColor}40` }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Shops view ────────────────────────────────────────────────────────────────

type ShopVouch = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar: string | null;
  toUserId: string;
  message: string;
  rating: number;
  createdAt: string;
  updatedAt?: string;
};

function ShopStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(
          size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3",
          n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-white/20"
        )} />
      ))}
    </div>
  );
}

function ShopStarPicker({ value, onChange, accent }: { value: number; onChange: (v: number) => void; accent: string }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110">
          <Star className={cn("w-6 h-6 transition-colors",
            (hovered || value) >= n ? "text-amber-400 fill-amber-400" : "text-white/15")} />
        </button>
      ))}
    </div>
  );
}

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

function ShopsView({ listings, onMessage, onOffer, onAddToCart, onViewCart, cartCount, user, onLoginPrompt, approvedShops, myShop, onCreateShop, onEditShop }: {
  listings: Listing[];
  onMessage: (listing: Listing, item: ListingItem) => void;
  onOffer: (listing: Listing, item: ListingItem) => void;
  onAddToCart: (listing: Listing, item: ListingItem) => void;
  onViewCart: () => void;
  cartCount: number;
  user: { id: string } | null;
  onLoginPrompt: () => void;
  approvedShops: ShopApplication[];
  myShop: ShopApplication | null;
  onCreateShop: () => void;
  onEditShop: () => void;
}) {
  const [openShop, setOpenShop] = useState<SellerShop | null>(null);
  const [cardSize, setCardSize] = useState<"sm" | "md" | "lg">("md");
  const [showManageSellers, setShowManageSellers] = useState(false);
  const [modalMembers, setModalMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);
  const [addedInModal, setAddedInModal] = useState<Set<string>>(new Set());
  const [shopTab, setShopTab] = useState<"items" | "reviews">("items");
  const [shopSortMode, setShopSortMode] = useState<"all" | "top-rated">("all");
  const [vouchMsg, setVouchMsg] = useState("");
  const [vouchRating, setVouchRating] = useState(5);
  const [vouchSubmitting, setVouchSubmitting] = useState(false);
  const [vouchSuccess, setVouchSuccess] = useState(false);
  const [vouchError, setVouchError] = useState<string | null>(null);
  const [allVouches, setAllVouches] = useState<ShopVouch[]>([]);
  const approvedIds = new Set(approvedShops.map((s) => s.userId));

  useEffect(() => {
    fetch("/api/vouches", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setAllVouches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const vouchStats = useMemo(() => {
    const map: Record<string, { avg: number; count: number; list: ShopVouch[] }> = {};
    for (const v of allVouches) {
      if (!map[v.toUserId]) map[v.toUserId] = { avg: 0, count: 0, list: [] };
      map[v.toUserId].list.push(v);
    }
    for (const key of Object.keys(map)) {
      const ratings = map[key].list.map((v) => v.rating);
      map[key].count = ratings.length;
      map[key].avg = Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
    }
    return map;
  }, [allVouches]);

  useEffect(() => {
    if (openShop && user?.id === openShop.sellerId && myShop) {
      setModalMembers(myShop.members ?? []);
      setShowManageSellers(false);
      setMemberInput("");
    }
    setAddedInModal(new Set());
    setShopTab("items");
    setVouchMsg("");
    setVouchRating(5);
    setVouchSuccess(false);
    setVouchError(null);
  }, [openShop?.sellerId]);

  // Only sellers who are approved shop owners or shop members belong in the Shops view
  const shopSellerIds = useMemo(() => {
    const ids = new Set<string>();
    approvedShops.forEach((s) => {
      ids.add(s.userId);
      (s.members ?? []).forEach((m) => ids.add(m));
    });
    return ids;
  }, [approvedShops]);

  const shopMap = listings.reduce<Record<string, SellerShop>>((acc, listing) => {
    const key = listing.discordUserId ?? listing.seller;
    if (!shopSellerIds.has(key)) return acc;
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
      if (acc[key].sampleImages.length < 8) acc[key].sampleImages.push(item.imageUrl ?? null);
    });
    listing.paymentMethods.forEach((m) => {
      if (!acc[key].paymentMethods.includes(m)) acc[key].paymentMethods.push(m);
    });
    return acc;
  }, {});

  // Every approved shop always appears — even if they have no active listings yet
  approvedShops.forEach((s) => {
    if (!shopMap[s.userId]) {
      shopMap[s.userId] = {
        sellerId: s.userId,
        sellerName: s.username,
        sellerAvatar: null,
        listings: [],
        itemCount: 0,
        paymentMethods: [],
        accentColor: s.accentColor ?? "#ff0080",
        sampleImages: [],
      };
    }
  });

  // Merge member sellers' listings into their shop owner's brand
  approvedShops.forEach((s) => {
    if (!s.members?.length) return;
    const ownerShop = shopMap[s.userId];
    if (!ownerShop) return;
    s.members.forEach((memberId) => {
      const memberShop = shopMap[memberId];
      if (!memberShop) return;
      memberShop.listings.forEach((listing) => {
        if (!ownerShop.listings.find((l) => l.id === listing.id)) {
          ownerShop.listings.push(listing);
          listing.items.filter((i) => !i.soldOut).forEach((item) => {
            ownerShop.itemCount++;
            if (ownerShop.sampleImages.length < 8) ownerShop.sampleImages.push(item.imageUrl ?? null);
          });
          listing.paymentMethods.forEach((m) => {
            if (!ownerShop.paymentMethods.includes(m)) ownerShop.paymentMethods.push(m);
          });
        }
      });
      delete shopMap[memberId];
    });
  });

  const shops = Object.values(shopMap).sort((a, b) => {
    if (shopSortMode === "top-rated") {
      const aAvg = vouchStats[a.sellerId]?.avg ?? 0;
      const bAvg = vouchStats[b.sellerId]?.avg ?? 0;
      if (bAvg !== aAvg) return bAvg - aAvg;
      const aCnt = vouchStats[a.sellerId]?.count ?? 0;
      const bCnt = vouchStats[b.sellerId]?.count ?? 0;
      return bCnt - aCnt;
    }
    const aVerified = approvedIds.has(a.sellerId) ? 1 : 0;
    const bVerified = approvedIds.has(b.sellerId) ? 1 : 0;
    if (bVerified !== aVerified) return bVerified - aVerified;
    return b.itemCount - a.itemCount;
  });

  const ctaSection = (
    <div className="mt-6">
      {!user ? (
        <button onClick={onLoginPrompt}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-violet-500/30 text-sm font-semibold text-violet-400 hover:bg-violet-500/10 transition-colors">
          <Store className="w-4 h-4" />
          Log in to open your own shop
        </button>
      ) : myShop?.status === "approved" ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-green-500/30 bg-green-500/10 text-sm font-semibold text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            Your shop is live!
          </div>
          <button onClick={onEditShop}
            className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 text-sm font-semibold text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/50 transition-colors shrink-0">
            <Pencil className="w-3.5 h-3.5" />
            Edit my shop
          </button>
        </div>
      ) : myShop?.status === "pending" ? (
        <div className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-sm font-semibold text-amber-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Your shop application is under review…
        </div>
      ) : myShop?.status === "rejected" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm font-semibold text-red-400">
            <AlertTriangle className="w-4 h-4" />
            Your previous application was rejected{myShop.rejectionReason ? ` — ${myShop.rejectionReason}` : ""}
          </div>
          <button onClick={onCreateShop}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-violet-500/30 text-sm font-semibold text-violet-400 hover:bg-violet-500/10 transition-colors">
            <Store className="w-4 h-4" />
            Re-apply for a shop
          </button>
        </div>
      ) : (
        <button onClick={onCreateShop}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-violet-500/30 text-sm font-semibold text-violet-400 hover:bg-violet-500/10 transition-colors">
          <Store className="w-4 h-4" />
          Create your own shop
        </button>
      )}
    </div>
  );

  if (shops.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-16 glass-panel rounded-3xl">
          <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">No shops open yet</h3>
          <p className="text-muted-foreground">Be the first to create one!</p>
        </div>
        {ctaSection}
      </div>
    );
  }

  const gridCols =
    cardSize === "sm" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" :
    cardSize === "lg" ? "grid-cols-1 lg:grid-cols-2" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="space-y-4">
      {/* Toolbar: sort + size toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {([["all", "All"], ["top-rated", "⭐ Top Rated"]] as const).map(([mode, label]) => (
            <button key={mode} onClick={() => setShopSortMode(mode)}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all",
                shopSortMode === mode ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70")}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {(["sm", "md", "lg"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setCardSize(s)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-bold transition-all",
                cardSize === s
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Full-screen shop modal */}
      <AnimatePresence>
        {openShop && (() => {
          const shop = openShop;
          const verifiedShop = approvedShops.find((s) => s.userId === shop.sellerId);
          const isVerified = !!verifiedShop;
          const accent = verifiedShop?.accentColor ?? shop.accentColor;
          const displayAvatar = verifiedShop?.logoUrl ?? shop.sellerAvatar ?? `https://cdn.discordapp.com/embed/avatars/0.png`;
          const displayName = verifiedShop?.shopName ?? shop.sellerName;
          const allItems = shop.listings.flatMap((l) =>
            l.items.filter((i) => !i.soldOut).map((item) => ({ listing: l, item }))
          );
          return (
            <motion.div
              key="shop-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex flex-col"
              style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
              onClick={() => setOpenShop(null)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="relative flex flex-col h-full max-w-3xl mx-auto w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Hero banner */}
                <div className="relative h-48 shrink-0 overflow-hidden">
                  {verifiedShop?.bannerUrl ? (
                    <img src={verifiedShop.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : verifiedShop?.logoUrl ? (
                    <img src={verifiedShop.logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-md" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}60 0%, #0a0a0f 100%)` }} />
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)" }} />

                  {/* Close */}
                  <button
                    onClick={() => setOpenShop(null)}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>

                  {/* Shop identity */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end gap-3">
                    <div className="w-14 h-14 rounded-xl border-2 overflow-hidden shrink-0 shadow-xl" style={{ borderColor: accent }}>
                      <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover bg-black"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-black text-white drop-shadow">{displayName}</h2>
                        {isVerified && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-full border"
                            style={{ background: `${accent}40`, color: accent, borderColor: `${accent}70` }}>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Verified
                          </span>
                        )}
                      </div>
                      {verifiedShop?.tagline && <p className="text-sm text-white/70">{verifiedShop.tagline}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${accent}30`, color: accent, border: `1px solid ${accent}50` }}>
                      {allItems.length} item{allItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Payment methods */}
                {shop.paymentMethods.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 py-2.5 shrink-0" style={{ background: `${accent}10`, borderBottom: `1px solid ${accent}20` }}>
                    {shop.paymentMethods.map((m) => (
                      <div key={m} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 border border-white/15 text-[10px] text-white/70">
                        {PAYMENT_EMOJI[m] && <img src={PAYMENT_EMOJI[m]} alt={m} className="w-3 h-3 object-contain" />}
                        {m}
                      </div>
                    ))}
                  </div>
                )}

                {/* Owner controls */}
                {user?.id === shop.sellerId && myShop?.status === "approved" && (
                  <div className="shrink-0 px-4 py-2.5 flex flex-wrap items-center gap-2"
                    style={{ background: `${accent}08`, borderBottom: `1px solid ${accent}20` }}>
                    <button
                      onClick={() => { setOpenShop(null); onEditShop(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:opacity-80"
                      style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}40` }}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit my shop
                    </button>
                    <button
                      onClick={() => setShowManageSellers((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:opacity-80"
                      style={showManageSellers
                        ? { background: `${accent}25`, color: accent, border: `1px solid ${accent}40` }
                        : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <Users className="w-3 h-3" />
                      Manage Sellers
                      {modalMembers.length > 0 && (
                        <span className="ml-0.5 px-1.5 rounded-full text-[9px] font-black leading-4"
                          style={{ background: accent, color: "#000" }}>
                          {modalMembers.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {/* Manage Sellers panel */}
                {user?.id === shop.sellerId && myShop?.status === "approved" && showManageSellers && (
                  <div className="shrink-0 px-4 py-3 space-y-2.5"
                    style={{ background: "rgba(0,0,0,0.55)", borderBottom: `1px solid ${accent}20` }}>
                    <p className="text-[11px] text-white/45 font-medium">
                      Add sellers by their Discord User ID — their listings will appear under your shop brand.
                    </p>
                    {modalMembers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {modalMembers.map((id) => (
                          <div key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}35` }}>
                            <span className="font-mono">{id}</span>
                            <button
                              onClick={() => setModalMembers((prev) => prev.filter((m) => m !== id))}
                              className="hover:opacity-60 transition-opacity ml-0.5">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={memberInput}
                        onChange={(e) => setMemberInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const id = memberInput.trim();
                            if (id && !modalMembers.includes(id)) setModalMembers((prev) => [...prev, id]);
                            setMemberInput("");
                          }
                        }}
                        placeholder="Discord User ID…"
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-white/8 border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 font-mono"
                      />
                      <button
                        onClick={() => {
                          const id = memberInput.trim();
                          if (id && !modalMembers.includes(id)) setModalMembers((prev) => [...prev, id]);
                          setMemberInput("");
                        }}
                        disabled={!memberInput.trim()}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-40 transition-all shrink-0"
                        style={{ background: `${accent}30`, color: accent, border: `1px solid ${accent}45` }}
                      >
                        Add
                      </button>
                      <button
                        onClick={async () => {
                          setMemberSaving(true);
                          try {
                            const r = await fetch("/api/shops/mine/members", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({ members: modalMembers }),
                            });
                            const d = await r.json() as { ok?: boolean; error?: string };
                            if (!r.ok) throw new Error(d.error ?? "Failed");
                          } catch (err) {
                            console.error("[members]", err);
                          } finally {
                            setMemberSaving(false);
                          }
                        }}
                        disabled={memberSaving}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 transition-all shrink-0"
                        style={{ background: accent, color: "#000" }}
                      >
                        {memberSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab bar */}
                <div className="shrink-0 flex gap-1 px-4 py-2.5" style={{ background: "rgba(0,0,0,0.5)", borderBottom: `1px solid ${accent}20` }}>
                  {([["items", "Items"], ["reviews", "Reviews"]] as const).map(([t, label]) => {
                    const cnt = t === "reviews" ? (vouchStats[shop.sellerId]?.count ?? 0) : allItems.length;
                    return (
                      <button key={t} onClick={() => setShopTab(t)}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          shopTab === t
                            ? "text-white border"
                            : "text-white/40 hover:text-white/70 border border-transparent")}
                        style={shopTab === t ? { background: `${accent}25`, borderColor: `${accent}50`, color: accent } : {}}>
                        {t === "reviews" && <Star className="w-3 h-3" />}
                        {label}
                        {cnt > 0 && <span className="text-[10px] opacity-70">({cnt})</span>}
                      </button>
                    );
                  })}
                  {(() => {
                    const stats = vouchStats[shop.sellerId];
                    if (!stats) return null;
                    return (
                      <div className="ml-auto flex items-center gap-1">
                        <ShopStars rating={stats.avg} />
                        <span className="text-xs font-bold text-amber-400">{stats.avg}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Items grid */}
                {shopTab === "items" && (
                <div className="flex-1 overflow-y-auto p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
                  {allItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-white/30">
                      <Box className="w-10 h-10 mb-2" />
                      <p className="text-sm font-semibold">No items listed yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {allItems.map(({ listing: l, item }) => (
                        <div key={`${l.id}-${item.name}`}
                          className="relative rounded-xl overflow-hidden border flex flex-col"
                          style={{ borderColor: `${accent}30`, background: "rgba(0,0,0,0.5)" }}>
                          {/* Item image */}
                          <div className="relative aspect-square w-full">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-2" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: `${accent}10` }}>
                                <Box className="w-8 h-8" style={{ color: `${accent}50` }} />
                              </div>
                            )}
                          </div>
                          {/* Info + Add / Offer */}
                          <div className="p-2 border-t" style={{ borderColor: `${accent}20` }}>
                            <div className="mb-1.5">
                              <p className="text-xs font-bold text-white truncate">{item.name}</p>
                              {item.price && <p className="text-[11px] font-bold" style={{ color: accent }}>${item.price}</p>}
                            </div>
                            <div className="flex gap-1.5">
                              {(() => {
                                const key = `${l.id}-${item.name}`;
                                const isAdded = addedInModal.has(key);
                                return (
                                  <button
                                    onClick={() => {
                                      if (!user) { onLoginPrompt(); return; }
                                      if (isAdded) {
                                        setAddedInModal((prev) => { const n = new Set(prev); n.delete(key); return n; });
                                      } else {
                                        onAddToCart(l, item);
                                        setAddedInModal((prev) => new Set([...prev, key]));
                                      }
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                                    style={isAdded
                                      ? { background: `${accent}30`, color: accent, border: `1px solid ${accent}50` }
                                      : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.12)" }}
                                  >
                                    {isAdded ? <Check className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
                                    {isAdded ? "Added" : "Add"}
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => { if (!user) { onLoginPrompt(); return; } onOffer(l, item); setOpenShop(null); }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:opacity-80 active:scale-95"
                                style={{ background: accent, color: contrastText(accent), boxShadow: `0 2px 8px ${accent}40` }}
                              >
                                <MessageCircle className="w-3 h-3" />
                                Offer
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Reviews tab */}
                {shopTab === "reviews" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: "rgba(0,0,0,0.6)" }}>
                  {/* Leave a review form */}
                  {user && user.id !== shop.sellerId && (
                    <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: `${accent}30`, background: `${accent}08` }}>
                      <p className="text-xs font-bold text-white/70 uppercase tracking-wider">Rate this shop</p>
                      {vouchSuccess ? (
                        <div className="flex items-center gap-2 text-green-400 text-sm font-bold py-2">
                          <Check className="w-4 h-4" />
                          Review submitted!
                        </div>
                      ) : (
                        <>
                          <ShopStarPicker value={vouchRating} onChange={setVouchRating} accent={accent} />
                          <textarea
                            value={vouchMsg}
                            onChange={(e) => setVouchMsg(e.target.value.slice(0, 300))}
                            placeholder="Share your experience with this shop… (min 10 chars)"
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[11px] ml-auto", vouchMsg.length > 270 ? "text-orange-400" : "text-white/30")}>{vouchMsg.length}/300</span>
                            {vouchError && <span className="text-[11px] text-red-400">{vouchError}</span>}
                            <button
                              disabled={vouchSubmitting || vouchMsg.trim().length < 10}
                              onClick={async () => {
                                setVouchSubmitting(true);
                                setVouchError(null);
                                const verSh = approvedShops.find((s) => s.userId === shop.sellerId);
                                try {
                                  const r = await fetch("/api/vouches", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({
                                      toUserId: shop.sellerId,
                                      toUsername: verSh?.shopName ?? shop.sellerName,
                                      toAvatar: verSh?.logoUrl ?? null,
                                      message: vouchMsg.trim(),
                                      rating: vouchRating,
                                    }),
                                  });
                                  const d = await r.json() as { ok?: boolean; error?: string };
                                  if (!r.ok) throw new Error(d.error ?? "Failed");
                                  setVouchSuccess(true);
                                  setVouchMsg("");
                                  // refresh local vouches
                                  fetch("/api/vouches", { credentials: "include" })
                                    .then((res) => res.ok ? res.json() : [])
                                    .then((data) => setAllVouches(Array.isArray(data) ? data : []))
                                    .catch(() => {});
                                } catch (err) {
                                  setVouchError(err instanceof Error ? err.message : "Failed to submit");
                                } finally {
                                  setVouchSubmitting(false);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 transition-all"
                              style={{ background: accent, color: contrastText(accent) }}
                            >
                              {vouchSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className="w-3.5 h-3.5" />}
                              Submit Review
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {!user && (
                    <button onClick={() => { setOpenShop(null); onLoginPrompt(); }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/15 text-sm text-white/50 hover:text-white/70 transition-colors">
                      <Heart className="w-4 h-4" />
                      Log in to leave a review
                    </button>
                  )}
                  {/* Existing reviews */}
                  {(vouchStats[shop.sellerId]?.list ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/25 gap-2">
                      <Star className="w-10 h-10" />
                      <p className="text-sm font-semibold">No reviews yet</p>
                      <p className="text-xs">Be the first to rate this shop</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(vouchStats[shop.sellerId]?.list ?? []).map((v) => (
                        <div key={v.id} className="p-3 rounded-xl border space-y-2" style={{ borderColor: `${accent}20`, background: "rgba(0,0,0,0.35)" }}>
                          <div className="flex items-center gap-2">
                            {v.fromAvatar ? (
                              <img src={v.fromAvatar} alt={v.fromUsername} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                                {v.fromUsername[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-white">{v.fromUsername}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <ShopStars rating={v.rating} />
                                <span className="text-[10px] text-white/35">
                                  {new Date(v.updatedAt ?? v.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed">&ldquo;{v.message}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Floating cart bar */}
                {cartCount > 0 && (
                  <div className="shrink-0 px-4 py-3 flex items-center gap-3"
                    style={{ background: "rgba(0,0,0,0.7)", borderTop: `1px solid ${accent}25` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white">{cartCount} item{cartCount !== 1 ? "s" : ""} in cart</p>
                      <p className="text-[10px] text-white/40">Ready to checkout</p>
                    </div>
                    <button
                      onClick={() => { setOpenShop(null); onViewCart(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                      style={{ background: accent, color: "#fff", boxShadow: `0 2px 12px ${accent}50` }}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      View Cart
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <div className={cn("grid gap-4", gridCols)}>
      {shops.map((shop) => {
        const verifiedShop = approvedShops.find((s) => s.userId === shop.sellerId);
        const isVerified = !!verifiedShop;
        const accent = verifiedShop?.accentColor ?? shop.accentColor;
        const displayAvatar = verifiedShop?.logoUrl ?? shop.sellerAvatar
          ?? `https://cdn.discordapp.com/embed/avatars/0.png`;
        const displayName = verifiedShop?.shopName ?? shop.sellerName;
        const totalItems = shop.listings.reduce((s, l) => s + l.items.filter((i) => !i.soldOut).length, 0);

        return (
          <motion.div
            key={shop.sellerId}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setOpenShop(shop)}
            className="relative rounded-2xl overflow-hidden border cursor-pointer group"
            style={{ borderColor: isVerified ? `${accent}60` : `${accent}22` }}
          >
            {/* Full-card background image */}
            <div className="absolute inset-0 z-0">
              {verifiedShop?.bannerUrl ? (
                <img src={verifiedShop.bannerUrl} alt="" className="w-full h-full object-cover" />
              ) : verifiedShop?.logoUrl ? (
                <img src={verifiedShop.logoUrl} alt="" className="w-full h-full object-cover scale-110 blur-sm" />
              ) : (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${accent}40 0%, #0a0a0f 100%)` }} />
              )}
              <div className="absolute inset-0 transition-opacity group-hover:opacity-80" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0.92) 100%)" }} />
            </div>

            {/* Card content */}
            <div className="relative z-10 p-4 space-y-3">

              {/* Top row: avatar + name + verified badge */}
              <div className="flex items-center gap-2.5">
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-10 h-10 rounded-full border-2 object-cover shrink-0 bg-black"
                  style={{ borderColor: accent }}
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-white text-sm truncate">{displayName}</span>
                    {isVerified && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-full border"
                        style={{ background: `${accent}30`, color: accent, borderColor: `${accent}60` }}>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Verified
                      </span>
                    )}
                  </div>
                  {verifiedShop?.tagline ? (
                    <p className="text-[11px] text-white/60 truncate">{verifiedShop.tagline}</p>
                  ) : (
                    <p className="text-[11px] text-white/50">{totalItems} item{totalItems !== 1 ? "s" : ""}</p>
                  )}
                  {(() => {
                    const stats = vouchStats[shop.sellerId];
                    if (!stats) return null;
                    return (
                      <div className="flex items-center gap-1 mt-0.5">
                        <ShopStars rating={stats.avg} size="xs" />
                        <span className="text-[10px] text-amber-400 font-bold">{stats.avg}</span>
                        <span className="text-[10px] text-white/35">({stats.count})</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Item thumbnails — always 6 slots */}
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => {
                  const img = shop.sampleImages[i];
                  return img ? (
                    <img key={i} src={img} alt=""
                      className="w-full aspect-video rounded-lg object-contain drop-shadow-xl"
                      style={{ background: "rgba(0,0,0,0.5)", padding: "3px" }} />
                  ) : (
                    <div key={i} className="w-full aspect-video rounded-lg bg-black/30 flex items-center justify-center border border-white/8">
                      <Box className="w-4 h-4 text-white/15" />
                    </div>
                  );
                })}
              </div>

              {/* Payment methods */}
              {shop.paymentMethods.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {shop.paymentMethods.slice(0, 5).map((m) => (
                    <div key={m} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 border border-white/15 text-[10px] text-white/70 backdrop-blur-sm">
                      {PAYMENT_EMOJI[m] ? (
                        <img src={PAYMENT_EMOJI[m]} alt={m} className="w-3 h-3 object-contain" />
                      ) : null}
                      {m}
                    </div>
                  ))}
                </div>
              )}

              {/* Open shop hint */}
              <div
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all backdrop-blur-sm"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", background: "rgba(0,0,0,0.3)" }}
              >
                <Tag className="w-3 h-3" />
                Browse {totalItems} item{totalItems !== 1 ? "s" : ""}
              </div>
            </div>
          </motion.div>
        );
      })}
      </div>
      {ctaSection}
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
  const [createShopModal, setCreateShopModal] = useState(false);
  const [editShopModal, setEditShopModal] = useState(false);
  const [approvedShops, setApprovedShops] = useState<ShopApplication[]>([]);
  const [myShop, setMyShop] = useState<ShopApplication | null>(null);

  useEffect(() => {
    fetch("/api/shops", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d: ShopApplication[]) => setApprovedShops(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setMyShop(null); return; }
    fetch("/api/shops/mine", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d: ShopApplication | null) => setMyShop(d))
      .catch(() => {});
  }, [user]);

  function refreshShopStatus() {
    fetch("/api/shops", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d: ShopApplication[]) => setApprovedShops(d))
      .catch(() => {});
    if (user) {
      fetch("/api/shops/mine", { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((d: ShopApplication | null) => setMyShop(d))
        .catch(() => {});
    }
  }

  // IDs of every seller whose listings belong inside a shop (owner + members)
  const shopAffiliatedIds = useMemo(() => {
    const ids = new Set<string>();
    approvedShops.forEach((s) => {
      ids.add(s.userId);
      (s.members ?? []).forEach((m) => ids.add(m));
    });
    return ids;
  }, [approvedShops]);

  // Shop-affiliated sellers are hidden from the normal All/Buy/Auctions feed
  const activeListings = [...listings].reverse().filter((l) => {
    const sellerId = l.discordUserId ?? l.seller;
    return l.items.some((i) => !i.soldOut) && !shopAffiliatedIds.has(sellerId);
  });

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
            onOffer={(listing, item) => {
              if (!user) { setLoginPrompt(true); return; }
              setChatTarget({
                listingId: listing.id,
                listingTitle: item.name,
                sellerId: listing.discordUserId ?? listing.seller,
                sellerName: listing.seller,
                sellerAvatar: listing.discordAvatar,
                prefill: `Hi! I'd like to make an offer on ${item.name}${item.price ? ` (listed at $${item.price})` : ""}. Are you open to negotiating?`,
              });
            }}
            onAddToCart={(listing, item) => {
              setCart((prev) => {
                const key = `${listing.id}-${item.name}`;
                if (prev.some((e) => e.listingId === listing.id && e.item.name === item.name)) return prev;
                return [...prev, {
                  listingId: listing.id,
                  sellerId: listing.discordUserId ?? listing.seller,
                  sellerName: listing.seller,
                  sellerAvatar: listing.discordAvatar,
                  item,
                }];
              });
            }}
            onViewCart={() => setCartOpen(true)}
            cartCount={cart.length}
            user={user}
            onLoginPrompt={() => setLoginPrompt(true)}
            approvedShops={approvedShops}
            myShop={myShop}
            onCreateShop={() => {
              if (!user) { setLoginPrompt(true); return; }
              setCreateShopModal(true);
            }}
            onEditShop={() => setEditShopModal(true)}
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


      {/* Create shop modal */}
      <AnimatePresence>
        {createShopModal && (
          <CreateShopModal
            onClose={() => setCreateShopModal(false)}
            onSuccess={() => {
              setCreateShopModal(false);
              refreshShopStatus();
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit shop modal */}
      <AnimatePresence>
        {editShopModal && myShop?.status === "approved" && (
          <EditShopModal
            shop={myShop}
            onClose={() => setEditShopModal(false)}
            onSuccess={(updated) => {
              setMyShop(updated);
              setEditShopModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
