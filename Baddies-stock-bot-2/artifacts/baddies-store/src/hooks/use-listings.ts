import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const apiBase = import.meta.env.VITE_API_URL ?? "";

export interface ListingItem {
  name: string;
  itemType: string;
  imageUrl: string | null;
  quantity: number | string;
  price?: string;
  soldOut: boolean;
}

export interface Bid {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  amount: number;
  placedAt: string;
}

export interface Listing {
  id: string;
  seller: string;
  discordUserId: string | null;
  discordAvatar: string | null;
  paymentMethods: string[];
  items: ListingItem[];
  customMessage?: string;
  createdAt: string;
  listingType?: "fixed" | "auction";
  auctionEndsAt?: string;
  startingBid?: number;
  bids?: Bid[];
  isVerifiedReseller?: boolean;
}

export function useListings(refetchInterval?: number) {
  return useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/listings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json() as Promise<Listing[]>;
    },
    refetchInterval: refetchInterval ?? 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      seller: string;
      items: { name: string; itemType: string; imageUrl: string | null; quantity: number | string; price?: string }[];
      paymentMethods: string[];
      customMessage?: string;
      listingType?: "fixed" | "auction";
      auctionDays?: number;
      startingBid?: number;
    }) => {
      const res = await fetch(`${apiBase}/api/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create listing");
      return res.json() as Promise<Listing>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });
}

export function useMarkSold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      listingId,
      itemName,
      soldQty,
    }: {
      listingId: string;
      itemName: string;
      soldQty?: number;
    }) => {
      const res = await fetch(
        `${apiBase}/api/listings/${listingId}/items/${encodeURIComponent(itemName)}/sold`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ soldQty }),
        }
      );
      if (!res.ok) throw new Error("Failed to mark as sold");
      return res.json() as Promise<Listing>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string) => {
      const res = await fetch(`${apiBase}/api/listings/${listingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete listing");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });
}

export function usePlaceBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ listingId, amount }: { listingId: string; amount: number }) => {
      const res = await fetch(`${apiBase}/api/listings/${listingId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to place bid");
      return data as Bid;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });
}

export function useRetractBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ listingId, bidId }: { listingId: string; bidId: string }) => {
      const res = await fetch(`${apiBase}/api/listings/${listingId}/bids/${bidId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to retract bid");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });
}

export function usePostListingToDiscord() {
  return useMutation({
    mutationFn: async ({ listingId, guildId }: { listingId: string; guildId: string }) => {
      const res = await fetch(`${apiBase}/api/auth/post-listing/${listingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ guildId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to post to Discord");
      }
      return res.json() as Promise<{ ok: boolean; channel: string }>;
    },
  });
}
