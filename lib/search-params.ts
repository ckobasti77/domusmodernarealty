import { z } from "zod";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  ConstructionType,
  Heating,
  PropertyType,
  SearchFilters,
  Sort,
  Transaction,
} from "@/convex/lib/validators";

/**
 * URL ⇄ filter state ⇄ Convex args: the ONE contract of the search (PRD A3).
 * The server page, the filter UI, the map and the e2e tests all go through it.
 *
 * Parameter names are locale-independent: the *path* is localized by next-intl
 * (`/sr/nekretnine`, `/de/immobilien`), the query string is not, so a filtered
 * search can be shared across languages and a locale switch keeps every filter.
 *
 * Parsing never throws. A hand-edited or stale URL degrades to the nearest
 * valid search: unknown values are dropped, numbers are clamped, and a
 * min > max pair is swapped.
 */

/* ------------------------------------------------------------ vocabularies */

export type SearchTransaction = Transaction;

export const TRANSACTIONS = ["sale", "rent"] as const satisfies readonly Transaction[];

export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "commercial",
  "office",
  "land",
  "garage",
  "cottage",
] as const satisfies readonly PropertyType[];

/** PRD A3 structure chips. `5` means "5 or more". */
export const ROOM_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5] as const;
export const ROOMS_PLUS = 5;

/** The heating kinds PRD A3 lists as filters (AC/pellet/other stay detail-only). */
export const HEATING_OPTIONS = [
  "CG",
  "EG",
  "TA",
  "gas",
  "floor",
  "heat_pump",
] as const satisfies readonly Heating[];

export const CONSTRUCTION_OPTIONS = [
  "new",
  "old",
  "under_construction",
] as const satisfies readonly ConstructionType[];

/**
 * Floor codes for the min/max selects, in storey order. The named floors map
 * onto `listings.floorNum` exactly as `convex/lib/money.ts::floorToNumber` does.
 */
export const FLOOR_CODES = ["SUT", "PSUT", "PR", "VPR"] as const;
export type FloorCode = (typeof FLOOR_CODES)[number];
export type FloorValue = FloorCode | number;
export const MAX_FLOOR = 30;
const FLOOR_NUM: Record<FloorCode, number> = { SUT: -1, PSUT: -0.5, PR: 0, VPR: 0.5 };

export function floorToNum(value: FloorValue): number {
  return typeof value === "number" ? value : FLOOR_NUM[value];
}

/** Every value the floor selects offer, lowest first. */
export const FLOOR_OPTIONS: readonly FloorValue[] = [
  ...FLOOR_CODES,
  ...Array.from({ length: MAX_FLOOR }, (_, i) => i + 1),
];

/** The PRD A3 toggles, as URL keys. */
export const TOGGLE_KEYS = [
  "elevator",
  "outdoor",
  "parking",
  "registered",
  "moveIn",
  "furnished",
  "vatRefund",
  "mortgage",
  "exclusive",
  "hasTour",
] as const;
export type ToggleKey = (typeof TOGGLE_KEYS)[number];

/** "Added in the last …" windows, in hours. */
export const ADDED_WINDOWS = { "1d": 24, "3d": 72, "7d": 168, "14d": 336 } as const;
export type AddedWithin = keyof typeof ADDED_WINDOWS;
export const ADDED_OPTIONS = Object.keys(ADDED_WINDOWS) as AddedWithin[];

/** Sorts a visitor can pick (PRD A3). `relevance` exists only with a text query. */
export const SORT_OPTIONS = [
  "newest",
  "price_asc",
  "price_desc",
  "ppm2_asc",
  "ppm2_desc",
  "area_desc",
] as const satisfies readonly Sort[];
export type SortOption = (typeof SORT_OPTIONS)[number] | "relevance";

/** Hard input bounds, so a hand-typed URL cannot ask Convex for nonsense. */
export const LIMITS = {
  price: { min: 0, max: 50_000_000 },
  area: { min: 0, max: 100_000 },
  qLength: 80,
} as const;

/** Page size of the result grid (IMPLEMENTATION-PLAN §1.3). */
export const PAGE_SIZE = 24;

/* ------------------------------------------------------------------- state */

export type Bbox = { west: number; south: number; east: number; north: number };

