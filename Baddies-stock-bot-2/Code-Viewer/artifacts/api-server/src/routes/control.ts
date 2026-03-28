import { Router } from "express";

const router = Router();

router.post("/control", (req, res) => {
  const BOT_SECRET = process.env["BOT_SECRET"];
  if (!BOT_SECRET) {
    res.status(500).send("BOT_SECRET not configured");
    return;
  }

  const { action, key } = req.body as { action?: string; key?: string };

  if (key !== BOT_SECRET) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (action === "restart") {
    res.send("Bot restarting...");
    setTimeout(() => process.exit(0), 100);
  } else if (action === "status") {
    res.send("Bot is online ✅");
  } else {
    res.send("Unknown action");
  }
});

export default router;
