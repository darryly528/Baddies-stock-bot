import fs from "fs";
import path from "path";

import { WEAPONS, FIGHTING_STYLES, type Item } from "./itemEmojis";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Events,
  Colors,
  type Interaction,
  type StringSelectMenuInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";

function loadDotenv(dotenvPath = ".env") {
  try {
    const file = fs.readFileSync(path.resolve(process.cwd(), dotenvPath), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore missing .env
  }
}

loadDotenv();

const TICKET_CATEGORY_ID = process.env["TICKET_CATEGORY_ID"] ?? "1477024231735951533";
const TICKET_MOD_ROLE_ID = process.env["TICKET_MOD_ROLE_ID"] ?? "";
const MOD_ROLE_ID = process.env["MOD_ROLE_ID"] ?? "1441178708311281845";
const LISTING_ROLE_PING = process.env["LISTING_ROLE_ID"] ?? "1441178708676448267";

if (!TICKET_MOD_ROLE_ID) {
  console.warn(
    "Warning: TICKET_MOD_ROLE_ID is not set. Tickets will still be created but moderators may not have access.",
  );
}

// ── Guild settings (persisted to disk) ────────────────────────────────────────
type GuildSettings = { ticketCategoryId?: string; listingChannelId?: string };
const SETTINGS_PATH = path.resolve(process.cwd(), "guild-settings.json");

function loadAllSettings(): Record<string, GuildSettings> {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Record<string, GuildSettings>;
  } catch {
    return {};
  }
}

function saveAllSettings(data: Record<string, GuildSettings>) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

function getGuildSettings(guildId: string): GuildSettings {
  return loadAllSettings()[guildId] ?? {};
}

function setGuildSetting(guildId: string, key: keyof GuildSettings, value: string) {
  const all = loadAllSettings();
  all[guildId] = { ...(all[guildId] ?? {}), [key]: value };
  saveAllSettings(all);
}

// ── Payment methods ───────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { label: "Venmo",    value: "venmo",    emoji: { id: "1481817470431006883", name: "munchkin_dgaf" } },
  { label: "PayPal",   value: "paypal",   emoji: { id: "1481817468912799814", name: "munchkin_dgaf" } },
  { label: "ApplePay", value: "applepay", emoji: { id: "1481817467813888212", name: "munchkin_dgaf" } },
  { label: "CashApp",  value: "cashapp",  emoji: { id: "1481817227975069718", name: "Screenshot_20260312_at_5" } },
] as const;

const PAGE_SIZE = 24;

const EMOJI_WEAPON = "⚔️" as const;
const EMOJI_STYLE = "🥋" as const;

// ── Session state ─────────────────────────────────────────────────────────────
type CartItem = { type: "w" | "s"; name: string; emoji: string };
type Cart = { cats: string[]; wPage: number; items: CartItem[]; createdAt: number };
const carts = new Map<string, Cart>();

type PendingListing = { lines: string[]; color: number; userId: string; username: string; avatarURL: string; cartKey: string; createdAt: number };
const pendingListings = new Map<string, PendingListing>();

type PendingTicket = { sellerId: string; sellerName: string; origChannelId: string; origMsgId: string; selectedItems: string[]; quantities: number[]; createdAt: number; acceptedPayments?: string };
const pendingTickets = new Map<string, PendingTicket>();

// Maps "channelId:msgId" → accepted payment line (e.g. "💳 **Accepts:** …")
const listingPayments = new Map<string, string>();

// Clean up stale sessions every 5 minutes (entries older than 30 min)
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of carts) if (v.createdAt < cutoff) carts.delete(k);
  for (const [k, v] of pendingTickets) if (v.createdAt < cutoff) pendingTickets.delete(k);
  for (const [k, v] of pendingListings) if (v.createdAt < cutoff) pendingListings.delete(k);
}, 5 * 60 * 1000);

