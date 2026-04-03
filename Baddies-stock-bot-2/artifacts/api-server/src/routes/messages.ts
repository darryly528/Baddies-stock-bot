import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { filterContent } from "../contentFilter";
import { getBotClient } from "../bot";

const router: IRouter = Router();

const MESSAGES_PATH = process.env["MESSAGES_PATH"] ?? path.resolve(process.cwd(), "../../messages.json");

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  timestamp: string;
  filtered: boolean;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string | null;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  readBy: string[];
}

function loadConversations(): Conversation[] {
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  fs.writeFileSync(MESSAGES_PATH, JSON.stringify(convs, null, 2), "utf8");
}

function requireSession(req: any, res: any, next: any) {
  if (!req.session?.discordUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

async function notifySellerDM(sellerId: string, buyerName: string, listingTitle: string, content: string) {
  try {
    const bot = getBotClient();
    if (!bot) return;
    const user = await bot.users.fetch(sellerId).catch(() => null);
    if (!user) return;
    await user.send(
      `💬 **New message from ${buyerName}** about your listing *${listingTitle}*:\n> ${content.slice(0, 200)}\n\nReply on the website to respond.`
    );
  } catch {
    // DMs may be disabled — ignore
  }
}

router.get("/messages", requireSession, (req: any, res: any) => {
  const userId = req.session.discordUser.id;
  const convs = loadConversations().filter(
    (c) => c.buyerId === userId || c.sellerId === userId
  );
  const withUnread = convs.map((c) => ({
    ...c,
    messages: undefined,
    lastMessage: c.messages[c.messages.length - 1] ?? null,
    unread: !c.readBy.includes(userId) && c.messages.length > 0,
  }));
  res.json(withUnread);
});

router.post("/messages", requireSession, async (req: any, res: any) => {
  const { listingId, listingTitle, sellerId, sellerName, sellerAvatar, firstMessage } = req.body as {
    listingId: string;
    listingTitle: string;
    sellerId: string;
    sellerName: string;
    sellerAvatar: string | null;
    firstMessage: string;
  };

  const buyer = req.session.discordUser;

  if (!firstMessage?.trim()) {
    res.status(400).json({ error: "Message cannot be empty." });
    return;
  }
  if (buyer.id === sellerId) {
    res.status(400).json({ error: "You cannot message yourself." });
    return;
  }

  const filter = filterContent(firstMessage.trim());

  const convs = loadConversations();
  const existing = convs.find(
    (c) => c.listingId === listingId && c.buyerId === buyer.id
  );
  if (existing) {
    res.json({ conversationId: existing.id, exists: true });
    return;
  }

  const msg: Message = {
    id: randomUUID(),
    senderId: buyer.id,
    senderName: buyer.username,
    senderAvatar: buyer.avatar ?? null,
    content: filter.filtered,
    timestamp: new Date().toISOString(),
    filtered: !filter.clean,
  };

  const conv: Conversation = {
    id: randomUUID(),
    listingId,
    listingTitle,
    buyerId: buyer.id,
    buyerName: buyer.username,
    buyerAvatar: buyer.avatar ?? null,
    sellerId,
    sellerName,
    sellerAvatar,
    messages: [msg],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readBy: [buyer.id],
  };

  convs.push(conv);
  saveConversations(convs);

  notifySellerDM(sellerId, buyer.username, listingTitle, filter.filtered);

  res.status(201).json({ conversationId: conv.id, exists: false });
});

router.get("/messages/:conversationId", requireSession, (req: any, res: any) => {
  const userId = req.session.discordUser.id;
  const convs = loadConversations();
  const idx = convs.findIndex((c) => c.id === req.params.conversationId);
  if (idx === -1) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const conv = convs[idx]!;
  if (conv.buyerId !== userId && conv.sellerId !== userId) {
    res.status(403).json({ error: "Access denied." });
    return;
  }
  if (!conv.readBy.includes(userId)) {
    conv.readBy.push(userId);
    convs[idx] = conv;
    saveConversations(convs);
  }
  res.json(conv);
});

router.post("/messages/:conversationId", requireSession, async (req: any, res: any) => {
  const userId = req.session.discordUser.id;
  const { content } = req.body as { content: string };

  if (!content?.trim()) {
    res.status(400).json({ error: "Message cannot be empty." });
    return;
  }

  const filter = filterContent(content.trim());

  const convs = loadConversations();
  const idx = convs.findIndex((c) => c.id === req.params.conversationId);
  if (idx === -1) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const conv = convs[idx]!;
  if (conv.buyerId !== userId && conv.sellerId !== userId) {
    res.status(403).json({ error: "Access denied." });
    return;
  }

  const sender = req.session.discordUser;
  const msg: Message = {
    id: randomUUID(),
    senderId: userId,
    senderName: sender.username,
    senderAvatar: sender.avatar ?? null,
    content: filter.filtered,
    timestamp: new Date().toISOString(),
    filtered: !filter.clean,
  };

  conv.messages.push(msg);
  conv.updatedAt = new Date().toISOString();
  conv.readBy = [userId];
  convs[idx] = conv;
  saveConversations(convs);

  const recipientId = userId === conv.buyerId ? conv.sellerId : conv.buyerId;
  const recipientName = userId === conv.buyerId ? conv.sellerName : conv.buyerName;
  notifySellerDM(recipientId, sender.username, conv.listingTitle, filter.filtered);

  res.status(201).json(msg);
});

export default router;
