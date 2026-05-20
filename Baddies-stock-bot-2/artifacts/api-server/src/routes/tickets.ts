import { Router } from "express";
import { ChannelType, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
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

router.post("/tickets", async (req, res) => {
  const { items } = req.body as { items: TicketItem[] };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "No items provided" });
    return;
  }

  const buyer = req.session?.discordUser ?? null;
  const bot = getBotClient();

  if (!bot) {
    res.json({ ok: false, inviteUrl: DISCORD_INVITE_URL, reason: "Bot offline — join Discord and open a ticket manually." });
    return;
  }

  const guild = bot.guilds.cache.first();
  if (!guild) {
    res.json({ ok: false, inviteUrl: DISCORD_INVITE_URL, reason: "Bot not in any guild." });
    return;
  }

  const buyerTag = buyer ? `${buyer.username}` : "Guest";
  const channelName = `ticket-${buyerTag.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;

  const sellerName = items[0].sellerName;
  const sellerId = items[0].sellerId ?? null;

  const itemLines = items
    .map((i) => `• **${i.name}**${i.quantity && i.quantity > 1 ? ` × ${i.quantity}` : ""}${i.price ? ` — $${i.price}` : ""}`)
    .join("\n");

  try {
    const permissionOverwrites: any[] = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ];

    if (buyer) {
      try {
        const member = await guild.members.fetch(buyer.id).catch(() => null);
        if (member) {
          permissionOverwrites.push({
            id: buyer.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          });
        }
      } catch {}
    }

    if (sellerId) {
      try {
        const sellerMember = await guild.members.fetch(sellerId).catch(() => null);
        if (sellerMember) {
          permissionOverwrites.push({
            id: sellerId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          });
        }
      } catch {}
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TICKET_PARENT_ID,
      permissionOverwrites,
      reason: `Web buy — ${buyerTag}`,
    });

    const buyerMention = buyer ? `<@${buyer.id}>` : `**${buyerTag}**`;
    const sellerMention = sellerId ? `<@${sellerId}>` : `**${sellerName}**`;

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`tc_cancel:${sellerId ?? "0"}:${buyer?.id ?? "0"}`)
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
    res.json({ ok: false, inviteUrl: DISCORD_INVITE_URL, reason: msg });
  }
});

export default router;
