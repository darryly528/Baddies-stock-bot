import { Router, type Request, type Response, type NextFunction } from "express";
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getBotClient } from "../bot";
import { loadListings } from "./listings";

const router = Router();

const DISCORD_CLIENT_ID = process.env["DISCORD_CLIENT_ID"] ?? "";
const DISCORD_CLIENT_SECRET = process.env["DISCORD_CLIENT_SECRET"] ?? "";
const DISCORD_INVITE_URL = process.env["DISCORD_INVITE_URL"] ?? "";

function getRedirectUri(req: Request): string {
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? req.get("host") ?? "localhost:8080";
  return `https://${domain}/api/auth/discord/callback`;
}

router.get("/auth/discord", (req: Request, res: Response) => {
  if (!DISCORD_CLIENT_ID) {
    res.status(503).json({ error: "Discord OAuth not configured (missing DISCORD_CLIENT_ID)" });
    return;
  }
  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const scope = encodeURIComponent("identify guilds");
  res.redirect(
    `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`
  );
});

router.get("/auth/discord/callback", async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };
  if (!code) {
    res.redirect("/?error=no_code");
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[auth] Token exchange failed:", await tokenRes.text());
      res.redirect("/?error=token_failed");
      return;
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      res.redirect("/?error=user_failed");
      return;
    }

    const user = (await userRes.json()) as {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
    };

    req.session.discordUser = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      accessToken: tokenData.access_token,
    };

    res.redirect("/list");
  } catch (err) {
    console.error("[auth] OAuth callback error:", err);
    res.redirect("/?error=oauth_error");
  }
});

router.get("/auth/me", (req: Request, res: Response) => {
  if (!req.session.discordUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { id, username, discriminator, avatar } = req.session.discordUser;
  res.json({
    id,
    username,
    discriminator,
    avatar,
    discordInviteUrl: DISCORD_INVITE_URL,
    oauthEnabled: !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET),
  });
});

router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/guilds", async (req: Request, res: Response) => {
  if (!req.session.discordUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { accessToken } = req.session.discordUser;
  const botClient = getBotClient();

  try {
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!guildsRes.ok) {
      res.status(502).json({ error: "Failed to fetch guilds from Discord" });
      return;
    }

    const allGuilds = (await guildsRes.json()) as Array<{
      id: string;
      name: string;
      icon: string | null;
      permissions: string;
    }>;

    const MANAGE_GUILD = BigInt(0x20);
    const ADMINISTRATOR = BigInt(0x8);

    const eligibleGuilds = allGuilds
      .filter((g) => {
        const perms = BigInt(g.permissions);
        const hasPerms = (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
        const botPresent = botClient ? botClient.guilds.cache.has(g.id) : false;
        return hasPerms && botPresent;
      })
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
      }));

    res.json(eligibleGuilds);
  } catch (err) {
    console.error("[auth] Guilds error:", err);
    res.status(500).json({ error: "Failed to fetch guilds" });
  }
});

router.post("/auth/post-listing/:listingId", async (req: Request, res: Response) => {
  if (!req.session.discordUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { listingId } = req.params as { listingId: string };
  const { guildId } = req.body as { guildId?: string };

  if (!guildId) {
    res.status(400).json({ error: "guildId is required" });
    return;
  }

  const botClient = getBotClient();
  if (!botClient) {
    res.status(503).json({ error: "Bot is not connected" });
    return;
  }

  const listings = loadListings();
  const listing = listings.find((l) => l.id === listingId);
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const guild = botClient.guilds.cache.get(guildId);
  if (!guild) {
    res.status(404).json({ error: "Bot is not in that server" });
    return;
  }

  const textChannel = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch
        .permissionsFor(guild.members.me!)
        ?.has(PermissionFlagsBits.SendMessages) === true
  );

  if (!textChannel || !textChannel.isTextBased()) {
    res.status(404).json({ error: "No accessible text channel found in that server" });
    return;
  }

  const activeItems = listing.items.filter((i) => !i.soldOut);
  const itemLines = activeItems
    .map((i) => {
      const priceStr = (i as { price?: string }).price ? ` — **$${(i as { price?: string }).price}**` : "";
      return `• **${i.name}** × ${i.quantity}${priceStr}`;
    })
    .join("\n");

  const paymentMethods: string[] = (listing as { paymentMethods?: string[] }).paymentMethods ?? [];
  const customMessage: string | undefined = (listing as { customMessage?: string }).customMessage;

  const PAYMENT_EMOJIS: Record<string, string> = {
    "PayPal": "💳",
    "Apple Pay": "🍎",
    "Cash App": "💸",
    "Venmo": "💙",
  };

  const embed = new EmbedBuilder()
    .setTitle("📦 New Listing")
    .setColor(0xff0080)
    .addFields(
      { name: "Seller", value: listing.seller, inline: true },
      ...(paymentMethods.length > 0
        ? [{ name: "Payment", value: paymentMethods.map((m) => `${PAYMENT_EMOJIS[m] ?? ""} ${m}`.trim()).join("  ·  "), inline: true }]
        : []),
      { name: `Items (${activeItems.length})`, value: itemLines || "—", inline: false },
      ...(customMessage ? [{ name: "Message", value: customMessage, inline: false }] : [])
    )
    .setTimestamp(new Date(listing.createdAt))
    .setFooter({ text: `Listing ID: ${listing.id}` });

  await textChannel.send({ embeds: [embed] });
  res.json({ ok: true, channel: textChannel.id });
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.discordUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export default router;
