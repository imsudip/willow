import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

// GET /api/entries/:id — single entry (scoped to the user)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(toApiEntry(row[0]));
}