export type SearchState = {
  transaction: Transaction;
  types: PropertyType[];
  /** Location SLUGS (city, municipality or neighborhood), resolved by the page. */
  locations: string[];
  q?: string;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  rooms: number[];
  floorMin?: FloorValue;
  floorMax?: FloorValue;
  notGround: boolean;
  notTop: boolean;
  heating: Heating[];
  construction: ConstructionType[];
  toggles: ToggleKey[];
  added?: AddedWithin;
  /** Explicit sort from the URL; `effectiveSort` supplies the default. */
  sort?: SortOption;
  /** Present only while "search as I move the map" is on. */
  bbox?: Bbox;
};

export const EMPTY_STATE: SearchState = {
  transaction: "sale",
  types: [],
  locations: [],
  rooms: [],
  notGround: false,
  notTop: false,
  heating: [],
  construction: [],
  toggles: [],
};

/* ----------------------------------------------------------------- parsing */

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(input: RawParams, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Comma lists keep each valid member once, in the vocabulary's canonical order. */
function stringList<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (raw === undefined) return [];
  const tokens = new Set(raw.split(",").map((token) => token.trim()));
  return allowed.filter((value) => tokens.has(value));
}

function numberList(raw: string | undefined, allowed: readonly number[]): number[] {
  if (raw === undefined) return [];
  const tokens = new Set(
    raw
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map(Number),
  );
  return allowed.filter((value) => tokens.has(value));
}

const amountSchema = z.coerce.number().int().nonnegative();

function amount(raw: string | undefined, max: number): number | undefined {
  if (raw === undefined || raw.trim().length === 0) return undefined;
  const parsed = amountSchema.safeParse(raw.replace(/[.\s_]/g, ""));
  if (!parsed.success) return undefined;
  return Math.min(parsed.data, max);
}

function floorValue(raw: string | undefined): FloorValue | undefined {
  if (raw === undefined) return undefined;
  const upper = raw.trim().toUpperCase();
  if ((FLOOR_CODES as readonly string[]).includes(upper)) return upper as FloorCode;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_FLOOR ? n : undefined;
}

const bboxSchema = z
  .string()
  .transform((raw) => raw.split(",").map(Number))
  .pipe(z.tuple([z.number(), z.number(), z.number(), z.number()]))
  .refine(
    ([west, south, east, north]) =>
      west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north,
  )
  .transform(([west, south, east, north]) => ({ west, south, east, north }));

const flag = (raw: string | undefined) => raw === "1" || raw === "true";

function ordered<T extends number | undefined>(low: T, high: T): [T, T] {
  if (low !== undefined && high !== undefined && low > high) return [high, low];
  return [low, high];
}

export function parseSearchParams(input: RawParams): SearchState {
  const transaction = readParam(input, "transaction") === "rent" ? "rent" : "sale";
  const [priceMin, priceMax] = ordered(
    amount(readParam(input, "priceMin"), LIMITS.price.max),
    amount(readParam(input, "priceMax"), LIMITS.price.max),
  );
  const [areaMin, areaMax] = ordered(
    amount(readParam(input, "areaMin"), LIMITS.area.max),
    amount(readParam(input, "areaMax"), LIMITS.area.max),
  );

  let floorMin = floorValue(readParam(input, "floorMin"));
  let floorMax = floorValue(readParam(input, "floorMax"));
  if (floorMin !== undefined && floorMax !== undefined && floorToNum(floorMin) > floorToNum(floorMax)) {
    [floorMin, floorMax] = [floorMax, floorMin];
  }

  const q = readParam(input, "q")?.trim().slice(0, LIMITS.qLength);
  const sortRaw = readParam(input, "sort");
  const sort =
    sortRaw !== undefined && ([...SORT_OPTIONS, "relevance"] as readonly string[]).includes(sortRaw)
      ? (sortRaw as SortOption)
      : undefined;
  const addedRaw = readParam(input, "added");
  const bboxRaw = readParam(input, "bbox");
  const bbox = bboxRaw !== undefined ? bboxSchema.safeParse(bboxRaw) : undefined;

  const locations = (readParam(input, "location") ?? "")
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug, index, all) => /^[a-z0-9-]{1,80}$/.test(slug) && all.indexOf(slug) === index)
    .slice(0, 20);

  return {
    transaction,
    types: stringList(readParam(input, "type"), PROPERTY_TYPES),
    locations,
    ...(q !== undefined && q.length > 0 ? { q } : {}),
    ...(priceMin !== undefined ? { priceMin } : {}),
    ...(priceMax !== undefined ? { priceMax } : {}),
    ...(areaMin !== undefined ? { areaMin } : {}),
    ...(areaMax !== undefined ? { areaMax } : {}),
    rooms: numberList(readParam(input, "rooms"), ROOM_OPTIONS),
    ...(floorMin !== undefined ? { floorMin } : {}),
    ...(floorMax !== undefined ? { floorMax } : {}),
    notGround: flag(readParam(input, "notGround")),
    notTop: flag(readParam(input, "notTop")),
    heating: stringList(readParam(input, "heating"), HEATING_OPTIONS),
    construction: stringList(readParam(input, "construction"), CONSTRUCTION_OPTIONS),
    toggles: TOGGLE_KEYS.filter((key) => flag(readParam(input, key))),
    ...(addedRaw !== undefined && addedRaw in ADDED_WINDOWS ? { added: addedRaw as AddedWithin } : {}),
    ...(sort !== undefined ? { sort } : {}),
    ...(bbox?.success === true ? { bbox: bbox.data } : {}),
  };
}

