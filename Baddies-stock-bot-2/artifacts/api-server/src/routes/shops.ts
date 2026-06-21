import { Router, type Request, type Response } from "express";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { getBotClient } from "../bot";
import { upsertShopApplication, loadShops, saveShops, type ShopApplication } from "../shopReview";

const SHOP_REVIEW_CHANNEL_ID = process.env["SHOP_REVIEW_CHANNEL_ID"] ?? process.env["IMAGE_REVIEW_CHANNEL_ID"] ?? "1517999979224895549";

async function postShopForReview(app: ShopApplication): Promise<void> {
  try {
    const bot = getBotClient();
    if (!bot) return;
    const channel = await bot.channels.fetch(SHOP_REVIEW_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0xa855f7)
      .setTitle("🏪 Shop Application")
      .addFields(
        { name: "Shop Name",  value: app.shopName,   inline: true },
        { name: "Applicant",  value: `<@${app.userId}> (${app.username})`, inline: true },
        { name: "Tagline",    value: app.tagline || "(none)", inline: false },
        { name: "Categories / What they sell", value: app.categories || "(none)", inline: false },
      )
      .setFooter({ text: `User ID: ${app.userId}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`shopapprove:${app.userId}`).setLabel("✅ Approve Shop").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`shopreject:${app.userId}`).setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
    );

    await (channel as import("discord.js").TextChannel).send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error("[shopReview] Failed to post for review:", err);
  }
}

const router = Router();

router.post("/shops/apply", async (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { shopName, tagline, categories, bannerUrl, logoUrl, accentColor } = req.body as {
    shopName?: string; tagline?: string; categories?: string;
    bannerUrl?: string; logoUrl?: string; accentColor?: string;
  };

  if (!shopName?.trim()) { res.status(400).json({ error: "Shop name is required" }); return; }
  if (shopName.trim().length > 40) { res.status(400).json({ error: "Shop name must be 40 characters or less" }); return; }

  const shops = loadShops();
  const existing = shops[user.id];
  if (existing?.status === "approved") {
    res.status(400).json({ error: "Your shop is already approved" }); return;
  }

  const app = upsertShopApplication({
    userId: user.id,
    username: user.username,
    shopName: shopName.trim(),
    tagline: (tagline ?? "").trim().slice(0, 100),
    categories: (categories ?? "").trim().slice(0, 200),
    bannerUrl: bannerUrl ?? undefined,
    logoUrl: logoUrl ?? undefined,
    accentColor: accentColor ?? undefined,
  });

  await postShopForReview(app);
  res.json({ ok: true, status: "pending" });
});

router.get("/shops/mine", (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const shops = loadShops();
  res.json(shops[user.id] ?? null);
});

router.put("/shops/mine", (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const shops = loadShops();
  const existing = shops[user.id];
  if (!existing || existing.status !== "approved") {
    res.status(403).json({ error: "Only approved shops can be edited" }); return;
  }

  const { shopName, tagline, bannerUrl, logoUrl, accentColor } = req.body as {
    shopName?: string; tagline?: string;
    bannerUrl?: string; logoUrl?: string; accentColor?: string;
  };

  if (shopName !== undefined) {
    if (!shopName.trim()) { res.status(400).json({ error: "Shop name cannot be empty" }); return; }
    if (shopName.trim().length > 40) { res.status(400).json({ error: "Shop name must be 40 characters or less" }); return; }
    existing.shopName = shopName.trim();
  }
  if (tagline !== undefined) existing.tagline = tagline.trim().slice(0, 100);
  if (bannerUrl !== undefined) existing.bannerUrl = bannerUrl || undefined;
  if (logoUrl !== undefined) existing.logoUrl = logoUrl || undefined;
  if (accentColor !== undefined) existing.accentColor = accentColor || undefined;
  existing.updatedAt = new Date().toISOString();

  shops[user.id] = existing;
  saveShops(shops);
  res.json({ ok: true, shop: existing });
});

router.patch("/shops/mine/members", (req: Request, res: Response) => {
  const user = req.session?.discordUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const shops = loadShops();
  const existing = shops[user.id];
  if (!existing || existing.status !== "approved") {
    res.status(403).json({ error: "Only approved shops can manage members" }); return;
  }
  const { members } = req.body as { members?: string[] };
  if (!Array.isArray(members)) { res.status(400).json({ error: "members must be an array" }); return; }
  existing.members = [...new Set(members.map((m) => m.trim()).filter(Boolean))].slice(0, 20);
  existing.updatedAt = new Date().toISOString();
  shops[user.id] = existing;
  saveShops(shops);
  res.json({ ok: true, shop: existing });
});

router.get("/shops", (_req: Request, res: Response) => {
  const shops = loadShops();
  const approved = Object.values(shops).filter((s) => s.status === "approved");
  res.json(approved);
});

export default router;
