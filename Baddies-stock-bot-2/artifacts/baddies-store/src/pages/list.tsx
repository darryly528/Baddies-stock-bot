import { useState, useMemo, useEffect, useRef } from "react";
import { useInfiniteCatalogItems } from "@/hooks/use-catalog";
import { useListings, useCreateListing, useMarkSold, useDeleteListing, usePostListingToDiscord } from "@/hooks/use-listings";
import { useConfig } from "@/hooks/use-config";
import type { ListingItem } from "@/hooks/use-listings";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  PackagePlus,
  ListChecks,
  Loader2,
  X,
  ShoppingBag,
  Send,
  MessageCircle,
  ChevronDown,
  ServerIcon,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

const PAYMENT_LABELS = ["PayPal", "Apple Pay", "Cash App", "Venmo"] as const;
const PAYMENT_EMOJI: Record<string, string> = {
  "PayPal":    "💳",
  "Apple Pay": "🍎",
  "Cash App":  "💸",
  "Venmo":     "💙",
};

interface SelectedItem {
  name: string;
  itemType: string;
  imageUrl: string | null;
  quantity: number;
  price: string;
}

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

export default function ListPage() {
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<"select" | "review">("select");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [itemType, setItemType] = useState("All");
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState("");
  const [soldDialogItem, setSoldDialogItem] = useState<{ listingId: string; item: ListingItem } | null>(null);
  const [soldQtyInput, setSoldQtyInput] = useState("");
  const [postedListingId, setPostedListingId] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [showGuildPicker, setShowGuildPicker] = useState(false);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: catalogData, isLoading: catalogLoading } = useInfiniteCatalogItems({
    search,
    itemType,
    category: "All",
  });

  const { data: listings = [], isLoading: listingsLoading } = useListings();
  const { data: config } = useConfig();
  const createListing = useCreateListing();
  const markSold = useMarkSold();
  const deleteListing = useDeleteListing();
  const postToDiscord = usePostListingToDiscord();

  const items = useMemo(() => catalogData?.pages.flatMap((p) => p.items) ?? [], [catalogData]);

  const ITEM_TYPES = [
    { label: "All", value: "All" },
    { label: "Weapons", value: "Weapon" },
    { label: "Fighting Styles", value: "Fighting Style" },
    { label: "Skins", value: "Skin" },
  ];

  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 300);
  }

  function toggleItem(item: { name: string; itemType: string; imageUrl: string | null }) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.name === item.name);
      if (exists) return prev.filter((s) => s.name !== item.name);
      return [...prev, { name: item.name, itemType: item.itemType, imageUrl: item.imageUrl, quantity: 1, price: "" }];
    });
  }

  function updateQty(name: string, delta: number) {
    setSelected((prev) =>
      prev.map((s) => s.name === name ? { ...s, quantity: Math.max(1, s.quantity + delta) } : s)
    );
  }

  function setQty(name: string, val: string) {
    const n = parseInt(val);
    if (isNaN(n) || n < 1) return;
    setSelected((prev) => prev.map((s) => s.name === name ? { ...s, quantity: n } : s));
  }

  function setPrice(name: string, val: string) {
    setSelected((prev) => prev.map((s) => s.name === name ? { ...s, price: val } : s));
  }

  function togglePayment(label: string) {
    setPaymentMethods((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    );
  }

  async function submitListing() {
    if (!user || selected.length === 0) return;
    const result = await createListing.mutateAsync({
      seller: user.username,
      items: selected.map((s) => ({ name: s.name, itemType: s.itemType, imageUrl: s.imageUrl, quantity: s.quantity, price: s.price || undefined })),
      paymentMethods,
      customMessage: customMessage.trim() || undefined,
    });
    setPostedListingId(result.id);
    setSelected([]);
    setPaymentMethods([]);
    setCustomMessage("");
  }

  async function loadGuilds() {
    setGuildsLoading(true);
    try {
      const res = await fetch("/api/auth/guilds", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as Guild[];
        setGuilds(data);
        setShowGuildPicker(true);
      }
    } finally {
      setGuildsLoading(false);
    }
  }

  async function handlePostToDiscord(guildId: string) {
    if (!postedListingId) return;
    setPostSuccess(null);
    setPostError(null);
    try {
      await postToDiscord.mutateAsync({ listingId: postedListingId, guildId });
      setPostSuccess("Posted to Discord!");
      setShowGuildPicker(false);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to post");
    }
  }

  async function handleMarkSold(listingId: string, itemName: string, soldAll: boolean, qty?: number) {
    await markSold.mutateAsync({ listingId, itemName, soldQty: soldAll ? undefined : qty });
    setSoldDialogItem(null);
    setSoldQtyInput("");
  }

  const activeListings = listings.filter((l) => l.items.some((i) => !i.soldOut));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-10 max-w-md w-full text-center border border-white/10 shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-display font-extrabold text-white mb-3">Sign in to List Items</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Log in with your Discord account to create listings. Your Discord username will be used as your seller name.
          </p>
          <a
            href="/api/auth/discord"
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-base transition-colors shadow-lg shadow-[#5865F2]/25"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Continue with Discord
          </a>
        </motion.div>
      </div>
    );
  }

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border-primary/30 text-primary mb-6 shadow-[0_0_30px_rgba(255,0,128,0.2)]">
            <PackagePlus className="w-4 h-4" />
            <span className="text-sm font-semibold tracking-wide uppercase">Stock Management</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 mb-4">
            List <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">Items</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Select items from the catalog, set quantities, and publish your listing.
          </p>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex gap-3 mb-8 glass-panel rounded-2xl p-1.5 max-w-sm mx-auto">
          <button
            onClick={() => setStep("select")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              step === "select"
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <PackagePlus className="w-4 h-4" />
            Create Listing
          </button>
          <button
            onClick={() => setStep("review")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              step === "review"
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <ListChecks className="w-4 h-4" />
            Active Listings
            {activeListings.length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeListings.length}
              </span>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Seller info + config */}
              <div className="glass-panel rounded-2xl p-6 mb-6 space-y-5">
                {/* Seller display */}
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user.username} className="w-10 h-10 rounded-full ring-2 ring-primary/40" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center font-bold text-primary">
                      {user.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Listing as</p>
                    <p className="font-semibold text-white">{user.username}</p>
                  </div>
                </div>

                {/* Payment methods */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Payment methods you accept</p>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_LABELS.map((label) => {
                      const active = paymentMethods.includes(label);
                      return (
                        <button
                          key={label}
                          onClick={() => togglePayment(label)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                            active
                              ? "bg-primary/20 border-primary/50 text-primary"
                              : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                          )}
                        >
                          <span>{PAYMENT_EMOJI[label]}</span>
                          {label}
                          {active && <span className="text-xs ml-0.5">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Middleman notice */}
                {user.discordInviteUrl && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20">
                    <MessageCircle className="w-4 h-4 text-[#5865F2] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/80">
                      Need a middleman?{" "}
                      <a
                        href={user.discordInviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#5865F2] font-semibold hover:underline"
                      >
                        Join our Discord server
                      </a>{" "}
                      to request one for safe trades.
                    </p>
                  </div>
                )}

                {/* Selected items cart */}
                {selected.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Selected ({selected.length}) — set quantities and prices below
                    </p>
                    <div className="flex flex-col gap-2">
                      {selected.map((s) => (
                        <div
                          key={s.name}
                          className="flex flex-wrap items-center gap-2 glass-panel rounded-xl px-3 py-2 border border-primary/30"
                        >
                          {s.imageUrl && (
                            <img src={s.imageUrl} alt={s.name} className="w-6 h-6 object-contain flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-white flex-1 min-w-0 truncate">{s.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQty(s.name, -1)}
                              className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              value={s.quantity}
                              onChange={(e) => setQty(s.name, e.target.value)}
                              className="w-10 text-center bg-transparent text-sm font-bold text-white border-0 outline-none"
                              min={1}
                            />
                            <button
                              onClick={() => updateQty(s.name, 1)}
                              className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">$</span>
                            <input
                              type="text"
                              value={s.price}
                              onChange={(e) => setPrice(s.name, e.target.value)}
                              placeholder="Price"
                              className="w-20 bg-black/30 border border-white/10 rounded-md px-2 py-1 text-sm text-white outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                            />
                          </div>
                          <button
                            onClick={() => toggleItem(s)}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Custom message (optional)</p>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Add a note to your listing, e.g. DM me on Discord, prices negotiable..."
                        rows={3}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none"
                      />
                    </div>

                    <Button
                      onClick={submitListing}
                      disabled={createListing.isPending}
                      className="mt-4"
                      size="lg"
                    >
                      {createListing.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</>
                      ) : (
                        <><ShoppingBag className="w-4 h-4 mr-2" />Publish Listing ({selected.length} items)</>
                      )}
                    </Button>
                    {createListing.isError && (
                      <p className="mt-2 text-red-400 text-sm">Failed to publish. Try again.</p>
                    )}
                  </div>
                )}

                {/* Post to Discord after publishing */}
                <AnimatePresence>
                  {postedListingId && !selected.length && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 space-y-3"
                    >
                      <p className="text-green-400 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Listing published successfully!
                      </p>
                      {postSuccess ? (
                        <p className="text-[#5865F2] text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> {postSuccess}
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={loadGuilds}
                          disabled={guildsLoading}
                          className="border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2]/10"
                        >
                          {guildsLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading servers...</>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                              </svg>
                              Post to Discord Server
                            </>
                          )}
                        </Button>
                      )}
                      {postError && <p className="text-red-400 text-sm">{postError}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Search + filters */}
              <div className="glass-panel rounded-2xl p-3 mb-6 flex flex-col sm:flex-row gap-3 items-center">
                <div className="flex w-full sm:w-auto p-1 bg-black/40 rounded-xl overflow-x-auto">
                  {ITEM_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setItemType(t.value)}
                      className={cn(
                        "flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                        itemType === t.value
                          ? "bg-gradient-to-r from-primary to-secondary text-white shadow"
                          : "text-muted-foreground hover:text-white hover:bg-white/5"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchInput}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    placeholder="Search catalog..."
                    className="pl-9 bg-black/40 border-white/10"
                  />
                </div>
              </div>

              {/* Item grid */}
              {catalogLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {items.map((item) => {
                    const isSelected = selected.some((s) => s.name === item.name);
                    return (
                      <motion.button
                        key={item.itemId}
                        onClick={() => toggleItem(item)}
                        className={cn(
                          "relative flex flex-col items-center gap-2 p-4 rounded-2xl glass-panel border transition-all duration-200 text-left",
                          isSelected
                            ? "border-primary shadow-[0_0_20px_rgba(255,0,128,0.25)] bg-primary/10"
                            : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        )}
                        whileTap={{ scale: 0.97 }}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className="w-16 h-16 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain drop-shadow-lg" loading="lazy" />
                          ) : (
                            <ShoppingBag className="w-8 h-8 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="w-full text-center">
                          <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.itemType}</p>
                          {item.value && (
                            <p className="text-[10px] text-yellow-400 font-mono mt-0.5">{formatNumber(item.value)}</p>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              {listingsLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-24 glass-panel rounded-3xl">
                  <ListChecks className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">No listings yet</h3>
                  <p className="text-muted-foreground mb-6">Head over to Create Listing to add your first listing.</p>
                  <Button onClick={() => setStep("select")} variant="outline">Create a Listing</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...listings].reverse().map((listing) => {
                    const listingAvatar = listing.discordUserId && listing.discordAvatar
                      ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
                      : null;
                    const isOwner = !!user && user.id === listing.discordUserId;
                    const inviteUrl = user?.discordInviteUrl || config?.discordInviteUrl || null;
                    return (
                      <motion.div
                        key={listing.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel rounded-2xl p-6 border border-white/10"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {listingAvatar ? (
                              <img src={listingAvatar} alt={listing.seller} className="w-9 h-9 rounded-full ring-2 ring-white/10" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                                {listing.seller[0]?.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h3 className="font-display font-bold text-lg text-white">{listing.seller}</h3>
                              <div className="flex items-center gap-3 mt-0.5">
                                <p className="text-muted-foreground text-xs">
                                  {new Date(listing.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </p>
                                {listing.paymentMethods?.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {listing.paymentMethods.map((m) => (
                                      <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 font-medium flex items-center gap-0.5">
                                        {PAYMENT_EMOJI[m] ? <span>{PAYMENT_EMOJI[m]}</span> : null}
                                        {m}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isOwner && inviteUrl && (
                              <a
                                href={inviteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2]/30 border border-[#5865F2]/30 transition-colors whitespace-nowrap"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                                </svg>
                                Buy via Discord
                              </a>
                            )}
                            {isOwner && (
                              <button
                                onClick={() => deleteListing.mutate(listing.id)}
                                className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                                title="Delete listing"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {listing.customMessage && (
                          <div className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 italic">
                            "{listing.customMessage}"
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {listing.items.map((item) => (
                            <div
                              key={item.name}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border transition-all",
                                item.soldOut
                                  ? "border-white/5 bg-black/20 opacity-50"
                                  : "border-white/10 bg-black/30"
                              )}
                            >
                              {item.imageUrl && (
                                <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-contain flex-shrink-0" />
                              )}
                              <div className="flex-grow min-w-0">
                                <p className={cn("text-sm font-semibold leading-tight", item.soldOut && "line-through text-muted-foreground")}>
                                  {item.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {item.soldOut ? "Sold Out" : `Qty: ${item.quantity}`}
                                </p>
                                {item.price && !item.soldOut && (
                                  <p className="text-xs text-green-400 font-semibold mt-0.5">${item.price}</p>
                                )}
                              </div>
                              {!item.soldOut && isOwner && (
                                <button
                                  onClick={() => { setSoldDialogItem({ listingId: listing.id, item }); setSoldQtyInput(""); }}
                                  className="flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors whitespace-nowrap"
                                >
                                  Mark Sold
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Guild picker modal */}
      <AnimatePresence>
        {showGuildPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGuildPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel rounded-2xl p-6 w-full max-w-sm border border-white/15 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display font-bold text-lg text-white mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Post to Server
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Select a server where you have manage permissions and the bot is present.
              </p>
              {guilds.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No eligible servers found. Make sure the bot is in a server you manage.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {guilds.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handlePostToDiscord(g.id)}
                      disabled={postToDiscord.isPending}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-[#5865F2]/40 hover:bg-[#5865F2]/10 transition-all text-left"
                    >
                      {g.icon ? (
                        <img src={g.icon} alt={g.name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-xs font-bold text-[#5865F2]">
                          {g.name[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium text-white flex-1 truncate">{g.name}</span>
                      {postToDiscord.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Send className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full mt-4" onClick={() => setShowGuildPicker(false)}>
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mark as Sold dialog */}
      <AnimatePresence>
        {soldDialogItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setSoldDialogItem(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel rounded-2xl p-6 w-full max-w-sm border border-white/15 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display font-bold text-lg text-white mb-1">Mark as Sold</h3>
              <p className="text-muted-foreground text-sm mb-5">
                <span className="font-semibold text-white">{soldDialogItem.item.name}</span>
                {" "}— currently {typeof soldDialogItem.item.quantity === "number" ? `${soldDialogItem.item.quantity} in stock` : soldDialogItem.item.quantity}
              </p>

              {typeof soldDialogItem.item.quantity === "number" && soldDialogItem.item.quantity > 1 && (
                <div className="mb-4">
                  <label className="block text-sm text-muted-foreground mb-2">How many sold? (leave empty to mark all sold out)</label>
                  <Input
                    type="number"
                    min={1}
                    max={soldDialogItem.item.quantity}
                    value={soldQtyInput}
                    onChange={(e) => setSoldQtyInput(e.target.value)}
                    placeholder={`1 – ${soldDialogItem.item.quantity}`}
                    className="bg-black/40 border-white/10"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSoldDialogItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={markSold.isPending}
                  onClick={() => {
                    const qty = soldQtyInput ? parseInt(soldQtyInput) : undefined;
                    handleMarkSold(soldDialogItem.listingId, soldDialogItem.item.name, !qty, qty);
                  }}
                >
                  {markSold.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Sold"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