/* ------------------------------------------------------------- serializing */

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/**
 * Canonical query object: fixed key order, defaults omitted (`sale`, no sort),
 * so equal searches produce byte-identical URLs.
 */
export function toQuery(state: SearchState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.transaction !== "sale") out.transaction = state.transaction;
  if (state.types.length > 0) out.type = state.types.join(",");
  if (state.locations.length > 0) out.location = state.locations.join(",");
  if (state.q !== undefined && state.q.length > 0) out.q = state.q;
  if (state.priceMin !== undefined) out.priceMin = String(state.priceMin);
  if (state.priceMax !== undefined) out.priceMax = String(state.priceMax);
  if (state.areaMin !== undefined) out.areaMin = String(state.areaMin);
  if (state.areaMax !== undefined) out.areaMax = String(state.areaMax);
  if (state.rooms.length > 0) out.rooms = state.rooms.join(",");
  if (state.floorMin !== undefined) out.floorMin = String(state.floorMin);
  if (state.floorMax !== undefined) out.floorMax = String(state.floorMax);
  if (state.notGround) out.notGround = "1";
  if (state.notTop) out.notTop = "1";
  if (state.heating.length > 0) out.heating = state.heating.join(",");
  if (state.construction.length > 0) out.construction = state.construction.join(",");
  for (const key of TOGGLE_KEYS) if (state.toggles.includes(key)) out[key] = "1";
  if (state.added !== undefined) out.added = state.added;
  if (state.sort !== undefined && state.sort !== defaultSort(state)) out.sort = state.sort;
  if (state.bbox !== undefined) {
    const { west, south, east, north } = state.bbox;
    out.bbox = [west, south, east, north].map(round4).join(",");
  }
  return out;
}

export function toQueryString(state: SearchState): string {
  return new URLSearchParams(toQuery(state)).toString();
}

/** A stable identity for a search (used to match server data to client args). */
export function searchKey(state: SearchState): string {
  return toQueryString(state);
}

/* ------------------------------------------------------------- derivations */

function defaultSort(state: SearchState): SortOption {
  return state.q !== undefined && state.q.length > 0 ? "relevance" : "newest";
}

/** The sort actually applied: an explicit choice, else relevance for text, else newest. */
export function effectiveSort(state: SearchState): SortOption {
  if (state.sort === "relevance" && (state.q === undefined || state.q.length === 0)) return "newest";
  return state.sort ?? defaultSort(state);
}

/** Ids grouped by tree level, as `searchFiltersV` wants them. */
export type ResolvedLocations = {
  cityId: Id<"locations">[];
  municipalityId: Id<"locations">[];
  neighborhoodId: Id<"locations">[];
};

export const NO_LOCATIONS: ResolvedLocations = { cityId: [], municipalityId: [], neighborhoodId: [] };

/** "parking/garaža" means a place for the car: street-zone parking does not count. */
const CAR_SPACES: NonNullable<SearchFilters["parking"]> = ["garage", "garage_spot", "parking_spot"];

const HOUR = 3_600_000;

/**
 * `added=7d` becomes an absolute `publishedAfter` rounded DOWN to the hour, so
 * a query never reads the clock and the server render and the client island
 * send identical args for the whole hour (IMPLEMENTATION-PLAN §1.4.6).
 */
export function publishedAfter(added: AddedWithin, now: number): number {
  return Math.floor(now / HOUR) * HOUR - ADDED_WINDOWS[added] * HOUR;
}

