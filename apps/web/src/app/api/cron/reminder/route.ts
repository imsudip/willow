import { NextResponse } from "next/server";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { entries, prompts, user } from "@/lib/db/schema";
import { sendToUser } from "@/lib/services/push";
import { generatePrompts } from "@/lib/services/prompts";
import { dateKeyInZone, startOfDayInZone } from "@/lib/timezone";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
// All cron endpoints require the shared secret (GitHub Actions sends it as a
// Bearer token) so random internet traffic can't trigger pushes.
function authorized(req: Request) {
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

// POST /api/cron/reminder — evening reminder to users with no entry today
export async function POST(req: Request) {
  if (!authorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startOfDay = startOfDayInZone(new Date(), env.CRON_TIMEZONE);

  const users = await db.select().from(user);
  let sent = 0;
  for (const u of users) {
    const today = await db
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(
          eq(entries.userId, u.id),
          gte(entries.recordedAt, startOfDay),
          isNull(entries.deletedAt),
        ),
      )
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
  return NextResponse.json({ ok: true, sent });
}
