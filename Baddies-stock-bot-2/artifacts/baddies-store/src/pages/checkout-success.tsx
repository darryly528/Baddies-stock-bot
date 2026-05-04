import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";

type SessionData = {
  status: string;
  customerEmail: string | null;
  amountTotal: number | null;
  lineItems: { description: string | null; amount_total: number; quantity: number | null; price: { product_data?: { name?: string }; product?: { name?: string } } | null }[];
};

export default function CheckoutSuccess() {
  const [search] = useLocation();
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    fetch(`/api/checkout/session/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSession(data);
      })
      .catch(() => setError("Could not load order details."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="glass-panel border border-white/10 rounded-2xl p-8 sm:p-12 max-w-lg w-full text-center space-y-6"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground">Loading order details…</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
            <h1 className="font-display font-extrabold text-3xl text-white">Payment Received!</h1>
            <p className="text-muted-foreground text-sm">Your payment was successful. The seller will be in touch shortly.</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.3)]"
            >
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </motion.div>

            <div className="space-y-2">
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white">Payment Successful!</h1>
              {session?.amountTotal != null && (
                <p className="text-2xl font-bold text-green-400">
                  ${(session.amountTotal / 100).toFixed(2)}
                </p>
              )}
              {session?.customerEmail && (
                <p className="text-sm text-muted-foreground">Receipt sent to {session.customerEmail}</p>
              )}
            </div>

            {session && session.lineItems.length > 0 && (
              <div className="bg-black/30 rounded-xl border border-white/10 divide-y divide-white/5 text-left overflow-hidden">
                {session.lineItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {(item.price as any)?.product?.name ?? "Item"}
                      </p>
                      {item.quantity && item.quantity > 1 && (
                        <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-green-400 shrink-0">
                      ${(item.amount_total / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed">
              The seller will be notified and will reach out to complete the trade. Check your messages for updates.
            </p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/listings"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm font-semibold"
          >
            <ShoppingBag className="w-4 h-4" />
            Back to Listings
          </Link>
          <Link
            href="/messages"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm shadow-[0_0_16px_rgba(255,0,128,0.3)] hover:opacity-90 transition-opacity"
          >
            View Messages
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
