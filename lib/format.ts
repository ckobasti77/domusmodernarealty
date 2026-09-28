import type { Locale } from "@/i18n/routing";

/**
 * Locale-aware formatters. Money is always EUR and area always m2
 * (docs/03-DESIGN-SYSTEM.md, CLAUDE.md "Conventions"), so the only variable is
 * the locale's grouping and decimal marks: sr-Latn / de / ru all group with a
 * dot (`125.000 EUR`), en groups with a comma.
 */

/** `Intl` does not know `sr-Latn`; the BCP-47 tag it does know is `sr-Latn-RS`. */
const INTL_LOCALE: Record<Locale, string> = {
  "sr-Latn": "sr-Latn-RS",
  en: "en-GB",
  ru: "ru-RU",
  de: "de-DE",
};

const moneyCache = new Map<string, Intl.NumberFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();

function money(locale: Locale): Intl.NumberFormat {
  const key = INTL_LOCALE[locale];
  let formatter = moneyCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(key, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
      currencyDisplay: "symbol",
    });
    moneyCache.set(key, formatter);
  }
  return formatter;
}

function plain(locale: Locale): Intl.NumberFormat {
  const key = INTL_LOCALE[locale];
  let formatter = numberCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(key, { maximumFractionDigits: 0 });
    numberCache.set(key, formatter);
  }
  return formatter;
}

/** `125.000 €` in sr-Latn, `€125,000` in en. Never shows cents. */
export function formatPrice(value: number, locale: Locale): string {
  return money(locale).format(Math.round(value));
}

/**
 * The square-metre unit per locale. Russian writes it with a Cyrillic м, so a
 * hard-coded "m²" mixes scripts inside one string. These values MUST match
 * `units.m2` in `messages/*.json`; callers that already hold a translator
 * should pass `t("m2")` explicitly instead of relying on this map.
 */
export const SQUARE_METRE: Record<Locale, string> = {
  "sr-Latn": "m²",
  en: "m²",
  ru: "м²",
  de: "m²",
};

/** `2.450 €/m²` — the per-square-metre figure that must sit next to every price. */
export function formatPricePerM2(value: number, locale: Locale, unit?: string): string {
  return `${money(locale).format(Math.round(value))}/${unit ?? SQUARE_METRE[locale]}`;
}

/** `78 m²`. */
export function formatArea(value: number, locale: Locale, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 1,
  }).format(rounded);
  return `${formatted} ${unit ?? SQUARE_METRE[locale]}`;
}

/** Plain grouped integer, for counters and listing counts. */
export function formatCount(value: number, locale: Locale): string {
  return plain(locale).format(Math.round(value));
}

/**
 * Room counts are halves in Serbian practice (1.5 = "jednoiposoban"), so the
 * decimal must survive: `1,5` in sr/ru/de, `1.5` in en.
 */
export function formatRooms(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Serbian typography does not leave a one-letter preposition at the end of a
 * line (u, i, o, a, s, k). `text-wrap: balance` is banned on SplitText elements
 * (CLAUDE.md), so the join is made unbreakable with a non-breaking space
 * instead. Safe for en/ru/de too — those single letters are rare there and a
 * NBSP after them is never wrong.
 */
const ORPHANS = /(^|[\s ])([aiouskAIOUSK])\s+/g;

export function fixOrphans(text: string): string {
  return text.replace(ORPHANS, "$1$2 ");
}

/** Percentage change between two prices, negative when the price was reduced. */
export function priceDeltaPct(previous: number, current: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}
