import { NextResponse } from "next/server";
import { eq, lt } from "drizzle-orm";
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
  const old = await db.select().from(entries).where(lt(entries.updatedAt, cutoff));
  let pruned = 0;
  for (const e of old) {
    if (e.audioPresent) {
      try {
        await deleteAudio(e.userId, e.id);
        await db
          .update(entries)
          .set({ audioPath: null, audioPresent: false })
          .where(eq(entries.id, e.id));
        pruned++;
      } catch (err) {
        console.error("Retention prune failed for entry", e.id, err);
      }
    }
  }
  return NextResponse.json({ ok: true, pruned });
}
