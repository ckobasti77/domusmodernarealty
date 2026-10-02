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
 * A map pin's price: short enough for a 20 px tall label. Sale prices drop to
 * thousands ("215k €", "1,25M €" with the locale's decimal mark); rents and
 * small figures stay in full.
 */
export function formatPinPrice(value: number, locale: Locale): string {
  const intl = INTL_LOCALE[locale];
  // The € goes where the locale's full price puts it ("€215k" in en, "215k €" elsewhere).
  const withEuro = (figure: string) => (locale === "en" ? `€${figure}` : `${figure} €`);
  if (value >= 1_000_000) {
    const millions = new Intl.NumberFormat(intl, { maximumFractionDigits: 2 }).format(value / 1_000_000);
    return withEuro(`${millions}M`);
  }
  if (value >= 10_000) {
    const thousands = new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }).format(Math.round(value / 1_000));
    return withEuro(`${thousands}k`);
  }
  return formatPrice(value, locale);
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
 * NBSP after them is never wrong. The lookbehind lets a run of them chain
 * ("i u Beogradu", "и в Белграде"): each one stays with the next word.
 */
const ORPHANS =
  /(?<=^|[\s\u00A0])([aiouskAIOUSK\u0430\u0438\u043E\u0443\u0441\u043A\u0432\u044F\u0410\u0418\u041E\u0423\u0421\u041A\u0412\u042F])\s+/g;

/**
 * Multi-word conjunctions that read as one unit and must not break across a
 * line ("… pre nego / što dođete"). Kept short on purpose: every entry is a
 * chunk that still has to fit a phone's measure at display sizes.
 */
const UNITS = /(^|[\s\u00A0])([Pp]re) nego što(?=[\s\u00A0.,;:!?]|$)/g;

/**
 * A spaced em or en dash never opens a line ("Предложения / — Белград"): it is
 * bound to the word before it and may still break after itself. Ranges
 * without spaces ("9–17 h") are not touched.
 */
const DASH = /[ \t]+([—–])(?=\s)/g;

export function fixOrphans(text: string): string {
  return text
    .replace(ORPHANS, "$1\u00A0")
    .replace(UNITS, "$1$2\u00A0nego\u00A0što")
    .replace(DASH, "\u00A0$1");
}

/**
 * Russian two-letter prepositions and particles stay with the next word
 * ("Прогуляйтесь по / комнатам" never ends a line on "по"). Cyrillic only, so
 * headlines get it too without re-wrapping the sr/en/de ones.
 */
const RU_TWO_LETTER =
  /(?<=^|[\s\u00A0])(по|на|за|до|от|из|об|со|во|не|но|По|На|За|До|От|Из|Об|Со|Во|Не|Но)\s+/g;

/**
 * A German relative pronoun after a comma opens the next line instead of
 * closing this one ("Ein Zuhause, das / man nicht" → "Ein Zuhause, / das man
 * nicht"). Headlines only: a prose measure is long enough not to need it.
 */
const DE_RELATIVE = /(?<=,[ \u00A0])(der|die|das|dem|den|deren|dessen|denen) +/g;

/**
 * `fixOrphans` for display headlines, plus no lone last word: in a headline of
 * three or more words the last two are joined with a non-breaking space when
 * together they stay short ("Koliko vredi / Vaš stan?" instead of "Koliko
 * vredi Vaš / stan?"). `maxChars` caps the joined pair so it can never be wider
 * than a phone's measure at the size it is set in; lower it for larger type.
 */
export function fixWidows(text: string, maxChars = 16): string {
  const fixed = fixOrphans(text).replace(RU_TWO_LETTER, "$1\u00A0").replace(DE_RELATIVE, "$1\u00A0");
  const words = fixed.split(" ");
  if (words.length < 3) return fixed;
  const last = words.at(-1) ?? "";
  const before = words.at(-2) ?? "";
  if (before.length + 1 + last.length > maxChars) return fixed;
  return `${words.slice(0, -2).join(" ")} ${before}\u00A0${last}`;
}

