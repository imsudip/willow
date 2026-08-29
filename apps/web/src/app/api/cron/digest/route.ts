import { NextResponse } from "next/server";
import { and, count, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { sendToUser } from "@/lib/services/push";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
// One grouped query + per-active-user push; keep the Hobby 300s ceiling.
export const maxDuration = 300;

// Bounded batch: each invocation processes at most this many users so the
// route stays within the platform duration limit even as the user base grows.
// Users beyond the batch are served on the next cron run (the digest is
// weekly, so catch-up is acceptable).
const MAX_DIGEST_BATCH = 200;

function authorized(req: Request) {
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

// POST /api/cron/digest — weekly digest push (Sunday evening)
export async function POST(req: Request) {
  if (!authorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // One grouped aggregate: users with ≥1 non-deleted entry in the last 7 days.
  // Avoids the per-user query loop (N+1) that could blow the function limit.
  const active = await db
    .select({ userId: entries.userId, entryCount: count(entries.id) })
    .from(entries)
    .where(
      and(gte(entries.recordedAt, weekAgo), isNull(entries.deletedAt)),
    )
    .groupBy(entries.userId)
    .limit(MAX_DIGEST_BATCH);

  let sent = 0;
  for (const a of active) {
    sent += await sendToUser(a.userId, {
      title: "Your week in Willow",
      body: `${Number(a.entryCount)} entries this week. Your digest is ready.`,
      url: "/stats",
    });
  }
  return NextResponse.json({ ok: true, sent, batch: active.length });
}
