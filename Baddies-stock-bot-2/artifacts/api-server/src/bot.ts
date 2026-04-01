import fs from "fs";
import path from "path";

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

if (!TICKET_MOD_ROLE_ID) {
  console.warn(
    "Warning: TICKET_MOD_ROLE_ID is not set. Tickets will still be created but moderators may not have access.",
  );
}

type Item = { name: string; emoji: string };

const WEAPONS: Item[] = [
  // Replace the emoji strings below with your server's custom emoji (e.g. "<:myWeapon:123456789012345678>")
  { name: "Glitter Bomb", emoji: "<:glitter_bomb:1481520426273472564>" },
  { name: "Ghostly Gloves", emoji: "<:ghostly_gloves:1481520423194722444>" },
  { name: "Scythe", emoji: "<:scythe:1481520488823001119>" },
  { name: "Spiked Knuckles", emoji: "<:spiked_knuckles:1481520500130713753>" },
  { name: "Ice Crown Queen", emoji: "<:ice_crown_queen:1481520443566325770>" },
  { name: "Trident", emoji: "<:trident:1481520508683161752>" },
  { name: "Ice Katana", emoji: "<:ice_katana:1481520447358107719>" },
  { name: "Cupid's Bow", emoji: "<:cupids_bow:1481520414898389113>" },
  {
    name: "Love Me Hate Me Taser",
    emoji: "<:love_me_hate_me_taser:1481520456342437979>",
  },
  {
    name: "Santa's Naughty or Nice Launcher",
    emoji: "<:santa_launcher:1481520486214275092>",
  },
  { name: "Slasher Claws", emoji: "<:slasher_claws:1481520492383961228>" },
  {
    name: "Grenade Launcher",
    emoji: "<:grenade_launcher:1481520434645041152>",
  },
  {
    name: "Glitter Blue Spray",
    emoji: "<:glitter_blue_spray:1481520424385777715>",
  },
  {
    name: "Spiked Nightmare Purse",
    emoji: "<:spiked_nightmare_purse:1481520501795983472>",
  },
  {
    name: "Spiked Kitty Stanli",
    emoji: "<:spiked_kitty_stanli:1481520498897588365>",
  },
  {
    name: "Grim Reaper Cloak",
    emoji: "<:grim_reaper_cloak:1481520436213841991>",
  },
  { name: "Dog Purse", emoji: "<:dog_purse:1481520417591263232>" },
  { name: "Gravity Gun", emoji: "<:gravity_gun:1481520432891953222>" },
  {
    name: "Trashbin Disguise",
    emoji: "<:trashbin_disguise:1481520507235991622>",
  },
  { name: "Loveboard", emoji: "<:loveboard:1481520457336229939>" },
  { name: "Dance Bomb", emoji: "<:dance_bomb:1481520416156811295>" },
  { name: "Riot Shield", emoji: "<:riot_shield:1481520478781706423>" },
  { name: "Cannon", emoji: "<:cannon:1481520404320485426>" },
  { name: "Reindeer Purse", emoji: "<:reindeer_purse:1481520477288530103>" },
  { name: "Inferno Blade", emoji: "<:inferno_blade:1481520449216053288>" },
  { name: "Champion Gloves", emoji: "<:champion_gloves:1481520411949793371>" },
  { name: "Grapple Hook", emoji: "<:grapple_hook:1481520431197585602>" },
  { name: "Sakura Blade", emoji: "<:sakura_blade:1481520484892803202>" },
  { name: "Freeze Gun", emoji: "<:freeze_gun:1481520421865263164>" },
  { name: "Brass Knuckles", emoji: "<:brass_knuckles:1481520401673752677>" },
  { name: "Fan of Requiem", emoji: "<:fan_of_requiem:1481520418656485487>" },
  { name: "Chainsaw", emoji: "<:chainsaw:1481520407671607398>" },
  { name: "Blast Bow", emoji: "<:blast_bow:1481520399052443658>" },
  { name: "Witch Scepter", emoji: "<:witch_scepter:1481520512327749672>" },
  { name: "Kitty Purse", emoji: "<:kitty_purse:1481520454433771531>" },
  { name: "Nunchucks", emoji: "<:nunchucks:1481520466299584683>" },
  { name: "Turkey Skewers", emoji: "<:turkey_skewers:1481520510650290206>" },
  { name: "Chakram", emoji: "<:chakram:1481520410620203068>" },
  { name: "Sledgehammer", emoji: "<:sledgehammer:1481520493919207465>" },
  { name: "Spiked Purse", emoji: "<:spiked_purse:1481520503259922482>" },
  { name: "Harpoon", emoji: "<:harpoon:1481520438734622761>" },
  {
    name: "Golden Snowball Launcher",
    emoji: "<:golden_snowball_launcher:1481520429628784680>",
  },
  { name: "Axe", emoji: "<:axe:1481520397529911347>" },
  { name: "Roller Skates", emoji: "<:roller_skates:1481520480212095016>" },
  { name: "Shiny Purse", emoji: "<:shiny_purse:1481520490618159104>" },
  { name: "Chain Mace", emoji: "<:chain_mace:1481520406144749589>" },
  {
    name: "Snowball Launcher",
    emoji: "<:snowball_launcher:1481520496544710770>",
  },
  { name: "Crowbar", emoji: "<:crowbar:1481520413430517851>" },
  { name: "Regular Bow", emoji: "<:regular_bow:1481520475950813245>" },
  { name: "Rusty Bow", emoji: "<:rusty_bow:1481520483454423040>" },
  { name: "Slingshot", emoji: "<:slingshot:1481520495198339202>" },
  { name: "Spearhead Stick", emoji: "<:spearhead_stick:1481520497622777976>" },
  { name: "Stick", emoji: "<:stick:1481520504358699159>" },
  { name: "Parasol", emoji: "<:parasol:1481520467960532992>" },
  { name: "Medic Spray", emoji: "<:medic_spray:1481520463208386660>" },
];

