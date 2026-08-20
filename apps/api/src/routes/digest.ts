import { Hono } from "hono";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { CONTEXT_BODY_CHARS } from "@willow/shared";
import { db } from "../db/index.js";
import { entries } from "../db/schema.js";
import { getSessionUser } from "../lib/auth-helpers.js";
import { generateWeeklyDigest } from "../services/digest.js";

export const digestRoutes = new Hono();

digestRoutes.get("/weekly", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, user.id), isNull(entries.deletedAt), gte(entries.recordedAt, weekAgo)))
    .orderBy(desc(entries.recordedAt))
    .limit(50);

  if (rows.length === 0) {
    return c.json({ digest: null, entryCount: 0 });
  }

  const context = rows.map((r) => ({
    title: r.title,
    mood: r.mood,
    tags: r.tags ?? [],
    excerpt: (r.cleanedBody || r.rawTranscript).slice(0, CONTEXT_BODY_CHARS),
  }));

  const digest = await generateWeeklyDigest(context);
  return c.json({ digest, entryCount: rows.length });
});
