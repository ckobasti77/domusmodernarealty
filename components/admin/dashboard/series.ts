/**
 * The day window behind the views & leads chart. `dailyStats` rows are keyed
 * by UTC day (`yyyy-mm-dd`, written by the 03:05 UTC rollup), so the window is
 * built in UTC days too.
 */

const DAY_MS = 86_400_000;
export const CHART_DAYS = 30;
/** Pixel height of the plot, shared by the chart and its loading skeleton. */
export const CHART_HEIGHT = 280;

export type SeriesRow = { day: string; views: number; leads: number };
/**
 * `ms` is noon UTC of the day: the same calendar day in Belgrade, for labels.
 * `recorded` is false for days the rollup has no row for (drawn as 0).
 */
export type ChartDay = { day: string; ms: number; views: number; leads: number; recorded: boolean };

export type ChartWindow = {
  days: ChartDay[];
  /** Days in the window that have a real rollup row (the rest are filled with 0). */
  recorded: number;
  totalViews: number;
  totalLeads: number;
};

function parseDay(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (match === null) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * A continuous axis ending on the latest rolled-up day (yesterday once the
 * nightly job has run), missing days filled with 0. Anchoring on the latest
 * row keeps the tail honest before 03:05 UTC, when "yesterday" has not been
 * counted yet and a trailing 0 would be a fabricated value.
 *
 * The axis spans 30 days. A record younger than that starts the axis the day
 * before its first row instead, so a few days of data fill the chart rather
 * than sitting at the right edge of a flat, empty month.
 */
export function chartWindow(series: readonly SeriesRow[], now: number): ChartWindow {
  const byDay = new Map<string, SeriesRow>();
  let earliest: number | null = null;
  let latest: number | null = null;
  for (const row of series) {
    const start = parseDay(row.day);
    if (start === null) continue;
    byDay.set(row.day, row);
    if (earliest === null || start < earliest) earliest = start;
    if (latest === null || start > latest) latest = start;
  }
  const todayStart = parseDay(dayKey(now)) ?? now;
  const end = latest ?? todayStart - DAY_MS;
  const monthStart = end - (CHART_DAYS - 1) * DAY_MS;
  const first = earliest === null ? monthStart : Math.max(monthStart, earliest - DAY_MS);

  const days: ChartDay[] = [];
  let recorded = 0;
  let totalViews = 0;
  let totalLeads = 0;
  for (let start = first; start <= end; start += DAY_MS) {
    const key = dayKey(start);
    const row = byDay.get(key);
    if (row !== undefined) recorded += 1;
    const views = row?.views ?? 0;
    const leads = row?.leads ?? 0;
    totalViews += views;
    totalLeads += leads;
    days.push({ day: key, ms: start + DAY_MS / 2, views, leads, recorded: row !== undefined });
  }
  return { days, recorded, totalViews, totalLeads };
}

/**
 * Indices of the days that get an axis label: the first, the last, and days
 * evenly spaced between them, about `slots` in all (weekly on a 30-day axis).
 * A regular label too close to the last one gives way to it.
 */
export function dayTicks(count: number, slots: number): number[] {
  if (count <= 0) return [];
  const last = count - 1;
  const stride = Math.max(1, Math.floor(last / Math.max(1, slots - 1)));
  const ticks: number[] = [];
  for (let index = 0; index < last; index += stride) ticks.push(index);
  if (ticks.length > 1 && last - ticks[ticks.length - 1] < stride) ticks.pop();
  ticks.push(last);
  return ticks;
}

/** A clean integer axis maximum at or above `value` (never below 1). */
export function niceMax(value: number): number {
  if (value <= 5) return Math.max(1, Math.ceil(value));
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value && Number.isInteger(candidate)) return candidate;
  }
  return 10 * magnitude;
}