const FIGHTING_STYLES: Item[] = [
  {
    name: "Heartbreaker Style",
    emoji: "<:heartbreaker_style:1481520440315875409>",
  },
  { name: "Angel Style", emoji: "<:angel_style:1481520396233736294>" },
  {
    name: "Princess Power Style",
    emoji: "<:princess_power_style:1481520469093122159>",
  },
  {
    name: "Feral Frenzy Style",
    emoji: "<:feral_frenzy_style:1481520420199989248>",
  },
  { name: "Glitter Style", emoji: "<:glitter_style:1481520427787354253>" },
  {
    name: "Storm Dancer Style",
    emoji: "<:storm_dancer_style:1481520505654612099>",
  },
  {
    name: "Hug of Doom Style",
    emoji: "<:hug_of_doom_style:1481520441704321024>",
  },
  {
    name: "Princess Punchout Style",
    emoji: "<:princess_punchout_style:1481520472339517614>",
  },
  {
    name: "Mean Girl Mayhem Style",
    emoji: "<:mean_girl_mayhem_style:1481520459798413373>",
  },
  { name: "Kickboxing", emoji: "<:kickboxing:1481520452370436147>" },
  {
    name: "Bubble Pop Style",
    emoji: "<:bubble_pop_style:1481520402923786344>",
  },
  { name: "Boxing", emoji: "<:boxing:1481520400193159293>" },
  { name: "Karate Style", emoji: "<:karate_style:1481520450424279130>" },
  {
    name: "Rough 'n' Rude Style",
    emoji: "<:rough_n_rude_style:1481520481688354937>",
  },
  { name: "MMA Fighting", emoji: "<:mma_fighting:1481520464646901830>" },
  {
    name: "Puppet Panic Style",
    emoji: "<:puppet_panic_style:1481520474373754940>",
  },
];

const PAGE_SIZE = 24;

// Emojis used for UI elements (change these to match your server/brand emoji)
const EMOJI_WEAPON = "⚔️" as const;
const EMOJI_STYLE = "🥋" as const;

// ── Cart ──────────────────────────────────────────────────────────────────────
type CartItem = { type: "w" | "s"; name: string; emoji: string };
type Cart = { cats: string[]; wPage: number; items: CartItem[] };
const carts = new Map<string, Cart>();

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
          .setPlaceholder(
            `${EMOJI_WEAPON} Add weapons… (page ${cart.wPage + 1}/${totalWPages})`,
          )
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
    .setColor(
      hasWeapons && hasStyles
        ? Colors.Gold
        : hasWeapons
          ? Colors.Red
          : Colors.Purple,
    )
    .setTimestamp();

  if (cart.items.length === 0) {
    embed.setDescription(
      "Select items from the menus below to add them to your list.",
    );
  } else {
    const lines = cart.items
      .map(
        (it) =>
          `${it.type === "w" ? EMOJI_WEAPON : EMOJI_STYLE} ${it.emoji} **${it.name}**`,
      )
      .join("\n");
    embed.setDescription(
      `**Selected (${cart.items.length}):**\n${lines}\n\nSelect more or click **✅ Enter Quantities** when done.`,
    );
  }

  return embed;
}

