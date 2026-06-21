import { Capacitor } from "@capacitor/core";

const NATIVE_API_URL = import.meta.env["VITE_API_URL"] as string | undefined;

export function apiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (!NATIVE_API_URL) {
      console.warn("[api] VITE_API_URL is not set — native API calls will fail. Set it to your deployed backend URL.");
    }
    return NATIVE_API_URL ?? "";
  }
  return "";
}

export function apiUrl(path: string): string {
  const base = apiBase();
  if (!path.startsWith("/")) path = "/" + path;
  return `${base}${path}`;
}
