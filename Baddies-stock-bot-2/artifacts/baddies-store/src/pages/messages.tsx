import { useState, useEffect, useRef } from "react";
import { useConversations, useConversation, useSendMessage, useIsMod, useMiddleman, useBlocks, useBlock, useUnblock } from "@/hooks/use-messages";
import { useAuth } from "@/contexts/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, X, Send, AlertTriangle, Loader2, MessageCircle, ImageIcon, Flag, Shield, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportModal, type ReportTarget } from "@/components/report-modal";

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: conversations = [], isLoading } = useConversations();
  const [openConvId, setOpenConvId] = useState<string | null>(null);
  const { data: openConv } = useConversation(openConvId);
  const sendMsg = useSendMessage(openConvId);
  const mmTicket = useMiddleman(openConvId);
  const { data: modData } = useIsMod();
  const isMod = modData?.isMod ?? false;
  const { data: blocksData } = useBlocks();
  const blockMutation = useBlock();
  const unblockMutation = useUnblock();
  const otherId = openConv ? (user?.id === openConv.sellerId ? openConv.buyerId : openConv.sellerId) : null;
  const isBlocked = !!otherId && (blocksData?.blocked ?? []).includes(otherId);
  const [replyDraft, setReplyDraft] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [mmStatus, setMmStatus] = useState<string | null>(null);
  const [showMmConfirm, setShowMmConfirm] = useState(false);
  const convBottomRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  async function uploadAndSendImage(file: File) {
    if (!openConvId) return;
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/uploads/dm-image", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { url, pendingId } = await res.json() as { url: string; pendingId?: string };
      sendMsg.mutate({ content: "", imageUrl: url, pendingId });
    } catch {
    } finally {
      setImageUploading(false);
    }
  }

  useEffect(() => {
    convBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openConv?.messages?.length]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center glass-panel rounded-3xl p-12 max-w-md w-full">
          <MessageCircle className="w-14 h-14 text-primary/50 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in to view messages</h2>
          <p className="text-muted-foreground mb-6">Log in with Discord to access your conversations.</p>
          <a
            href="/api/auth/discord"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Login with Discord
          </a>
        </div>
      </div>
    );
  }

  const sorted = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const unreadCount = conversations.filter((c) => c.unread).length;

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <Inbox className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">Messages</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/30 text-primary text-xs font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">Conversations with buyers and sellers.</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : !openConvId ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {sorted.length === 0 ? (
                <div className="text-center py-24 glass-panel rounded-3xl">
                  <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">No messages yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Buyers who message you from the Listings page will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sorted.map((conv) => {
                    const isSellerView = !!user && conv.sellerId === user.id;
                    const otherName = isSellerView ? conv.buyerName : conv.sellerName;
                    const otherId = isSellerView ? conv.buyerId : conv.sellerId;
                    const otherAvatarHash = isSellerView ? conv.buyerAvatar : conv.sellerAvatar;
                    const otherAvatarUrl = otherId && otherAvatarHash
                      ? `https://cdn.discordapp.com/avatars/${otherId}/${otherAvatarHash}.png?size=64`
                      : null;
                    return (
                      <motion.button
                        key={conv.id}
                        onClick={() => setOpenConvId(conv.id)}
                        className={cn(
                          "w-full glass-panel rounded-2xl p-4 border text-left flex items-start gap-3 transition-all hover:border-primary/30",
                          conv.unread ? "border-primary/40 bg-primary/5" : "border-white/10"
                        )}
                      >
                        {otherAvatarUrl ? (
                          <img src={otherAvatarUrl} alt={otherName} className="w-10 h-10 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                            {otherName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn("text-sm font-semibold truncate", conv.unread ? "text-white" : "text-white/80")}>{otherName}</p>
                            {conv.unread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.listingTitle}</p>
                          {conv.lastMessage && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-1">
                              {conv.lastMessage.filtered ? "Message filtered" : conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(conv.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : openConv ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="glass-panel rounded-2xl border border-white/10 overflow-hidden flex flex-col"
              style={{ height: "min(600px, calc(100vh - 200px))" }}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 flex-shrink-0">
                <button onClick={() => setOpenConvId(null)} className="text-muted-foreground hover:text-white transition-colors p-1">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.id === openConv.sellerId ? openConv.buyerName : openConv.sellerName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{openConv.listingTitle}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {mmStatus && (
                    <span className="text-[10px] text-primary font-medium px-2 py-1 bg-primary/10 rounded-lg">{mmStatus}</span>
                  )}
                  <button
                    onClick={() => setShowMmConfirm(true)}
                    disabled={mmTicket.isPending}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-primary/80 bg-primary/10 hover:bg-primary/20 disabled:opacity-40 transition-colors"
                    title="Request a middleman"
                  >
                    {mmTicket.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    <span>Middle Man</span>
                  </button>
                  <button
                    onClick={() => {
                      const targetId = user?.id === openConv.sellerId ? openConv.buyerId : openConv.sellerId;
                      if (isBlocked) {
                        unblockMutation.mutate(targetId);
                      } else {
                        blockMutation.mutate(targetId);
                      }
                    }}
                    disabled={blockMutation.isPending || unblockMutation.isPending}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40",
                      isBlocked
                        ? "text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
                        : "text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10"
                    )}
                    title={isBlocked ? "Unblock user" : "Block user"}
                  >
                    <UserX className="w-3 h-3" />
                    <span>{isBlocked ? "Unblock" : "Block"}</span>
                  </button>
                  <button
                    onClick={() => {
                      const targetId = user?.id === openConv.sellerId ? openConv.buyerId : openConv.sellerId;
                      const targetName = user?.id === openConv.sellerId ? openConv.buyerName : openConv.sellerName;
                      setReportTarget({ type: "user", id: targetId, name: targetName });
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Report user"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {openConv.messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  const avatarUrl = msg.senderId && msg.senderAvatar
                    ? `https://cdn.discordapp.com/avatars/${msg.senderId}/${msg.senderAvatar}.png?size=64`
                    : null;
                  return (
                    <div key={msg.id} className={cn("group flex gap-2 items-end", isMe ? "flex-row-reverse" : "flex-row")}>
                      {!isMe && (
                        msg.isAdmin ? (
                          <img src="/admin-avatar.jpg" alt="Admin" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
                        ) : avatarUrl ? (
                          <img src={avatarUrl} alt={msg.senderName} className="w-6 h-6 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                            {msg.senderName[0]?.toUpperCase()}
                          </div>
                        )
                      )}
                      <div className={cn("max-w-[75%] flex flex-col", isMe ? "items-end" : "items-start")}>
                        {!isMe && msg.isAdmin && (
                          <span className="text-[10px] font-bold text-primary px-1 mb-0.5">Admin</span>
                        )}
                        {msg.filtered ? (
                          <div className={cn("flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm", isMe ? "bg-primary/20 text-primary/60 rounded-br-sm" : "bg-white/10 text-muted-foreground rounded-bl-sm")}>
                            <AlertTriangle className="w-3 h-3" />
                            <span className="italic text-xs">Message filtered</span>
                          </div>
                        ) : msg.imageUrl ? (
                          msg.imagePending ? (
                            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-2xl text-sm", isMe ? "bg-primary/10 text-primary/60 rounded-br-sm" : "bg-white/10 text-muted-foreground rounded-bl-sm")}>
                              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                              <span className="text-xs italic">Image awaiting mod approval…</span>
                            </div>
                          ) : (
                            <img
                              src={msg.imageUrl}
                              alt="Shared image"
                              className="rounded-2xl max-h-60 max-w-xs object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(msg.imageUrl, "_blank")}
                            />
                          )
                        ) : (
                          <div className={cn("px-3 py-2 rounded-2xl text-sm break-words",
                            msg.isAdmin
                              ? (isMe ? "bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-br-sm" : "bg-violet-600/20 border border-violet-500/30 text-white rounded-bl-sm")
                              : (isMe ? "bg-gradient-to-br from-primary to-secondary text-white rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm")
                          )}>
                            {msg.content}
                          </div>
                        )}
                        <div className={cn("flex items-center gap-1 mt-0.5", isMe ? "flex-row-reverse" : "flex-row")}>
                          <p className={cn("text-[10px] text-muted-foreground px-1", isMe ? "text-right" : "text-left")}>
                            {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {!isMe && !msg.filtered && (
                            <button
                              onClick={() => setReportTarget({ type: "message", id: msg.id, name: msg.senderName, context: msg.content?.slice(0, 200) })}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground/40 hover:text-red-400 transition-all"
                              title="Report message"
                            >
                              <Flag className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={convBottomRef} />
              </div>
              <div className="flex-shrink-0 border-t border-white/10 p-3 flex gap-2">
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAndSendImage(file);
                    e.target.value = "";
                  }}
                />
                {isBlocked ? (
                  <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <UserX className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span className="text-sm text-orange-300">You've blocked this user. </span>
                    <button
                      onClick={() => otherId && unblockMutation.mutate(otherId)}
                      className="text-sm text-orange-400 underline hover:text-orange-300 transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => imgInputRef.current?.click()}
                      disabled={imageUploading || sendMsg.isPending}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-colors flex-shrink-0"
                      title="Send image"
                    >
                      {imageUploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 flex flex-col gap-1">
                      {isMod && (
                        <div className="flex items-center gap-1.5 px-1">
                          <img src="/admin-avatar.jpg" alt="Admin" className="w-3.5 h-3.5 rounded-full object-cover" />
                          <span className="text-[10px] text-primary font-semibold">Sending as Admin</span>
                        </div>
                      )}
                      <input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && replyDraft.trim()) {
                            e.preventDefault();
                            sendMsg.mutate(replyDraft.trim(), { onSuccess: () => setReplyDraft("") });
                          }
                        }}
                        placeholder={isMod ? "Type as Admin…" : "Type a message…"}
                        className={cn(
                          "flex-1 bg-white/5 border rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none transition-colors",
                          isMod ? "border-primary/30 focus:border-primary/60" : "border-white/10 focus:border-primary/40"
                        )}
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (replyDraft.trim()) {
                          sendMsg.mutate(replyDraft.trim(), { onSuccess: () => setReplyDraft("") });
                        }
                      }}
                      disabled={!replyDraft.trim() || sendMsg.isPending}
                      className="p-2 rounded-xl bg-primary hover:bg-primary/80 disabled:opacity-40 transition-colors"
                    >
                      {sendMsg.isPending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {reportTarget && (
          <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMmConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMmConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-[#18181b] border border-white/10 shadow-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Request a Middleman?</h3>
                  <p className="text-xs text-muted-foreground">Read before confirming</p>
                </div>
              </div>

              <div className="rounded-xl bg-primary/8 border border-primary/20 px-4 py-3 flex items-start gap-3">
                <span className="text-xl mt-0.5">💰</span>
                <p className="text-sm text-white/80 leading-relaxed">
                  The middleman facilitates this trade and takes a{" "}
                  <span className="font-bold text-primary">15% fee</span>{" "}
                  of the total transaction value as compensation for their service.
                </p>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                A private Discord ticket will be opened with both parties and a moderator who will oversee the exchange.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowMmConfirm(false)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium text-muted-foreground bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowMmConfirm(false);
                    setMmStatus(null);
                    try {
                      await mmTicket.mutateAsync();
                      setMmStatus("Ticket created in Discord!");
                      setTimeout(() => setMmStatus(null), 4000);
                    } catch {
                      setMmStatus("Failed — bot may be offline");
                      setTimeout(() => setMmStatus(null), 4000);
                    }
                  }}
                  disabled={mmTicket.isPending}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/80 disabled:opacity-50 transition-colors"
                >
                  {mmTicket.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
