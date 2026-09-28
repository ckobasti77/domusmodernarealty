import { Cormorant_Garamond, JetBrains_Mono, Manrope } from "next/font/google";

/**
 * Shared font definitions (Next's "font definitions file" pattern) so both root
 * layouts and `global-not-found.tsx` instantiate each family exactly once.
 *
 * All three load `latin`, `latin-ext` (Serbian č ć š ž đ, German umlauts) and
 * `cyrillic` (Russian) - see docs/03-DESIGN-SYSTEM.md 2. next/font requires
 * literal option values, so the subset list is repeated rather than shared.
 */

/** Display serif: headlines, editorial numbers, the wordmark. */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500"],
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
export const fontVariables = `${cormorant.variable} ${manrope.variable} ${jetbrainsMono.variable}`;
