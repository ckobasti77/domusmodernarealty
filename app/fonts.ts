import { EB_Garamond, JetBrains_Mono, Manrope } from "next/font/google";

/**
 * Shared font definitions (Next's "font definitions file" pattern) so both root
 * layouts and `global-not-found.tsx` instantiate each family exactly once.
 *
 * next/font self-hosts EVERY subset Google serves for a family (latin,
 * latin-ext, cyrillic…) and the browser picks files by `unicode-range`; the
 * `subsets` option only decides which files are PRELOADED. Preloads compete
 * with the hero photo for the first bytes on a phone, so only what the first
 * paint of nearly every page uses is preloaded: `latin` + `latin-ext` (Serbian
 * č ć š ž đ, German umlauts) of the upright serif and of Manrope. Cyrillic
 * (/ru), the italic serif and the mono accents still load, on demand
 * (docs/DECISIONS.md [12]). next/font requires literal option values, so the
 * subset list is repeated rather than shared.
 */

/**
 * Display serif: headlines, editorial numbers, the wordmark.
 *
 * EB Garamond, NOT Cormorant Garamond (which DESIGN §2 names). Google's
 * Cormorant Garamond latin-ext subset ships precomposed uppercase Č Ć Š Ž Đ but
 * no precomposed LOWERCASE č š ž, so Chrome composes them from U+030C and
 * parks the caron at cap height — "Vračar", "život" and "Niš" render with the
 * mark floating detached above the letter, at every size. EB Garamond is the
 * same garalde voice (both are Claude Garamond revivals), covers latin,
 * latin-ext and cyrillic completely, and renders every Serbian letter
 * correctly. See docs/DECISIONS.md.
 *
 * Its variable range starts at 400, so display text uses `font-normal`, not
 * `font-light`.
 */
export const displaySerif = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal"],
  display: "swap",
  variable: "--font-display-family",
});

/**
 * The italic cut of the same serif, as its own family so it is not preloaded:
 * it only sets pull quotes in articles and the error page's subtitle, never
 * anything in the first viewport. Used through the `font-display-italic` token.
 */
export const displaySerifItalic = EB_Garamond({
  weight: ["400"],
  style: ["italic"],
  display: "swap",
  preload: false,
  variable: "--font-display-italic-family",
});

/** UI sans: body, navigation, prices. Variable 200-800. */
export const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans-family",
});

/** Mono accents: ref codes, coordinates, step numbers. */
export const jetbrainsMono = JetBrains_Mono({
  weight: ["400"],
  display: "swap",
  preload: false,
  variable: "--font-mono-family",
});

/** Class list applied to `<html>` in every root layout. */
export const fontVariables = `${displaySerif.variable} ${displaySerifItalic.variable} ${manrope.variable} ${jetbrainsMono.variable}`;
