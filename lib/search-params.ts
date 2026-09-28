import type { Transaction } from "@/convex/lib/validators";

/**
 * URL ⇄ filter contract for the search and valuation routes.
 *
 * The parameter names are deliberately locale-independent: the *path* is
 * localized by next-intl (`/sr/nekretnine`, `/de/immobilien`), the query string
 * is not, so a filtered search can be shared across languages and a switch of
 * locale keeps every filter. Step 06 extends this module with the full filter
 * set and the zod parser; the landing page only ever writes the four keys the
 * hero search bar and the valuation mini-form can express.
 */

export type HomeSearchInput = {
  transaction: Transaction;
  /** Location slug (city, municipality or neighborhood). */
  location?: string;
  /** Free text: street, neighbourhood or listing reference. */
  q?: string;
  priceMax?: number;
};

export type ValuationInput = {
  location?: string;
  /** Floor area in m². */
  area?: number;
};

/** Drops empty values so the URL never carries `?q=&location=`. */
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
  });
}

export function valuationQuery(input: ValuationInput): Record<string, string> {
  return compact({ location: input.location, area: input.area });
}
