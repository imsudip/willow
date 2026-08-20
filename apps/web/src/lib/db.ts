import Dexie, { type Table } from "dexie";
import type { Entry } from "@willow/shared";

export interface AudioBlobRow {
  entryId: string;
  blob: Blob;
  createdAt: number;
}

export interface SettingsRow {
  key: string;
  value: unknown;
}

class WillowDB extends Dexie {
  entries!: Table<Entry, string>;
  audio!: Table<AudioBlobRow, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super("willow");
    this.version(1).stores({
      entries: "id, recordedAt, updatedAt, status, deleted, dirty",
      audio: "entryId, createdAt",
      settings: "key",
    });
  }
}

export const db = new WillowDB();

export async function saveEntry(entry: Entry) {
  await db.entries.put(entry);
}

export async function getEntry(id: string) {
  return db.entries.get(id);
}

export async function getEntries() {
  return db.entries.where("deleted").equals(0).reverse().sortBy("recordedAt");
}

export async function saveAudio(entryId: string, blob: Blob) {
  await db.audio.put({ entryId, blob, createdAt: Date.now() });
}

export async function getAudio(entryId: string) {
  const row = await db.audio.get(entryId);
  return row?.blob ?? null;
}

export async function deleteAudio(entryId: string) {
  await db.audio.delete(entryId);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}
