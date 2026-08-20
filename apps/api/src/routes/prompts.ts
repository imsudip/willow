import { Hono } from "hono";
import { and, eq, lt, desc, isNull } from "drizzle-orm";
import { CONTEXT_BODY_CHARS, PROMPT_COUNT } from "@willow/shared";
import { db } from "../db/index.js";
import { entries, prompts } from "../db/schema.js";
import { getSessionUser } from "../lib/auth-helpers.js";
import { generatePrompts, FALLBACK_PROMPTS } from "../services/prompts.js";

export const promptsRoutes = new Hono();

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(date: Date) {
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

promptsRoutes.get("/daily", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const key = todayKey();

  // Cache per user + date
  const cached = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.userId, user.id), eq(prompts.date, key)))
    .limit(1);
  if (cached.length > 0) {
    return c.json({ questions: cached[0].questions.slice(0, PROMPT_COUNT) });
  }

  // Build history context from non-deleted entries
  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, user.id), isNull(entries.deletedAt)))
    .orderBy(desc(entries.recordedAt))
    .limit(10);

  const history = rows.map((r) => ({
    title: r.title,
    mood: r.mood,
    tags: r.tags ?? [],
    excerpt: (r.cleanedBody || r.rawTranscript).slice(0, CONTEXT_BODY_CHARS),
    daysAgo: daysAgo(r.recordedAt),
  }));

  const { questions } = await generatePrompts(history);
  const toStore = questions.slice(0, PROMPT_COUNT);

  await db.insert(prompts).values({
    id: crypto.randomUUID(),
    userId: user.id,
    date: key,
    questions: toStore,
  });

  return c.json({ questions: toStore });
});

// Expire cached prompts older than a few days (simple cleanup)
promptsRoutes.delete("/cleanup", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  await db
    .delete(prompts)
    .where(and(eq(prompts.userId, user.id), lt(prompts.createdAt, cutoff)));
  return c.json({ ok: true });
});
