import { useState, useRef, useEffect } from "react";
import { useListings, Listing, ListingItem } from "@/hooks/use-listings";
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
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

const PAYMENT_EMOJI: Record<string, string> = {
  "PayPal":    "https://cdn.discordapp.com/emojis/1481817468912799814.png",
  "Apple Pay": "https://cdn.discordapp.com/emojis/1481817467813888212.png",
  "Cash App":  "https://cdn.discordapp.com/emojis/1481817227975069718.png",
  "Venmo":     "https://cdn.discordapp.com/emojis/1481817470431006883.png",
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
    } catch (err) {
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

function ListingItemCard({
  flat,
  inCart,
  onToggle,
  isOwn,
}: {
  flat: FlatItem;
  inCart: boolean;
  onToggle: () => void;
  isOwn: boolean;
}) {
  const { listing, item } = flat;
  const avatarUrl = listing.discordUserId && listing.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
    : null;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
      }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      className="group relative flex flex-col overflow-hidden rounded-2xl glass-panel border border-white/10 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(255,0,128,0.15)] transition-all duration-200"
    >
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
        <h3 className="font-display font-bold text-sm sm:text-base text-white leading-tight line-clamp-2 group-hover:text-primary transition-colors">
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
            <button
              onClick={onToggle}
              className={cn(
                "flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-200 shrink-0",
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
        {/* Header */}
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

        {/* Items */}
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
                  {/* Seller row */}
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

                  {/* Item rows */}
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

        {/* Sticky checkout footer */}
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

export default function ListingsPage() {
  const { data: listings = [], isLoading } = useListings();
  const { data: config } = useConfig();
  const { user } = useAuth();

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{
    listingId: string;
    listingTitle: string;
    sellerId: string;
    sellerName: string;
    sellerAvatar: string | null;
    prefill?: string;
  } | null>(null);
  const [ticketSuccess, setTicketSuccess] = useState<{ inviteUrl: string } | null>(null);
  const [ticketPending, setTicketPending] = useState(false);
  const [joinGuildModal, setJoinGuildModal] = useState<{ inviteUrl: string; pendingEntries: CartEntry[] } | null>(null);
  const [joinCheckPending, setJoinCheckPending] = useState(false);
  const [joinCheckFailed, setJoinCheckFailed] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);

  const activeListings = [...listings].reverse().filter((l) => l.items.some((i) => !i.soldOut));

  const flatItems: FlatItem[] = activeListings.flatMap((listing) =>
    listing.items.filter((i) => !i.soldOut).map((item) => ({ listing, item }))
  );

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
    await createTicket(entries);
  }

  async function handleIveJoined() {
    if (!joinGuildModal) return;
    setJoinCheckPending(true);
    setJoinCheckFailed(false);
    try {
      const check = await fetch("/api/guild/member-check").then((r) => r.json()) as { inGuild: boolean; inviteUrl: string };
      if (check.inGuild) {
        const entries = joinGuildModal.pendingEntries;
        setJoinGuildModal(null);
        await createTicket(entries);
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
            Add items to your cart and hit Buy — a Discord ticket will be opened for your trade.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : flatItems.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-3xl">
            <LayoutList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No active listings</h3>
            <p className="text-muted-foreground">Check back soon — sellers will post stock here.</p>
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
              return (
                <ListingItemCard
                  key={`${flat.listing.id}-${flat.item.name}`}
                  flat={flat}
                  inCart={isInCart(flat.listing.id, flat.item.name)}
                  onToggle={() => toggleCart(flat)}
                  isOwn={isOwn}
                />
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Floating cart button */}
      <AnimatePresence>
        {flatItems.length > 0 && (
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
                You need to log in with Discord to message sellers.
              </p>
              <a
                href="/api/auth/discord"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
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
        {(ticketPending) && (
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
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="font-display font-bold text-xl text-white">Join the Server First</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  You need to be a member of our Discord server to open a trade ticket. Join below, then come back and confirm.
                </p>
              </div>

              {joinCheckFailed && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                >
                  You don't appear to be in the server yet. Make sure you joined with the same Discord account you're logged in with, then try again.
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
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
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
                  Your purchase ticket has been opened in our Discord. Join the server to complete your trade with the seller.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={ticketSuccess.inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
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
    </div>
  );
}
