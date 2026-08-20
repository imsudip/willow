import { Hono } from "hono";
import { getSessionUser } from "../lib/auth-helpers.js";
import { db } from "../db/index.js";
import { entries } from "../db/schema.js";
import { eq, and, gt, desc, isNull } from "drizzle-orm";
import { syncPullSchema, syncPushSchema, MAX_AUDIO_BYTES } from "@willow/shared";
import { saveAudioFile, readAudioFile } from "../lib/audio-store.js";
import { Readable } from "node:stream";

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

    const values = {
      id: e.id,
      userId: user.id,
      recordedAt: new Date(e.recordedAt),
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      audioPresent: e.audioPresent,
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

entriesRoutes.put("/:id/audio", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") return c.json({ error: "Missing file" }, 400);
  if (file.size > MAX_AUDIO_BYTES) return c.json({ error: "File too large" }, 413);

  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, c.req.param("id")), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0) return c.json({ error: "Not found" }, 404);

  const audioPath = await saveAudioFile(user.id, row[0].id, file);
  await db.update(entries).set({ audioPath, audioPresent: true }).where(eq(entries.id, row[0].id));
  return c.json({ ok: true });
});

entriesRoutes.get("/:id/audio", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const row = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, c.req.param("id")), eq(entries.userId, user.id)))
    .limit(1);
  if (row.length === 0 || !row[0].audioPath) return c.json({ error: "Not found" }, 404);

  const file = readAudioFile(row[0].audioPath);
  if (!file) return c.json({ error: "Not found" }, 404);

  const total = file.size;
  const range = c.req.header("range");
  const baseHeaders = {
    "Content-Type": "audio/webm",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
  };

  // Range request → 206 Partial Content so the browser can seek + show duration
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : total - 1;
      if (Number.isNaN(start) || Number.isNaN(end)) {
        return c.json({ error: "Invalid range" }, 416);
      }
      if (start > end || start >= total) {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
        });
      }
      end = Math.min(end, total - 1);
      const chunk = Readable.toWeb(file.stream({ start, end })) as unknown as ReadableStream;
      return new Response(chunk, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${total}`,
        },
      });
    }
  }

  return new Response(Readable.toWeb(file.stream()) as unknown as ReadableStream, {
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
});
