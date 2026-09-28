import { EB_Garamond, JetBrains_Mono, Manrope } from "next/font/google";

/**
 * Shared font definitions (Next's "font definitions file" pattern) so both root
 * layouts and `global-not-found.tsx` instantiate each family exactly once.
 *
 * All three load `latin`, `latin-ext` (Serbian č ć š ž đ, German umlauts) and
 * `cyrillic` (Russian) - see docs/03-DESIGN-SYSTEM.md 2. next/font requires
 * literal option values, so the subset list is repeated rather than shared.
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
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display-family",
});

/** UI sans: body, navigation, prices. Variable 200-800. */
export const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-sans-family",
});

/** Mono accents: ref codes, coordinates, step numbers. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400"],
  display: "swap",
  variable: "--font-mono-family",
});

/** Class list applied to `<html>` in every root layout. */
export const fontVariables = `${displaySerif.variable} ${manrope.variable} ${jetbrainsMono.variable}`;
