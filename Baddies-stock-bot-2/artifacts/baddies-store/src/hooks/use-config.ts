import { useQuery } from "@tanstack/react-query";

const apiBase = import.meta.env.VITE_API_URL ?? "";

interface AppConfig {
  discordInviteUrl: string | null;
  oauthEnabled: boolean;
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/config`);
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json() as Promise<AppConfig>;
    },
    staleTime: Infinity,
  });
}
