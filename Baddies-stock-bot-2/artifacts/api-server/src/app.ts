import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use("/api/*splat", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

const staticDir = process.env["STATIC_DIR"] ?? path.resolve(process.cwd(), "artifacts/baddies-store/dist");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
