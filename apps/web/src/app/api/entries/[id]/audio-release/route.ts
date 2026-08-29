import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { releaseUploadQuota } from "@/lib/r2";

export const dynamic = "force-dynamic";

// POST /api/entries/:id/audio-release — releases the user's most recent quota
// reservation (called when the presigned PUT or completion fails). Best-effort
// and idempotent.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await releaseUploadQuota(user.id);
  return NextResponse.json({ ok: true });
}
