/**
 * Dashboard-only wording and number helpers. Dates and relative times come
 * from `lib/admin/format`; this file adds the greeting, durations and counts.
 */

const TZ = "Europe/Belgrade";

const hourFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});

const weekdayFmt = new Intl.DateTimeFormat("sr-Latn-RS", { weekday: "long", timeZone: TZ });

const countFmt = new Intl.NumberFormat("sr-Latn-RS");

/** "Dobro jutro" (05–11 h), "Dobar dan" (12–17 h), "Dobro veče" otherwise, Belgrade time. */
export function greetingFor(ms: number): string {
  const hour = Number(hourFmt.format(ms));
  if (hour >= 5 && hour < 12) return "Dobro jutro";
  if (hour >= 12 && hour < 18) return "Dobar dan";
  return "Dobro veče";
}

/** `Sreda` — the weekday in Belgrade, capitalised to open a line. */
export function weekdayOf(ms: number): string {
  const day = weekdayFmt.format(ms);
  return day.charAt(0).toLocaleUpperCase("sr-Latn") + day.slice(1);
}

/** `1.234` */
export function formatCount(value: number): string {
  return countFmt.format(value);
}

/**
 * A count read with `.take(limit)` on the server: at the limit the true number
 * may be higher, so it reads `500+` instead of pretending to be exact.
 */
export function formatCapped(value: number, limit: number): string {
  return value >= limit ? `${countFmt.format(limit)}+` : countFmt.format(value);
}

/** Serbian noun after a number: 1, 21, 31… take the singular, the rest the plural. */
export function pluralSr(count: number, one: string, many: string): string {
  return count % 10 === 1 && count % 100 !== 11 ? one : many;
}

/** 0 → `< 1 min`, 45 → `45 min`, 135 → `2 h 15 min`, 1500 → `1 dan 1 h`. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  // The server rounds to whole minutes, so 0 means "under half a minute".
  if (total < 1) return "< 1 min";
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  const dayWord = `${days} ${pluralSr(days, "dan", "dana")}`;
  return dayHours === 0 ? dayWord : `${dayWord} ${dayHours} h`;
}

/** First word of a display name, for the greeting. */
export function firstName(name: string | undefined): string | undefined {
  const first = name?.trim().split(/\s+/)[0];
  return first !== undefined && first.length > 0 ? first : undefined;
}

export function isoOf(ms: number): string {
  return new Date(ms).toISOString();
}
