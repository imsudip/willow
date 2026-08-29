import { client } from "./api";
import { db } from "./db";
import type { Entry } from "@willow/shared";

let running = false;

/** Push dirty entries to the server, pull changes, upload missing audio. */
export async function syncNow(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!navigator.onLine) return;

    // Push dirty entries (filter in JS: `dirty` may be stored as true or 1)
    const all = await db.entries.toArray();
    const dirty = all.filter((e) => e.dirty);
    if (dirty.length > 0) {
      const payload = dirty.map(({ dirty: _d, ...e }) => e);
      const { accepted } = await client.syncPush(payload);
      const acceptedSet = new Set(accepted);
      for (const e of dirty) {
        if (acceptedSet.has(e.id)) {
          await db.entries.update(e.id, { dirty: false });
        }
      }
    }

    // Pull remote changes (entries created/edited on another device)
    const lastSync = await db.settings.get("lastSync");
    const since = (lastSync?.value as string) ?? undefined;
    const { entries: remote } = await client.syncPull(since);
    for (const r of remote) {
      const local = await db.entries.get(r.id);
      if (!local || new Date(r.updatedAt) > new Date(local.updatedAt)) {
        await db.entries.put(r as unknown as Entry);
      }
    }
    await db.settings.put({ key: "lastSync", value: new Date().toISOString() });

    // Upload audio blobs for entries that have local audio but no server copy.
    // (An entry is usually already synced by the time its blob lands, so this
    // is deliberately not gated on `dirty`.)
    const audioRows = await db.audio.toArray();
    for (const row of audioRows) {
      const e = await db.entries.get(row.entryId);
      if (e && e.audioPresent && e.serverAudioUrl === null) {
        try {
          await client.uploadAudio(e.id, row.blob);
          // Server has it now
          await db.entries.update(e.id, { serverAudioUrl: `/api/entries/${e.id}/audio` });
        } catch {
          /* will retry next sync */
          continue;
        }

        // The audio just landed on the server; if this is a deferred entry
        // (left in "error"/"transcribing" by a failed upload earlier), finish
        // the job — transcribe, then clean up — so it doesn't stay stuck in
        // "error" without a transcript.
        if (e.status === "error" || e.status === "transcribing") {
          await transcribeAndClean(e.id);
        }
      }
    }

    // Entries whose audio already reached the server but whose transcription
    // never completed (e.g. the RecordOverlay's transcribe step failed, or the
    // app closed mid-transcribe) are left in "error"/"transcribing". Resume
    // them here so they don't stay stuck without a transcript. (`serverAudioUrl`
    // isn't an indexed Dexie column, so this is a filter scan — fine for the
    // small local store.)
    const stalled = await db.entries
      .filter(
        (e) =>
          e.serverAudioUrl !== null &&
          (e.status === "error" || e.status === "transcribing"),
      )
      .toArray();
    for (const e of stalled) {
      await transcribeAndClean(e.id);
    }
  } finally {
    running = false;
  }
}

/** Transcribe a server-side entry, then run cleanup; sets status to "ready". */
async function transcribeAndClean(entryId: string): Promise<void> {
  const e = await db.entries.get(entryId);
  if (!e) return;
  try {
    const { transcript } = await client.transcribe(entryId);
    try {
      const cleaned = await client.cleanup(transcript);
      await db.entries.update(entryId, {
        rawTranscript: transcript,
        cleanedBody: cleaned.body,
        title: cleaned.title,
        mood: (cleaned.mood as Entry["mood"]) ?? null,
        tags: cleaned.tags,
        status: "ready",
        errorMessage: null,
        dirty: true,
      });
    } catch {
      // Keep the transcript; cleanup can be retried from review.
      await db.entries.update(entryId, {
        rawTranscript: transcript,
        status: "ready",
        errorMessage: null,
        dirty: true,
      });
    }
  } catch (err) {
    // Transcribe failed — keep it retryable next sync.
    await db.entries.update(entryId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Transcription failed",
      dirty: true,
    });
  }
}

/** Hook wiring: sync on mount, on reconnect, and on visibility change. */
export function startSyncEngine() {
  const run = () => void syncNow();
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
  // Initial sync shortly after load
  setTimeout(run, 1500);
}
