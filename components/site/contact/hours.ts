import type { Locale } from "@/i18n/routing";

/**
 * Office hours from Settings (`officeHours`: weekday 0 = Sunday … 6, "HH:MM"
 * strings) as the rows a visitor reads: Monday first, the weekday names from
 * `Intl` in the page's language, consecutive days with identical hours merged
 * ("Ponedeljak – četvrtak 09:00–18:00") and days without hours shown as closed.
 */

export type OfficeSlot = { weekday: number; from: string; to: string };

export type HoursRow = {
  /** Stable key: the weekdays the row covers. */
  key: string;
  days: string;
  /** `null` = closed. */
  hours: string | null;
};

/** `Intl` does not know `sr-Latn`; `sr-Latn-RS` gives the Latin names. */
const INTL_LOCALE: Record<Locale, string> = {
  "sr-Latn": "sr-Latn-RS",
  en: "en-GB",
  ru: "ru-RU",
  de: "de-DE",
};

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The slots that can be shown: valid times, opening before closing. */
export function validSlots(slots: readonly OfficeSlot[]): OfficeSlot[] {
  return slots.filter(
    (slot) =>
      Number.isInteger(slot.weekday) &&
      slot.weekday >= 0 &&
      slot.weekday <= 6 &&
      TIME.test(slot.from) &&
      TIME.test(slot.to) &&
      slot.from < slot.to,
  );
}

function weekdayName(weekday: number, locale: Locale): string {
  // 7 January 2024 was a Sunday, so the 7th + weekday lands on that weekday.
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 7 + weekday)),
  );
}

function capitalize(text: string, locale: Locale): string {
  return text.charAt(0).toLocaleUpperCase(INTL_LOCALE[locale]) + text.slice(1);
}

/** Rows for the hours table; empty when no hours are set at all. */
export function officeHoursRows(slots: readonly OfficeSlot[], locale: Locale): HoursRow[] {
  const valid = validSlots(slots);
  if (valid.length === 0) return [];

  const hoursOf = (weekday: number): string | null => {
    const ranges = valid
      .filter((slot) => slot.weekday === weekday)
      .sort((a, b) => a.from.localeCompare(b.from))
      .map((slot) => `${slot.from}–${slot.to}`);
    return ranges.length > 0 ? ranges.join(", ") : null;
  };

  const rows: HoursRow[] = [];
  let run: number[] = [];
  let runHours: string | null = null;

  const flush = () => {
    const first = run[0];
    const last = run.at(-1);
    if (first === undefined || last === undefined) return;
    const days =
      run.length === 1
        ? capitalize(weekdayName(first, locale), locale)
        : `${capitalize(weekdayName(first, locale), locale)} – ${weekdayName(last, locale)}`;
    rows.push({ key: run.join("-"), days, hours: runHours });
  };

  for (const weekday of MONDAY_FIRST) {
    const hours = hoursOf(weekday);
    if (run.length > 0 && hours === runHours) {
      run.push(weekday);
      continue;
    }
    flush();
    run = [weekday];
    runHours = hours;
  }
  flush();
  return rows;
}
