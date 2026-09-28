import type { Transaction } from "@/convex/lib/validators";

/**
 * URL ⇄ filter contract for the search and valuation routes.
 *
 * Parameter names are locale-independent and match `searchFiltersV` in
 * `convex/lib/validators.ts`: the *path* is localized by next-intl
 * (`/sr/nekretnine`, `/de/immobilien`), the query string is not, so a filtered
 * search can be shared across languages and a locale switch keeps every filter.
 * Step 06 extends this module with the full filter set and its parser; the
 * landing only writes the keys below.
 *
 * `location` is a location SLUG (city, municipality or neighborhood), resolved
 * to ids by the search page; `transaction` is always present because every
 * Convex search runs inside exactly one transaction scope.
 */

export type SearchTransaction = Transaction;

export type HomeSearchInput = {
  transaction: SearchTransaction;
  location?: string;
  /** Free text: street, neighbourhood or listing reference. */
  q?: string;
  priceMax?: number;
  /** Only listings with a 360° tour or a 3D walkthrough. */
  hasTour?: boolean;
};

export type ValuationInput = {
  location?: string;
  /** Floor area in m². */
  area?: number;
};

/** Drops empty values so a URL never carries `?q=&location=`. */
function compact(input: Record<string, string | number | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) out[key] = text;
  }
  return out;
}

export function searchQuery(input: HomeSearchInput): Record<string, string> {
  return compact({
    transaction: input.transaction,
    location: input.location,
    q: input.q,
    priceMax: input.priceMax,
    hasTour: input.hasTour === true ? "1" : undefined,
  });
}

export function valuationQuery(input: ValuationInput): Record<string, string> {
  return compact({ location: input.location, area: input.area });
}
