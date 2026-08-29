import { NextResponse } from "next/server";
import { and, eq, lt, desc, isNull } from "drizzle-orm";
import { CONTEXT_BODY_CHARS, PROMPT_COUNT } from "@willow/shared";
import { db } from "@/lib/db/index";
import { entries, prompts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";
import { dateKeyInZone } from "@/lib/timezone";
import { env } from "@/lib/env";
import { generatePrompts, FALLBACK_PROMPTS } from "@/lib/services/prompts";

export const dynamic = "force-dynamic";

function todayKey() {
  return dateKeyInZone(new Date(), env.CRON_TIMEZONE);
}

function daysAgo(date: Date) {
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// GET /api/prompts/daily — cached per-user, per-date AI prompts
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = todayKey();

  const cached = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.userId, user.id), eq(prompts.date, key)))
    .limit(1);
  if (cached.length > 0) {
    return NextResponse.json({ questions: cached[0].questions.slice(0, PROMPT_COUNT) });
  }

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

  return NextResponse.json({ questions: toStore });
}
