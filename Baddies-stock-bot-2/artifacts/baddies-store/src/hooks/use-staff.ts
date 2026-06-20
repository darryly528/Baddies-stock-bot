import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const apiBase = import.meta.env.VITE_API_URL ?? "";

export type StaffRole = "co-owner" | "admin" | "mod" | "verified_reseller";
export type AnyRole = "owner" | StaffRole;

export interface StaffEntry {
  userId: string;
  role: StaffRole;
  username: string;
  addedAt: string;
  addedBy: string;
}

export interface BanRequest {
  id: string;
  requestedBy: string;
  requestedByUsername: string;
  targetUserId: string;
  targetUsername: string;
  reason: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface Warning {
  id: string;
  reason: string;
  issuedBy: string;
  issuedByUsername: string;
  issuedAt: string;
}

export const ROLE_LABEL: Record<AnyRole, string> = {
  "owner":             "Owner",
  "co-owner":          "Co-Owner",
  "admin":             "Admin",
  "mod":               "Mod",
  "verified_reseller": "Verified Reseller",
};

export const ROLE_COLOR: Record<AnyRole, string> = {
  "owner":             "bg-amber-500/15 border-amber-500/40 text-amber-300",
  "co-owner":          "bg-purple-500/15 border-purple-500/40 text-purple-300",
  "admin":             "bg-primary/15 border-primary/40 text-primary",
  "mod":               "bg-blue-500/15 border-blue-500/40 text-blue-400",
  "verified_reseller": "bg-green-500/15 border-green-500/40 text-green-400",
};

export const ROLE_RANK: Record<AnyRole, number> = {
  "owner": 4, "co-owner": 3, "admin": 2, "mod": 1, "verified_reseller": 0,
};

export function hasMinRole(userRole: AnyRole | null | undefined, minRole: AnyRole): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

// ── Staff CRUD ────────────────────────────────────────────────────────────────

export function useStaff() {
  return useQuery<StaffEntry[]>({
    queryKey: ["admin-staff"],
    queryFn: () => fetch(`${apiBase}/api/admin/staff`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });
}

export function useAddStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; username: string; role: StaffRole }) =>
      fetch(`${apiBase}/api/admin/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        return d;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-staff"] }),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: StaffRole }) =>
      fetch(`${apiBase}/api/admin/staff/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        return d;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-staff"] }),
  });
}

export function useRemoveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      fetch(`${apiBase}/api/admin/staff/${userId}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        return d;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-staff"] }),
  });
}

// ── Ban requests ──────────────────────────────────────────────────────────────

export function useBanRequests() {
  return useQuery<BanRequest[]>({
    queryKey: ["admin-ban-requests"],
    queryFn: () => fetch(`${apiBase}/api/admin/ban-requests`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useSubmitBanRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; targetUsername: string; reason: string }) =>
      fetch(`${apiBase}/api/admin/members/${data.userId}/ban-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUsername: data.targetUsername, reason: data.reason }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        return d;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ban-requests"] }),
  });
}

export function useApproveBanRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqId: string) =>
      fetch(`${apiBase}/api/admin/ban-requests/${reqId}/approve`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        return d;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ban-requests"] }),
  });
}

export function useRejectBanRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqId: string) =>
      fetch(`${apiBase}/api/admin/ban-requests/${reqId}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        return d;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ban-requests"] }),
  });
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export function useWarnUser() {
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      fetch(`${apiBase}/api/admin/members/${userId}/warn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        return d;
      }),
  });
}
