import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, X, Check, Loader2 } from "lucide-react";

export interface ReportTarget {
  type: "listing" | "user";
  id: string;
  name: string;
}

export function ReportModal({
  target,
  onClose,
}: {
  target: ReportTarget;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetType: target.type,
          targetId: target.id,
          targetName: target.name,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to submit report");
      }
      setDone(true);
      setTimeout(onClose, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
        className="glass-panel border border-red-500/20 rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
          <Flag className="w-4 h-4 text-red-400" />
          <span className="font-bold text-white text-sm flex-1">
            Report {target.type === "user" ? "User" : "Listing"}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {done ? (
            <div className="text-center py-4 space-y-2">
              <Check className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-white font-bold text-sm">Report submitted</p>
              <p className="text-xs text-muted-foreground">Our moderation team will review it shortly.</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                Reporting: <strong className="text-red-200">{target.name}</strong>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the issue (scam, harassment, rule violation, etc.)"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-red-500/40 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!reason.trim() || submitting}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                  {submitting ? "Submitting…" : "Submit Report"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function useReportModal() {
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  return { reportTarget, setReportTarget, clearReport: () => setReportTarget(null) };
}
