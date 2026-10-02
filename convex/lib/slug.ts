/**
 * Diacritic folding and slugs. `foldDiacritics` is the single source of truth
 * for the sr-Latn / Cyrillic → ASCII mapping and is reused by `lib/search.ts`,
 * the contact search and every client-side filter box.
 */

/**
 * Letters that are not a base letter plus combining marks, so NFD cannot fold
 * them: đ, ß, the Serbian Latin digraph letters, and Serbian and Russian
 * Cyrillic (lowercase; the input is lowercased first). The Cyrillic mapping
 * lands on the same tokens as the Latin folding, so "Врачар" is "vracar"
 * like "Vračar", and the Russian spellings "Дорчол" and "Сеньяк" meet the
 * Serbian "Дорћол" / "Dorćol" and "Сењак" / "Senjak".
 */
const LETTERS: Record<string, string> = {
  đ: "dj",
  ß: "ss",
  ǆ: "dz",
  ǉ: "lj",
  ǌ: "nj",
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  ђ: "dj",
  е: "e",
  ё: "e",
  ѐ: "e",
  ж: "z",
  з: "z",
  и: "i",
  ѝ: "i",
  й: "j",
  ј: "j",
  к: "k",
  л: "l",
  љ: "lj",
  м: "m",
  н: "n",
  њ: "nj",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  ћ: "c",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "c",
  џ: "dz",
  ш: "s",
  щ: "sc",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "ju",
  я: "ja",
};

const COMBINING_MARKS = /\p{M}/gu;

/**
 * Lowercases, transliterates Cyrillic and folds every diacritic to its base
 * letter ("Čačak", "Ча́чак" and "Cac\u030Cak" are all "cacak").
 * NFC first, so a decomposed "й" (и + breve) is still one letter, "j"; the
 * marks left after the letter table are dropped through NFD.
 */
export function foldDiacritics(input: string): string {
  let out = "";
  for (const char of input.normalize("NFC").toLowerCase()) {
    out += LETTERS[char] ?? char;
  }
  return out.normalize("NFD").replace(COMBINING_MARKS, "");
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

/** `ME-1042` from the absolute reference number. */
export function formatRef(n: number): string {
  return `ME-${n}`;
}

/** The first reference number the agency uses. */
export const FIRST_REF_NUMBER = 1042;

/** Parses the numeric part back out of a ref; returns 0 when unparseable. */
export function refNumber(ref: string): number {
  const match = /(\d+)$/.exec(ref);
  return match ? Number(match[1]) : 0;
}
