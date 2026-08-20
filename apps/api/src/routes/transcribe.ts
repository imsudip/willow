import { Hono } from "hono";
import { z } from "zod";
import { MAX_AUDIO_BYTES } from "@willow/shared";
import { getSessionUser } from "../lib/auth-helpers.js";
import { transcribeAudioFile } from "../services/transcription.js";
import { cleanupTranscript } from "../services/cleanup.js";
import { aiAvailable } from "../services/openai.js";

export const transcribeRoutes = new Hono();

// POST /api/transcribe — upload an audio blob, get back the transcript.
// Multipart: { file: Blob }
transcribeRoutes.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!aiAvailable()) return c.json({ error: "Transcription is not configured" }, 503);

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") return c.json({ error: "Missing file" }, 400);
  if (file.size > MAX_AUDIO_BYTES) return c.json({ error: "File too large" }, 413);

  try {
    const transcript = await transcribeAudioFile(file);
    return c.json({ transcript });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      502,
    );
  }
});

const cleanupBodySchema = z.object({
  transcript: z.string().min(1).max(50_000),
});

// POST /api/cleanup — turn a raw transcript into title/body/mood/tags.
// Used when the client saved an entry without server-side cleanup.
transcribeRoutes.post("/cleanup", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!aiAvailable()) return c.json({ error: "Cleanup is not configured" }, 503);

  const body = await c.req.json().catch(() => null);
  const parsed = cleanupBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid transcript" }, 400);

  try {
    const cleaned = await cleanupTranscript(parsed.data.transcript);
    return c.json(cleaned);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      502,
    );
  }
});
