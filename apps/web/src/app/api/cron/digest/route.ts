import { NextResponse } from "next/server";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { entries, user } from "@/lib/db/schema";
import { sendToUser } from "@/lib/services/push";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

// POST /api/cron/digest — weekly digest push (Sunday evening)
export async function POST(req: Request) {
  if (!authorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await db.select().from(user);
  let sent = 0;
  for (const u of users) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const count = await db
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(
          eq(entries.userId, u.id),
          gte(entries.recordedAt, weekAgo),
          isNull(entries.deletedAt),
        ),
      );
    if (count.length === 0) continue;
    sent += await sendToUser(u.id, {
      title: "Your week in Willow",
      body: `${count.length} entries this week. Your digest is ready.`,
      url: "/stats",
    });
  }
  return NextResponse.json({ ok: true, sent });
}
