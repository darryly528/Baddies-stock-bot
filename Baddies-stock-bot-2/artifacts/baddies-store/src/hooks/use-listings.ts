import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const apiBase = import.meta.env.VITE_API_URL ?? "";

export interface ListingItem {
  name: string;
  itemType: string;
  imageUrl: string | null;
  quantity: number | string;
  soldOut: boolean;
}

export interface Listing {
  id: string;
  seller: string;
  items: ListingItem[];
  createdAt: string;
}

export function useListings() {
  return useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/listings`);
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json() as Promise<Listing[]>;
    },
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      seller: string;
      items: { name: string; itemType: string; imageUrl: string | null; quantity: number | string }[];
    }) => {
      const res = await fetch(`${apiBase}/api/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      });
      if (!res.ok) throw new Error("Failed to delete listing");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });
}
