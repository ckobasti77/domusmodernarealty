import { displayFloor } from "@/components/site/listing/floor";
import type { Locale } from "@/i18n/routing";
import { formatArea, formatPrice } from "./format";
import { floorName, roomsKey, type ListingTranslator } from "./listing-text";
import {
  ROOMS_PLUS,
  type FilterChip,
  type FloorValue,
  type SearchState,
  type SortOption,
} from "./search-params";

/**
 * Wording for the search page, shared by the Server Component (title, meta,
 * breadcrumb) and the client island (chips, summaries). Each function takes
 * next-intl translators, so the same code runs with `getTranslations` and
 * `useTranslations`.
 */
export type SearchTranslators = {
  search: ListingTranslator;
  filters: ListingTranslator;
  listing: ListingTranslator;
  units: ListingTranslator;
};

/** Localized place name for a slug, or `undefined` for an unknown slug. */
export type PlaceName = (slug: string) => string | undefined;

const INTL: Record<Locale, string> = { "sr-Latn": "sr-Latn-RS", en: "en-GB", ru: "ru-RU", de: "de-DE" };

/** "2,5" / "2.5", and "5+" for the open-ended chip. */
export function roomsShort(rooms: number, locale: Locale): string {
  if (rooms >= ROOMS_PLUS) return `${ROOMS_PLUS}+`;
  return new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 1 }).format(rooms);
}

/** "Trosoban" — the Serbian structure word behind a chip, for its accessible name. */
export function roomsLong(t: SearchTranslators, rooms: number): string {
  const key = roomsKey(rooms);
  const word = key !== null ? t.listing(`structure.${key}`) : t.units("rooms", { count: rooms });
  return rooms >= ROOMS_PLUS ? `${word}+` : word;
}

/** A floor as the listing page prints it (Russian numbers shift by one). */
export function floorText(t: SearchTranslators, value: FloorValue, locale: Locale): string {
  return floorName(t.listing, displayFloor(value, locale));
}

function money(value: number, state: SearchState, t: SearchTranslators, locale: Locale): string {
  const base = formatPrice(value, locale);
  return state.transaction === "rent" ? `${base} ${t.units("perMonth")}` : base;
}

function rangeText(
  t: SearchTranslators,
  min: number | undefined,
  max: number | undefined,
  format: (value: number) => string,
): string {
  if (min !== undefined && max !== undefined) {
    return t.search("chips.range", { from: format(min), to: format(max) });
  }
  if (min !== undefined) return t.search("chips.from", { value: format(min) });
  return t.search("chips.to", { value: format(max ?? 0) });
}

export function priceText(t: SearchTranslators, state: SearchState, locale: Locale): string | undefined {
  if (state.priceMin === undefined && state.priceMax === undefined) return undefined;
  return rangeText(t, state.priceMin, state.priceMax, (value) => money(value, state, t, locale));
}

export function areaText(t: SearchTranslators, state: SearchState, locale: Locale): string | undefined {
  if (state.areaMin === undefined && state.areaMax === undefined) return undefined;
  return rangeText(t, state.areaMin, state.areaMax, (value) => formatArea(value, locale, t.units("m2")));
}

export function floorRangeText(t: SearchTranslators, state: SearchState, locale: Locale): string | undefined {
  if (state.floorMin === undefined && state.floorMax === undefined) return undefined;
  const range =
    state.floorMin !== undefined && state.floorMax !== undefined
      ? t.search("chips.range", { from: floorText(t, state.floorMin, locale), to: floorText(t, state.floorMax, locale) })
      : state.floorMin !== undefined
        ? t.search("chips.from", { value: floorText(t, state.floorMin, locale) })
        : t.search("chips.to", { value: floorText(t, state.floorMax ?? 0, locale) });
  return t.search("chips.floor", { range });
}

export function chipLabel(
  t: SearchTranslators,
  chip: FilterChip,
  state: SearchState,
  locale: Locale,
  placeName: PlaceName,
): string {
  switch (chip.kind) {
    case "type":
      return t.listing(`propertyType.${chip.value}`);
    case "location":
      return placeName(chip.value) ?? chip.value;
    case "q":
      return t.search("chips.query", { q: chip.value });
    case "price":
      return priceText(t, state, locale) ?? "";
    case "area":
      return areaText(t, state, locale) ?? "";
    case "rooms":
      return roomsLong(t, chip.value);
    case "floor":
      return floorRangeText(t, state, locale) ?? "";
    case "notGround":
      return t.filters("notGround");
    case "notTop":
      return t.filters("notTop");
    case "heating":
      return t.listing(`heatingValue.${chip.value}`);
    case "construction":
      return t.listing(`construction.${chip.value}`);
    case "toggle":
      return t.filters(`toggle.${chip.value}`);
    case "added":
      return t.filters(`added.${chip.value}`);
    case "bbox":
      return t.search("chips.bbox");
  }
}

/**
 * "Stanovi na prodaju — Vračar": the H1, the `<title>` and the breadcrumb leaf.
 * One property type names the listing kind, otherwise the generic phrase; two
 * places are named ("Vračar i Dorćol"), more are counted ("3 lokacije"), so
 * the H1 keeps one line.
 */
export function searchTitle(t: SearchTranslators, state: SearchState, placeName: PlaceName): string {
  const type = state.types.length === 1 ? state.types[0] : "all";
  const title = t.search(`title.${type}`, { transaction: state.transaction });
  const places = state.locations
    .map((slug) => placeName(slug))
    .filter((name): name is string => name !== undefined);
  if (places.length === 0) return title;
  const place =
    places.length === 1
      ? places[0]
      : places.length === 2
        ? t.search("placePair", { first: places[0], second: places[1] })
        : t.search("placeCount", { count: places.length });
  return t.search("titleWithPlace", { title, place });
}

/** The title names more than the transaction (a type or a place): worth a breadcrumb leaf. */
export function titleIsSpecific(state: SearchState): boolean {
  return state.types.length === 1 || state.locations.length > 0;
}

/** A plain-language summary of the search, used to prefill the contact form. */
export function searchSummary(
  t: SearchTranslators,
  state: SearchState,
  locale: Locale,
  placeName: PlaceName,
): string {
  const parts = [searchTitle(t, state, placeName)];
  const price = priceText(t, state, locale);
  if (price !== undefined) parts.push(price);
  const area = areaText(t, state, locale);
  if (area !== undefined) parts.push(area);
  if (state.rooms.length > 0) parts.push(state.rooms.map((rooms) => roomsLong(t, rooms)).join(" / "));
  for (const key of state.toggles) parts.push(t.filters(`toggle.${key}`));
  return parts.join(", ");
}

export const SORT_LABEL_KEYS: Record<SortOption, string> = {
  newest: "sortNewest",
  price_asc: "sortPriceAsc",
  price_desc: "sortPriceDesc",
  ppm2_asc: "sortPricePerM2Asc",
  ppm2_desc: "sortPricePerM2Desc",
  area_desc: "sortAreaDesc",
  relevance: "sortRelevance",
};
