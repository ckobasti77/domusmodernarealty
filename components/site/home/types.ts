/**
 * View models the landing's server components hand to its client islands.
 * They live apart from `data.ts`, which is `server-only`.
 */

/** One option of a location `<select>`, already localized. */
export type LocationOption = {
  slug: string;
  name: string;
  /** 0 city, 1 municipality, 2 neighborhood — rendered as indentation. */
  depth: 0 | 1 | 2;
  /** Published listings per transaction, from the denormalized counters. */
  sale: number;
  rent: number;
};

/** A featured location with the context the neighborhood index shows. */
export type NeighborhoodItem = {
  id: string;
  slug: string;
  name: string;
  /** Set when the name fell back to Serbian, for `lang`. */
  lang?: string;
  /** Parent area, e.g. "Stari grad" for Dorćol. */
  context?: string;
  count: number;
  image?: string;
};
