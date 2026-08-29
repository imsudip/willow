import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { entries } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";
import { openaiClientFor } from "@/lib/services/openai";
import { transcribeAudioFile } from "@/lib/services/transcription";
import { r2, audioKey } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
// Transcription waits on OpenAI; allow the 5-minute Hobby ceiling.
export const maxDuration = 300;

const transcribeBodySchema = z.object({
  entryId: z.string().uuid(),
});

/**
 * POST /api/transcribe — transcribe an entry's audio.
 *
 * REWORKED for Vercel: the client uploads the audio straight to R2 (presigned
 * PUT, no request-body limit), then calls this with just { entryId }. The
 * Route Handler fetches the blob from R2 server-side and sends it to OpenAI —
 * never through the function's request body (which Vercel caps at 4.5 MB).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve the OpenAI key: the user's BYO key, else the app default.
  const client = await openaiClientFor(user.id);
  if (!client)
    return NextResponse.json(
      { error: "Transcription is not configured" },
      { status: 503 },
    );

  const body = await req.json().catch(() => null);
  const parsed = transcribeBodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Missing or invalid entryId" }, { status: 400 });

  const row = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.id, parsed.data.entryId),
        eq(entries.userId, user.id),
      ),
    )
    .limit(1);
  if (row.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // Pull the audio object back from R2 (server-side subrequest).
    let get;
    try {
      get = await r2.send(
        new GetObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: audioKey(user.id, row[0].id),
        }),
      );
    } catch (err) {
      // The S3 client throws NoSuchKey for a missing object (it doesn't
      // resolve with an undefined Body). Only a missing object is a 409 —
      // rethrow access/credential/network failures so they reach the outer
      // 502 handler.
      if (err instanceof Error && err.name === "NoSuchKey") {
        return NextResponse.json(
          { error: "Audio not found on storage" },
          { status: 409 },
        );
      }
      throw err;
    }
    if (!get.Body) {
      return NextResponse.json(
        { error: "Audio not found on storage" },
        { status: 409 },
      );
    }

    // transformToByteArray returns Uint8Array<ArrayBufferLike>; copy into a
    // plain ArrayBuffer so it's a valid BlobPart/File source.
    const bytes = await get.Body.transformToByteArray();
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const file = new File([buffer], "recording.webm", { type: "audio/webm" });
    const transcript = await transcribeAudioFile(file, client.apiKey);
    return NextResponse.json({ transcript });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 502 },
    );
  }
}
