import { Hono } from "hono";
import { getSessionUser } from "../lib/auth-helpers.js";
import { db } from "../db/index.js";
import { entries } from "../db/schema.js";
import { eq, and, gt, desc, isNull } from "drizzle-orm";
import { syncPullSchema, syncPushSchema } from "@willow/shared";
import { env } from "../env.js";
import { createDownloadUrl, deleteAudio, createUploadUrl, getBucketUsageBytes, assertUploadQuota, releaseUploadQuota, audioObjectSize } from "../lib/r2.js";

export const entriesRoutes = new Hono();

// Helper: serialize a DB row to the API entry shape.
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

// ---- Sync: push dirty entries from the client ----
entriesRoutes.post("/sync", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = syncPushSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);

  const now = new Date();
  const accepted: string[] = [];

  for (const e of parsed.data.entries) {
    const existing = await db.select().from(entries).where(eq(entries.id, e.id)).limit(1);

    // audioPresent on the client means "blob exists locally", not "server
    // has it". Only persist it when the client also reports a completed
    // server upload (serverAudioUrl set); otherwise the entry could be
    // marked as having server-side audio before the R2 upload finished.
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
      await db.insert(entries).values(values);
      accepted.push(e.id);
    } else {
      // Last-write-wins on updatedAt
      const incoming = new Date(e.updatedAt).getTime();
      if (incoming >= existing[0].updatedAt.getTime()) {
        await db.update(entries).set(values).where(eq(entries.id, e.id));
        accepted.push(e.id);
      }
    }
  }

  return c.json({ accepted });
});

// ---- Sync: pull changes since a timestamp ----
entriesRoutes.get("/sync", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const q = syncPullSchema.safeParse(c.req.query());
  const since = q.success && q.data.since ? new Date(q.data.since) : new Date(0);

  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, user.id), gt(entries.updatedAt, since)))
    .orderBy(desc(entries.updatedAt))
    .limit(200);

  return c.json({ entries: rows.map(toApiEntry) });
});

// ---- Pull single entry ----
entriesRoutes.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, c.req.param("id")), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0) return c.json({ error: "Not found" }, 404);

  return c.json(toApiEntry(row[0]));
});

// ---- List entries (non-deleted) ----
entriesRoutes.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, user.id), isNull(entries.deletedAt)))
    .orderBy(desc(entries.recordedAt))
    .limit(500);

  return c.json({ entries: rows.map(toApiEntry) });
});

// ---- Audio upload / download ----

// The client first calls POST /api/entries/:id/audio-url to get a presigned
// R2 PUT URL (gated by the 9.9GB bucket cap + daily per-user limit), uploads
// straight to R2, then calls POST /api/entries/:id/audio-complete so the
// entry is only marked as having audio once the object actually exists.
entriesRoutes.post("/:id/audio-url", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, c.req.param("id")), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0) return c.json({ error: "Not found" }, 404);

  // The client declares the exact blob size; validate it before signing.
  const body = await c.req.json().catch(() => null);
  const byteLength = (body as { size?: unknown } | null)?.size;
  if (typeof byteLength !== "number" || !Number.isInteger(byteLength) || byteLength <= 0) {
    return c.json({ error: "Missing or invalid size" }, 400);
  }
  if (byteLength > env.MAX_AUDIO_UPLOAD_BYTES) {
    return c.json({ error: "Recording too large." }, 413);
  }

  // Free-tier storage gate
  try {
    const usage = await getBucketUsageBytes();
    if (usage >= env.R2_STORAGE_LIMIT_BYTES) {
      return c.json({ error: "Audio storage is full — no more recordings can be saved right now." }, 507);
    }
  } catch (err) {
    console.error("R2 usage check failed:", err);
    // Fail closed: don't hand out upload URLs when we can't verify capacity.
    return c.json({ error: "Storage check unavailable — try again shortly." }, 503);
  }

  // Per-user daily upload quota
  const ok = await assertUploadQuota(user.id);
  if (!ok) return c.json({ error: "Daily recording limit reached (50/day)." }, 429);

  try {
    const url = await createUploadUrl(user.id, row[0].id, byteLength);
    return c.json({ uploadUrl: url });
  } catch (err) {
    console.error("Failed to mint upload URL:", err);
    // Don't leave a reserved quota slot behind if minting failed.
    await releaseUploadQuota(user.id);
    return c.json({ error: "Could not prepare upload — try again." }, 500);
  }
});

// Confirms the blob landed in R2 with the authorized size, then marks the
// entry as having audio. Called by the client after the presigned PUT.
entriesRoutes.post("/:id/audio-complete", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, c.req.param("id")), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const byteLength = (body as { size?: unknown } | null)?.size;
  if (typeof byteLength !== "number" || !Number.isInteger(byteLength) || byteLength <= 0) {
    return c.json({ error: "Missing or invalid size" }, 400);
  }

  const storedSize = await audioObjectSize(user.id, row[0].id);
  if (storedSize === null) {
    return c.json({ error: "Upload not found on storage — try again." }, 409);
  }
  if (storedSize !== byteLength) {
    return c.json({ error: "Upload size mismatch — try again." }, 409);
  }

  await db
    .update(entries)
    .set({ audioPresent: true, audioPath: `r2://${user.id}/${row[0].id}.webm`, updatedAt: new Date() })
    .where(eq(entries.id, row[0].id));
  return c.json({ ok: true });
});

// Releases the user's most recent quota reservation (called by the client
// when the presigned PUT or completion fails, so retries don't consume
// multiple daily slots). Best-effort and idempotent.
entriesRoutes.post("/:id/audio-release", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  await releaseUploadQuota(user.id);
  return c.json({ ok: true });
});

entriesRoutes.delete("/:id/audio", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, c.req.param("id")), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0) return c.json({ error: "Not found" }, 404);

  await deleteAudio(user.id, row[0].id);
  await db.update(entries).set({ audioPath: null, audioPresent: false }).where(eq(entries.id, row[0].id));
  return c.json({ ok: true });
});

// GET /:id/audio now returns a presigned R2 GET URL instead of streaming from disk.
entriesRoutes.get("/:id/audio", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, c.req.param("id")), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0 || !row[0].audioPresent) return c.json({ error: "Not found" }, 404);

  const url = await createDownloadUrl(user.id, row[0].id);
  return c.json({ url });
});
