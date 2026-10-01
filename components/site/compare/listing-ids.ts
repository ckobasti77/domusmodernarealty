import type { Id } from "@/convex/_generated/dataModel";

/**
 * Listing ids reach the favorites and compare pages from places a visitor can
 * edit: `localStorage` and the `?ids=` of a shared link. Convex validates them
 * with `v.id("listings")`, and ONE malformed id makes the whole query throw, so
 * everything is screened here first and a bad value is simply left out.
 *
 * Convex document ids are lowercase base-32 strings of roughly 32 characters.
 * The check is deliberately loose about the length (the encoding may grow) and
 * strict about the alphabet, which is what keeps `garbage`, `../x` or a URL out.
 */
const LISTING_ID = /^[0-9a-z]{24,40}$/;

/**
 * How many listings a shared comparison may carry. It mirrors `COMPARE_MAX`
 * (lib/stores/compare.ts, a client module the server page cannot read a value
 * from) and the cap `listings.detailsByIds` applies on its side.
 */
export const COMPARE_URL_MAX = 4;

export function isListingId(value: string): value is Id<"listings"> {
  return LISTING_ID.test(value);
}

/**
 * The `?ids=` of a compare link: `null` when the parameter is absent (the page
 * then reads this device's selection), otherwise the well-formed, de-duplicated
 * ids in link order, capped at four. Repeated parameters (`?ids=a&ids=b`) are
 * read as one list.
 */
export function parseIdsParam(raw: string | string[] | undefined): Id<"listings">[] | null {
  if (raw === undefined) return null;
  const values = (Array.isArray(raw) ? raw : [raw]).flatMap((value) => value.split(","));
  const ids: Id<"listings">[] = [];
  for (const value of values) {
    const id = value.trim();
    if (isListingId(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === COMPARE_URL_MAX) break;
  }
  return ids;
}
