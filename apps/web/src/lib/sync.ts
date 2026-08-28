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
          if (e.serverAudioUrl === null) {
            await db.entries.update(e.id, { serverAudioUrl: `/api/entries/${e.id}/audio` });
          }
        } catch {
          /* will retry next sync */
        }
      }
    }
  } finally {
    running = false;
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
