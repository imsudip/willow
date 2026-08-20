import { useLiveQuery } from "dexie-react-hooks";
import type { Entry } from "@willow/shared";
import { db } from "./db";

/** Live list of non-deleted entries, newest first. */
export function useEntries(): Entry[] {
  return useLiveQuery(
    async () => {
      const rows = await db.entries.toArray();
      return rows
        .filter((e) => !e.deleted)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    },
    [],
    [] as Entry[],
  );
}

/** Live single entry. */
export function useEntry(id: string | undefined) {
  return useLiveQuery(async () => (id ? db.entries.get(id) : undefined), [id]);
}

/** Today's entries (newest first). Supports multiple notes per day. */
export function useTodayEntries(): Entry[] {
  return useLiveQuery(
    async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const rows = await db.entries
        .where("recordedAt")
        .between(start.toISOString(), end.toISOString())
        .filter((e) => !e.deleted)
        .toArray();
      return rows.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    },
    [],
    [] as Entry[],
  );
}
