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
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const partsOf = (d: Date) => {
    const parts = fmt.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return {
      y: get("year"),
      mo: get("month"),
      da: get("day"),
      h: get("hour"),
      mi: get("minute"),
      s: get("second"),
      // Preserve the sub-second part so the offset math below stays exact
      // when `now` has nonzero milliseconds.
      ms: d.getUTCMilliseconds(),
    };
  };
  // The zone's wall clock interpreted as if it were UTC. The zone's UTC
  // offset is (local wall clock) - (real UTC instant): positive east of UTC
  // (IST = +5.5h), negative west (NY = -4h in EDT).
  const wallClockAsUtc = (d: Date) => {
    const p = partsOf(d);
    const ms = String(p.ms).padStart(3, "0");
    return Date.parse(`${p.y}-${p.mo}-${p.da}T${p.h}:${p.mi}:${p.s}.${ms}Z`);
  };

  const target = partsOf(now);
  const midnightAsUtc = Date.parse(
    `${target.y}-${target.mo}-${target.da}T00:00:00.000Z`,
  );

  // First estimate of local midnight using `now`'s offset.
  let instant = new Date(midnightAsUtc - (wallClockAsUtc(now) - now.getTime()));

  // The offset at local midnight can differ from the offset at `now` on a DST
  // transition day. Converge: correct `instant` by the delta between the
  // desired and observed wall clock until it reads 00:00 on the target date.
  for (let i = 0; i < 3; i++) {
    const observedAsUtc = wallClockAsUtc(instant);
    if (observedAsUtc === midnightAsUtc) break;
    instant = new Date(instant.getTime() + (midnightAsUtc - observedAsUtc));
  }

  return instant;
}
