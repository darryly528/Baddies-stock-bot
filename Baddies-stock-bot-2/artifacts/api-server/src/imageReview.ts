import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const PENDING_PATH = process.env["PENDING_IMAGES_PATH"] ?? path.resolve(process.cwd(), "../../pending-images.json");
const MESSAGES_PATH = process.env["MESSAGES_PATH"] ?? path.resolve(process.cwd(), "../../messages.json");
const PROFILES_PATH = process.env["PROFILES_PATH"] ?? path.resolve(process.cwd(), "../../profiles.json");

export type PendingImageType = "dm" | "avatar" | "banner";

export interface PendingImage {
  id: string;
  type: PendingImageType;
  filePath: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  conversationId?: string;
  messageId?: string;
  profileField?: "customAvatarUrl" | "bannerImageUrl";
  aiFlag?: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
}

function loadPending(): PendingImage[] {
  try { return JSON.parse(fs.readFileSync(PENDING_PATH, "utf8")); } catch { return []; }
}
function savePending(p: PendingImage[]): void {
  fs.writeFileSync(PENDING_PATH, JSON.stringify(p, null, 2), "utf8");
}

export function createPendingImage(data: Omit<PendingImage, "id" | "createdAt" | "status">): PendingImage {
  const pending = loadPending();
  const entry: PendingImage = { ...data, id: randomUUID(), createdAt: new Date().toISOString(), status: "pending" };
  pending.push(entry);
  savePending(pending);
  return entry;
}

export function linkPendingToMessage(pendingId: string, conversationId: string, messageId: string): void {
  const pending = loadPending();
  const idx = pending.findIndex((p) => p.id === pendingId);
  if (idx !== -1) {
    pending[idx]!.conversationId = conversationId;
    pending[idx]!.messageId = messageId;
    savePending(pending);
  }
}

export function approveImage(id: string): { ok: boolean; entry?: PendingImage } {
  const pending = loadPending();
  const idx = pending.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false };
  const entry = pending[idx]!;
  entry.status = "approved";
  savePending(pending);

  if (entry.type === "dm" && entry.conversationId && entry.messageId) {
    try {
      const convs = JSON.parse(fs.readFileSync(MESSAGES_PATH, "utf8")) as Array<{
        id: string;
        messages: Array<{ id: string; imagePending?: boolean }>;
      }>;
      const cidx = convs.findIndex((c) => c.id === entry.conversationId);
      if (cidx !== -1) {
        const midx = convs[cidx]!.messages.findIndex((m) => m.id === entry.messageId);
        if (midx !== -1) {
          convs[cidx]!.messages[midx]!.imagePending = false;
          fs.writeFileSync(MESSAGES_PATH, JSON.stringify(convs, null, 2), "utf8");
        }
      }
    } catch {}
  }

  if ((entry.type === "avatar" || entry.type === "banner") && entry.profileField) {
    try {
      const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8")) as Record<string, Record<string, unknown>>;
      profiles[entry.uploadedBy] = { ...(profiles[entry.uploadedBy] ?? {}), [entry.profileField]: entry.url };
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), "utf8");
    } catch {}
  }

  return { ok: true, entry };
}

export function rejectImage(id: string): { ok: boolean; entry?: PendingImage } {
  const pending = loadPending();
  const idx = pending.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false };
  const entry = pending[idx]!;
  entry.status = "rejected";
  savePending(pending);

  try { if (fs.existsSync(entry.filePath)) fs.unlinkSync(entry.filePath); } catch {}

  if (entry.type === "dm" && entry.conversationId && entry.messageId) {
    try {
      const convs = JSON.parse(fs.readFileSync(MESSAGES_PATH, "utf8")) as Array<{
        id: string;
        messages: Array<{ id: string; imageUrl?: string; imagePending?: boolean; filtered?: boolean; content?: string }>;
      }>;
      const cidx = convs.findIndex((c) => c.id === entry.conversationId);
      if (cidx !== -1) {
        const midx = convs[cidx]!.messages.findIndex((m) => m.id === entry.messageId);
        if (midx !== -1) {
          const msg = convs[cidx]!.messages[midx]!;
          delete msg.imageUrl;
          delete msg.imagePending;
          msg.filtered = true;
          msg.content = "###";
          fs.writeFileSync(MESSAGES_PATH, JSON.stringify(convs, null, 2), "utf8");
        }
      }
    } catch {}
  }

  return { ok: true, entry };
}
