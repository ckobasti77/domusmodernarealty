/**
 * Viewing slots are agent office hours, entered as Belgrade wall-clock time
 * (`agentsAdmin.setAvailability`). The booking widget therefore works in
 * Europe/Belgrade regardless of where the visitor is, and passes the Belgrade
 * UTC offset to `agents.slots` / `viewings.request`, which validate in the same
 * local space.
 */
export const BELGRADE_TZ = "Europe/Belgrade";
const DAY_MS = 86_400_000;

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BELGRADE_TZ,
  timeZoneName: "shortOffset",
});

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BELGRADE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Belgrade's offset from UTC in minutes at `at` (60 in winter, 120 in summer). */
export function belgradeOffsetMinutes(at: number): number {
  const name = offsetFormatter.formatToParts(at).find((part) => part.type === "timeZoneName")?.value;
  const match = name !== undefined ? /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name) : null;
  if (match === null) return 60;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** Epoch ms of Belgrade local midnight on the calendar day that contains `at`. */
export function belgradeMidnight(at: number): number {
  const parts = dateFormatter.formatToParts(at);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const utcMidnight = Date.UTC(year, month - 1, day);
  // The offset that applies at local midnight, not at `at`: the two differ on
  // the two DST-change days.
  return utcMidnight - belgradeOffsetMinutes(utcMidnight - 60 * 60_000) * 60_000;
}

/** Stable `YYYY-MM-DD` key of the Belgrade calendar day containing `at`. */
export function belgradeDayKey(at: number): string {
  return dateFormatter.format(at);
}

/** The Belgrade calendar-day keys of the `count` days starting today. */
export function nextBelgradeDays(now: number, count: number): { key: string; start: number }[] {
  const days: { key: string; start: number }[] = [];
  const first = belgradeMidnight(now);
  for (let index = 0; index < count; index += 1) {
    // Midday of each day is safely inside it even across a DST change.
    const noon = first + index * DAY_MS + 12 * 60 * 60_000;
    days.push({ key: belgradeDayKey(noon), start: belgradeMidnight(noon) });
  }
  return days;
}
