import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const OWNER_USERNAME = "disgust_tf";

export type StaffRole = "co-owner" | "admin" | "mod" | "verified_reseller";
export type AnyRole = "owner" | StaffRole;

const PERMS_PATH = process.env["PERMS_PATH"] ?? path.resolve(process.cwd(), "../../permissions.json");
const BAN_REQUESTS_PATH = process.env["BAN_REQUESTS_PATH"] ?? path.resolve(process.cwd(), "../../ban-requests.json");
const WARNINGS_PATH = process.env["WARNINGS_PATH"] ?? path.resolve(process.cwd(), "../../warnings.json");

export type StaffEntry = {
  role: StaffRole;
  username: string;
  addedAt: string;
  addedBy: string;
};

export type BanRequest = {
  id: string;
  requestedBy: string;
  requestedByUsername: string;
  targetUserId: string;
  targetUsername: string;
  reason: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
};

export type Warning = {
  id: string;
  reason: string;
  issuedBy: string;
  issuedByUsername: string;
  issuedAt: string;
};

// ── Role hierarchy ────────────────────────────────────────────────────────────
export const ROLE_RANK: Record<AnyRole, number> = {
  "owner":             4,
  "co-owner":          3,
  "admin":             2,
  "mod":               1,
  "verified_reseller": 0,
};

export const ROLE_LABEL: Record<AnyRole, string> = {
  "owner":             "Owner",
  "co-owner":          "Co-Owner",
  "admin":             "Admin",
  "mod":               "Mod",
  "verified_reseller": "Verified Reseller",
};

export function hasMinRole(userRole: AnyRole | null, minRole: AnyRole): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

// ── Staff store ───────────────────────────────────────────────────────────────
let _staff: Record<string, StaffEntry> = {};

function _loadStaff(): void {
  try { _staff = JSON.parse(fs.readFileSync(PERMS_PATH, "utf8")); } catch { _staff = {}; }
}

function _saveStaff(): void {
  fs.writeFileSync(PERMS_PATH, JSON.stringify(_staff, null, 2), "utf8");
}

_loadStaff();
try { fs.watch(PERMS_PATH, () => { try { _loadStaff(); } catch {} }); } catch {}

export function getStaff(): Array<StaffEntry & { userId: string }> {
  return Object.entries(_staff).map(([id, e]) => ({ ...e, userId: id }));
}

export function getRole(userId: string, username?: string): AnyRole | null {
  if (username === OWNER_USERNAME) return "owner";
  return (_staff[userId]?.role as AnyRole) ?? null;
}

export function setStaffMember(userId: string, role: StaffRole, addedBy: string, username: string): void {
  _staff[userId] = { role, username, addedAt: new Date().toISOString(), addedBy };
  _saveStaff();
}

export function removeStaffMember(userId: string): void {
  delete _staff[userId];
  _saveStaff();
}

// ── Ban requests ──────────────────────────────────────────────────────────────
function _loadBanRequests(): BanRequest[] {
  try { return JSON.parse(fs.readFileSync(BAN_REQUESTS_PATH, "utf8")); } catch { return []; }
}
function _saveBanRequests(reqs: BanRequest[]): void {
  fs.writeFileSync(BAN_REQUESTS_PATH, JSON.stringify(reqs, null, 2), "utf8");
}

export function getBanRequests(): BanRequest[] { return _loadBanRequests(); }

export function addBanRequest(data: Omit<BanRequest, "id" | "createdAt" | "status">): BanRequest {
  const reqs = _loadBanRequests();
  const req: BanRequest = { ...data, id: randomUUID(), createdAt: new Date().toISOString(), status: "pending" };
  reqs.push(req);
  _saveBanRequests(reqs);
  return req;
}

export function updateBanRequestStatus(id: string, status: "approved" | "rejected"): BanRequest | null {
  const reqs = _loadBanRequests();
  const req = reqs.find((r) => r.id === id);
  if (!req) return null;
  req.status = status;
  _saveBanRequests(reqs);
  return req;
}

// ── Warnings ──────────────────────────────────────────────────────────────────
function _loadWarnings(): Record<string, Warning[]> {
  try { return JSON.parse(fs.readFileSync(WARNINGS_PATH, "utf8")); } catch { return {}; }
}
function _saveWarnings(w: Record<string, Warning[]>): void {
  fs.writeFileSync(WARNINGS_PATH, JSON.stringify(w, null, 2), "utf8");
}

export function getWarnings(userId: string): Warning[] {
  return _loadWarnings()[userId] ?? [];
}

export function addWarning(userId: string, data: Omit<Warning, "id" | "issuedAt">): Warning {
  const all = _loadWarnings();
  const w: Warning = { ...data, id: randomUUID(), issuedAt: new Date().toISOString() };
  if (!all[userId]) all[userId] = [];
  all[userId].push(w);
  _saveWarnings(all);
  return w;
}

export function removeWarning(userId: string, warningId: string): boolean {
  const all = _loadWarnings();
  if (!all[userId]) return false;
  const before = all[userId].length;
  all[userId] = all[userId].filter((w) => w.id !== warningId);
  _saveWarnings(all);
  return all[userId].length < before;
}
