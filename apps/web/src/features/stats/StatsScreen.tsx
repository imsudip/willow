import { useEffect, useState } from "react";
import { Flame, TrendingUp } from "lucide-react";
import { useEntries } from "../../lib/hooks";
import { client } from "../../lib/api";
import { MoodCalendar } from "./MoodCalendar";
import type { WeeklyDigest } from "@willow/shared";

function streakDays(entries: { recordedAt: string }[]) {
  const days = new Set(entries.map((e) => new Date(e.recordedAt).toDateString()));
  let streak = 0;
  const d = new Date();
  // Count today first
  if (days.has(d.toDateString())) streak++;
  else return 0;
  while (true) {
    d.setDate(d.getDate() - 1);
    if (days.has(d.toDateString())) streak++;
    else break;
  }
  return streak;
}

function last14(entries: { recordedAt: string }[]) {
  const out: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    out.push({
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      count: entries.filter((e) => new Date(e.recordedAt).toDateString() === key).length,
    });
  }
  return out;
}

function moodTrend(entries: { mood: string | null; recordedAt: string }[]) {
  const byMood = new Map<string, number>();
  for (const e of entries) {
    if (!e.mood) continue;
    byMood.set(e.mood, (byMood.get(e.mood) ?? 0) + 1);
  }
  return [...byMood.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export function StatsScreen() {
  const entries = useEntries();
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [digestLoading, setDigestLoading] = useState(true);

  useEffect(() => {
    client
      .weeklyDigest()
      .then((r) => setDigest(r.digest))
      .catch(() => setDigest(null))
      .finally(() => setDigestLoading(false));
  }, []);

  const streak = streakDays(entries);
  const chart = last14(entries);
  const moods = moodTrend(entries);
  const maxCount = Math.max(1, ...chart.map((c) => c.count));

  return (
    <div className="fade-up space-y-6">
      <h1 className="pt-2 font-serif text-2xl font-normal text-balance">Stats</h1>

      {/* Streak */}
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Flame className={`h-10 w-10 ${streak > 0 ? "text-accent-strong" : "text-muted"}`} aria-hidden />
        <div>
          <p className="font-serif text-3xl font-medium">{streak}</p>
          <p className="text-sm text-muted">{streak === 1 ? "day in a row" : "days in a row"}</p>
        </div>
      </div>

      {/* Last 14 days */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
          <TrendingUp className="h-4 w-4" aria-hidden /> Last 14 days
        </h2>
        <div className="mt-4 flex h-24 items-end gap-1.5" aria-hidden>
          {chart.map((c, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${c.count > 0 ? "bg-accent" : "bg-surface-2"}`}
                style={{ height: `${Math.max(4, (c.count / maxCount) * 80)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5 text-[11px] tabular-nums text-muted">
          {chart.map((c, i) => (
            <span key={i} className="flex-1 text-center">
              {i % 2 === 0 ? c.day : ""}
            </span>
          ))}
        </div>
      </section>

      {/* Mood calendar */}
      <MoodCalendar entries={entries} />

      {/* Mood trend — borderless divided rows, not another card */}
      {moods.length > 0 && (
        <section className="border-y border-line divide-y divide-line/60">
          <h2 className="py-3 text-xs font-medium uppercase tracking-wide text-muted">Moods lately</h2>
          <ul className="divide-y divide-line/40">
            {moods.map(([m, n]) => (
              <li key={m} className="flex items-center justify-between py-3">
                <span className="capitalize text-ink">{m}</span>
                <span className="text-sm tabular-nums text-muted">{n}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Weekly digest — letter, not a tile: borderless warm wash */}
      <section className="rounded-2xl bg-accent-soft/60 p-6">
        <p className="font-serif text-[11px] font-medium uppercase tracking-[0.14em] text-accent-strong">This week in Willow</p>
        {digestLoading ? (
          <p className="mt-3 text-sm text-muted">Warming up the pen…</p>
        ) : digest ? (
          <>
            <p className="journal mt-3 text-[1.0625rem] leading-7">{digest.summary}</p>
            {digest.themes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {digest.themes.map((t) => (
                  <span key={t} className="rounded-full border border-line/40 bg-surface/70 px-3 py-1 text-xs text-muted">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {digest.reflectionPrompt && (
              <p className="mt-4 border-l-2 border-accent/40 pl-3 text-sm italic leading-6 text-ink/70">“{digest.reflectionPrompt}”</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            Journal a few times this week and a digest will appear here — a short note in your own words, back to you.
          </p>
        )}
      </section>
    </div>
  );
}