/** Percentage change between two prices, negative when the price was reduced. */
export function priceDeltaPct(previous: number, current: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** `50.396.000 RSD` — the informative dinar figure behind the price toggle. */
export function formatRsd(eur: number, rate: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "RSD",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(Math.round((eur * rate) / 1000) * 1000);
}

/**
 * `fixOrphans` plus two rules for running prose (listing descriptions, notices):
 * a number never parts from its unit ("9 m²", "120 metara", "25 god."), and the
 * common two-letter prepositions stay with the next word (sa, na, od, za, do,
 * iz, uz, po, ka; ru по, на, за, до, от, из, об, со, во, не, но). The Latin set
 * is kept out of `fixOrphans` so the landing's measured headlines do not
 * re-wrap.
 */
const NUMBER_UNIT =
  /(\d)\s+(?=(?:m²|м²|m2|m|м|km|км|€|EUR|RSD|min|мин|god\.|godina|metara|минут|metres|meters|Meter|sata|sati|sat|dana|часов|часа|час|дней|hours|hour|days|Stunden|Stunde|Tagen|Tage)(?![\p{L}\d]))/gu;
const TWO_LETTER = /(?<=^|[\s\u00A0])(sa|na|od|za|do|iz|uz|po|ka|Sa|Na|Od|Za|Do|Iz|Uz|Po|Ka)\s+/g;

/** A one-letter prefix and its hyphen ("e-mail", "e-pošta") never end a line. */
const PREFIX_HYPHEN = /(^|[\s(])([eE])-(?=\S)/g;
/** Nor does a numeric one ("3D-Tour", "360°-Tour", "360°-тур"): "360°-" alone at a line end reads as a typo. */
const NUMERIC_PREFIX_HYPHEN = /(\d[\p{L}°]{0,2})-(?=\p{L})/gu;
const WORD_JOINER = String.fromCharCode(0x2060);

export function fixTypography(text: string): string {
  return fixProse(text).replace(TWO_LETTER, "$1\u00A0").replace(RU_TWO_LETTER, "$1\u00A0");
}

/**
 * `fixTypography` without the two-letter glue, for long paragraphs set in a
 * narrow measure (listing descriptions): chaining every "sa", "na", "po" to the
 * next word left lines visibly short. Numbers still keep their units and
 * prefixes their hyphens.
 */
export function fixProse(text: string): string {
  return fixOrphans(text)
    .replace(NUMBER_UNIT, "$1\u00A0")
    .replace(PREFIX_HYPHEN, `$1$2-${WORD_JOINER}`)
    .replace(NUMERIC_PREFIX_HYPHEN, `$1-${WORD_JOINER}`);
}

/** Grouped figure for an input's initial value ("430.000", "5,4"). */
export function formatInputNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2 }).format(value);
}

/**
 * Parses what a visitor typed in the locale's own notation: "430.000" and
 * "5,4" in sr/de, "430 000" in ru, "430,000" and "5.4" in en. The other
 * notation is read too where it cannot mean anything else: a dot or a comma
 * followed by only one or two final digits is a decimal mark in every locale
 * ("5.4" in sr, "5,4" in en; nobody types a group separator there), and where
 * the group separator is a space (ru) a dot before groups of exactly three
 * digits is grouping ("430.000").
 */
export function parseLocaleNumber(input: string, locale: Locale): number | null {
  const parts = new Intl.NumberFormat(INTL_LOCALE[locale]).formatToParts(12345.6);
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  let text = input.trim().replace(/[\s\u00A0\u202F]/g, "");
  if (text.length === 0) return null;
  if (/^\d+[.,]\d{1,2}$/.test(text)) {
    text = text.replace(/[.,]/, decimal);
  } else if (/^\s$/.test(group) && /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) {
    text = text.split(".").join("");
  }
  text = text.split(group).join("").replace(decimal, ".");
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
