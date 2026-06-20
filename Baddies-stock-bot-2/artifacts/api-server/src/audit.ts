import { EmbedBuilder } from "discord.js";
import { getBotClient } from "./bot";

const LOG_CHANNEL_ID = "1517999979224895549";

export type AuditAction =
  | "BAN"           | "UNBAN"
  | "KICK"
  | "TIMEOUT"       | "TIMEOUT_REMOVE"
  | "SUSPEND"       | "UNSUSPEND"
  | "WARN"          | "WARN_REMOVE"
  | "BAN_REQUEST"   | "BAN_REQUEST_APPROVE" | "BAN_REQUEST_REJECT"
  | "STAFF_ADD"     | "STAFF_REMOVE"        | "STAFF_ROLE_CHANGE"
  | "LISTING_DELETE"| "LISTINGS_CLEAR"      | "LISTINGS_PURGE_SOLDOUT";

const ACTION_META: Record<AuditAction, { emoji: string; label: string; color: number }> = {
  BAN:                   { emoji: "🔨", label: "Member Banned",            color: 0xef4444 },
  UNBAN:                 { emoji: "✅", label: "Member Unbanned",          color: 0x22c55e },
  KICK:                  { emoji: "👢", label: "Member Kicked",            color: 0xf97316 },
  TIMEOUT:               { emoji: "⏱️", label: "Member Timed Out",         color: 0xeab308 },
  TIMEOUT_REMOVE:        { emoji: "⏰", label: "Timeout Removed",          color: 0x22c55e },
  SUSPEND:               { emoji: "🚫", label: "Site Suspended",           color: 0xef4444 },
  UNSUSPEND:             { emoji: "✅", label: "Site Suspension Lifted",   color: 0x22c55e },
  WARN:                  { emoji: "⚠️", label: "Warning Issued",           color: 0xeab308 },
  WARN_REMOVE:           { emoji: "🗑️", label: "Warning Removed",          color: 0x94a3b8 },
  BAN_REQUEST:           { emoji: "📋", label: "Ban Requested",            color: 0xf97316 },
  BAN_REQUEST_APPROVE:   { emoji: "✅", label: "Ban Request Approved",     color: 0xef4444 },
  BAN_REQUEST_REJECT:    { emoji: "❌", label: "Ban Request Rejected",     color: 0x94a3b8 },
  STAFF_ADD:             { emoji: "👤", label: "Staff Member Added",       color: 0xa855f7 },
  STAFF_REMOVE:          { emoji: "🗑️", label: "Staff Member Removed",     color: 0x94a3b8 },
  STAFF_ROLE_CHANGE:     { emoji: "🔄", label: "Staff Role Changed",       color: 0xa855f7 },
  LISTING_DELETE:        { emoji: "🗑️", label: "Listing Deleted",          color: 0x94a3b8 },
  LISTINGS_CLEAR:        { emoji: "💥", label: "All Listings Cleared",     color: 0xef4444 },
  LISTINGS_PURGE_SOLDOUT:{ emoji: "🧹", label: "Sold-Out Listings Purged", color: 0x94a3b8 },
};

export interface AuditEntry {
  action: AuditAction;
  /** Who performed the action */
  actorId: string;
  actorUsername: string;
  /** Who was acted on (optional) */
  targetId?: string;
  targetUsername?: string;
  /** Extra details */
  details?: string;
}

export async function sendAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const bot = getBotClient();
    if (!bot) return;

    const channel = await bot.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const meta = ACTION_META[entry.action];

    const embed = new EmbedBuilder()
      .setColor(meta.color)
      .setTitle(`${meta.emoji} ${meta.label}`)
      .addFields(
        { name: "Staff", value: `<@${entry.actorId}> (${entry.actorUsername})`, inline: true },
        ...(entry.targetId
          ? [{ name: "Target", value: `<@${entry.targetId}>${entry.targetUsername ? ` (${entry.targetUsername})` : ""}`, inline: true }]
          : []),
        ...(entry.details
          ? [{ name: "Details", value: entry.details.slice(0, 1024), inline: false }]
          : []),
      )
      .setTimestamp();

    await (channel as import("discord.js").TextChannel).send({ embeds: [embed] });
  } catch {
    // Never crash the API over a logging failure
  }
}
