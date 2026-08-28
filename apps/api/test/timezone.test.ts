import { describe, expect, it } from "vitest";
import { dateKeyInZone, startOfDayInZone } from "../src/lib/timezone.js";

describe("startOfDayInZone", () => {
  it("returns the correct UTC instant for Asia/Kolkata (UTC+5:30, no DST)", () => {
    // 2026-08-28 18:30 IST == 13:00 UTC. Local midnight 2026-08-28 00:00 IST
    // == 2026-08-27 18:30 UTC.
    const now = new Date("2026-08-28T13:00:00.000Z");
    const start = startOfDayInZone(now, "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-08-27T18:30:00.000Z");
  });

  it("handles a DST-observing zone (America/New_York)", () => {
    // 2026-08-28 12:00 EDT (UTC-4) == 16:00 UTC. Local midnight
    // 2026-08-28 00:00 EDT == 04:00 UTC.
    const now = new Date("2026-08-28T16:00:00.000Z");
    const start = startOfDayInZone(now, "America/New_York");
    expect(start.toISOString()).toBe("2026-08-28T04:00:00.000Z");
  });

  it("handles the DST fall-back day (America/New_York)", () => {
    // 2026-11-01 12:00 EST (UTC-5) == 17:00 UTC.
    const now = new Date("2026-11-01T17:00:00.000Z");
    const start = startOfDayInZone(now, "America/New_York");
    expect(start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });
});

describe("dateKeyInZone", () => {
  it("returns the calendar date in the zone, not the process timezone", () => {
    // 2026-08-28 00:30 IST == 2026-08-27 19:00 UTC. In IST the date is the
    // 28th, even though UTC (and most process timezones) still say the 27th.
    const now = new Date("2026-08-27T19:00:00.000Z");
    expect(dateKeyInZone(now, "Asia/Kolkata")).toBe("2026-08-28");
    expect(dateKeyInZone(now, "UTC")).toBe("2026-08-27");
  });
});
