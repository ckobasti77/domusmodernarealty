import * as server from "@/convex/lib/belgradeTime";
import { describe, expect, it } from "vitest";
import {
  belgradeDayKey,
  belgradeMidnight,
  belgradeOffsetMinutes,
  nextBelgradeDays,
} from "./belgrade-time";

describe("belgrade-time", () => {
  it("knows summer and winter offsets", () => {
    expect(belgradeOffsetMinutes(Date.UTC(2026, 6, 1, 12))).toBe(120);
    expect(belgradeOffsetMinutes(Date.UTC(2026, 0, 15, 12))).toBe(60);
  });

  it("finds local midnight in summer (22:00 UTC the day before)", () => {
    const at = Date.UTC(2026, 8, 28, 10, 30); // 12:30 in Belgrade
    expect(belgradeMidnight(at)).toBe(Date.UTC(2026, 8, 27, 22));
  });

  it("treats 23:30 UTC as the next Belgrade day", () => {
    const at = Date.UTC(2026, 8, 28, 23, 30); // 01:30 on the 29th in Belgrade
    expect(belgradeDayKey(at)).toBe("2026-09-29");
    expect(belgradeMidnight(at)).toBe(Date.UTC(2026, 8, 28, 22));
  });

  it("lists 14 consecutive days across the October DST change", () => {
    const days = nextBelgradeDays(Date.UTC(2026, 9, 20, 9), 14);
    expect(days).toHaveLength(14);
    expect(days[0].key).toBe("2026-10-20");
    expect(days[13].key).toBe("2026-11-02");
    // After 25 October Belgrade is back on UTC+1, so midnight is 23:00 UTC.
    expect(days[13].start).toBe(Date.UTC(2026, 10, 1, 23));
    expect(new Set(days.map((day) => day.key)).size).toBe(14);
  });
});

describe("the server's EU rule agrees with the browser's time-zone data", () => {
  it("offset and local midnight match every 30 minutes around each switch, 2025–2030", () => {
    for (let year = 2025; year <= 2030; year += 1) {
      for (const month of [2, 9]) {
        const from = Date.UTC(year, month, 20);
        for (let at = from; at < from + 14 * 86_400_000; at += 30 * 60_000) {
          expect(server.belgradeOffsetMinutes(at)).toBe(belgradeOffsetMinutes(at));
          expect(server.belgradeMidnight(at)).toBe(belgradeMidnight(at));
        }
      }
    }
  });

  it("wall-clock readings round-trip outside the spring gap", () => {
    for (let at = Date.UTC(2026, 9, 24); at < Date.UTC(2026, 9, 27); at += 15 * 60_000) {
      const wall = server.belgradeWall(at);
      // The October overlap maps back to the earlier (summer) instant.
      expect([at, at - 60 * 60_000]).toContain(server.fromBelgradeWall(wall));
    }
  });
});
