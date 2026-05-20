import "dotenv/config";
import app from "./app";
import { startBot } from "./bot";
import { startCatalogUpdater } from "./catalogUpdater";

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

startCatalogUpdater();

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});

startBot().catch((err) => {
  console.error("Bot failed to start:", err);
});
