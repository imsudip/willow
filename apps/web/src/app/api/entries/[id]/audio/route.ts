import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";
import { createDownloadUrl, deleteAudio } from "@/lib/r2";

export const dynamic = "force-dynamic";

// GET /api/entries/:id/audio — presigned R2 GET URL for playback
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
  if (row.length === 0 || !row[0].audioPresent)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await createDownloadUrl(user.id, row[0].id);
  return NextResponse.json({ url });
}

// DELETE /api/entries/:id/audio — delete the audio object + clear the flag
export async function DELETE(
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
  if (row.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteAudio(user.id, row[0].id);
  // Bump updatedAt so GET /api/entries/sync propagates the audio removal.
  const now = new Date();
  await db
    .update(entries)
    .set({
      audioPath: null,
      audioPresent: false,
      updatedAt: now,
      updatedAtEpochMs: now.getTime(),
    })
    .where(eq(entries.id, row[0].id));
  return NextResponse.json({ ok: true });
}
