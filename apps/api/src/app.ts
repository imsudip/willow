import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "./auth.js";
import { migrate } from "./db/bootstrap.js";
import { entriesRoutes } from "./routes/entries.js";
import { promptsRoutes } from "./routes/prompts.js";
import { pushRoutes } from "./routes/push.js";
import { digestRoutes } from "./routes/digest.js";
import { transcribeRoutes } from "./routes/transcribe.js";
import { cronRoutes } from "./routes/cron.js";
import { env } from "./env.js";

await migrate();

export const app = new Hono();
app.use("*", logger());

// Browser calls come from the Vercel frontend (or localhost in dev) when the
// API is served from Neon Functions. Allow credentials so session cookies work.
app.use(
  "/api/*",
  cors({
    origin: [env.PUBLIC_ORIGIN ?? "", "http://localhost:5173", "http://127.0.0.1:5173"].filter(Boolean),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/entries", entriesRoutes);
app.route("/api/prompts", promptsRoutes);
app.route("/api/push", pushRoutes);
app.route("/api/digest", digestRoutes);
app.route("/api/transcribe", transcribeRoutes);
app.route("/api/cron", cronRoutes);

app.get("/api/health", (c) => c.json({ ok: true }));

// Serve the built PWA (apps/web/dist) when present, with SPA fallback.
const webDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));

app.use(
  "*",
  serveStatic({
    root: webDist,
    rewriteRequestPath: (path) => (path.startsWith("/api") ? "/404.html" : path),
  }),
);
app.get("*", (c) => {
  // API routes that didn't match: real 404, not the SPA
  if (c.req.path.startsWith("/api")) return c.json({ error: "Not found" }, 404);
  // SPA fallback: serve index.html for client-side routes
  const indexPath = join(webDist, "index.html");
  if (!existsSync(indexPath)) return c.notFound();
  return new Response(readFileSync(indexPath), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

export default app;
