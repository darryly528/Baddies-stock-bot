import app from "./app";
import { startBot } from "./bot";
import { startCatalogUpdater } from "./catalogUpdater";

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

console.log("[env] DISCORD_CLIENT_ID present:", !!process.env["DISCORD_CLIENT_ID"]);
console.log("[env] DISCORD_CLIENT_SECRET present:", !!process.env["DISCORD_CLIENT_SECRET"]);

startCatalogUpdater();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

startBot().catch((err) => {
  console.error("Bot failed to start:", err);
});
