import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInfiniteCatalogItems, useCatalogCategories } from "@/hooks/use-catalog";
import { ItemCard } from "@/components/item-card";
import { ItemDetailModal } from "@/components/item-detail-modal";
import type { CatalogItem } from "@/hooks/use-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Search, Loader2, MessageSquare, FilterX, Sparkles, Box, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/hooks/use-config";

const apiBase = import.meta.env.VITE_API_URL ?? "";

const ITEM_TYPES = [
  { label: "All", value: "All", emoji: "✨" },
  { label: "Weapons", value: "Weapon", emoji: "⚔️" },
  { label: "Fighting Styles", value: "Fighting Style", emoji: "🥋" },
  { label: "Skins", value: "Skin", emoji: "🎨" },
];

export default function Home() {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState(""); // Debounced visually
  const [itemType, setItemType] = useState("All");
  const [category, setCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${apiBase}/api/catalog/refresh`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { count: number; updatedAt: string };
        setLastRefreshAt(data.updatedAt);
        await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      }
    } finally {
      setRefreshing(false);
    }
  }

  const { data: categoriesData } = useCatalogCategories();
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError
  } = useInfiniteCatalogItems({ search, itemType, category });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleTypeChange = (type: string) => {
    setItemType(type);
    setCategory("All"); // Reset category when type changes
  };

  const items = data?.pages.flatMap((page) => page.items) || [];
  const totalItems = data?.pages[0]?.total || 0;

  // Derive available categories for the dropdown
  const availableCategories = ["All", ...(categoriesData?.categories || []).sort()];

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden">
      {/* Background Hero Image */}
      <div className="absolute top-0 left-0 w-full h-[600px] z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background z-10" />
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Baddies Neon Background" 
          className="w-full h-full object-cover opacity-60"
        />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-24 pb-10 sm:pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass-panel border-primary/30 text-primary mb-5 sm:mb-8 shadow-[0_0_30px_rgba(255,0,128,0.2)]">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-[10px] sm:text-sm font-semibold tracking-wide uppercase">Official Stock Explorer</span>
          </div>

          <img
            src="/logo.png"
            alt="Baddies Store"
            className="w-24 h-24 sm:w-32 sm:h-32 object-contain mb-4 sm:mb-6 drop-shadow-[0_0_32px_rgba(255,0,128,0.7)]"
          />
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 mb-4 sm:mb-6 drop-shadow-sm">
            Baddies <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">Store</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-10 leading-relaxed px-2">
            Browse our complete catalog of Weapons, Fighting Styles, and exclusive Skins. Find exactly what you need to dominate.
          </p>

          <a href={config?.discordInviteUrl ?? "https://discord.gg/eB6ksCQPWP"} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button variant="discord" size="lg" className="group w-full sm:w-auto">
              <MessageSquare className="w-5 h-5 mr-2 group-hover:animate-bounce" />
              <span className="text-sm sm:text-base">Join Discord for Middle Man service</span>
            </Button>
          </a>
        </motion.div>
      </div>

      {/* Interactive Filters Section */}
      <div className="relative z-20 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mb-8 sm:mb-12">
        <div className="glass-panel rounded-2xl p-2 md:p-4 shadow-2xl flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center justify-between sticky top-16 md:top-4">
          
          {/* Main Type Toggles */}
          <div className="flex w-full lg:w-auto p-1 bg-black/40 rounded-xl overflow-x-auto hide-scrollbar">
            {ITEM_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleTypeChange(type.value)}
                className={cn(
                  "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                  itemType === type.value 
                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                <span>{type.emoji}</span>
                <span className="hidden sm:inline">{type.label}</span>
              </button>
            ))}
          </div>

          <div className="flex w-full lg:w-auto gap-3 items-center flex-1 lg:flex-none justify-end">
            {/* Category Dropdown */}
            {itemType !== "Fighting Style" && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-12 px-4 rounded-xl border border-white/10 bg-black/40 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer hidden md:block w-48"
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat} className="bg-background text-white">
                    {cat === "All" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
            )}

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search items..."
                className="pl-10 pr-20 bg-black/40 border-white/10"
              />
              <Button 
                type="submit" 
                size="sm" 
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 rounded-lg"
              >
                Find
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Results Info */}
        {!isLoading && !isError && (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-6 sm:mb-8 border-b border-white/10 pb-4">
            <h2 className="text-xl sm:text-2xl font-display font-bold">
              {itemType === "All" ? "Catalog" : ITEM_TYPES.find(t => t.value === itemType)?.label}
              {category !== "All" && <span className="text-muted-foreground font-normal"> / {category}</span>}
              {search && <span className="text-primary font-normal"> "{search}"</span>}
            </h2>
            <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">
                {items.length} of {totalItems} items
              </p>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title={lastRefreshAt ? `Last refreshed ${new Date(lastRefreshAt).toLocaleTimeString()}` : "Refresh values from bloxtsar.com"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-muted-foreground hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 text-primary">
            <Loader2 className="w-12 h-12 animate-spin" />
            <p className="text-lg font-medium text-muted-foreground animate-pulse">Accessing vault...</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
              <FilterX className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Connection Lost</h3>
            <p className="text-muted-foreground mb-6">Failed to retrieve items from the server.</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry Connection
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center glass-panel rounded-3xl">
            <Box className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-2xl font-bold mb-2">No items found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              We couldn't find any items matching your current filters. Try adjusting your search or category.
            </p>
            <Button 
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setItemType("All");
                setCategory("All");
              }} 
              variant="outline"
            >
              Clear all filters
            </Button>
          </div>
        )}

        {/* Grid */}
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {items.map((item, index) => (
            <ItemCard key={`${item.itemId}-${index}`} item={item} onClick={() => setSelectedItem(item)} />
          ))}
        </motion.div>

        {/* Load More */}
        {hasNextPage && (
          <div className="mt-16 flex justify-center">
            <Button 
              onClick={() => fetchNextPage()} 
              disabled={isFetchingNextPage}
              size="lg"
              variant="outline"
              className="w-full max-w-md bg-black/40 border-white/10 hover:border-primary/50"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading more items...
                </>
              ) : (
                "Load More Items"
              )}
            </Button>
          </div>
        )}
      </main>

      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
