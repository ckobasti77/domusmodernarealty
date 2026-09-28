import type { Floor } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";

/**
 * Serbian, English and German count storeys ABOVE the ground floor ("1. sprat"
 * is one flight up), while Russian counts the ground floor as the first
 * («1-й этаж» is at street level). A raw "1" would therefore put a Russian
 * reader one storey too low, so numbered floors and totals shift by one in `ru`.
 * Named floors (PR, VPR, SUT…) are translated words and need no shift.
 */
export function displayFloor(floor: Floor, locale: Locale): Floor {
  return typeof floor === "number" && locale === "ru" ? floor + 1 : floor;
}

/** The building's storey count, shifted the same way so "3 of 5" stays consistent. */
export function displayTotalFloors(total: number | undefined, locale: Locale): number | undefined {
  if (total === undefined) return undefined;
  return locale === "ru" ? total + 1 : total;
}
