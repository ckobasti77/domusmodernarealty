/**
 * Calendar arithmetic in Europe/Belgrade, shared with the server
 * (`convex/lib/belgradeTime.ts`), so the admin grid and the booking rules
 * agree to the minute, DST included.
 *
 * A "wall" value is a Belgrade wall-clock reading expressed as if it were UTC:
 * its `getUTC*` accessors return the Belgrade date and time, and whole Belgrade
 * days are exactly `DAY_MS` apart in that space even on the 23- and 25-hour
 * days. Instants (epoch ms) are what Convex stores; `fromBelgradeWall` turns a
 * wall value back into one.
 */
import { belgradeWall, DAY_MS, fromBelgradeWall } from "@/convex/lib/belgradeTime";

export { DAY_MS };
export const MINUTE_MS = 60_000;

/** `YYYY-MM-DD` of a Belgrade calendar day. */
export type DayKey = string;

/** The Belgrade wall midnight of the day `key` names, or null for anything that is not a real date. */
export function wallOfDayKey(key: string | null | undefined): number | null {
  if (key === null || key === undefined) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (match === null) return null;
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Rejects 2026-02-31 and friends, which Date.UTC would roll over.
  return dayKeyOfWall(wall) === key ? wall : null;
}

export function dayKeyOfWall(wall: number): DayKey {
  return new Date(wall).toISOString().slice(0, 10);
}

/** Belgrade wall midnight of the day containing the instant `at`. */
export function wallMidnightOf(at: number): number {
  const wall = belgradeWall(at);
  return wall - (wall % DAY_MS);
}

export function todayKey(now: number): DayKey {
  return dayKeyOfWall(wallMidnightOf(now));
}

/** Monday (wall midnight) of the week containing `wallMidnight`. */
export function mondayOf(wallMidnight: number): number {
  const weekday = new Date(wallMidnight).getUTCDay();
  return wallMidnight - ((weekday + 6) % 7) * DAY_MS;
}

/** The instant of a Belgrade wall-clock reading. */
export function instantOf(wall: number): number {
  return fromBelgradeWall(wall);
}

export function wallOf(at: number): number {
  return belgradeWall(at);
}

/** Minutes after Belgrade midnight of the instant `at`. */
export function minutesIntoDay(at: number): number {
  return Math.floor((belgradeWall(at) % DAY_MS) / MINUTE_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `14:05` in Belgrade time. */
export function formatHm(at: number): string {
  const minutes = minutesIntoDay(at);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** `14:00–15:00` */
export function formatSpan(start: number, end: number): string {
  return `${formatHm(start)}–${formatHm(end)}`;
}

/** Minutes → `HH:MM` (for `<input type="time">` values and slot strings). */
export function hmOfMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** `HH:MM` → minutes after midnight, or null. */
export function minutesOfHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** The instant of `HH:MM` on the Belgrade day `key`, or null when either is invalid. */
export function instantOfDayAndTime(key: string, time: string): number | null {
  const wall = wallOfDayKey(key);
  const minutes = minutesOfHm(time);
  if (wall === null || minutes === null) return null;
  return fromBelgradeWall(wall + minutes * MINUTE_MS);
}

// Wall values are formatted in UTC: that prints the Belgrade calendar reading.
const weekdayLong = new Intl.DateTimeFormat("sr-Latn-RS", { weekday: "long", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("sr-Latn-RS", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("sr-Latn-RS", { day: "numeric", month: "numeric", timeZone: "UTC" });
const dayMonthLong = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const rangeFmt = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toLocaleUpperCase("sr-Latn") + text.slice(1) : text;
}

/** `Četvrtak` */
function weekdayName(wall: number): string {
  return capitalize(weekdayLong.format(wall));
}

/** `čet` */
export function weekdayShortName(wall: number): string {
  return weekdayShort.format(wall).replace(/\.$/, "");
}

/** `1. 10.` */
export function dayMonthLabel(wall: number): string {
  return dayMonth.format(wall);
}

/** `Četvrtak, 1. oktobar 2026.` */
export function longDayLabel(wall: number): string {
  return `${weekdayName(wall)}, ${dayMonthLong.format(wall)}`;
}

/** `28. septembar – 4. oktobar 2026.` */
export function weekRangeLabel(mondayWall: number): string {
  return rangeFmt.formatRange(mondayWall, mondayWall + 6 * DAY_MS);
}
