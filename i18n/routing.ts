import { defineRouting } from "next-intl/routing";

/**
 * The four public locales. `sr-Latn` is the default and is served under `/sr`.
 * The internal (canonical) pathnames below are English; every locale gets its
 * own localized segment, per docs/02-ARCHITECTURE.md §4.
 */
export const locales = ["sr-Latn", "en", "ru", "de"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "sr-Latn";

/** Prefix shown in the URL for each locale (`sr-Latn` is shortened to `/sr`). */
export const localePrefixes = { "sr-Latn": "/sr" } as const;

/** `<html lang>` and hreflang use these exact codes. */
export const htmlLang: Record<Locale, string> = {
  "sr-Latn": "sr-Latn",
  en: "en",
  ru: "ru",
  de: "de",
};

export const pathnames = {
  "/": "/",
  // The site's default share image (a Route Handler, like the two below).
  "/opengraph-image": "/opengraph-image",
  "/properties": {
    "sr-Latn": "/nekretnine",
    en: "/properties",
    ru: "/nedvizhimost",
    de: "/immobilien",
  },
  "/properties/[slug]": {
    "sr-Latn": "/nekretnine/[slug]",
    en: "/properties/[slug]",
    ru: "/nedvizhimost/[slug]",
    de: "/immobilien/[slug]",
  },
  // The per-listing share image (a Route Handler, see its file for why).
  "/properties/[slug]/opengraph-image": {
    "sr-Latn": "/nekretnine/[slug]/opengraph-image",
    en: "/properties/[slug]/opengraph-image",
    ru: "/nedvizhimost/[slug]/opengraph-image",
    de: "/immobilien/[slug]/opengraph-image",
  },
  "/locations": {
    "sr-Latn": "/lokacije",
    en: "/locations",
    ru: "/lokacii",
    de: "/lagen",
  },
  "/locations/[slug]": {
    "sr-Latn": "/lokacije/[slug]",
    en: "/locations/[slug]",
    ru: "/lokacii/[slug]",
    de: "/lagen/[slug]",
  },
  "/valuation": {
    "sr-Latn": "/procena",
    en: "/valuation",
    ru: "/ocenka",
    de: "/bewertung",
  },
  "/sell": {
    "sr-Latn": "/prodajte",
    en: "/sell",
    ru: "/prodat",
    de: "/verkaufen",
  },
  "/agents": {
    "sr-Latn": "/agenti",
    en: "/agents",
    ru: "/agenty",
    de: "/makler",
  },
  "/agents/[slug]": {
    "sr-Latn": "/agenti/[slug]",
    en: "/agents/[slug]",
    ru: "/agenty/[slug]",
    de: "/makler/[slug]",
  },
  "/about": {
    "sr-Latn": "/o-nama",
    en: "/about",
    ru: "/o-nas",
    de: "/ueber-uns",
  },
  "/contact": {
    "sr-Latn": "/kontakt",
    en: "/contact",
    ru: "/kontakty",
    de: "/kontakt",
  },
  "/journal": {
    "sr-Latn": "/magazin",
    en: "/journal",
    ru: "/zhurnal",
    de: "/magazin",
  },
  "/journal/[slug]": {
    "sr-Latn": "/magazin/[slug]",
    en: "/journal/[slug]",
    ru: "/zhurnal/[slug]",
    de: "/magazin/[slug]",
  },
  "/journal/[slug]/opengraph-image": {
    "sr-Latn": "/magazin/[slug]/opengraph-image",
    en: "/journal/[slug]/opengraph-image",
    ru: "/zhurnal/[slug]/opengraph-image",
    de: "/magazin/[slug]/opengraph-image",
  },
  "/favorites": {
    "sr-Latn": "/omiljeno",
    en: "/favorites",
    ru: "/izbrannoe",
    de: "/favoriten",
  },
  "/compare": {
    "sr-Latn": "/uporedi",
    en: "/compare",
    ru: "/sravnit",
    de: "/vergleich",
  },
  "/privacy": {
    "sr-Latn": "/privatnost",
    en: "/privacy",
    ru: "/konfidencialnost",
    de: "/datenschutz",
  },
  "/terms": {
    "sr-Latn": "/uslovi",
    en: "/terms",
    ru: "/usloviya",
    de: "/agb",
  },
  "/cookies": {
    "sr-Latn": "/kolacici",
    en: "/cookies",
    ru: "/cookies",
    de: "/cookies",
  },
  "/styleguide": "/styleguide",
} as const;

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: { mode: "always", prefixes: localePrefixes },
  pathnames,
});
