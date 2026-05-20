import { Router } from "express";
import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { getBotClient } from "../bot";

const router = Router();

const TICKET_PARENT_ID = "1506471588462199014";
const DISCORD_INVITE_URL = process.env["DISCORD_INVITE_URL"] ?? "https://discord.gg/eB6ksCQPWP";

type TicketItem = {
  name: string;
  price?: string;
  quantity?: number;
  sellerName: string;
  sellerId?: string;
};

router.get("/guild/member-check", async (req, res) => {
  const sessionUser = req.session?.discordUser ?? null;
  if (!sessionUser) {
    res.json({ inGuild: false, inviteUrl: DISCORD_INVITE_URL });
    return;
  }
  const bot = getBotClient();
  const guild = bot?.guilds.cache.first() ?? null;
  if (!guild) {
    res.json({ inGuild: false, inviteUrl: DISCORD_INVITE_URL });
    return;
  }
  const member = await guild.members.fetch({ user: sessionUser.id, force: true }).catch(() => null);
  res.json({ inGuild: !!member, inviteUrl: DISCORD_INVITE_URL });
});

router.post("/tickets", async (req, res) => {
  const sessionUser = req.session?.discordUser ?? null;
  if (!sessionUser) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  const { items } = req.body as { items: TicketItem[] };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "No items provided" });
    return;
  }

  const bot = getBotClient();
  if (!bot) {
    res.status(503).json({ ok: false, inviteUrl: DISCORD_INVITE_URL, reason: "Bot offline." });
    return;
  }

  const guild = bot.guilds.cache.first();
  if (!guild) {
    res.status(503).json({ ok: false, inviteUrl: DISCORD_INVITE_URL, reason: "Bot not in any guild." });
    return;
  }

  const buyer = await guild.members.fetch({ user: sessionUser.id, force: true }).catch(() => null);
  if (!buyer) {
    res.status(403).json({ error: "notInGuild", inviteUrl: DISCORD_INVITE_URL });
    return;
  }

  const buyerTag = sessionUser.username;
  const channelName = `ticket-${buyerTag.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;

  const sellerName = items[0].sellerName;
  const sellerId = items[0].sellerId ?? null;

  const itemLines = items
    .map((i) => `• **${i.name}**${i.quantity && i.quantity > 1 ? ` × ${i.quantity}` : ""}${i.price ? ` — $${i.price}` : ""}`)
    .join("\n");

  try {
    const permissionOverwrites: any[] = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: sessionUser.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
    ];

    if (sellerId) {
      const sellerMember = await guild.members.fetch(sellerId).catch(() => null);
      if (sellerMember) {
        permissionOverwrites.push({
          id: sellerId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TICKET_PARENT_ID,
      permissionOverwrites,
      reason: `Web buy — ${buyerTag}`,
    });

    const buyerMention = `<@${sessionUser.id}>`;
    const sellerMention = sellerId ? `<@${sellerId}>` : `**${sellerName}**`;

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`tc_cancel:${sellerId ?? "0"}:${sessionUser.id}`)
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Danger);

    const embed = new EmbedBuilder()
      .setTitle("🛒 Purchase Request")
      .setDescription(`${buyerMention} wants to buy from ${sellerMention}:\n\n${itemLines}`)
      .setColor(0xff0080)
      .setTimestamp()
      .setFooter({ text: "Baddies Store — Web Purchase" });

    await ticketChannel.send({
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(cancelBtn)],
    });

    res.json({ ok: true, inviteUrl: DISCORD_INVITE_URL, channelId: ticketChannel.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tickets] Failed to create ticket channel:", msg);
    res.status(500).json({ ok: false, inviteUrl: DISCORD_INVITE_URL, reason: msg });
  }
});

export default router;
