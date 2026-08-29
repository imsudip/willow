import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { SERVER_AUDIO_RETENTION_DAYS } from "@willow/shared";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { deleteAudio } from "@/lib/r2";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

// POST /api/cron/retention — prune server-side audio older than N days
export async function POST(req: Request) {
  if (!authorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SERVER_AUDIO_RETENTION_DAYS);
  const old = await db
    .select({ id: entries.id, userId: entries.userId })
    .from(entries)
    .where(and(lt(entries.updatedAt, cutoff), eq(entries.audioPresent, true)))
    .limit(500);
  const now = new Date();
  let pruned = 0;
  for (const e of old) {
    try {
      await deleteAudio(e.userId, e.id);
      // Bump updatedAt so GET /api/entries/sync propagates the audio removal.
      await db
        .update(entries)
        .set({
          audioPath: null,
          audioPresent: false,
          updatedAt: now,
          updatedAtEpochMs: now.getTime(),
        })
        .where(eq(entries.id, e.id));
      pruned++;
    } catch (err) {
      console.error("Retention prune failed for entry", e.id, err);
    }
  }
  return NextResponse.json({ ok: true, pruned });
}
