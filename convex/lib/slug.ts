/**
 * Diacritic folding and slugs. `foldDiacritics` is the single source of truth
 * for the sr-Latn → ASCII mapping and is reused by `lib/search.ts`.
 */

const FOLD_MAP: Record<string, string> = {
  č: "c",
  ć: "c",
  š: "s",
  ž: "z",
  đ: "dj",
  Č: "c",
  Ć: "c",
  Š: "s",
  Ž: "z",
  Đ: "dj",
  ä: "a",
  ö: "o",
  ü: "u",
  ß: "ss",
  á: "a",
  à: "a",
  â: "a",
  é: "e",
  è: "e",
  ê: "e",
  í: "i",
  ì: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  ú: "u",
  ù: "u",
  ñ: "n",
  ç: "c",
};

/** Lowercases and folds every diacritic we care about to ASCII. */
export function foldDiacritics(input: string): string {
  let out = "";
  for (const char of input) {
    const mapped = FOLD_MAP[char];
    out += mapped ?? char;
  }
  return out.toLowerCase();
}

/** ASCII, hyphen-separated slug. Never empty (falls back to "x"). */
export function slugify(input: string): string {
  const slug = foldDiacritics(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "x";
}

/** `trosoban-stan-vracar-me-1042` — stable across locales, includes the ref. */
export function listingSlug(titleSrLatn: string, ref: string): string {
  return `${slugify(titleSrLatn)}-${slugify(ref)}`;
}

/** `ME-1042` from a running number. */
export function formatRef(n: number): string {
  return `ME-${1000 + n}`;
}

/** Parses the numeric part back out of a ref; returns 0 when unparseable. */
export function refNumber(ref: string): number {
  const match = /(\d+)$/.exec(ref);
  return match ? Number(match[1]) : 0;
}