function cartKey(userId: string, channelId: string) {
  return `${userId}:${channelId}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildItemRows(
  cart: Cart,
): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
  const hasWeapons = cart.cats.includes("weapons");
  const hasStyles = cart.cats.includes("styles");

  if (hasWeapons) {
    const totalWPages = Math.ceil(WEAPONS.length / PAGE_SIZE);
    const wStart = cart.wPage * PAGE_SIZE;
    const wItems = WEAPONS.slice(wStart, wStart + PAGE_SIZE);

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`li:w:${cart.wPage}`)
          .setPlaceholder(`${EMOJI_WEAPON} Add weapons… (page ${cart.wPage + 1}/${totalWPages})`)
          .setMinValues(1)
          .setMaxValues(Math.min(25, wItems.length))
          .addOptions(
            wItems.map((item, i) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(item.name)
                .setValue(`w:${wStart + i}`)
                .setEmoji(item.emoji),
            ),
          ),
      ),
    );

    if (totalWPages > 1) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`lp:w:${cart.wPage - 1}`)
            .setLabel("◀ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(cart.wPage === 0),
          new ButtonBuilder()
            .setCustomId(`lp:w:${cart.wPage + 1}`)
            .setLabel("Next ▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(cart.wPage === totalWPages - 1),
        ),
      );
    }
  }

  if (hasStyles) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("li:s:0")
          .setPlaceholder(`${EMOJI_STYLE} Add fighting styles…`)
          .setMinValues(1)
          .setMaxValues(Math.min(25, FIGHTING_STYLES.length))
          .addOptions(
            FIGHTING_STYLES.map((item, i) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(item.name)
                .setValue(`s:${i}`)
                .setEmoji(item.emoji),
            ),
          ),
      ),
    );
  }

  const cartCount = cart.items.length;
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("list_done")
        .setLabel(
          cartCount > 0
            ? `✅ Enter Quantities (${cartCount} item${cartCount !== 1 ? "s" : ""} selected)`
            : "✅ Select items above first",
        )
        .setStyle(cartCount > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(cartCount === 0),
    ),
  );

  return rows;
}

function buildCartEmbed(cart: Cart, username: string): EmbedBuilder {
  const hasWeapons = cart.cats.includes("weapons");
  const hasStyles = cart.cats.includes("styles");

  const title =
    hasWeapons && hasStyles
      ? `${EMOJI_WEAPON} Weapons & ${EMOJI_STYLE} Fighting Styles`
      : hasWeapons
        ? `${EMOJI_WEAPON} Weapons`
        : `${EMOJI_STYLE} Fighting Styles`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(hasWeapons && hasStyles ? Colors.Gold : hasWeapons ? Colors.Red : Colors.Purple)
    .setTimestamp();

  if (cart.items.length === 0) {
    embed.setDescription("Select items from the menus below to add them to your list.");
  } else {
    const lines = cart.items
      .map((it) => `${it.type === "w" ? EMOJI_WEAPON : EMOJI_STYLE} ${it.emoji} **${it.name}**`)
      .join("\n");
    embed.setDescription(`**Selected (${cart.items.length}):**\n${lines}\n\nSelect more or click **✅ Enter Quantities** when done.`);
  }

  return embed;
}

// ── Bot client export ─────────────────────────────────────────────────────────
let _botClient: Client | null = null;
export function getBotClient(): Client | null { return _botClient; }

// ── Bot ───────────────────────────────────────────────────────────────────────
export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];

  const parts = token?.split(".") ?? [];
  console.log(
    "DISCORD_BOT_TOKEN loaded:",
    token
      ? `${token.length} chars, parts=${parts.length} [${parts.map((p) => p.length).join(",")}]`
      : "<none>",
  );

  if (!token) {
    console.error("DISCORD_BOT_TOKEN is not set — bot will not start.");
    return;
  }

  if (parts.length !== 3) {
    console.error(
      "DISCORD_BOT_TOKEN does not look like a valid Discord token (expected 3 dot-separated parts). Reset the token in the Developer Portal and paste it into .env.",
    );
    return;
  }

  const tokenFormat = /^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/;
  if (!tokenFormat.test(token)) {
    console.error(
      "DISCORD_BOT_TOKEN appears to contain invalid characters. Make sure you copied the token exactly and didn't include quotes or spaces.",
    );
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    _botClient = client;
    console.log(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
    const commands = [
      new SlashCommandBuilder()
        .setName("list")
        .setDescription("List your stock of Weapons and/or Fighting Styles"),
      new SlashCommandBuilder()
        .setName("sold")
        .setDescription("Pick one of your recent listings to mark as sold"),
      new SlashCommandBuilder()
        .setName("close")
        .setDescription("Close and delete this ticket channel"),
      new SlashCommandBuilder()
        .setName("setchannel")
        .setDescription("Configure bot channels for this server (Admins only)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
          sub
            .setName("ticket")
            .setDescription("Set the category where ticket channels are created")
            .addChannelOption((opt) =>
              opt.setName("channel").setDescription("The category channel for tickets").setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("listing")
            .setDescription("Set the channel where stock listings are posted publicly")
            .addChannelOption((opt) =>
              opt.setName("channel").setDescription("The text channel for listings").setRequired(true),
            ),
        ),
    ].map((c) => c.toJSON());

    const rest = new REST().setToken(token);
    try {
      await rest.put(Routes.applicationCommands(readyClient.user.id), { body: commands });
      console.log("Slash commands registered.");
    } catch (err) {
      console.error("Failed to register commands:", err);
    }
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
   try {
    if (!interaction.guild) {
      if ("reply" in interaction) {
        await (interaction as { reply: Function }).reply({ content: "This bot can only be used inside the server.", ephemeral: true });
      }
      return;
    }

    // ── /list ─────────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === "list") {
      const embed = new EmbedBuilder()
        .setTitle("📦 Stock Listing")
        .setDescription("Choose one or both categories. You can mix weapons and fighting styles.")
        .setColor(Colors.Blurple)
        .setTimestamp();

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("list_category")
          .setPlaceholder("⚙️ Choose category (or both)…")
          .setMinValues(1)
          .setMaxValues(2)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("Weapons").setDescription("Glitter Bomb, Ice Katana, Scythe and more")
              .setValue("weapons").setEmoji(EMOJI_WEAPON),
            new StringSelectMenuOptionBuilder()
              .setLabel("Fighting Styles").setDescription("Heartbreaker, Angel Style and more")
              .setValue("styles").setEmoji(EMOJI_STYLE),
          ),
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      return;
    }

    // ── /sold — scan recent messages ──────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === "sold") {
      const user = interaction.user;
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "Use this in a text channel.", ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const fetched = await channel.messages.fetch({ limit: 50 });

      const options: StringSelectMenuOptionBuilder[] = [];

      for (const msg of fetched.values()) {
        if (msg.author.id !== client.user!.id) continue;
        const embed = msg.embeds[0];
        if (!embed || embed.title !== "📦 Stock Listed") continue;
        if (!embed.description?.includes(`@${user.username}`)) continue;

        if (embed.description) {
          const lines = embed.description.split("\n");
          lines.forEach((line, idx) => {
            const match = line.match(/^[⚔️🥋].+?\*\*(.+?)\*\*\s*—\s*(.+)$/u);
            if (!match) return;
            const [, name, stock] = match;
            if (stock!.startsWith("~~")) return;
            if (options.length < 25) {
              options.push(
                new StringSelectMenuOptionBuilder()
                  .setLabel(name!.slice(0, 100))
                  .setDescription(`Stock: ${stock}`)
                  .setValue(`${msg.id}:${idx}:${stock}`),
              );
            }
          });
        }

        if (embed.fields.length >= 2 && !embed.fields[0]!.value.startsWith("~~")) {
          const itemName = embed.fields[0]!.value;
          const stock = embed.fields[1]!.value;
          if (options.length < 25) {
            options.push(
              new StringSelectMenuOptionBuilder()
                .setLabel(itemName.slice(0, 100))
                .setDescription(`Stock: ${stock}`)
                .setValue(`${msg.id}:old:${stock}`),
            );
          }
        }
      }

      if (options.length === 0) {
        await interaction.editReply({
          content: "No active listings found for you in this channel. Use `/list` to add some first.",
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔴 Mark as Sold")
            .setDescription("Pick the item you sold — then choose how many.")
            .setColor(Colors.DarkRed)
            .setTimestamp(),
        ],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("sold_item_pick")
              .setPlaceholder("Choose an item…")
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(options),
          ),
        ],
      });
      return;
    }

    // ── /close — delete ticket channel ────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === "close") {
      const ch = interaction.channel;
      const guildSettings = interaction.guildId ? getGuildSettings(interaction.guildId) : {};
      const resolvedCategoryId = guildSettings.ticketCategoryId ?? TICKET_CATEGORY_ID;

      if (!ch || !("parentId" in ch) || (ch as { parentId: string | null }).parentId !== resolvedCategoryId) {
        await interaction.reply({ content: "This command can only be used inside a ticket channel.", ephemeral: true });
        return;
      }
      await interaction.reply({ content: "Closing ticket…" });
      await (ch as { delete(reason?: string): Promise<unknown> }).delete(`Closed via /close by ${interaction.user.tag}`);
      return;
    }

    // ── /setchannel ───────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === "setchannel") {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({ content: "This command can only be used inside a server.", ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const channel = interaction.options.getChannel("channel", true);

      if (sub === "ticket") {
        setGuildSetting(guildId, "ticketCategoryId", channel.id);
        await interaction.reply({
          content: `✅ Ticket category set to <#${channel.id}>. New tickets will be created inside that category.`,
          ephemeral: true,
        });
      } else if (sub === "listing") {
        setGuildSetting(guildId, "listingChannelId", channel.id);
        await interaction.reply({
          content: `✅ Listing channel set to <#${channel.id}>. Stock listings will now be posted there.`,
          ephemeral: true,
        });
      }
      return;
    }

    // ── sold_item_pick — show quantity dropdown + Sold Out button ─────────
    if (interaction.isStringSelectMenu() && interaction.customId === "sold_item_pick") {
      const sel = interaction as StringSelectMenuInteraction;
      const raw = sel.values[0]!;
      const firstColon = raw.indexOf(":");
      const rest = raw.slice(firstColon + 1);
      const secondColon = rest.indexOf(":");
      const msgId = raw.slice(0, firstColon);
      const lineRef = rest.slice(0, secondColon);
      const stockStr = rest.slice(secondColon + 1).trim();
      const stock = parseInt(stockStr);
      const hasNumericStock = !isNaN(stock) && stock > 0;

      const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

      if (hasNumericStock && stock > 1) {
        const qtyOptions: StringSelectMenuOptionBuilder[] = [];
        for (let sold = 1; sold < stock && qtyOptions.length < 25; sold++) {
          qtyOptions.push(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${sold} sold — ${stock - sold} remaining`)
              .setValue(String(sold)),
          );
        }
        components.push(
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`sold_qty:${msgId}:${lineRef}`)
              .setPlaceholder("How many sold?")
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(qtyOptions),
          ),
        );
      }

      const soldOutLabel = hasNumericStock ? `🔴 Sold Out (all ${stock} gone)` : "🔴 Sold Out";
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`sold_out:${msgId}:${lineRef}`)
            .setLabel(soldOutLabel)
            .setStyle(ButtonStyle.Danger),
        ),
      );

      const itemLabel =
        sel.component.options.find((o) => o.value === raw)?.label ?? "this item";

      await sel.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔴 How many sold?")
            .setDescription(
              `**${itemLabel}** — currently ${hasNumericStock ? `**${stock}** in stock` : `stock: ${stockStr}`}.\n\nChoose how many sold, or mark as fully sold out.`,
            )
            .setColor(Colors.DarkRed)
            .setTimestamp(),
        ],
        components,
      });
      return;
    }

    // ── sold_qty — reduce stock, keep listing active ───────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sold_qty:")) {
      const sel = interaction as StringSelectMenuInteraction;
      const parts = sel.customId.split(":");
      const msgId = parts[1]!;
      const lineRef = parts[2]!;
      const soldQty = parseInt(sel.values[0]!);
      const channel = sel.channel;
      if (!channel || !channel.isTextBased()) return;

      const original = await channel.messages.fetch(msgId);
      const origEmbed = original.embeds[0]!;

      if (lineRef === "old") {
        const currentStock = parseInt(origEmbed.fields[1]?.value ?? "0");
        const newStock = Math.max(0, currentStock - soldQty);
        const updatedEmbed = EmbedBuilder.from(origEmbed).spliceFields(1, 1, {
          name: "📦 Stock",
          value: String(newStock),
          inline: true,
        });
        await original.edit({ embeds: [updatedEmbed] });
      } else {
        const lineIdx = parseInt(lineRef);
        const lines = origEmbed.description!.split("\n");
        lines[lineIdx] = lines[lineIdx]!.replace(
          /(\*\*\s*—\s*)(\d+)(.*)/,
          (_, prefix, oldStock, suffix) => {
            const newStock = Math.max(0, parseInt(oldStock) - soldQty);
            return `${prefix}${newStock}${suffix}`;
          },
        );
        await original.edit({
          embeds: [EmbedBuilder.from(origEmbed).setDescription(lines.join("\n"))],
        });
      }

      await sel.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Stock Updated")
            .setDescription(`Marked **${soldQty}** as sold. The listing has been updated.\n\nRun \`/sold\` again to update more.`)
            .setColor(Colors.Green)
            .setTimestamp(),
        ],
        components: [],
      });
      return;
    }

    // ── sold_out — strike through item permanently ─────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith("sold_out:")) {
      const btn = interaction as ButtonInteraction;
      const parts = btn.customId.split(":");
      const msgId = parts[1]!;
      const lineRef = parts[2]!;
      const channel = btn.channel;
      if (!channel || !channel.isTextBased()) return;

      const original = await channel.messages.fetch(msgId);
      const origEmbed = original.embeds[0]!;
      let itemName = "item";

      if (lineRef === "old") {
        itemName = origEmbed.fields[0]?.value ?? "item";
        const soldEmbed = EmbedBuilder.from(origEmbed)
          .setTitle("🔴 Sold Out")
          .setColor(Colors.DarkRed)
          .spliceFields(0, 1, { name: origEmbed.fields[0]?.name ?? "Item", value: `~~${itemName}~~`, inline: true })
          .spliceFields(1, 1, { name: "📦 Stock", value: "~~0~~", inline: true });
        await original.edit({ embeds: [soldEmbed] });
      } else {
        const lineIdx = parseInt(lineRef);
        const lines = origEmbed.description!.split("\n");
        const match = lines[lineIdx]!.match(/^([⚔️🥋].+?)\*\*(.+?)\*\*\s*—\s*(.+)$/u);
        if (match) {
          const [, prefix, name, priceSuffix] = match;
          itemName = name!;
          lines[lineIdx] = `${prefix}~~**${name}**~~ — ~~0~~${priceSuffix && !priceSuffix.startsWith("~~") ? "" : ""}`;
        }
        const allLines = lines.filter((l) => l.match(/^[⚔️🥋]/u));
        const allSold = allLines.every((l) => l.includes("~~"));
        const updatedEmbed = EmbedBuilder.from(origEmbed)
          .setDescription(lines.join("\n"))
          .setColor(Colors.DarkRed);
        if (allSold) updatedEmbed.setTitle("🔴 Sold Out");
        await original.edit({ embeds: [updatedEmbed] });
      }

      await btn.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔴 Sold Out")
            .setDescription(`**${itemName}** has been marked as sold out.\n\nRun \`/sold\` again to update more listings.`)
            .setColor(Colors.DarkRed)
            .setTimestamp(),
        ],
        components: [],
      });
      return;
    }

    // ── Category selected ─────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "list_category") {
      const sel = interaction as StringSelectMenuInteraction;
      const cats = sel.values;
      const key = cartKey(sel.user.id, sel.channelId);
      carts.set(key, { cats, wPage: 0, items: [], createdAt: Date.now() });
      const cart = carts.get(key)!;

      await sel.update({
        embeds: [buildCartEmbed(cart, sel.user.username)],
        components: buildItemRows(cart),
      });
      return;
    }

    // ── Item selected from weapons or styles dropdown ──────────────────────
    if (
      interaction.isStringSelectMenu() &&
      (interaction.customId.startsWith("li:w:") || interaction.customId === "li:s:0")
    ) {
      const sel = interaction as StringSelectMenuInteraction;
      const key = cartKey(sel.user.id, sel.channelId);
      const cart = carts.get(key);
      if (!cart) {
        await sel.reply({ content: "Session expired. Please run `/list` again.", ephemeral: true });
        return;
      }

      for (const val of sel.values) {
        const [type, idxStr] = val.split(":") as ["w" | "s", string];
        const idx = parseInt(idxStr);
        const item = type === "w" ? WEAPONS[idx]! : FIGHTING_STYLES[idx]!;
        if (!cart.items.some((it) => it.name === item.name)) {
          cart.items.push({ type, name: item.name, emoji: item.emoji });
        }
      }

      await sel.update({
        embeds: [buildCartEmbed(cart, sel.user.username)],
        components: buildItemRows(cart),
      });
      return;
    }

    // ── Weapon page nav ───────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith("lp:w:")) {
      const btn = interaction as ButtonInteraction;
      const newPage = parseInt(btn.customId.split(":")[2]!);
      const key = cartKey(btn.user.id, btn.channelId);
      const cart = carts.get(key);
      if (!cart) {
        await btn.reply({ content: "Session expired. Please run `/list` again.", ephemeral: true });
        return;
      }
      cart.wPage = newPage;
      await btn.update({
        embeds: [buildCartEmbed(cart, btn.user.username)],
        components: buildItemRows(cart),
      });
      return;
    }

    // ── Done button → show quantities + prices modal ───────────────────────
    if (interaction.isButton() && interaction.customId === "list_done") {
      const btn = interaction as ButtonInteraction;
      const key = cartKey(btn.user.id, btn.channelId);
      const cart = carts.get(key);
      if (!cart || cart.items.length === 0) {
        await btn.reply({ content: "No items selected.", ephemeral: true });
        return;
      }

      const itemList = cart.items
        .map((it, i) => `${i + 1}. ${it.type === "w" ? EMOJI_WEAPON : EMOJI_STYLE} ${it.name}`)
        .join("\n");
      const label =
        cart.items.length <= 3
          ? `Quantities for: ${cart.items.map((i) => i.name).join(", ")}`
          : `Quantities for ${cart.items.length} items (in order listed)`;

      const modal = new ModalBuilder()
        .setCustomId("list_quantities")
        .setTitle("Enter Stock Counts");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("items_display")
            .setLabel("Your selected items (for reference)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(itemList)
            .setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("quantities")
            .setLabel(label.slice(0, 45))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(
              cart.items.length === 1 ? "e.g. 5" : `e.g. ${cart.items.map(() => "1").join(", ")}`,
            )
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("prices")
            .setLabel("Prices (optional, comma-separated)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(
              cart.items.length === 1 ? "e.g. 500" : `e.g. ${cart.items.map(() => "500").join(", ")}`,
            )
            .setRequired(false),
        ),
      );

      await btn.showModal(modal);
      return;
    }

    // ── Quantities modal submitted → ask for payment methods ───────────────
    if (interaction.isModalSubmit() && interaction.customId === "list_quantities") {
      const modal = interaction as ModalSubmitInteraction;
      const key = cartKey(modal.user.id, modal.channelId!);
      const cart = carts.get(key);
      if (!cart || cart.items.length === 0) {
        await modal.reply({ content: "Session expired. Run `/list` again.", ephemeral: true });
        return;
      }

      const rawQtys = modal.fields.getTextInputValue("quantities");
      const qtys = rawQtys.split(",").map((q) => q.trim());
      const parsedQtys = qtys.map((q) => parseInt(q));

      if (parsedQtys.some((q) => isNaN(q) || q < 1)) {
        await modal.reply({
          content: `❌ All quantities must be valid whole numbers, e.g. \`${cart.items.map(() => "1").join(", ")}\`. Please run \`/list\` again.`,
          ephemeral: true,
        });
        return;
      }

      const rawPrices = modal.fields.getTextInputValue("prices").trim();
      const prices = rawPrices ? rawPrices.split(",").map((p) => p.trim()) : [];

      const user = modal.user;
      const lines = cart.items.map((item, i) => {
        const qty = parsedQtys[i] ?? 1;
        const price = prices[i] ?? "";
        const prefix = item.type === "w" ? EMOJI_WEAPON : EMOJI_STYLE;
        const priceSuffix = price ? ` | 💰 ${price}` : "";
        return `${prefix} ${item.emoji} **${item.name}** — ${qty}${priceSuffix}`;
      });

      const hasWeapons = cart.items.some((i) => i.type === "w");
      const hasStyles = cart.items.some((i) => i.type === "s");
      const color = hasWeapons && hasStyles ? Colors.Gold : hasWeapons ? Colors.Red : Colors.Purple;

      pendingListings.set(user.id, {
        lines,
        color,
        userId: user.id,
        username: user.username,
        avatarURL: user.displayAvatarURL({ size: 64 }),
        cartKey: key,
        createdAt: Date.now(),
      });
      carts.delete(key);

      await modal.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Which payment methods do you accept?")
            .setDescription("Choose all that apply — buyers will see these on your listing.")
            .setColor(Colors.Blurple)
            .setTimestamp(),
        ],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("lpay")
              .setPlaceholder("Select payment method(s)…")
              .setMinValues(1)
              .setMaxValues(PAYMENT_METHODS.length)
              .addOptions(
                PAYMENT_METHODS.map((pm) =>
                  new StringSelectMenuOptionBuilder()
                    .setLabel(pm.label)
                    .setValue(pm.value)
                    .setEmoji(pm.emoji),
                ),
              ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── lpay — seller picks payment methods → post listing embed ───────────
    if (interaction.isStringSelectMenu() && interaction.customId === "lpay") {
      const sel = interaction as StringSelectMenuInteraction;
      const pl = pendingListings.get(sel.user.id);
      if (!pl) {
        await sel.reply({ content: "Session expired. Run `/list` again.", ephemeral: true });
        return;
      }
      pendingListings.delete(sel.user.id);

      const selectedPayments = sel.values
        .map((v) => PAYMENT_METHODS.find((pm) => pm.value === v))
        .filter((pm): pm is (typeof PAYMENT_METHODS)[number] => !!pm);

      const paymentLine =
        "💳 " +
        selectedPayments
          .map((pm) => `<:${pm.emoji.name}:${pm.emoji.id}> ${pm.label}`)
          .join(" | ");

      const description = `@${pl.username}'s Stock\n\n${pl.lines.join("\n")}\n\n${paymentLine}`;

      const resultEmbed = new EmbedBuilder()
        .setTitle("📦 Stock Listed")
        .setDescription(description)
        .setColor(pl.color)
        .setThumbnail(pl.avatarURL)
        .setFooter({ text: `Listed by ${pl.username} • ${pl.userId}`, iconURL: pl.avatarURL })
        .setTimestamp();

      const listingComponents = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("create_ticket")
            .setLabel("Create Ticket")
            .setStyle(ButtonStyle.Primary),
        ),
      ];

      await sel.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("📦 Listed!")
            .setDescription("Run `/list` again to add more stock.")
            .setColor(Colors.Green)
            .setTimestamp(),
        ],
        components: [],
      });

      const guildSettings = sel.guildId ? getGuildSettings(sel.guildId) : {};
      const listingChannelId = guildSettings.listingChannelId;

      if (listingChannelId) {
        try {
          const targetChannel = await client.channels.fetch(listingChannelId);
          if (targetChannel && targetChannel.isTextBased()) {
            await targetChannel.send({
              content: `<@&${LISTING_ROLE_PING}>`,
              embeds: [resultEmbed],
              components: listingComponents,
              allowedMentions: { roles: [LISTING_ROLE_PING] },
            });
            return;
          }
        } catch {
          // fall through to followUp
        }
      }

      await sel.followUp({
        content: `<@&${LISTING_ROLE_PING}>`,
        embeds: [resultEmbed],
        components: listingComponents,
        allowedMentions: { roles: [LISTING_ROLE_PING] },
      });
      return;
    }

    // ── Create ticket — show item selection dropdown ───────────────────────
    if (interaction.isButton() && interaction.customId === "create_ticket") {
      const btn = interaction as ButtonInteraction;
      const embed = btn.message.embeds[0];
      if (!embed?.description) {
        await btn.reply({ content: "Could not read listing info. Try again.", ephemeral: true });
        return;
      }

      const descLines = embed.description.split("\n");
      const sellerMatch = descLines[0]?.match(/^@(.+?)'s Stock/);
      const sellerName = sellerMatch?.[1] ?? "seller";
      const itemLines = descLines.slice(2).filter(Boolean);
      const itemNames = itemLines
        .filter((line) => !line.includes("~~") && !line.startsWith("💳"))
        .map((line) => line.match(/\*\*(.+?)\*\*/)?.[1])
        .filter((n): n is string => !!n);

      const footerText = embed.footer?.text ?? "";
      const sellerIdMatch = footerText.match(/•\s*(\d+)$/);
      const sellerId = sellerIdMatch?.[1] ?? "0";

      const acceptedPayments = descLines.find((l) => l.startsWith("💳")) ?? "";
      if (acceptedPayments) listingPayments.set(`${btn.channelId}:${btn.message.id}`, acceptedPayments);

      if (itemNames.length === 0) {
        await btn.reply({ content: "No available items found in this listing.", ephemeral: true });
        return;
      }

      const selectId = `ti:${sellerId}:${btn.channelId}:${btn.message.id}:${sellerName}`.slice(0, 100);

      await btn.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🛒 What do you want to buy?")
            .setDescription(`Choose the item(s) you want from **${sellerName}**'s stock:`)
            .setColor(Colors.Blurple)
            .setTimestamp(),
        ],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(selectId)
              .setPlaceholder("Select item(s)…")
              .setMinValues(1)
              .setMaxValues(Math.min(4, itemNames.length))
              .addOptions(
                itemNames.slice(0, 25).map((name) =>
                  new StringSelectMenuOptionBuilder().setLabel(name).setValue(name),
                ),
              ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── ti: — item(s) chosen → ask quantities via dropdowns ───────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("ti:")) {
      const sel = interaction as StringSelectMenuInteraction;
      const [, sellerId, origChannelId, origMsgId, ...nameParts] = sel.customId.split(":");
      const sellerName = nameParts.join(":");
      const selectedItems = sel.values;
      const capped = selectedItems.slice(0, 4);

      const stockMap = new Map<string, number>();
      try {
        const origChannel = await sel.guild?.channels.fetch(origChannelId ?? "");
        if (origChannel?.isTextBased()) {
          const origMsg = await (origChannel as import("discord.js").TextChannel).messages.fetch(origMsgId ?? "");
          const descLines = origMsg.embeds[0]?.description?.split("\n") ?? [];
          for (const line of descLines) {
            const m = line.match(/\*\*(.+?)\*\*.*?—\s*(\d+)/);
            if (m) stockMap.set(m[1]!, parseInt(m[2]!));
          }
        }
      } catch {
        // fall back to no cap
      }

      const pmKey = `${origChannelId}:${origMsgId}`;
      pendingTickets.set(sel.user.id, {
        sellerId: sellerId ?? "0",
        sellerName,
        origChannelId: origChannelId ?? "",
        origMsgId: origMsgId ?? "",
        selectedItems: capped,
        quantities: new Array(capped.length).fill(1),
        createdAt: Date.now(),
        acceptedPayments: listingPayments.get(pmKey) ?? "",
      });

      const availableCapped = capped.filter((name) => (stockMap.get(name) ?? 1) > 0);
      if (availableCapped.length === 0) {
        await sel.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Items No Longer Available")
              .setDescription("All selected items have sold out. Please try again.")
              .setColor(Colors.Red)
              .setTimestamp(),
          ],
          components: [],
        });
        pendingTickets.delete(sel.user.id);
        return;
      }

      const qtyRows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = availableCapped.map(
        (name, idx) => {
          const maxQty = Math.min(Math.max(stockMap.get(name) ?? 20, 1), 25);
          const qtyOptions = Array.from({ length: maxQty }, (_, i) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${i + 1}`)
              .setValue(`${i + 1}`)
              .setDefault(i === 0),
          );
          return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`tqd:${idx}`)
              .setPlaceholder(`Qty for: ${name.slice(0, 60)} (max ${maxQty})`)
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(qtyOptions),
          );
        },
      );
      qtyRows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("tq_submit")
            .setLabel("✅ Create Ticket")
            .setStyle(ButtonStyle.Success),
        ),
      );

      await sel.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔢 How many of each?")
            .setDescription(
              availableCapped.map((name, i) => `${i + 1}. **${name}**`).join("\n") +
              "\n\nSelect a quantity for each item, then click **✅ Create Ticket**.",
            )
            .setColor(Colors.Blurple)
            .setTimestamp(),
        ],
        components: qtyRows,
      });
      return;
    }

    // ── tqd: — quantity dropdown updated ──────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("tqd:")) {
      const sel = interaction as StringSelectMenuInteraction;
      const idx = parseInt(sel.customId.split(":")[1]!);
      const pending = pendingTickets.get(sel.user.id);
      if (pending && idx >= 0 && idx < pending.quantities.length) {
        pending.quantities[idx] = parseInt(sel.values[0]!);
      }
      await sel.deferUpdate();
      return;
    }

    // ── tq_submit — create ticket channel ─────────────────────────────────
    if (interaction.isButton() && interaction.customId === "tq_submit") {
      const btn = interaction as ButtonInteraction;
      const pending = pendingTickets.get(btn.user.id);
      const guild = btn.guild;
      if (!pending || !guild) {
        await btn.reply({ content: "Session expired. Please try again.", ephemeral: true });
        return;
      }
      pendingTickets.delete(btn.user.id);

      const { sellerId, sellerName, selectedItems, quantities, acceptedPayments } = pending;

      const channelName = selectedItems
        .slice(0, 3)
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 100);

      const guildTicketSettings = getGuildSettings(guild.id);
      const resolvedTicketCategoryId = guildTicketSettings.ticketCategoryId ?? TICKET_CATEGORY_ID;

      const permissionOverwrites: import("discord.js").OverwriteResolvable[] = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: btn.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ];

      if (sellerId && sellerId !== "0") {
        permissionOverwrites.push({
          id: sellerId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }

      if (TICKET_MOD_ROLE_ID) {
        permissionOverwrites.push({
          id: TICKET_MOD_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }

      try {
        const ticketChannel = await guild.channels.create({
          name: channelName || `ticket-${sellerName}`,
          type: ChannelType.GuildText,
          parent: resolvedTicketCategoryId || undefined,
          topic: `Ticket for ${btn.user.tag} buying from ${sellerName}`,
          reason: `Ticket created by ${btn.user.tag}`,
          permissionOverwrites,
        });

        const itemSummary = selectedItems
          .map((name, i) => `• **${name}** × ${quantities[i] ?? 1}`)
          .join("\n");

        const ticketMsg = [
          `${btn.user} wants to buy from **${sellerName}**:`,
          itemSummary,
          acceptedPayments ? `\n${acceptedPayments}` : "",
        ].filter(Boolean).join("\n");

        await ticketChannel.send({ content: ticketMsg });

        await btn.reply({
          content: `✅ Ticket created: ${ticketChannel}`,
          ephemeral: true,
        });
      } catch (err) {
        await btn.reply({
          content: `Failed to create ticket: ${String(err)}`,
          ephemeral: true,
        });
      }
      return;
    }

   } catch (err) {
     console.error("[bot] Unhandled interaction error:", err);
   }
  });

  await client.login(token);
}