/** The Convex `searchFiltersV` value for a state. */
export function toConvexFilters(
  state: SearchState,
  locations: ResolvedLocations,
  now: number,
): SearchFilters {
  const has = (key: ToggleKey) => state.toggles.includes(key);
  const floorBands: NonNullable<SearchFilters["floorBands"]> = [];
  if (state.notGround) floorBands.push("not_ground");
  if (state.notTop) floorBands.push("not_top");

  return {
    transaction: state.transaction,
    ...(state.q !== undefined && state.q.length > 0 ? { q: state.q } : {}),
    ...(state.types.length > 0 ? { propertyType: state.types } : {}),
    ...(locations.cityId.length > 0 ? { cityId: locations.cityId } : {}),
    ...(locations.municipalityId.length > 0 ? { municipalityId: locations.municipalityId } : {}),
    ...(locations.neighborhoodId.length > 0 ? { neighborhoodId: locations.neighborhoodId } : {}),
    ...(state.priceMin !== undefined ? { priceMin: state.priceMin } : {}),
    ...(state.priceMax !== undefined ? { priceMax: state.priceMax } : {}),
    ...(state.areaMin !== undefined ? { areaMin: state.areaMin } : {}),
    ...(state.areaMax !== undefined ? { areaMax: state.areaMax } : {}),
    ...(state.rooms.length > 0 ? { rooms: state.rooms } : {}),
    ...(state.floorMin !== undefined ? { floorMin: floorToNum(state.floorMin) } : {}),
    ...(state.floorMax !== undefined ? { floorMax: floorToNum(state.floorMax) } : {}),
    ...(floorBands.length > 0 ? { floorBands } : {}),
    ...(state.heating.length > 0 ? { heating: state.heating } : {}),
    ...(state.construction.length > 0 ? { construction: state.construction } : {}),
    ...(has("elevator") ? { features: ["elevator"] } : {}),
    ...(has("outdoor") ? { outdoor: true } : {}),
    ...(has("parking") ? { parking: CAR_SPACES } : {}),
    ...(has("registered") ? { registered: true } : {}),
    ...(has("moveIn") ? { moveIn: true } : {}),
    ...(has("furnished") ? { furnishing: ["furnished"] } : {}),
    ...(has("vatRefund") ? { vatRefund: true } : {}),
    ...(has("mortgage") ? { mortgage: true } : {}),
    ...(has("exclusive") ? { exclusive: true } : {}),
    ...(has("hasTour") ? { hasTour: true } : {}),
    ...(state.added !== undefined ? { publishedAfter: publishedAfter(state.added, now) } : {}),
    ...(state.bbox !== undefined ? { bbox: state.bbox } : {}),
  };
}

/* ------------------------------------------------------ chips and counting */

/** One removable chip per active value (PRD A3 "active filter chips"). */
export type FilterChip =
  | { kind: "type"; value: PropertyType }
  | { kind: "location"; value: string }
  | { kind: "q"; value: string }
  | { kind: "price" }
  | { kind: "area" }
  | { kind: "rooms"; value: number }
  | { kind: "floor" }
  | { kind: "notGround" }
  | { kind: "notTop" }
  | { kind: "heating"; value: Heating }
  | { kind: "construction"; value: ConstructionType }
  | { kind: "toggle"; value: ToggleKey }
  | { kind: "added"; value: AddedWithin }
  | { kind: "bbox" };

export function activeChips(state: SearchState): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const value of state.locations) chips.push({ kind: "location", value });
  for (const value of state.types) chips.push({ kind: "type", value });
  if (state.q !== undefined) chips.push({ kind: "q", value: state.q });
  if (state.priceMin !== undefined || state.priceMax !== undefined) chips.push({ kind: "price" });
  if (state.areaMin !== undefined || state.areaMax !== undefined) chips.push({ kind: "area" });
  for (const value of state.rooms) chips.push({ kind: "rooms", value });
  if (state.floorMin !== undefined || state.floorMax !== undefined) chips.push({ kind: "floor" });
  if (state.notGround) chips.push({ kind: "notGround" });
  if (state.notTop) chips.push({ kind: "notTop" });
  for (const value of state.heating) chips.push({ kind: "heating", value });
  for (const value of state.construction) chips.push({ kind: "construction", value });
  for (const value of state.toggles) chips.push({ kind: "toggle", value });
  if (state.added !== undefined) chips.push({ kind: "added", value: state.added });
  if (state.bbox !== undefined) chips.push({ kind: "bbox" });
  return chips;
}

