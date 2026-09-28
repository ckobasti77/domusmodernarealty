import type { Locale } from "@/i18n/routing";

/**
 * Client-safe reader for the localized content shape Convex stores.
 *
 * Convex rejects object keys containing a hyphen, so `sr-Latn` is stored as
 * `sr` (see docs/DECISIONS.md, step 03). This is the browser-side twin of
 * `convex/lib/derive.ts::pickLocale`; keep the two in sync.
 */

export type L10nValue = {
  sr: string;
  en?: string;
  ru?: string;
  de?: string;
};

export type L10nList = {
  sr: string[];
  en?: string[];
  ru?: string[];
  de?: string[];
};

/** next-intl locale → the key the value is stored under. */
export const LOCALE_FIELD: Record<Locale, keyof L10nValue> = {
  "sr-Latn": "sr",
  en: "en",
  ru: "ru",
  de: "de",
};

/**
 * The translation for `locale`, or the Serbian source when it is missing.
 * `lang` is the BCP-47 tag of whatever came back, so callers can mark a
 * fallback with `lang={...}` for SEO and screen readers.
 */
export function pickL10n(value: L10nValue, locale: Locale): { text: string; lang: string } {
  const field = LOCALE_FIELD[locale];
  const translated = value[field];
  if (typeof translated === "string" && translated.length > 0) {
    return { text: translated, lang: locale };
  }
  return { text: value.sr, lang: "sr-Latn" };
}

/** Same rule, for the localized string lists (highlights, bullet lists). */
export function pickL10nList(value: L10nList, locale: Locale): { items: string[]; lang: string } {
  const field = LOCALE_FIELD[locale];
  const translated = value[field];
  if (Array.isArray(translated) && translated.length > 0) {
    return { items: translated, lang: locale };
  }
  return { items: value.sr, lang: "sr-Latn" };
}

/** `true` when this locale has no translation and the Serbian source is shown. */
export function isFallback(value: L10nValue, locale: Locale): boolean {
  return pickL10n(value, locale).lang !== locale;
}
