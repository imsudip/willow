import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { getSessionUser } from "../lib/auth-helpers.js";
import { subscribe, unsubscribe } from "../services/push.js";

export const pushRoutes = new Hono();

const pushSubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

pushRoutes.post("/subscribe", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = pushSubSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid subscription" }, 400);

  await subscribe(user.id, parsed.data);
  return c.json({ ok: true });
});

pushRoutes.delete("/subscribe", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return c.json({ error: "Missing endpoint" }, 400);

  await unsubscribe(user.id, endpoint);
  return c.json({ ok: true });
});
