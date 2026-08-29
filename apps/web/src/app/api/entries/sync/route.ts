import { NextResponse } from "next/server";
import { and, eq, gt, desc } from "drizzle-orm";
import { syncPullSchema, syncPushSchema } from "@willow/shared";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

function toApiEntry(row: typeof entries.$inferSelect) {
  return {
    id: row.id,
    recordedAt: new Date(row.recordedAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    audioPresent: row.audioPresent,
    audioDurationMs: row.audioDurationMs,
    rawTranscript: row.rawTranscript,
    cleanedBody: row.cleanedBody,
    title: row.title,
    mood: row.mood,
    tags: row.tags ?? [],
    status: row.status,
    errorMessage: row.errorMessage,
    deleted: row.deletedAt !== null,
    serverAudioUrl: row.audioPath ? `/api/entries/${row.id}/audio` : null,
  };
}

// POST /api/entries/sync — push dirty entries from the client
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = syncPushSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );

  const now = new Date();
  const accepted: string[] = [];

  for (const e of parsed.data.entries) {
    // Scope by userId too: an id owned by another user must never be
    // overwritten or transferred (see the ownership guard below).
    const existing = await db
      .select()
      .from(entries)
      .where(and(eq(entries.id, e.id), eq(entries.userId, user.id)))
      .limit(1);

    // audioPresent on the client means "blob exists locally", not "server has
    // it". Only persist it when the client also reports a completed server
    // upload (serverAudioUrl set).
    const audioPresent = e.audioPresent && e.serverAudioUrl !== null;

    const values = {
      id: e.id,
      userId: user.id,
      recordedAt: new Date(e.recordedAt),
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      audioPresent,
      audioDurationMs: e.audioDurationMs,
      rawTranscript: e.rawTranscript,
      cleanedBody: e.cleanedBody,
      title: e.title,
      mood: e.mood,
      tags: e.tags,
      status: e.status,
      errorMessage: e.errorMessage,
      deletedAt: e.deleted ? now : null,
      updatedAtEpochMs: new Date(e.updatedAt).getTime(),
    };

    if (existing.length === 0) {
      // The id may belong to another user (the scoped lookup above returned
      // nothing) — or a concurrent request may have just inserted it. Use an
      // atomic INSERT ... ON CONFLICT DO NOTHING so a primary-key collision
      // is a no-op, never an overwrite or a 500. The ownership merge path for
      // same-user conflicts is handled by the update branch below.
      const inserted = await db
        .insert(entries)
        .values(values)
        .onConflictDoNothing({ target: entries.id })
        .returning({ id: entries.id });
      if (inserted.length > 0) accepted.push(e.id);
    } else {
      const incoming = new Date(e.updatedAt).getTime();
      if (incoming >= existing[0].updatedAt.getTime()) {
        await db
          .update(entries)
          .set(values)
          .where(and(eq(entries.id, e.id), eq(entries.userId, user.id)));
        accepted.push(e.id);
      }
    }
  }

  return NextResponse.json({ accepted });
}

// GET /api/entries/sync — pull changes since a timestamp
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = syncPullSchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  const since = q.success && q.data.since ? new Date(q.data.since) : new Date(0);

  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, user.id), gt(entries.updatedAt, since)))
    .orderBy(desc(entries.updatedAt))
    .limit(200);

  return NextResponse.json({ entries: rows.map(toApiEntry) });
}
