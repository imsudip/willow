import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";
import { audioObjectSize } from "@/lib/r2";

export const dynamic = "force-dynamic";

// POST /api/entries/:id/audio-complete — confirms the blob landed in R2 with
// the authorized size, then marks the entry as having audio.
export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => null);
  const byteLength = (body as { size?: unknown } | null)?.size;
  if (
    typeof byteLength !== "number" ||
    !Number.isInteger(byteLength) ||
    byteLength <= 0
  ) {
    return NextResponse.json({ error: "Missing or invalid size" }, { status: 400 });
  }

  const storedSize = await audioObjectSize(user.id, row[0].id);
  if (storedSize === null) {
    return NextResponse.json(
      { error: "Upload not found on storage — try again." },
      { status: 409 },
    );
  }
  if (storedSize !== byteLength) {
    return NextResponse.json(
      { error: "Upload size mismatch — try again." },
      { status: 409 },
    );
  }

  await db
    .update(entries)
    .set({
      audioPresent: true,
      audioPath: `r2://${user.id}/${row[0].id}.webm`,
      updatedAt: new Date(),
    })
    .where(eq(entries.id, row[0].id));
  return NextResponse.json({ ok: true });
}
