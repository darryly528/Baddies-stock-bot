import { useState, useMemo } from "react";
import { useInfiniteCatalogItems } from "@/hooks/use-catalog";
import { useListings, useCreateListing, useMarkSold, useDeleteListing } from "@/hooks/use-listings";
import type { ListingItem } from "@/hooks/use-listings";
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
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

interface SelectedItem {
  name: string;
  itemType: string;
  imageUrl: string | null;
  quantity: number;
}

export default function ListPage() {
  const [step, setStep] = useState<"select" | "review">("select");
  const [seller, setSeller] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [itemType, setItemType] = useState("All");
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [soldDialogItem, setSoldDialogItem] = useState<{ listingId: string; item: ListingItem } | null>(null);
  const [soldQtyInput, setSoldQtyInput] = useState("");

  const { data: catalogData, isLoading: catalogLoading } = useInfiniteCatalogItems({
    search,
    itemType,
    category: "All",
  });

  const { data: listings = [], isLoading: listingsLoading } = useListings();
  const createListing = useCreateListing();
  const markSold = useMarkSold();
  const deleteListing = useDeleteListing();

  const items = useMemo(() => catalogData?.pages.flatMap((p) => p.items) ?? [], [catalogData]);

  const ITEM_TYPES = [
    { label: "All", value: "All" },
    { label: "Weapons", value: "Weapon" },
    { label: "Fighting Styles", value: "FightingStyle" },
    { label: "Skins", value: "Skin" },
  ];

  function toggleItem(item: { name: string; itemType: string; imageUrl: string | null }) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.name === item.name);
      if (exists) return prev.filter((s) => s.name !== item.name);
      return [...prev, { name: item.name, itemType: item.itemType, imageUrl: item.imageUrl, quantity: 1 }];
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

  async function submitListing() {
    if (!seller.trim() || selected.length === 0) return;
    await createListing.mutateAsync({
      seller: seller.trim(),
      items: selected.map((s) => ({ name: s.name, itemType: s.itemType, imageUrl: s.imageUrl, quantity: s.quantity })),
    });
    setSelected([]);
    setSeller("");
    setStep("select");
  }

  async function handleMarkSold(listingId: string, itemName: string, soldAll: boolean, qty?: number) {
    await markSold.mutateAsync({ listingId, itemName, soldQty: soldAll ? undefined : qty });
    setSoldDialogItem(null);
    setSoldQtyInput("");
  }

  const activeListings = listings.filter((l) => l.items.some((i) => !i.soldOut));

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
              {/* Seller name + selected cart */}
              <div className="glass-panel rounded-2xl p-6 mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Your Name / Username</label>
                  <Input
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    placeholder="e.g. Baddie123"
                    className="bg-black/40 border-white/10 max-w-xs"
                  />
                </div>

                {selected.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Selected ({selected.length}) — set quantities below
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selected.map((s) => (
                        <div
                          key={s.name}
                          className="flex items-center gap-2 glass-panel rounded-xl px-3 py-2 border border-primary/30"
                        >
                          {s.imageUrl && (
                            <img src={s.imageUrl} alt={s.name} className="w-6 h-6 object-contain" />
                          )}
                          <span className="text-sm font-medium text-white">{s.name}</span>
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
                          <button
                            onClick={() => toggleItem(s)}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={submitListing}
                      disabled={!seller.trim() || createListing.isPending}
                      className="mt-4"
                      size="lg"
                    >
                      {createListing.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</>
                      ) : (
                        <><ShoppingBag className="w-4 h-4 mr-2" />Publish Listing ({selected.length} items)</>
                      )}
                    </Button>
                    {createListing.isSuccess && (
                      <p className="mt-2 text-green-400 text-sm flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Listing published!
                      </p>
                    )}
                  </div>
                )}
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
                <form
                  onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
                  className="relative w-full sm:w-72"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search catalog..."
                    className="pl-9 pr-16 bg-black/40 border-white/10"
                  />
                  <Button type="submit" size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg">
                    Go
                  </Button>
                </form>
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
                  {[...listings].reverse().map((listing) => (
                    <motion.div
                      key={listing.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-panel rounded-2xl p-6 border border-white/10"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-display font-bold text-lg text-white">{listing.seller}</h3>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            Listed {new Date(listing.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteListing.mutate(listing.id)}
                          className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                          title="Delete listing"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

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
                            </div>
                            {!item.soldOut && (
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
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
