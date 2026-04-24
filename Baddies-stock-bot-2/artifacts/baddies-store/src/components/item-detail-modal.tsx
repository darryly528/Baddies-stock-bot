import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Coins, TrendingUp, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CatalogItem } from "@/hooks/use-catalog";
import { cn, formatNumber } from "@/lib/utils";

const apiBase = import.meta.env.VITE_API_URL ?? "";

const RANGES = [
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "ALL", value: "all" },
] as const;

interface Snapshot {
  t: number;
  v: number | null;
  r: number | null;
}

interface HistoryResponse {
  itemId: number;
  name: string | null;
  range: string;
  history: Snapshot[];
}

interface Props {
  item: CatalogItem | null;
  onClose: () => void;
}

function getRarityStyles(rarity: string) {
  const norm = rarity.toLowerCase();
  if (norm.includes("legend")) return { border: "border-yellow-500/50", text: "text-yellow-400", bg: "bg-yellow-500/10" };
  if (norm.includes("epic")) return { border: "border-purple-500/50", text: "text-purple-400", bg: "bg-purple-500/10" };
  if (norm.includes("rare")) return { border: "border-blue-500/50", text: "text-blue-400", bg: "bg-blue-500/10" };
  if (norm.includes("uncommon")) return { border: "border-green-500/50", text: "text-green-400", bg: "bg-green-500/10" };
  return { border: "border-gray-500/50", text: "text-gray-400", bg: "bg-gray-500/10" };
}

function ChartCard({
  title,
  data,
  dataKey,
  color,
  icon,
  current,
}: {
  title: string;
  data: { time: number; value: number | null }[];
  dataKey: "value";
  color: string;
  icon: React.ReactNode;
  current: number | null;
}) {
  const valid = data.filter((d) => d.value !== null);
  const minDomain = valid.length ? Math.min(...valid.map((d) => d.value as number)) * 0.95 : 0;
  const maxDomain = valid.length ? Math.max(...valid.map((d) => d.value as number)) * 1.05 : 100;

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{title}</span>
        </div>
        <span className="font-mono font-bold text-white text-lg">{formatNumber(current)}</span>
      </div>
      <div className="h-44">
        {valid.length < 2 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground/60 italic text-center px-4">
            No history available for this item yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[minDomain, maxDomain]}
                tickFormatter={(v) => formatNumber(v)}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(t) => new Date(t).toLocaleString()}
                formatter={(v: number) => [formatNumber(v), title]}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function ItemDetailModal({ item, onClose }: Props) {
  const [range, setRange] = useState<string>("1m");

  const { data, isLoading } = useQuery({
    queryKey: ["item-history", item?.itemId, range],
    enabled: !!item,
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/catalog/items/${item!.itemId}/history?range=${range}`);
      if (!res.ok) throw new Error("Failed to load history");
      return res.json() as Promise<HistoryResponse>;
    },
    staleTime: 30_000,
  });

  const valueData = useMemo(() => (data?.history ?? []).map((s) => ({ time: s.t, value: s.v })), [data]);
  const rapData = useMemo(() => (data?.history ?? []).map((s) => ({ time: s.t, value: s.r })), [data]);

  if (!item) return null;
  const rarityStyle = getRarityStyles(item.rarity);

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          key="modal"
          layoutId={`item-card-${item.itemId}`}
          transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl my-8 glass-panel rounded-3xl border border-white/10 overflow-hidden"
        >
          <motion.button
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2, duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.18, duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="p-6 sm:p-8"
          >
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
              <div className={cn("relative w-full sm:w-48 h-48 flex-shrink-0 rounded-2xl border-2 bg-black/40 flex items-center justify-center p-4", rarityStyle.border)}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="object-contain w-full h-full drop-shadow-2xl" />
                ) : (
                  <span className="text-muted-foreground/50 text-sm">No image</span>
                )}
                <span className={cn("absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider backdrop-blur-md border", rarityStyle.bg, rarityStyle.text, rarityStyle.border)}>
                  {item.rarity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap mb-2">
                  <h2 className="text-3xl font-display font-extrabold text-white leading-tight">{item.name}</h2>
                  {item.acronym && (
                    <span className="text-xs font-medium text-muted-foreground bg-white/5 px-2 py-0.5 rounded mt-2">
                      {item.acronym}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-white/10 text-white/80">{item.itemType}</span>
                  {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Demand</p>
                    <p className={cn("font-semibold mt-0.5",
                      item.demand?.toLowerCase().includes("amazing") ? "text-primary" :
                      item.demand?.toLowerCase().includes("high") ? "text-green-400" : "text-white"
                    )}>{item.demand || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trend</p>
                    <p className={cn("font-semibold mt-0.5 capitalize",
                      item.trend?.toLowerCase().includes("rais") || item.trend?.toLowerCase().includes("up") ? "text-green-400" :
                      item.trend?.toLowerCase().includes("low") || item.trend?.toLowerCase().includes("down") ? "text-red-400" : "text-white"
                    )}>{item.trend || "Stable"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tradeable</p>
                    <p className={cn("font-semibold mt-0.5", item.tradeable ? "text-green-400" : "text-red-400")}>
                      {item.tradeable ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Item ID</p>
                    <p className="font-mono text-xs mt-0.5 text-muted-foreground">{item.itemId}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-white">Value &amp; RAP History</h3>
              <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-lg transition-colors",
                      range === r.value ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="h-44 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartCard
                  title="Value"
                  data={valueData}
                  dataKey="value"
                  color="#facc15"
                  icon={<Coins className="w-4 h-4 text-yellow-400" />}
                  current={item.value}
                />
                <ChartCard
                  title="RAP"
                  data={rapData}
                  dataKey="value"
                  color="#60a5fa"
                  icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
                  current={item.rap}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
