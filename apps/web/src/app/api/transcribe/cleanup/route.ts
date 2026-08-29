import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth-helpers";
import { aiAvailable } from "@/lib/services/openai";
import { cleanupTranscript } from "@/lib/services/cleanup";

export const dynamic = "force-dynamic";

const cleanupBodySchema = z.object({
  transcript: z.string().min(1).max(50_000),
});

// POST /api/transcribe/cleanup — turn a raw transcript into title/body/mood/tags
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!aiAvailable())
    return NextResponse.json(
      { error: "Cleanup is not configured" },
      { status: 503 },
    );

  const body = await req.json().catch(() => null);
  const parsed = cleanupBodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid transcript" }, { status: 400 });

  try {
    const cleaned = await cleanupTranscript(parsed.data.transcript);
    return NextResponse.json(cleaned);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 502 },
    );
  }
}
