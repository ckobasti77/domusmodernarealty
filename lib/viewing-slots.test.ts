import { BOOKING_LEAD_MS } from "@/convex/lib/belgradeTime";
import { describe, expect, it } from "vitest";
import { isBookableStart, offeredSlotsByDay, type ViewingSlot } from "./viewing-slots";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Monday 28 September 2026, 10:00 in Belgrade (UTC+2). */
const NOW = Date.UTC(2026, 8, 28, 8);

function slot(start: number, taken = false): ViewingSlot {
  return { start, end: start + HOUR, taken };
}

describe("isBookableStart", () => {
  it("accepts a slot exactly at the lead time and refuses one a minute earlier", () => {
    expect(isBookableStart(NOW + BOOKING_LEAD_MS, NOW)).toBe(true);
    expect(isBookableStart(NOW + BOOKING_LEAD_MS - 60_000, NOW)).toBe(false);
  });

  it("refuses a slot more than 14 days out", () => {
    expect(isBookableStart(NOW + 14 * DAY, NOW)).toBe(true);
    expect(isBookableStart(NOW + 14 * DAY + 60_000, NOW)).toBe(false);
  });

  it("drops a slot once the clock moves into its lead time (a widget left open)", () => {
    const noon = NOW + 2 * HOUR;
    expect(isBookableStart(noon, NOW)).toBe(true);
    expect(isBookableStart(noon, NOW + 30 * 60_000)).toBe(false);
  });
});

describe("offeredSlotsByDay", () => {
  it("leaves out past and too-soon slots and keeps taken ones, in order", () => {
    const slots = [
      slot(NOW - HOUR),
      slot(NOW + HOUR),
      slot(NOW + 2 * HOUR, true),
      slot(NOW + 3 * HOUR),
      slot(NOW + DAY),
    ];
    const byDay = offeredSlotsByDay(slots, NOW);
    expect([...byDay.keys()]).toEqual(["2026-09-28", "2026-09-29"]);
    expect(byDay.get("2026-09-28")?.map((item) => item.start)).toEqual([NOW + 2 * HOUR, NOW + 3 * HOUR]);
    expect(byDay.get("2026-09-28")?.[0].taken).toBe(true);
    expect(byDay.get("2026-09-29")?.map((item) => item.start)).toEqual([NOW + DAY]);
  });

  it("files a slot under its Belgrade day, not its UTC day", () => {
    // 23:30 UTC on the 28th is 01:30 on the 29th in Belgrade.
    const late = Date.UTC(2026, 8, 28, 23, 30);
    expect([...offeredSlotsByDay([slot(late)], NOW).keys()]).toEqual(["2026-09-29"]);
  });

  it("re-filters as time passes: an hour later the first afternoon slot is gone", () => {
    const slots = [slot(NOW + 2 * HOUR), slot(NOW + 3 * HOUR)];
    expect(offeredSlotsByDay(slots, NOW).get("2026-09-28")).toHaveLength(2);
    expect(offeredSlotsByDay(slots, NOW + HOUR).get("2026-09-28")?.map((item) => item.start)).toEqual([NOW + 3 * HOUR]);
  });
});
