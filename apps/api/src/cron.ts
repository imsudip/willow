import cron from "node-cron";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "./db/index.js";
import { entries, prompts, pushSubscriptions, user } from "./db/schema.js";
import { env, isPushConfigured } from "./env.js";
import { sendToUser } from "./services/push.js";
import { generatePrompts } from "./services/prompts.js";
import { SERVER_AUDIO_RETENTION_DAYS } from "@willow/shared";
import { unlinkSync, existsSync } from "node:fs";

export function startCron() {
  if (!isPushConfigured) {
    console.log("Push not configured — reminders and digests disabled.");
    return;
  }

  // Evening reminder: only for users with no entry today.
  cron.schedule(env.REMINDER_CRON, async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const users = await db.select().from(user);
      for (const u of users) {
        const today = await db
          .select({ id: entries.id })
          .from(entries)
          .where(and(eq(entries.userId, u.id), gte(entries.recordedAt, startOfDay), isNull(entries.deletedAt)))
          .limit(1);
        if (today.length > 0) continue;

        // Include a personalized question in the reminder when available
        let body = "Time for your evening ramble?";
        const key = dateKey(new Date());
        const cached = await db
          .select()
          .from(prompts)
          .where(and(eq(prompts.userId, u.id), eq(prompts.date, key)))
          .limit(1);
        if (cached.length > 0 && cached[0].questions.length > 0) {
          body = cached[0].questions[0].question;
        }
        await sendToUser(u.id, { title: "Willow", body, url: "/" });
      }
    } catch (err) {
      console.error("Reminder cron failed:", err);
    }
  });

  // Weekly digest: every Sunday evening.
  cron.schedule("0 19 * * 0", async () => {
    try {
      const users = await db.select().from(user);
      for (const u of users) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const count = await db
          .select({ id: entries.id })
          .from(entries)
          .where(and(eq(entries.userId, u.id), gte(entries.recordedAt, weekAgo), isNull(entries.deletedAt)));
        if (count.length === 0) continue;
        await sendToUser(u.id, {
          title: "Your week in Willow",
          body: `${count.length} entries this week. Your digest is ready.`,
          url: "/stats",
        });
      }
    } catch (err) {
      console.error("Digest cron failed:", err);
    }
  });

  // Audio retention: prune server-side audio files older than N days.
  cron.schedule("30 4 * * *", async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - SERVER_AUDIO_RETENTION_DAYS);
      const old = await db
        .select()
        .from(entries)
        .where(lt(entries.updatedAt, cutoff));
      for (const e of old) {
        if (e.audioPath && existsSync(e.audioPath)) {
          unlinkSync(e.audioPath);
          await db.update(entries).set({ audioPath: null, audioPresent: false }).where(eq(entries.id, e.id));
        }
      }
    } catch (err) {
      console.error("Retention cron failed:", err);
    }
  });

  console.log("Cron started (reminders, digests, retention).");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
