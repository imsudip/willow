import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import {
  createUploadUrl,
  getBucketUsageBytes,
  assertUploadQuota,
  releaseUploadQuota,
} from "@/lib/r2";

export const dynamic = "force-dynamic";

// POST /api/entries/:id/audio-url — mint a presigned R2 PUT URL (gated by the
// 9.9GB bucket cap + daily per-user limit)
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
  if (byteLength > env.MAX_AUDIO_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Recording too large." }, { status: 413 });
  }

  // Free-tier storage gate
  try {
    const usage = await getBucketUsageBytes();
    if (usage >= env.R2_STORAGE_LIMIT_BYTES) {
      return NextResponse.json(
        { error: "Audio storage is full — no more recordings can be saved right now." },
        { status: 507 },
      );
    }
  } catch (err) {
    console.error("R2 usage check failed:", err);
    return NextResponse.json(
      { error: "Storage check unavailable — try again shortly." },
      { status: 503 },
    );
  }

  // Per-user daily upload quota
  const ok = await assertUploadQuota(user.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Daily recording limit reached (50/day)." },
      { status: 429 },
    );
  }

  try {
    const url = await createUploadUrl(user.id, row[0].id, byteLength);
    return NextResponse.json({ uploadUrl: url });
  } catch (err) {
    console.error("Failed to mint upload URL:", err);
    await releaseUploadQuota(user.id);
    return NextResponse.json(
      { error: "Could not prepare upload — try again." },
      { status: 500 },
    );
  }
}
