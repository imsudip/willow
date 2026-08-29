import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { CONTEXT_BODY_CHARS } from "@willow/shared";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";
import { generateWeeklyDigest } from "@/lib/services/digest";

export const dynamic = "force-dynamic";

// GET /api/digest/weekly
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, user.id),
        isNull(entries.deletedAt),
        gte(entries.recordedAt, weekAgo),
      ),
    )
    .orderBy(desc(entries.recordedAt))
    .limit(50);

  if (rows.length === 0) {
    return NextResponse.json({ digest: null, entryCount: 0 });
  }

  const context = rows.map((r) => ({
    title: r.title,
    mood: r.mood,
    tags: r.tags ?? [],
    excerpt: (r.cleanedBody || r.rawTranscript).slice(0, CONTEXT_BODY_CHARS),
  }));

  try {
    const digest = await generateWeeklyDigest(user.id, context);
    return NextResponse.json({ digest, entryCount: rows.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Digest failed" },
      { status: 502 },
    );
  }
}
