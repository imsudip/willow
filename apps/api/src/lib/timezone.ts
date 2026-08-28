/**
 * Timezone-aware calendar helpers. All "today" boundaries and prompt cache
 * date keys must be computed in the same zone the scheduled jobs run in
 * (CRON_TIMEZONE, default Asia/Kolkata) or the app's day flips at the wrong
 * time near midnight.
 */

/** Local calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function dateKeyInZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Midnight (start of day) in the given IANA timezone, returned as a UTC
 * Date. Correct across DST: computes the zone's wall-clock time at `now`,
 * then subtracts the offset to land on that zone's calendar midnight.
 */
export function startOfDayInZone(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const mo = get("month");
  const da = get("day");
  const h = get("hour");
  const mi = get("minute");
  const s = get("second");

  // Wall-clock time of `now` in the zone, interpreted as if it were UTC.
  // The zone's UTC offset is (local wall clock) - (real UTC instant):
  // positive east of UTC (IST = +5.5h), negative west (NY = -4h in EDT).
  const wallClockAsUtc = Date.parse(`${y}-${mo}-${da}T${h}:${mi}:${s}.000Z`);
  const offsetMs = wallClockAsUtc - now.getTime();

  // Local calendar midnight converted to UTC: UTC = local - offset
  // (IST 00:00 on the 28th == 2026-08-27T18:30Z).
  const midnight = Date.parse(`${y}-${mo}-${da}T00:00:00.000Z`);
  return new Date(midnight - offsetMs);
}
