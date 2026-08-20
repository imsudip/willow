import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Entry, Mood } from "@willow/shared";

/** Soft, distinct tints for each mood (light-enough to read day numbers on). */
const MOOD_COLORS: Record<Mood, string> = {
  calm: "oklch(0.82 0.05 150)",
  grateful: "oklch(0.85 0.08 90)",
  tired: "oklch(0.83 0.04 300)",
  anxious: "oklch(0.84 0.07 30)",
  happy: "oklch(0.85 0.1 85)",
  sad: "oklch(0.83 0.05 240)",
  energetic: "oklch(0.82 0.11 60)",
  stressed: "oklch(0.83 0.09 20)",
  hopeful: "oklch(0.85 0.07 160)",
  neutral: "oklch(0.86 0.02 80)",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function MoodCalendar({ entries }: { entries: Entry[] }) {
  const navigate = useNavigate();
  const [monthOffset, setMonthOffset] = useState(0);

  const { year, month, cells, byDay, monthLabel, usedMoods } = useMemo(() => {
    const now = new Date();
    const view = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDay = view.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const byDay = new Map<string, { mood: Mood | null; id: string; title: string }>();
    const used = new Set<Mood>();
    for (const e of entries) {
      const d = new Date(e.recordedAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      byDay.set(d.toDateString(), { mood: e.mood, id: e.id, title: e.title });
      if (e.mood) used.add(e.mood);
    }

    const cells: (Date | null)[] = [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];

    return {
      year,
      month,
      cells,
      byDay,
      monthLabel: view.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      usedMoods: [...used],
    };
  }, [entries, monthOffset]);

  const todayKey = new Date().toDateString();
  const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === year;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Mood calendar</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthOffset((o) => o - 1)}
            aria-label="Previous month"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-surface-2"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="w-32 text-center text-sm font-medium text-ink">{monthLabel}</span>
          <button
            onClick={() => setMonthOffset((o) => o + 1)}
            aria-label="Next month"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-surface-2"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-xs font-medium uppercase tracking-wide text-muted">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const info = byDay.get(date.toDateString());
          const isToday = isCurrentMonth && date.toDateString() === todayKey;
          return (
            <button
              key={i}
              disabled={!info}
              onClick={() => info && navigate(`/entries/${info.id}`)}
              aria-label={info ? `${date.toLocaleDateString()}: ${info.title || "entry"}` : undefined}
              className={`relative flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition-transform ${
                info?.mood ? "text-ink" : "text-muted"
              } ${isToday ? "ring-2 ring-accent-strong ring-offset-1" : ""} ${
                info ? "active:scale-95" : ""
              }`}
              style={
                info?.mood
                  ? { backgroundColor: "oklch(0.85 0.08 75)", color: "oklch(0.25 0.03 70)" }
                  : undefined
              }
            >
              {date.getDate()}
              {info?.mood && (
                <span
                  className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: MOOD_COLORS[info.mood] }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {usedMoods.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
          {usedMoods.map((m) => (
            <span key={m} className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: MOOD_COLORS[m] }}
                aria-hidden
              />
              <span className="capitalize">{m}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
