import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";

const PgStore = connectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionStore = process.env["DATABASE_URL"]
  ? new PgStore({
      conString: process.env["DATABASE_URL"],
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60,
    })
  : undefined;

app.use(
  session({
    store: sessionStore,
    secret: process.env["SESSION_SECRET"] ?? "baddies-store-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api", router);

app.use("/api/*splat", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

const staticDir = path.resolve(process.env["STATIC_DIR"] ?? path.join(process.cwd(), "artifacts/baddies-store/dist"));
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(200).send("OK");
  });
}

export default app;
