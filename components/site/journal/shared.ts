import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { PostCategory } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";
import { BELGRADE_TZ } from "@/lib/belgrade-time";

/**
 * Journal pieces shared by the server pages and the "load more" island:
 * the card DTO, the category list, the grid and the date format. No server
 * imports here, so the client bundle can use it.
 */

/** A published post as the public list returns it (`posts.list`). */
export type PostCard = FunctionReturnType<typeof api.posts.list>["page"][number];

/** Posts per request, for the first server page and each "load more". */
export const JOURNAL_PAGE_SIZE = 12;

/** Every category in the order the filter lists them (`postCategoryV`). */
export const POST_CATEGORIES = [
  "market",
  "guide",
  "neighborhood",
  "legal",
  "interior",
] as const satisfies readonly PostCategory[];

/** `?category=` is visitor input: anything but a known category means "all". */
export function parseCategory(value: string | string[] | undefined): PostCategory | undefined {
  if (typeof value !== "string") return undefined;
  return (POST_CATEGORIES as readonly string[]).includes(value) ? (value as PostCategory) : undefined;
}

/**
 * The post grid. The "load more" list repeats it directly under the server's
 * list, with the row gap as its top margin, so the two read as one grid.
 */
export const POST_GRID = "grid grid-cols-1 gap-x-6 gap-y-16 md:grid-cols-2 lg:grid-cols-3 lg:gap-y-20";
export const POST_GRID_CONTINUED = "mt-16 lg:mt-20";

/** English dates are British (`21 September 2026`), per the brand voice. */
const DATE_LOCALE: Record<Locale, string> = { "sr-Latn": "sr-Latn", en: "en-GB", ru: "ru", de: "de" };

/** A long calendar date on the agency's clock (Belgrade), whatever the server's zone. */
export function formatLongDate(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BELGRADE_TZ,
  }).format(at);
}

/** `YYYY-MM-DD` for `<time dateTime>`, on the same clock as the visible date. */
export function isoDate(at: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BELGRADE_TZ,
  }).format(at);
}
