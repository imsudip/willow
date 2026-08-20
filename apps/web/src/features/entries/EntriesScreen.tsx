import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import Fuse from "fuse.js";
import type { Entry } from "@willow/shared";
import { useEntries } from "../../lib/hooks";

function groupByDay(entries: Entry[]) {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = new Date(e.recordedAt).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export function EntriesScreen() {
  const entries = useEntries();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const fuse = new Fuse(entries, {
      keys: ["title", "cleanedBody", "rawTranscript", "tags"],
      threshold: 0.4,
    });
    return fuse.search(query).map((r) => r.item);
  }, [entries, query]);

  return (
    <div className="fade-up space-y-4">
      <h1 className="pt-2 font-serif text-2xl font-normal text-balance">Entries</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your words"
          aria-label="Search entries"
          className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-4 text-ink placeholder:text-muted"
        />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-serif text-xl">No entries yet</p>
          <p className="mt-1 text-sm text-muted">Tonight's the night. Tap the mic and ramble.</p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-accent-strong">
            Go to Today →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-serif text-xl">Nothing matches</p>
          <p className="mt-1 text-sm text-muted">Try a different word or phrase.</p>
          <button
            onClick={() => setQuery("")}
            className="mt-3 text-sm font-medium text-accent-strong"
          >
            Clear search
          </button>
        </div>
      ) : (
        groupByDay(filtered).map(([day, dayEntries]) => (
          <section key={day}>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{day}</h2>
            <ul className="mt-2 space-y-2">
              {dayEntries.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/entries/${e.id}`}
                    className="block rounded-2xl border border-line bg-surface p-4 transition-colors active:bg-surface-2"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate font-serif text-lg font-medium">
                        {e.title || "Untitled"}
                      </h3>
                      {e.mood && (
                        <span className="shrink-0 text-xs capitalize text-muted">{e.mood}</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {e.cleanedBody || e.rawTranscript}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                      {e.audioPresent && <span>🎙 audio</span>}
                      {e.status !== "ready" && (
                        <span className="capitalize text-warning">{e.status}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
