import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { env } from "./env.js";
import { closeDb } from "./db/bootstrap.js";

const wss = new WebSocketServer({ noServer: true });

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
    websocket: { server: wss },
  },
  (info) => {
    console.log(`Willow API listening on http://localhost:${info.port}`);
  },
);

function shutdown() {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
