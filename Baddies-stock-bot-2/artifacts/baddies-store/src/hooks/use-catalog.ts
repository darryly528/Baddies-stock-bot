import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

const apiBase = import.meta.env.VITE_API_URL ?? "";

export interface CatalogItem {
  itemId: number;
  name: string;
  rarity: string;
  imageUrl: string | null;
  value: number | null;
  rap: number | null;
  category: string | null;
  tradeable: boolean;
  itemType: string;
  acronym: string | null;
  demand: string | null;
  trend: string | null;
}

export interface CatalogItemsResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CatalogCategoriesResponse {
  itemTypes: string[];
  categories: string[];
}

export interface CatalogFilters {
  search: string;
  itemType: string;
  category: string;
}

export function useInfiniteCatalogItems(filters: CatalogFilters) {
  return useInfiniteQuery({
    queryKey: ["catalog", "items", filters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.append("page", pageParam.toString());
      params.append("limit", "40");
      
      if (filters.search) params.append("search", filters.search);
      if (filters.itemType && filters.itemType !== "All") params.append("itemType", filters.itemType);
      if (filters.category && filters.category !== "All") params.append("category", filters.category);

      const url = `${apiBase}/api/catalog/items?${params.toString()}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error("Failed to fetch catalog items");
      }
      
      return res.json() as Promise<CatalogItemsResponse>;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/catalog/categories`);
      if (!res.ok) {
        throw new Error("Failed to fetch categories");
      }
      return res.json() as Promise<CatalogCategoriesResponse>;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