export function removeChip(state: SearchState, chip: FilterChip): SearchState {
  const next: SearchState = { ...state };
  switch (chip.kind) {
    case "type":
      next.types = state.types.filter((value) => value !== chip.value);
      break;
    case "location":
      next.locations = state.locations.filter((value) => value !== chip.value);
      break;
    case "q":
      delete next.q;
      if (next.sort === "relevance") delete next.sort;
      break;
    case "price":
      delete next.priceMin;
      delete next.priceMax;
      break;
    case "area":
      delete next.areaMin;
      delete next.areaMax;
      break;
    case "rooms":
      next.rooms = state.rooms.filter((value) => value !== chip.value);
      break;
    case "floor":
      delete next.floorMin;
      delete next.floorMax;
      break;
    case "notGround":
      next.notGround = false;
      break;
    case "notTop":
      next.notTop = false;
      break;
    case "heating":
      next.heating = state.heating.filter((value) => value !== chip.value);
      break;
    case "construction":
      next.construction = state.construction.filter((value) => value !== chip.value);
      break;
    case "toggle":
      next.toggles = state.toggles.filter((value) => value !== chip.value);
      break;
    case "added":
      delete next.added;
      break;
    case "bbox":
      delete next.bbox;
      break;
  }
  return next;
}

/** "Obriši sve": every filter goes; the transaction and the sort stay. */
export function clearFilters(state: SearchState): SearchState {
  const sort = state.sort === "relevance" ? undefined : state.sort;
  return { ...EMPTY_STATE, transaction: state.transaction, ...(sort !== undefined ? { sort } : {}) };
}

/** Filters that live in the "Svi filteri" drawer (the top bar shows the rest). */
export function moreFiltersCount(state: SearchState): number {
  return (
    (state.floorMin !== undefined || state.floorMax !== undefined ? 1 : 0) +
    (state.notGround ? 1 : 0) +
    (state.notTop ? 1 : 0) +
    state.heating.length +
    state.construction.length +
    state.toggles.length +
    (state.added !== undefined ? 1 : 0)
  );
}

export function activeCount(state: SearchState): number {
  return activeChips(state).length;
}

/* --------------------------------------------------------------------- SEO */

/**
 * Curated combinations are indexable landing pages: a transaction plus at most
 * one property type and one place, nothing else (sort and map bounds included).
 * Everything deeper is `noindex, follow` (ARCHITECTURE §9, step 06).
 */
export function isCurated(state: SearchState): boolean {
  return (
    state.types.length <= 1 &&
    state.locations.length <= 1 &&
    state.q === undefined &&
    state.priceMin === undefined &&
    state.priceMax === undefined &&
    state.areaMin === undefined &&
    state.areaMax === undefined &&
    state.rooms.length === 0 &&
    state.floorMin === undefined &&
    state.floorMax === undefined &&
    !state.notGround &&
    !state.notTop &&
    state.heating.length === 0 &&
    state.construction.length === 0 &&
    state.toggles.length === 0 &&
    state.added === undefined &&
    state.bbox === undefined &&
    (state.sort === undefined || state.sort === "newest")
  );
}

/** The clean, canonical form of a curated search (drops the sort). */
export function canonicalState(state: SearchState): SearchState {
  return {
    ...EMPTY_STATE,
    transaction: state.transaction,
    types: state.types.slice(0, 1),
    locations: state.locations.slice(0, 1),
  };
}

/* ------------------------------------------------ landing / valuation links */

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

/** The landing's search entry points write a subset of the same contract. */
export function searchQuery(input: HomeSearchInput): Record<string, string> {
  return toQuery({
    ...EMPTY_STATE,
    transaction: input.transaction,
    locations: input.location !== undefined && input.location.length > 0 ? [input.location] : [],
    ...(input.q !== undefined && input.q.trim().length > 0 ? { q: input.q.trim() } : {}),
    ...(input.priceMax !== undefined ? { priceMax: Math.round(input.priceMax) } : {}),
    toggles: input.hasTour === true ? ["hasTour"] : [],
  });
}

export function valuationQuery(input: ValuationInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (input.location !== undefined && input.location.trim().length > 0) out.location = input.location.trim();
  if (input.area !== undefined) out.area = String(input.area);
  return out;
}