// ── Bot client export ─────────────────────────────────────────────────────────
let _botClient: Client | null = null;
export function getBotClient(): Client | null { return _botClient; }

// ── Bot ───────────────────────────────────────────────────────────────────────
export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];

  // Debug: confirm the token is being loaded (length + part lengths)
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
      "DISCORD_BOT_TOKEN appears to contain invalid characters. Make sure you copied the token exactly and didn’t include quotes or spaces.",
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
    ].map((c) => c.toJSON());

    const rest = new REST().setToken(token);
    try {
      await rest.put(Routes.applicationCommands(readyClient.user.id), {
        body: commands,
      });
      console.log("Slash commands registered.");
    } catch (err) {
      console.error("Failed to register commands:", err);
    }
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // ── /list ─────────────────────────────────────────────────────────────
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "list"
    ) {
      const embed = new EmbedBuilder()
        .setTitle("📦 Stock Listing")
        .setDescription(
          "Choose one or both categories. You can mix weapons and fighting styles.",
        )
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
              .setLabel("Weapons")
              .setDescription("Glitter Bomb, Ice Katana, Scythe and more")
              .setValue("weapons")
              .setEmoji(EMOJI_WEAPON),
            new StringSelectMenuOptionBuilder()
              .setLabel("Fighting Styles")
              .setDescription("Heartbreaker, Angel Style and more")
              .setValue("styles")
              .setEmoji(EMOJI_STYLE),
          ),
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
      return;
    }

    // ── /sold — scan recent messages ──────────────────────────────────────
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "sold"
    ) {
      const user = interaction.user;
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({
          content: "Use this in a text channel.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const fetched = await channel.messages.fetch({ limit: 50 });

      // value format: `msgId:lineIdx:stock` (new) or `msgId:old:stock` (old field-based)
      const options: StringSelectMenuOptionBuilder[] = [];

      for (const msg of fetched.values()) {
        if (msg.author.id !== client.user!.id) continue;
        const embed = msg.embeds[0];
        if (!embed || embed.title !== "📦 Stock Listed") continue;
        if (!embed.description?.includes(`@${user.username}`)) continue;

        // New description-based format
        if (embed.description) {
          const lines = embed.description.split("\n");
          lines.forEach((line, idx) => {
            const match = line.match(/^[⚔️🥋].+?\*\*(.+?)\*\*\s*—\s*(.+)$/u);
            if (!match) return;
            const [, name, stock] = match;
            if (stock!.startsWith("~~")) return; // already sold out
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

        // Old field-based format
        if (
          embed.fields.length >= 2 &&
          !embed.fields[0]!.value.startsWith("~~")
        ) {
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
          content:
            "No active listings found for you in this channel. Use `/list` to add some first.",
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

    // ── sold_item_pick — show quantity dropdown + Sold Out button ─────────
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "sold_item_pick"
    ) {
      const sel = interaction as StringSelectMenuInteraction;
      const raw = sel.values[0]!;
      // raw = `msgId:lineIdxOrOld:stock`
      const firstColon = raw.indexOf(":");
      const rest = raw.slice(firstColon + 1);
      const secondColon = rest.indexOf(":");
      const msgId = raw.slice(0, firstColon);
      const lineRef = rest.slice(0, secondColon); // "old" or number
      const stockStr = rest.slice(secondColon + 1).trim();
      const stock = parseInt(stockStr);
      const hasNumericStock = !isNaN(stock) && stock > 0;

      const components: ActionRowBuilder<
        StringSelectMenuBuilder | ButtonBuilder
      >[] = [];

      // Quantity dropdown: 1 sold → stock-1 remaining, … up to (stock-1) sold → 1 remaining
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

      // Sold Out button — always shown
      const soldOutLabel = hasNumericStock
        ? `🔴 Sold Out (all ${stock} gone)`
        : "🔴 Sold Out";
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`sold_out:${msgId}:${lineRef}`)
            .setLabel(soldOutLabel)
            .setStyle(ButtonStyle.Danger),
        ),
      );

      const itemLabel =
        sel.options?.find((o) => o.value === raw)?.label ??
        sel.component.options.find((o) => o.value === raw)?.label ??
        "this item";

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
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("sold_qty:")
    ) {
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
        // Old field-based format: update stock field
        const currentStock = parseInt(origEmbed.fields[1]?.value ?? "0");
        const newStock = Math.max(0, currentStock - soldQty);
        const updatedEmbed = EmbedBuilder.from(origEmbed).spliceFields(1, 1, {
          name: "📦 Stock",
          value: String(newStock),
          inline: true,
        });
        await original.edit({ embeds: [updatedEmbed] });
      } else {
        // New description format: update stock number on the line
        const lineIdx = parseInt(lineRef);
        const lines = origEmbed.description!.split("\n");
        lines[lineIdx] = lines[lineIdx]!.replace(
          /(\*\*\s*—\s*)(.+)$/,
          (_, prefix, oldStock) => {
            const newStock = Math.max(0, parseInt(oldStock) - soldQty);
            return `${prefix}${newStock}`;
          },
        );
        await original.edit({
          embeds: [
            EmbedBuilder.from(origEmbed).setDescription(lines.join("\n")),
          ],
        });
      }

      await sel.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Stock Updated")
            .setDescription(
              `Marked **${soldQty}** as sold. The listing has been updated with the new stock count.\n\nRun \`/sold\` again to update more.`,
            )
            .setColor(Colors.Green)
            .setTimestamp(),
        ],
        components: [],
      });
      return;
    }

    // ── sold_out — strike through item permanently ─────────────────────────
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("sold_out:")
    ) {
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
        // Old field-based format
        itemName = origEmbed.fields[0]?.value ?? "item";
        const soldEmbed = EmbedBuilder.from(origEmbed)
          .setTitle("🔴 Sold Out")
          .setColor(Colors.DarkRed)
          .spliceFields(0, 1, {
            name: origEmbed.fields[0]?.name ?? "Item",
            value: `~~${itemName}~~`,
            inline: true,
          })
          .spliceFields(1, 1, {
            name: "📦 Stock",
            value: "~~0~~",
            inline: true,
          });
        await original.edit({ embeds: [soldEmbed] });
      } else {
        // New description format: strike through the specific line
        const lineIdx = parseInt(lineRef);
        const lines = origEmbed.description!.split("\n");
        const match = lines[lineIdx]!.match(
          /^([⚔️🥋].+?)\*\*(.+?)\*\*\s*—\s*(.+)$/u,
        );
        if (match) {
          const [, prefix, name] = match;
          itemName = name!;
          lines[lineIdx] = `${prefix}~~**${name}**~~ — ~~0~~`;
        }
        // If ALL item lines are now struck, update the title too
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
            .setDescription(
              `**${itemName}** has been marked as sold out.\n\nRun \`/sold\` again to update more listings.`,
            )
            .setColor(Colors.DarkRed)
            .setTimestamp(),
        ],
        components: [],
      });
      return;
    }

    // ── Category selected ─────────────────────────────────────────────────
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "list_category"
    ) {
      const sel = interaction as StringSelectMenuInteraction;
      const cats = sel.values; // ["weapons"] | ["styles"] | ["weapons","styles"]
      const key = cartKey(sel.user.id, sel.channelId);
      carts.set(key, { cats, wPage: 0, items: [] });
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
      (interaction.customId.startsWith("li:w:") ||
        interaction.customId === "li:s:0")
    ) {
      const sel = interaction as StringSelectMenuInteraction;
      const key = cartKey(sel.user.id, sel.channelId);
      const cart = carts.get(key);
      if (!cart) {
        await sel.reply({
          content: "Session expired. Please run `/list` again.",
          ephemeral: true,
        });
        return;
      }

      // Add selected items to cart (deduplicate by name)
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
        await btn.reply({
          content: "Session expired. Please run `/list` again.",
          ephemeral: true,
        });
        return;
      }
      cart.wPage = newPage;
      await btn.update({
        embeds: [buildCartEmbed(cart, btn.user.username)],
        components: buildItemRows(cart),
      });
      return;
    }

    // ── Done button → show quantities modal ────────────────────────────────
    if (interaction.isButton() && interaction.customId === "list_done") {
      const btn = interaction as ButtonInteraction;
      const key = cartKey(btn.user.id, btn.channelId);
      const cart = carts.get(key);
      if (!cart || cart.items.length === 0) {
        await btn.reply({ content: "No items selected.", ephemeral: true });
        return;
      }

      const itemList = cart.items
        .map(
          (it, i) =>
            `${i + 1}. ${it.type === "w" ? EMOJI_WEAPON : EMOJI_STYLE} ${it.emoji} ${it.name}`,
        )
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
              cart.items.length === 1
                ? "e.g. 5"
                : `e.g. ${cart.items.map(() => "1").join(", ")}`,
            )
            .setRequired(true),
        ),
      );

      await btn.showModal(modal);
      return;
    }

    // ── Quantities modal submitted → post single embed ─────────────────────
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "list_quantities"
    ) {
      const modal = interaction as ModalSubmitInteraction;
      const key = cartKey(modal.user.id, modal.channelId!);
      const cart = carts.get(key);
      if (!cart || cart.items.length === 0) {
        await modal.reply({
          content: "Session expired. Run `/list` again.",
          ephemeral: true,
        });
        return;
      }

      const rawQtys = modal.fields.getTextInputValue("quantities");
      const qtys = rawQtys.split(",").map((q) => q.trim());

      const user = modal.user;
      const lines = cart.items.map((item, i) => {
        const qty = qtys[i] ?? "?";
        const prefix = item.type === "w" ? EMOJI_WEAPON : EMOJI_STYLE;
        return `${prefix} ${item.emoji} **${item.name}** — ${qty}`;
      });

      const hasWeapons = cart.items.some((i) => i.type === "w");
      const hasStyles = cart.items.some((i) => i.type === "s");
      const color =
        hasWeapons && hasStyles
          ? Colors.Gold
          : hasWeapons
            ? Colors.Red
            : Colors.Purple;

      const resultEmbed = new EmbedBuilder()
        .setTitle("📦 Stock Listed")
        .setDescription(`@${user.username}'s Stock\n\n${lines.join("\n")}`)
        .setColor(color)
        .setThumbnail(user.displayAvatarURL({ size: 64 }))
        .setFooter({
          text: `Listed by ${user.username}`,
          iconURL: user.displayAvatarURL(),
        })
        .setTimestamp();

      // Reset ephemeral to allow listing again
      const resetEmbed = new EmbedBuilder()
        .setTitle("📦 Listed!")
        .setDescription("Run `/list` again to add more stock.")
        .setColor(Colors.Blurple)
        .setTimestamp();

      carts.delete(key);

      await modal.update({ embeds: [resetEmbed], components: [] });
      await modal.followUp({
        embeds: [resultEmbed],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("create_ticket")
              .setLabel("Create Ticket")
              .setStyle(ButtonStyle.Primary),
          ),
        ],
        allowedMentions: { users: [] },
      });
      return;
    }

    // ── Create ticket from a listing ───────────────────────────────────
    if (interaction.isButton() && interaction.customId === "create_ticket") {
      const btn = interaction as ButtonInteraction;
      const msg = btn.message;

      const embed = msg.embeds[0];
      if (!embed?.description) {
        await btn.reply({
          content: "Could not read listing info. Try again.",
          ephemeral: true,
        });
        return;
      }

      const descLines = embed.description.split("\n");
      const sellerMatch = descLines[0]?.match(/^@(.+?)'s Stock/);
      const sellerName = sellerMatch?.[1] ?? "seller";
      const itemLines = descLines.slice(2).filter(Boolean);
      const itemNames = itemLines
        .map((line) => line.match(/\*\*(.+?)\*\*/)?.[1])
        .filter(Boolean) as string[];

      const threadName = `${sellerName} - ${itemNames.slice(0, 3).join(", ")}`.slice(
        0,
        100,
      );

      const channel = btn.channel;
      if (!channel || !channel.isTextBased()) {
        await btn.reply({
          content: "Unable to create a ticket in this channel.",
          ephemeral: true,
        });
        return;
      }

      try {
        const guild = channel.guild;
        if (!guild) {
          throw new Error("Channel is not in a guild");
        }

        const normalized = threadName
          .toLowerCase()
          .replace(/[^a-z0-9\- ]/g, "")
          .replace(/ +/g, "-")
          .slice(0, 90);

        const ticketChannel = await guild.channels.create({
          name: normalized || `ticket-${sellerName}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: `Ticket requested by ${btn.user.tag} for ${sellerName}'s items`,
          reason: `Ticket created by ${btn.user.tag}`,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: btn.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            ...(TICKET_MOD_ROLE_ID
              ? [
                  {
                    id: TICKET_MOD_ROLE_ID,
                    allow: [
                      PermissionFlagsBits.ViewChannel,
                      PermissionFlagsBits.SendMessages,
                      PermissionFlagsBits.ReadMessageHistory,
                    ],
                  },
                ]
              : []),
          ],
        });

        await ticketChannel.send({
          content: `${btn.user} wants to buy from **${sellerName}**:\n${itemNames
            .slice(0, 10)
            .map((i) => `• ${i}`)
            .join("\n")}`,
        });

        await btn.reply({
          content: `Ticket created: ${ticketChannel}`,
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

    // ── "Type item name" fallback (kept for quick single-item adds) ─────────
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "list_category_single"
    ) {
      // legacy path — no-op, handled by main category handler above
      return;
    }
  });

  await client.login(token);
}
