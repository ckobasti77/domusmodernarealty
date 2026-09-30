/**
 * Search normalization, in-JS post-filtering and index (driver) selection.
 *
 * Convex limits that shape this (docs/DECISIONS.md, step 03):
 *  - a search index has one search field, equality-only filter fields, relevance
 *    order only, and scans at most 1024 documents;
 *  - a regular index can range only on its LAST field;
 *  - there is no count operator, and `.collect()` is banned.
 *
 * So: one denormalized `scope` drives every index, a range (price/area) wins the
 * index choice over the requested sort, and everything else is post-filtered in
 * a bounded loop.
 */
import type { Doc } from "../_generated/dataModel";
import { inBbox, publicCoords } from "./geo";
import { foldDiacritics } from "./slug";
import type {
  Features,
  ListingStatus,
  SearchFilters,
  Sort,
  Transaction,
  Visibility,
} from "./validators";
import { FEATURE_KEYS } from "./validators";

/**
 * Documents one `listings.search` page reads from its driver index. Convex
 * allows a single `.paginate()` per function, so a page is one window of at
 * least this many documents, post-filtered.
 */
export const SEARCH_SCAN = 120;
/** Documents `listings.count` reads (one `.take()`); beyond it the count is "N+". */
export const COUNT_SCAN = 600;
export const MAX_POINTS = 1000;
/** `withSearchIndex` cap; the Convex hard limit is 1024 scanned docs. */
export const TEXT_TAKE = 200;

/**
 * The one normalizer. Used both to build `listings.searchText` and to normalize
 * the user's query, so "Vračar", "vracar" and "VRAČAR" all match.
 */
