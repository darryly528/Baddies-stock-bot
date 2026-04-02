import { useListings } from "@/hooks/use-listings";
import { useConfig } from "@/hooks/use-config";
import { motion } from "framer-motion";
import { Loader2, LayoutList, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const PAYMENT_EMOJI: Record<string, string> = {
  "PayPal":    "https://cdn.discordapp.com/emojis/1481817468912799814.png",
  "Apple Pay": "https://cdn.discordapp.com/emojis/1481817467813888212.png",
  "Cash App":  "https://cdn.discordapp.com/emojis/1481817227975069718.png",
  "Venmo":     "https://cdn.discordapp.com/emojis/1481817470431006883.png",
};

export default function ListingsPage() {
  const { data: listings = [], isLoading } = useListings();
  const { data: config } = useConfig();

  const activeListings = [...listings]
    .reverse()
    .filter((l) => l.items.some((i) => !i.soldOut));

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
            <LayoutList className="w-4 h-4" />
            <span className="text-sm font-semibold tracking-wide uppercase">All Listings</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 mb-4">
            Browse <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">Listings</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Active stock listings from all sellers. Click "Buy via Discord" to open a ticket.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : activeListings.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-3xl">
            <LayoutList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No active listings</h3>
            <p className="text-muted-foreground">Check back soon — sellers will post stock here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeListings.map((listing) => {
              const listingAvatar = listing.discordUserId && listing.discordAvatar
                ? `https://cdn.discordapp.com/avatars/${listing.discordUserId}/${listing.discordAvatar}.png?size=64`
                : null;
              const inviteUrl = config?.discordInviteUrl ?? null;
              const availableItems = listing.items.filter((i) => !i.soldOut);

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
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <p className="text-muted-foreground text-xs">
                            {new Date(listing.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {listing.paymentMethods?.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {listing.paymentMethods.map((m) => (
                                <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 font-medium flex items-center gap-0.5">
                                  {PAYMENT_EMOJI[m] && (
                                    <img src={PAYMENT_EMOJI[m]} alt={m} className="w-3 h-3 object-contain" />
                                  )}
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {inviteUrl && (
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
                  </div>

                  {listing.customMessage && (
                    <div className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 italic">
                      "{listing.customMessage}"
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableItems.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-black/30"
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-contain flex-shrink-0" />
                        ) : (
                          <ShoppingBag className="w-10 h-10 text-muted-foreground/30 flex-shrink-0" />
                        )}
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-semibold leading-tight text-white">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                          {item.price && (
                            <p className="text-xs text-green-400 font-semibold mt-0.5">${item.price}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
