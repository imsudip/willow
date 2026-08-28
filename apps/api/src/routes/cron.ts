import { Hono } from "hono";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { entries, prompts, user } from "../db/schema.js";
import { sendToUser } from "../services/push.js";
import { generatePrompts } from "../services/prompts.js";
import { SERVER_AUDIO_RETENTION_DAYS } from "@willow/shared";
import { deleteAudio } from "../lib/r2.js";
import { dateKeyInZone, startOfDayInZone } from "../lib/timezone.js";
import { env } from "../env.js";

export const cronRoutes = new Hono();

// All cron endpoints require the shared secret so random internet traffic
// can't trigger pushes. GitHub Actions sends it as a Bearer token.
function authorized(c: { req: { header: (n: string) => string | undefined } }) {
  return c.req.header("authorization") === `Bearer ${env.CRON_SECRET}`;
}

// Evening reminder: users with no entry today.
cronRoutes.post("/reminder", async (c) => {
  if (!authorized(c)) return c.json({ error: "Unauthorized" }, 401);

  // "Today" must be computed in the same timezone the workflow schedules in
  // (CRON_TIMEZONE, default Asia/Kolkata) or the reminder fires on the wrong
  // day near midnight.
  const startOfDay = startOfDayInZone(new Date(), env.CRON_TIMEZONE);

  const users = await db.select().from(user);
  let sent = 0;
  for (const u of users) {
    const today = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.userId, u.id), gte(entries.recordedAt, startOfDay), isNull(entries.deletedAt)))
      .limit(1);
    if (today.length > 0) continue;

    let body = "Time for your evening ramble?";
    const key = dateKeyInZone(new Date(), env.CRON_TIMEZONE);
    const cached = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.userId, u.id), eq(prompts.date, key)))
      .limit(1);
    if (cached.length > 0 && cached[0].questions.length > 0) {
      body = cached[0].questions[0].question;
    }
    sent += await sendToUser(u.id, { title: "Willow", body, url: "/" });
  }
  return c.json({ ok: true, sent });
});

// Weekly digest: every Sunday evening.
cronRoutes.post("/digest", async (c) => {
  if (!authorized(c)) return c.json({ error: "Unauthorized" }, 401);

  const users = await db.select().from(user);
  let sent = 0;
  for (const u of users) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const count = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.userId, u.id), gte(entries.recordedAt, weekAgo), isNull(entries.deletedAt)));
    if (count.length === 0) continue;
    sent += await sendToUser(u.id, {
      title: "Your week in Willow",
      body: `${count.length} entries this week. Your digest is ready.`,
      url: "/stats",
    });
  }
  return c.json({ ok: true, sent });
});

// Audio retention: prune server-side audio files older than N days.
cronRoutes.post("/retention", async (c) => {
  if (!authorized(c)) return c.json({ error: "Unauthorized" }, 401);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SERVER_AUDIO_RETENTION_DAYS);
  const old = await db
    .select()
    .from(entries)
    .where(lt(entries.updatedAt, cutoff));
  let pruned = 0;
  for (const e of old) {
    if (e.audioPresent) {
      try {
        await deleteAudio(e.userId, e.id);
        await db.update(entries).set({ audioPath: null, audioPresent: false }).where(eq(entries.id, e.id));
        pruned++;
      } catch (err) {
        console.error("Retention prune failed for entry", e.id, err);
      }
    }
  }
  return c.json({ ok: true, pruned });
});
