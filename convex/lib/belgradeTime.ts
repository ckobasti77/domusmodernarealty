/**
 * Europe/Belgrade time for the booking rules, computed on the server.
 *
 * Agent hours are Belgrade wall-clock time, so `agents.slots` and
 * `viewings.request` must convert with Belgrade's own offset. They never
 * accept an offset from the client: a crafted offset (anything from −12 h to
 * +14 h) would move a 22:00 request into the agent's 09:00 window.
 *
 * Pure arithmetic, no `Intl` time zones: Serbia follows the EU rule, where
 * summer time (UTC+2) runs from 01:00 UTC on the last Sunday of March to
 * 01:00 UTC on the last Sunday of October, and UTC+1 applies otherwise.
 * `lib/belgrade-time.test.ts` checks this against the browser's `Intl` data.
 */

export const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** One viewing is one hour on the agent's grid (PRD A5 booking widget). */
export const VIEWING_SLOT_MS = 60 * MINUTE_MS;
/** The widget offers today plus the next 13 days. */
export const BOOKING_DAYS = 14;
/** No same-hour surprises for the agent; the widget hides earlier slots too. */
export const BOOKING_LEAD_MS = 2 * 60 * MINUTE_MS;

/** 01:00 UTC on the last Sunday of `month` (0-based): the EU switch instant. */
function lastSundaySwitch(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1);
}

/** Belgrade's offset from UTC in minutes at `at` (60 in winter, 120 in summer). */
export function belgradeOffsetMinutes(at: number): number {
  const year = new Date(at).getUTCFullYear();
  return at >= lastSundaySwitch(year, 2) && at < lastSundaySwitch(year, 9) ? 120 : 60;
}

/**
 * The Belgrade wall-clock reading of `at`, expressed as if it were UTC, so the
 * `getUTC*` accessors return the local date, weekday and time.
 */
export function belgradeWall(at: number): number {
  return at + belgradeOffsetMinutes(at) * MINUTE_MS;
}

/** The instant a Belgrade wall-clock reading (as UTC) refers to. */
export function fromBelgradeWall(wall: number): number {
  // Summer first: during the October overlap the earlier instant wins. A
  // reading inside the March gap (02:00–03:00) does not exist and resolves one
  // hour later; office hours never fall there.
  const summer = wall - 120 * MINUTE_MS;
  return belgradeOffsetMinutes(summer) === 120 ? summer : wall - 60 * MINUTE_MS;
}

/** Epoch ms of Belgrade local midnight on the calendar day that contains `at`. */
export function belgradeMidnight(at: number): number {
  const wall = belgradeWall(at);
  return fromBelgradeWall(wall - (wall % DAY_MS));
}
