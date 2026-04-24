import { CatalogItem } from "@/hooks/use-catalog";
import { cn, formatNumber } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Coins, Box } from "lucide-react";

interface ItemCardProps {
  item: CatalogItem;
  onClick?: () => void;
}

function getRarityStyles(rarity: string) {
  const norm = rarity.toLowerCase();
  if (norm.includes("legend")) return { border: "border-yellow-500/50", glow: "shadow-yellow-500/20", text: "text-yellow-400", bg: "bg-yellow-500/10" };
  if (norm.includes("epic")) return { border: "border-purple-500/50", glow: "shadow-purple-500/20", text: "text-purple-400", bg: "bg-purple-500/10" };
  if (norm.includes("rare")) return { border: "border-blue-500/50", glow: "shadow-blue-500/20", text: "text-blue-400", bg: "bg-blue-500/10" };
  if (norm.includes("uncommon")) return { border: "border-green-500/50", glow: "shadow-green-500/20", text: "text-green-400", bg: "bg-green-500/10" };
  return { border: "border-gray-500/50", glow: "shadow-gray-500/20", text: "text-gray-400", bg: "bg-gray-500/10" };
}

function getTrendIcon(trend: string | null) {
  if (!trend) return <Minus className="w-4 h-4 text-gray-400" />;
  const norm = trend.toLowerCase();
  if (norm.includes("raising") || norm.includes("up")) return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (norm.includes("lowering") || norm.includes("down")) return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  const rarityStyle = getRarityStyles(item.rarity);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
      }}
      whileHover={onClick ? { y: -4, transition: { type: "spring", stiffness: 400, damping: 25 } } : undefined}
      whileTap={onClick ? { scale: 0.97, transition: { duration: 0.1, ease: "easeOut" } } : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl glass-panel hover:shadow-2xl",
        onClick && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50",
        rarityStyle.border,
        rarityStyle.glow
      )}
    >
      {/* Decorative gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80 z-10 pointer-events-none" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 z-10 bg-white pointer-events-none" />

      {/* Image Container */}
      <div className="relative h-48 w-full p-6 flex items-center justify-center bg-black/40">
        {item.imageUrl ? (
          <img 
            src={item.imageUrl} 
            alt={item.name} 
            className="object-contain w-full h-full drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500 ease-out relative z-0"
            loading="lazy"
          />
        ) : (
          <Box className="w-16 h-16 text-muted-foreground/50" />
        )}
        
        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 z-20 flex gap-2">
          <span className={cn("px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider backdrop-blur-md border", rarityStyle.bg, rarityStyle.text, rarityStyle.border)}>
            {item.rarity}
          </span>
        </div>
        <div className="absolute top-3 right-3 z-20">
          <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-black/60 text-white/90 backdrop-blur-md border border-white/10">
            {item.itemType}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-20 p-5 flex-grow flex flex-col">
        <div className="flex justify-between items-start gap-4 mb-3">
          <h3 className="font-display font-bold text-xl text-white leading-tight group-hover:text-primary transition-colors">
            {item.name}
          </h3>
          {item.acronym && (
            <span className="text-xs font-medium text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
              {item.acronym}
            </span>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 rounded-lg p-2 border border-white/5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Value</p>
              <p className="font-mono font-semibold text-white flex items-center gap-1.5 text-sm">
                <Coins className="w-3.5 h-3.5 text-yellow-500" />
                {formatNumber(item.value)}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-2 border border-white/5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">RAP</p>
              <p className="font-mono font-semibold text-white flex items-center gap-1.5 text-sm">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                {formatNumber(item.rap)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>Demand:</span>
              <span className={cn("font-medium", 
                item.demand?.toLowerCase().includes("amazing") ? "text-primary" : 
                item.demand?.toLowerCase().includes("high") ? "text-green-400" : "text-white"
              )}>
                {item.demand || "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(item.trend)}
              <span className="capitalize">{item.trend || "Stable"}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
