/**
 * Admin formatting. Money and area reuse the public formatters in `lib/format`
 * (sr-Latn: `125.000 €`); this file only adds the date and time helpers the
 * panel needs. All times are shown in Belgrade time.
 */
import { formatArea, formatPrice, formatPricePerM2, parseLocaleNumber } from "@/lib/format";

const TZ = "Europe/Belgrade";

const dateFmt = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: TZ,
});

const dateTimeFmt = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

const shortDayFmt = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "short",
  timeZone: TZ,
});

/** `30. 9. 2026.` */
export function formatDate(ms: number): string {
  return dateFmt.format(ms);
}

/** `30. 9. 2026. 14:05` */
export function formatDateTime(ms: number): string {
  return dateTimeFmt.format(ms);
}

/** `30. sep` — chart axis labels. */
export function formatShortDay(ms: number): string {
  return shortDayFmt.format(ms);
}

const rtf = new Intl.RelativeTimeFormat("sr-Latn-RS", { numeric: "auto" });

/** `pre 5 minuta`, `juče`, `za 3 dana`. `now` is passed in so renders stay pure. */
export function formatRelative(ms: number, now: number): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return "upravo sada";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return formatDate(ms);
}

/** `125.000 €` */
export function formatEur(value: number): string {
  return formatPrice(value, "sr-Latn");
}

/** `2.450 €/m²` */
export function formatEurPerM2(value: number): string {
  return formatPricePerM2(value, "sr-Latn");
}

/** `86 m²` */
export function formatM2(value: number): string {
  return formatArea(value, "sr-Latn");
}

/** `yyyy-mm-dd` in Belgrade time, for `<input type="date">`. */
export function toDateInput(ms: number | undefined): string {
  if (ms === undefined) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  }).format(ms);
  return parts;
}

/**
 * `yyyy-mm-dd` → epoch ms at Belgrade NOON of that day. Noon keeps the date
 * stable across the DST shift and any UTC offset a reader might apply.
 * `undefined` for anything that is not a real date: a year typed digit by
 * digit passes through `0002`, `0020` and `0202` in a date input, and
 * `Date.UTC` would read those as 1902, 1920 and 202, or roll 31 February
 * over into March.
 */
export function fromDateInput(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (year < 1000) return undefined;
  // 10:00 UTC is 11:00 or 12:00 in Belgrade — always the same calendar day.
  const ms = Date.UTC(year, month, day, 10, 0, 0);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return undefined;
  return ms;
}

/**
 * The text of a number input → the form's number: `null` when empty, `NaN`
 * when it does not parse (the schema reports it). Serbian notation is read
 * ("285.000", "2,5") and so is a decimal point ("1.5").
 */
export function fromNumberInput(text: string): number | null {
  if (text.trim() === "") return null;
  return parseLocaleNumber(text, "sr-Latn") ?? Number.NaN;
}

/** The form's number → the text of its input, with a decimal comma (`1.5` → "1,5"). */
export function toNumberInput(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
}
