import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const apiBase = import.meta.env.VITE_API_URL ?? "";

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  timestamp: string;
  filtered: boolean;
}

export interface ConversationSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string | null;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  lastMessage: Message | null;
  unread: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}

export function useIsMod() {
  return useQuery({
    queryKey: ["is-mod"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/auth/is-mod`, { credentials: "include" });
      if (!res.ok) return { isMod: false };
      return res.json() as Promise<{ isMod: boolean }>;
    },
    staleTime: 60_000,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/messages`, { credentials: "include" });
      if (!res.ok) return [] as ConversationSummary[];
      return res.json() as Promise<ConversationSummary[]>;
    },
    refetchInterval: 8000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/messages/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load conversation");
      return res.json() as Promise<Conversation>;
    },
    refetchInterval: 4000,
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      listingId: string;
      listingTitle: string;
      sellerId: string;
      sellerName: string;
      sellerAvatar: string | null;
      firstMessage: string;
    }) => {
      const res = await fetch(`${apiBase}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to send message");
      }
      return res.json() as Promise<{ conversationId: string; exists: boolean }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`${apiBase}/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to send message");
      }
      return res.json() as Promise<Message>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
