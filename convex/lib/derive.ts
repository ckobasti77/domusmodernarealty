/**
 * Derived listing fields. Every listing write goes through `applyDerived` so the
 * index drivers (`scope`, `pricePerM2`, `floorNum`, `hasTour`, `searchText`,
 * `mandateEnd`) can never drift from the source fields.
 */
import { externalTourEmbedUrl } from "./tours";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { floorToNumber } from "./money";
import { bucketOf, buildSearchText, scopeKey } from "./search";
import { L10N_KEYS, LOCALE_FIELD } from "./validators";
import type { L10n, Locale } from "./validators";

export type ListingDoc = Doc<"listings">;
/** A listing without system fields and without the derived fields. */
export type ListingInput = Omit<
  ListingDoc,
  "_id" | "_creationTime" | "scope" | "pricePerM2" | "floorNum" | "hasTour" | "searchText" | "mandateEnd"
>;

/** All locale variants of a localized string, in a stable order. */
export function l10nValues(value: L10n | undefined): string[] {
  if (value === undefined) return [];
  return L10N_KEYS.map((key) => value[key]).filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

/** Localized read with the mandated fallback to sr-Latn. */
export function pickLocale(value: L10n, locale: Locale): string {
  const candidate = value[LOCALE_FIELD[locale]];
  return candidate !== undefined && candidate.length > 0 ? candidate : value.sr;
}

export type DerivedFields = Pick<
  ListingDoc,
  "scope" | "pricePerM2" | "floorNum" | "hasTour" | "searchText" | "mandateEnd"
>;

/**
 * `locationNames` are the city/municipality/neighborhood names that go into the
 * search haystack; the caller loads them because this must stay synchronous.
 */
export function applyDerived(
  listing: ListingInput,
  locationNames: readonly string[],
  hasTourScenes = false,
): DerivedFields {
  const area = listing.areaM2 > 0 ? listing.areaM2 : 1;
  const pricePerM2 = Math.round((listing.price / area) * 100) / 100;

  // Only what the detail page will actually open: an unpublished 360° tour's
  // scenes must not earn the card a "360°" badge.
  const tour = listing.tour360;
  const tour360Live =
    tour?.published === true &&
    (tour.provider === "self"
      ? hasTourScenes
      : externalTourEmbedUrl(tour.provider, tour.url, tour.externalId) !== null);
  const hasTour = tour360Live || listing.walk3d?.published === true;

  return {
    scope: scopeKey(bucketOf(listing.status, listing.visibility), listing.transaction),
    pricePerM2,
    floorNum: floorToNumber(listing.floor, listing.totalFloors),
    hasTour,
    mandateEnd: listing.mandate?.end,
    searchText: buildSearchText([
      ...l10nValues(listing.title),
      ...locationNames,
      // Only index the street when the listing actually shows it: otherwise a
      // text search for the street name would confirm a hidden address.
      listing.location.addressVisibility === "exact"
        ? listing.location.street
        : undefined,
      listing.ref,
      listing.propertyType,
      listing.subtype,
      listing.transaction === "sale" ? "prodaja sale kauf" : "izdavanje rent miete",
    ]),
  };
}

/** Loads the names that `applyDerived` needs for the haystack. */
export async function locationNamesFor(
  ctx: QueryCtx,
  ids: {
    cityId: ListingDoc["cityId"];
    municipalityId?: ListingDoc["municipalityId"];
    neighborhoodId?: ListingDoc["neighborhoodId"];
  },
): Promise<string[]> {
  const names: string[] = [];
  for (const id of [ids.cityId, ids.municipalityId, ids.neighborhoodId]) {
    if (id === undefined) continue;
    const location = await ctx.db.get("locations", id);
    if (location !== null) names.push(...l10nValues(location.name));
  }
  return names;
}
