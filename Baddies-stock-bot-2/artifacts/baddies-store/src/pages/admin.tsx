import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Trash2, RefreshCw, BarChart3, Package,
  Users, ShoppingBag, AlertTriangle, X, Box, ChevronDown, ChevronUp
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { Link } from "wouter";

const ADMIN_USERNAME = "disgust_tf";

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="glass-panel border border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
          <p className="text-white text-sm font-semibold">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-white/15 text-muted-foreground hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors"
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => {
      if (!r.ok) throw new Error("Forbidden");
      return r.json();
    }),
    enabled: user?.username === ADMIN_USERNAME,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery<Listing[]>({
    queryKey: ["admin-listings"],
    queryFn: () => fetch("/api/admin/listings").then((r) => r.json()),
    enabled: user?.username === ADMIN_USERNAME,
  });

  const deleteListing = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/listings/${id}`, { method: "DELETE" }).then((r) => r.json()),
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

  if (user.username !== ADMIN_USERNAME) {
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

  function ask(message: string, action: () => void) {
    setConfirm({ message, action });
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,0,128,0.2)]">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Logged in as <span className="text-primary font-semibold">{user.username}</span></p>
          </div>
        </motion.div>

        {/* Stats grid */}
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

        {/* Actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-3">
          <button
            onClick={() => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => ask("Remove all sold-out items from listings?", () => clearSoldOut.mutate())}
            disabled={clearSoldOut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-sm font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear Sold-Out
          </button>
          <button
            onClick={() => ask("Delete ALL listings? This cannot be undone.", () => clearAll.mutate())}
            disabled={clearAll.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            Clear All Listings
          </button>
        </motion.div>

        {/* Listings table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-3">
          <h2 className="text-lg font-display font-bold text-white">
            All Listings <span className="text-muted-foreground text-base font-normal">({listings.length})</span>
          </h2>

          {listingsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-panel border border-white/10 rounded-xl h-16 animate-pulse bg-white/5" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="glass-panel border border-white/10 rounded-2xl p-12 text-center text-muted-foreground">
              No listings found.
            </div>
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
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={listing.seller} className="w-8 h-8 rounded-full ring-1 ring-white/20 shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {listing.seller[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{listing.seller}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-semibold">
                            {activeCount} active
                          </span>
                          {listing.items.some((i) => i.soldOut) && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                              {listing.items.filter((i) => i.soldOut).length} sold
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {new Date(listing.createdAt).toLocaleString()} · {listing.id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => ask(`Delete ${listing.seller}'s listing?`, () => deleteListing.mutate(listing.id))}
                          disabled={deleteListing.isPending}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-white/10"
                        >
                          <div className="px-4 py-3 space-y-1.5">
                            {listing.items.map((item, i) => (
                              <div key={i} className={`flex items-center gap-3 py-1.5 ${item.soldOut ? "opacity-40" : ""}`}>
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-7 h-7 object-contain shrink-0" />
                                ) : (
                                  <Box className="w-7 h-7 text-muted-foreground/30 shrink-0" />
                                )}
                                <span className="text-sm text-white flex-1">{item.name}</span>
                                <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                                {item.price && <span className="text-xs text-green-400 font-bold">${item.price}</span>}
                                {item.soldOut && <span className="text-[10px] text-orange-400 font-semibold">SOLD</span>}
                              </div>
                            ))}
                            {listing.customMessage && (
                              <p className="text-xs text-muted-foreground italic pt-1 border-t border-white/5 mt-2">
                                "{listing.customMessage}"
                              </p>
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
        </motion.div>
      </div>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            message={confirm.message}
            onConfirm={() => { confirm.action(); setConfirm(null); }}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