export function normalizeText(input: string): string {
  return foldDiacritics(input)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** The haystack stored on every listing. */
export function buildSearchText(parts: readonly (string | undefined)[]): string {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const part of parts) {
    if (part === undefined || part.length === 0) continue;
    for (const word of normalizeText(part).split(" ")) {
      if (word.length === 0 || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
    }
  }
  return words.join(" ");
}

/* --------------------------------------------------------------- scope keys */

/**
 * Three buckets, so every public query needs exactly ONE index range and the
 * pagination cursor stays a single Convex cursor (no k-way merge):
 *  - `listed`  — on the market and in search results (published, reserved)
 *  - `closed`  — reachable by URL with a Prodato/Izdato ribbon (sold, rented)
 *  - `hidden`  — never public (draft, review, withdrawn, archived, or a
 *                non-public `visibility`)
 */
export type ScopeBucket = "listed" | "closed" | "hidden";

export function bucketOf(status: ListingStatus, visibility: Visibility): ScopeBucket {
  if (visibility !== "public") return "hidden";
  if (status === "published" || status === "reserved") return "listed";
  if (status === "sold" || status === "rented") return "closed";
  return "hidden";
}

export function scopeKey(bucket: ScopeBucket, transaction: Transaction): string {
  return `${bucket}:${transaction}`;
}

/** The single scope every public search, count and map query reads. */
export function listedScope(transaction: Transaction): string {
  return scopeKey("listed", transaction);
}

/** `bySlug` accepts both public buckets. */
export function isPublicScope(scope: string): boolean {
  return scope.startsWith("listed:") || scope.startsWith("closed:");
}

/* ------------------------------------------------------------ driver choice */

export type Driver =
  | "price"
  | "pricePerM2"
  | "areaM2"
  | "publishedAt"
  | "cityPrice"
  | "municipalityPrice"
  | "neighborhoodPublishedAt"
  | "text";

export type DriverPlan = {
  driver: Driver;
  /** True when the chosen index cannot honour `sort`; we sort in the window. */
  orderedInWindow: boolean;
};

const PRICE_SORTS: readonly Sort[] = ["price_asc", "price_desc"];
const PPM2_SORTS: readonly Sort[] = ["ppm2_asc", "ppm2_desc"];

/**
 * Picks the index that does the most work. A range filter must sit on the last
 * indexed field, so a price/area range outranks the requested sort order.
 */
export function pickDriver(filters: SearchFilters, sort: Sort): DriverPlan {
  // `normalizeText("###")` is empty, and an empty search string is not a valid
  // search-index query — fall through to the normal drivers.
  if (filters.q !== undefined && normalizeText(filters.q).length > 0) {
    return { driver: "text", orderedInWindow: sort !== "relevance" };
  }

  const hasPriceRange =
    filters.priceMin !== undefined || filters.priceMax !== undefined;
  const hasAreaRange =
    filters.areaMin !== undefined || filters.areaMax !== undefined;

  // The location arrays are one OR-ed multi-select (see `searchFiltersV`), so a
  // location-specific index is only exact when exactly ONE place is selected.
  const locationCount =
    (filters.cityId?.length ?? 0) +
    (filters.municipalityId?.length ?? 0) +
    (filters.neighborhoodId?.length ?? 0);
  const singleCity = locationCount === 1 && filters.cityId?.length === 1;
  const singleMunicipality =
    locationCount === 1 && filters.municipalityId?.length === 1;
  const singleNeighborhood =
    locationCount === 1 && filters.neighborhoodId?.length === 1;

  if (hasPriceRange) {
    if (singleCity) {
      return {
        driver: "cityPrice",
        orderedInWindow: !PRICE_SORTS.includes(sort),
      };
    }
    if (singleMunicipality) {
      return {
        driver: "municipalityPrice",
        orderedInWindow: !PRICE_SORTS.includes(sort),
      };
    }
    return { driver: "price", orderedInWindow: !PRICE_SORTS.includes(sort) };
  }

  if (hasAreaRange) {
    return { driver: "areaM2", orderedInWindow: sort !== "area_desc" };
  }

  if (singleNeighborhood) {
    return {
      driver: "neighborhoodPublishedAt",
      orderedInWindow: sort !== "newest",
    };
  }

  if (singleCity && PRICE_SORTS.includes(sort)) {
    return { driver: "cityPrice", orderedInWindow: false };
  }

  if (PRICE_SORTS.includes(sort)) return { driver: "price", orderedInWindow: false };
  if (PPM2_SORTS.includes(sort)) {
    return { driver: "pricePerM2", orderedInWindow: false };
  }
  if (sort === "area_desc") return { driver: "areaM2", orderedInWindow: false };
  return { driver: "publishedAt", orderedInWindow: false };
}

/** The filter keys each driver's index range expresses by itself. */
const DRIVER_COVERS: Record<Driver, readonly (keyof SearchFilters)[]> = {
  price: ["priceMin", "priceMax"],
  cityPrice: ["cityId", "priceMin", "priceMax"],
  municipalityPrice: ["municipalityId", "priceMin", "priceMax"],
  areaM2: ["areaMin", "areaMax"],
  neighborhoodPublishedAt: ["neighborhoodId", "publishedAfter"],
  publishedAt: ["publishedAfter"],
  pricePerM2: [],
  text: [],
};

/**
 * True when the driver's index range IS the result set (every active filter is
 * part of the range), so a page can be exactly `numItems` long with an exact
 * cursor. Otherwise the page must scan a wider window and post-filter it.
 */
export function coveredByDriver(filters: SearchFilters, plan: DriverPlan): boolean {
  if (plan.driver === "text") return false;
  const covered = new Set<string>(["transaction", ...DRIVER_COVERS[plan.driver]]);
  return Object.entries(filters).every(
    ([key, value]) =>
      value === undefined || (Array.isArray(value) && value.length === 0) || covered.has(key),
  );
}

/** Descending for the "biggest/newest first" sorts. */
export function driverDescending(sort: Sort): boolean {
  return (
    sort === "newest" ||
    sort === "price_desc" ||
    sort === "ppm2_desc" ||
    sort === "area_desc"
  );
}

/* ----------------------------------------------------------- post-filtering */

function includesAny<T>(selected: readonly T[] | undefined, value: T): boolean {
  if (selected === undefined || selected.length === 0) return true;
  return selected.includes(value);
}

function includesAnyOf<T>(
  selected: readonly T[] | undefined,
  values: readonly T[],
): boolean {
  if (selected === undefined || selected.length === 0) return true;
  return selected.some((item) => values.includes(item));
}

function matchesFloorBands(
  listing: Doc<"listings">,
  bands: SearchFilters["floorBands"],
): boolean {
  if (bands === undefined || bands.length === 0) return true;
  return bands.every((band) => {
    switch (band) {
      case "not_ground":
        return listing.floorNum > 0.5;
      case "not_top":
        return (
          listing.totalFloors === undefined ||
          listing.floorNum < listing.totalFloors
        );
      case "ground":
        return listing.floorNum >= 0 && listing.floorNum <= 0.5;
      case "attic":
        return listing.floor === "PK";
    }
  });
}

/**
 * One multi-select across the three levels: in ANY selected city, municipality
 * or neighborhood. No location selected means everywhere.
 */
function matchesLocation(listing: Doc<"listings">, filters: SearchFilters): boolean {
  const cities = filters.cityId ?? [];
  const municipalities = filters.municipalityId ?? [];
  const neighborhoods = filters.neighborhoodId ?? [];
  if (cities.length + municipalities.length + neighborhoods.length === 0) return true;
  if (cities.includes(listing.cityId)) return true;
  if (
    listing.municipalityId !== undefined &&
    municipalities.includes(listing.municipalityId)
  ) {
    return true;
  }
  return (
    listing.neighborhoodId !== undefined &&
    neighborhoods.includes(listing.neighborhoodId)
  );
}

/** PRD A3 "terasa/lođa/balkon" is one toggle: any private outdoor space. */
function hasOutdoorSpace(features: Features): boolean {
  return (
    features.terrace || features.loggia || features.balcony || features.frenchBalcony
  );
}

function isFeatureKey(key: string): key is keyof Features {
  return (FEATURE_KEYS as readonly string[]).includes(key);
}

/**
 * Every predicate the driver index could not express. Shared verbatim with the
 * convex-test fixtures so the tests exercise the production logic.
 */
export function matches(listing: Doc<"listings">, filters: SearchFilters): boolean {
  if (listing.visibility !== "public") return false;
  if (listing.transaction !== filters.transaction) return false;
  if (!includesAny(filters.propertyType, listing.propertyType)) return false;
  if (
    filters.subtype !== undefined &&
    filters.subtype.length > 0 &&
    (listing.subtype === undefined || !filters.subtype.includes(listing.subtype))
  ) {
    return false;
  }

  if (!matchesLocation(listing, filters)) return false;

  if (filters.priceMin !== undefined && listing.price < filters.priceMin) return false;
  if (filters.priceMax !== undefined && listing.price > filters.priceMax) return false;
  if (filters.areaMin !== undefined && listing.areaM2 < filters.areaMin) return false;
  if (filters.areaMax !== undefined && listing.areaM2 > filters.areaMax) return false;

  if (filters.roomsMin !== undefined && listing.rooms < filters.roomsMin) return false;
  if (filters.roomsMax !== undefined && listing.rooms > filters.roomsMax) return false;
  if (filters.rooms !== undefined && filters.rooms.length > 0) {
    // 5+ is expressed as the value 5 and matches anything larger.
    const cap = Math.max(...filters.rooms);
    const matchesExact = filters.rooms.includes(listing.rooms);
    const matchesCap = cap >= 5 && listing.rooms >= cap;
    if (!matchesExact && !matchesCap) return false;
  }

  if (filters.floorMin !== undefined && listing.floorNum < filters.floorMin) {
    return false;
  }
  if (filters.floorMax !== undefined && listing.floorNum > filters.floorMax) {
    return false;
  }
  if (!matchesFloorBands(listing, filters.floorBands)) return false;

  if (!includesAnyOf(filters.heating, listing.heating)) return false;
  if (!includesAny(filters.construction, listing.constructionType)) return false;
  if (!includesAny(filters.condition, listing.condition)) return false;
  if (!includesAny(filters.furnishing, listing.furnishing)) return false;
  if (
    filters.energyClass !== undefined &&
    filters.energyClass.length > 0 &&
    (listing.energyClass === undefined ||
      !filters.energyClass.includes(listing.energyClass))
  ) {
    return false;
  }
  if (!includesAnyOf(filters.parking, listing.parking)) return false;

  if (filters.features !== undefined) {
    for (const key of filters.features) {
      if (!isFeatureKey(key)) continue;
      if (listing.features[key] !== true) return false;
    }
  }

  if (filters.registered === true && listing.legal.registration !== "registered") {
    return false;
  }
  if (filters.moveIn === true && listing.constructionType === "under_construction") {
    return false;
  }
  if (filters.vatRefund === true && listing.vatRefundEligible !== true) return false;
  if (filters.mortgage === true && listing.mortgageEligible !== true) return false;
  if (filters.exclusive === true && !listing.isExclusive) return false;
  if (filters.outdoor === true && !hasOutdoorSpace(listing.features)) return false;
  if (filters.hasTour === true && !listing.hasTour) return false;
  if (filters.agentId !== undefined && listing.agentId !== filters.agentId) {
    return false;
  }
  if (
    filters.publishedAfter !== undefined &&
    (listing.publishedAt === undefined || listing.publishedAt < filters.publishedAfter)
  ) {
    return false;
  }
  if (filters.bbox !== undefined) {
    const point = publicCoords(
      listing.location.lat,
      listing.location.lng,
      listing.location.addressVisibility,
    );
    if (!inBbox(point, filters.bbox)) return false;
  }

  return true;
}

/** In-window ordering for the cases the index could not sort. */
export function compareListings(
  a: Doc<"listings">,
  b: Doc<"listings">,
  sort: Sort,
): number {
  switch (sort) {
    case "price_asc":
      return a.price - b.price;
    case "price_desc":
      return b.price - a.price;
    case "ppm2_asc":
      return a.pricePerM2 - b.pricePerM2;
    case "ppm2_desc":
      return b.pricePerM2 - a.pricePerM2;
    case "area_desc":
      return b.areaM2 - a.areaM2;
    case "relevance":
      return 0;
    case "newest":
      return (b.publishedAt ?? b._creationTime) - (a.publishedAt ?? a._creationTime);
  }
}
