import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type {
  IndexRange,
  NamedTableInfo,
  OrderedQuery,
  PaginationOptions,
  PaginationResult,
} from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import {
  listingCardV,
  listingDetailV,
  mapPointV,
  toCard,
  toDetail,
  toMapPoint,
} from "./lib/dto";
import type { ListingCard, LocationCache } from "./lib/dto";
import { invalidInput } from "./lib/errors";
import {
  COUNT_SCAN,
  MAX_POINTS,
  SEARCH_SCAN,
  TEXT_TAKE,
  compareListings,
  coveredByDriver,
  driverDescending,
  effectiveSort,
  isPublicScope,
  isUnsearchableQuery,
  listedScope,
  matches,
  normalizeText,
  pickDriver,
  rangeDriver,
} from "./lib/search";
import type { Driver, DriverPlan } from "./lib/search";
import { searchFiltersV, sortV } from "./lib/validators";
import type { SearchFilters, Sort } from "./lib/validators";

/** Gallery frames attached to each search result card (PRD A4 carousel). */
const SEARCH_CARD_FRAMES = 5;

/* ------------------------------------------------------------ driver queries */

type ListingQuery = OrderedQuery<NamedTableInfo<DataModel, "listings">>;
type Order = "asc" | "desc";

/** The field each driver's index orders by, after its equality prefix. */
type OrderedField = "price" | "pricePerM2" | "areaM2" | "publishedAt";

/** Text search has no index order: Convex returns it by relevance. */
const ORDERED_FIELD: Record<Driver, OrderedField | undefined> = {
  price: "price",
  cityPrice: "price",
  municipalityPrice: "price",
  pricePerM2: "pricePerM2",
  areaM2: "areaM2",
  publishedAt: "publishedAt",
  neighborhoodPublishedAt: "publishedAt",
  text: undefined,
};

type Bounds = { lower: number | undefined; upper: number | undefined };

/**
 * A filter's range on the ordered field. `from` — a value read from inside
 * that range, where a page resumes — replaces the bound the index is walked
 * from; it is inclusive, and `windowLength` skips the ties already read.
 */
function bounds(
  min: number | undefined,
  max: number | undefined,
  order: Order,
  from: number | undefined,
): Bounds {
  return order === "asc" ? { lower: from ?? min, upper: max } : { lower: min, upper: from ?? max };
}

/**
 * The tail of an index range: the bounds on the field the index orders by.
 * Typed against Convex's builder, so naming a field the index does not order
 * by does not compile.
 */
type OrderedRange<Field extends string> = IndexRange & {
  gte(field: Field, value: number): IndexRange & { lte(field: Field, value: number): IndexRange };
  lte(field: Field, value: number): IndexRange;
};

function within<Field extends string>(
  range: OrderedRange<Field>,
  field: Field,
  { lower, upper }: Bounds,
): IndexRange {
  if (lower !== undefined && upper !== undefined) return range.gte(field, lower).lte(field, upper);
  if (lower !== undefined) return range.gte(field, lower);
  if (upper !== undefined) return range.lte(field, upper);
  return range;
}

/**
 * The index range for a driver, ordered and ready to `.paginate()` or read.
 * `pickDriver` guarantees a range filter only ever lands on the field the
 * index orders by. `from` starts the walk where a page resumes instead of at
 * the range's own start. Text search is handled by the callers (relevance
 * order only).
 */
function driverQuery(
  ctx: QueryCtx,
  scope: string,
  filters: SearchFilters,
  plan: DriverPlan,
  sort: Sort,
  from?: number,
): ListingQuery {
  const order: Order = driverDescending(sort) ? "desc" : "asc";
  const price = bounds(filters.priceMin, filters.priceMax, order, from);
  const published = bounds(filters.publishedAfter, undefined, order, from);
  const listings = ctx.db.query("listings");

  switch (plan.driver) {
    case "cityPrice": {
      const cityId = filters.cityId?.[0];
      if (cityId === undefined) break;
      return listings
        .withIndex("by_scope_and_cityId_and_price", (q) =>
          within(q.eq("scope", scope).eq("cityId", cityId), "price", price),
        )
        .order(order);
    }

    case "municipalityPrice": {
      const municipalityId = filters.municipalityId?.[0];
      if (municipalityId === undefined) break;
      return listings
        .withIndex("by_scope_and_municipalityId_and_price", (q) =>
          within(q.eq("scope", scope).eq("municipalityId", municipalityId), "price", price),
        )
        .order(order);
    }

    case "neighborhoodPublishedAt": {
      const neighborhoodId = filters.neighborhoodId?.[0];
      if (neighborhoodId === undefined) break;
      return listings
        .withIndex("by_scope_and_neighborhoodId_and_publishedAt", (q) =>
          within(q.eq("scope", scope).eq("neighborhoodId", neighborhoodId), "publishedAt", published),
        )
        .order(order);
    }

    case "areaM2":
      return listings
        .withIndex("by_scope_and_areaM2", (q) =>
          within(q.eq("scope", scope), "areaM2", bounds(filters.areaMin, filters.areaMax, order, from)),
        )
        .order(order);

    case "pricePerM2":
      return listings
        .withIndex("by_scope_and_pricePerM2", (q) =>
          within(q.eq("scope", scope), "pricePerM2", bounds(undefined, undefined, order, from)),
        )
        .order(order);

    case "publishedAt":
    case "text":
      break;

    case "price":
      return listings
        .withIndex("by_scope_and_price", (q) => within(q.eq("scope", scope), "price", price))
        .order(order);
  }

  // A location driver whose id went missing falls back to the date index; a
  // price range cannot, so it keeps the global price index.
  if (plan.driver === "cityPrice" || plan.driver === "municipalityPrice") {
    return driverQuery(ctx, scope, filters, { ...plan, driver: "price" }, sort, from);
  }
  return listings
    .withIndex("by_scope_and_publishedAt", (q) => within(q.eq("scope", scope), "publishedAt", published))
    .order(order);
}

/** Relevance-ordered text matches: one bounded read, never a cursor walk. */
async function textMatches(ctx: QueryCtx, scope: string, filters: SearchFilters) {
  // Bounded input: the search index matches on terms, and a pasted paragraph
  // must not become an expensive query.
  const normalized = normalizeText(filters.q ?? "").split(" ").slice(0, MAX_QUERY_TERMS).join(" ");
  // Every equality the search index declares narrows BEFORE the relevance cap,
  // so "stan" in Novi Sad is not crowded out by 200 Belgrade matches.
  const city = onlyCity(filters);
  const type = filters.propertyType?.length === 1 ? filters.propertyType[0] : undefined;
  return await ctx.db
    .query("listings")
    .withSearchIndex("search_text", (q) => {
      let query = q.search("searchText", normalized).eq("scope", scope);
      if (city !== undefined) query = query.eq("cityId", city);
      if (type !== undefined) query = query.eq("propertyType", type);
      if (filters.hasTour === true) query = query.eq("hasTour", true);
      return query;
    })
    .take(TEXT_TAKE);
}

/** The one selected place, when it is a city and nothing else is selected. */
function onlyCity(filters: SearchFilters) {
  const municipalities = filters.municipalityId?.length ?? 0;
  const neighborhoods = filters.neighborhoodId?.length ?? 0;
  return filters.cityId?.length === 1 && municipalities + neighborhoods === 0 ? filters.cityId[0] : undefined;
}

/** Terms kept from a text query. */
const MAX_QUERY_TERMS = 8;
/** Largest page a client may ask for (`usePaginatedQuery` asks for 24). */
const MAX_PAGE = 100;

/* ---------------------------------------------------------------- page cursors */

/** A position in a driver index: the ordered field's value, then `_creationTime`. */
type IndexKey = { value: number; creationTime: number };

/**
 * Where a post-filtered index page starts: Convex's own cursor, plus the index
 * key of the last document before it, so the page can find where its
 * `numItems`-th match lies before it reads (`windowLength`).
 */
type IndexCursor = { native: string | null; after?: IndexKey };

/** Marks the cursors this module writes; any other cursor is Convex's own. */
const CURSOR_TAG = "listings.search";

function indexCursor(native: string, after: IndexKey | undefined): string {
  return JSON.stringify({
    tag: CURSOR_TAG,
    native,
    ...(after !== undefined ? { after: [after.value, after.creationTime] } : {}),
  });
}

function textCursor(offset: number): string {
  return JSON.stringify({ tag: CURSOR_TAG, offset });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The fields of a cursor this module wrote, or null for one of Convex's. */
function ownCursor(cursor: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cursor);
  } catch {
    return null;
  }
  return isRecord(parsed) && parsed.tag === CURSOR_TAG ? parsed : null;
}

function invalidCursor(): never {
  return invalidInput("Nevažeći kursor pretrage.");
}

/** Convex's cursors (a page split by `usePaginatedQuery`) pass through as they are. */
function readIndexCursor(cursor: string | null): IndexCursor {
  if (cursor === null) return { native: null };
  const own = ownCursor(cursor);
  if (own === null) return { native: cursor };
  if (typeof own.native !== "string") return invalidCursor();
  const after = own.after;
  return Array.isArray(after) &&
    after.length === 2 &&
    typeof after[0] === "number" &&
    typeof after[1] === "number"
    ? { native: own.native, after: { value: after[0], creationTime: after[1] } }
    : { native: own.native };
}

function readTextOffset(cursor: string | null): number {
  if (cursor === null) return 0;
  const offset = ownCursor(cursor)?.offset;
  return typeof offset === "number" && Number.isInteger(offset) && offset >= 0 ? offset : invalidCursor();
}

function keyOf(doc: Doc<"listings">, field: OrderedField): IndexKey | undefined {
  const value = doc[field];
  return value === undefined ? undefined : { value, creationTime: doc._creationTime };
}

/* ------------------------------------------------------------------- paging */

/** One page of documents, before they become cards. */
type SearchWindow = {
  docs: Doc<"listings">[];
  isDone: boolean;
  continueCursor: string;
  splitCursor: string | null;
  pageStatus: NonNullable<PaginationResult<Doc<"listings">>["pageStatus"]> | null;
  /** Documents the page covers in the index, for the "approximate" UI hint. */
  scanned: number;
};

/** What a resumed page has already read: the resume key and the ties before it. */
type Resume = { field: OrderedField; after: IndexKey; order: Order };

function readBefore(doc: Doc<"listings">, { field, after, order }: Resume): boolean {
  if (doc[field] !== after.value) return false;
  return order === "asc" ? doc._creationTime <= after.creationTime : doc._creationTime >= after.creationTime;
}

/**
 * How many documents a post-filtered page spans from its start: through its
 * `numItems`-th match, so the page ends on that match and Convex's cursor
 * resumes right after it. At most `limit` documents; a range that ends inside
 * the window is counted one past its end, so the page reports `isDone`.
 * Keys are compared without `_id`, so identical creation times can only make
 * a page shorter, never longer.
 */
async function windowLength(
  scan: ListingQuery,
  filters: SearchFilters,
  numItems: number,
  limit: number,
  resume?: Resume,
): Promise<number> {
  let read = 0;
  let found = 0;
  let skipped = 0;
  for await (const doc of scan) {
    if (resume !== undefined && readBefore(doc, resume)) {
      skipped += 1;
      // A long run of ties: a plain window of `numItems` documents cannot
      // hold more than `numItems` matches.
      if (skipped > limit) return numItems;
      continue;
    }
    if (found === numItems || read === limit) return read;
    read += 1;
    if (matches(doc, filters)) found += 1;
  }
  return read + 1;
}

/**
 * How many documents a post-filtered page starting at `start` paginates over
 * (see `indexPage`).
 */
async function pageLength(
  ctx: QueryCtx,
  scope: string,
  filters: SearchFilters,
  plan: DriverPlan,
  sort: Sort,
  start: IndexCursor,
  numItems: number,
): Promise<number> {
  const limit = Math.max(numItems, SEARCH_SCAN);
  if (start.native === null) {
    return await windowLength(driverQuery(ctx, scope, filters, plan, sort), filters, numItems, limit);
  }
  const field = ORDERED_FIELD[plan.driver];
  if (start.after === undefined || field === undefined) {
    // Convex's own cursor carries no key to read from; a page of `numItems`
    // documents cannot hold more than `numItems` matches.
    return numItems;
  }
  return await windowLength(
    driverQuery(ctx, scope, filters, plan, sort, start.after.value),
    filters,
    numItems,
    limit,
    { field, after: start.after, order: driverDescending(sort) ? "desc" : "asc" },
  );
}

/**
 * One page from a driver index.
 *  - When the index range expresses every filter (`coveredByDriver`), the
 *    page is `paginationOpts` as is: `numItems` long with an exact cursor.
 *  - Otherwise the page is post-filtered (`matches`). A first read finds how
 *    far its `numItems`-th match lies (at most `SEARCH_SCAN` documents), and
 *    the page paginates exactly that far: it holds at most `numItems` cards,
 *    and Convex's cursor resumes right after the last one, so pages never skip
 *    or repeat a listing. A window with fewer matches comes back short and
 *    `usePaginatedQuery` reads on.
 * Convex allows ONE `.paginate()` per function, and only `.paginate()` keeps a
 * page's range fixed while it re-runs reactively (the page may then grow or
 * shrink, never shift), so the first read is a plain one and the page itself
 * is the one `.paginate()`. `paginationOpts` is forwarded whole apart from
 * `cursor`, `endCursor` and `numItems`, so `id` and the read limits keep
 * their native behaviour.
 */
async function indexPage(
  ctx: QueryCtx,
  scope: string,
  filters: SearchFilters,
  plan: DriverPlan,
  sort: Sort,
  options: PaginationOptions,
  numItems: number,
): Promise<SearchWindow> {
  const covered = coveredByDriver(filters, plan);
  const start: IndexCursor = covered ? { native: options.cursor } : readIndexCursor(options.cursor);
  // A page split by `usePaginatedQuery` arrives with `endCursor`: its range is
  // already fixed, and Convex ignores `numItems`.
  const end = options.endCursor;
  const length =
    covered || typeof end === "string"
      ? numItems
      : await pageLength(ctx, scope, filters, plan, sort, start, numItems);

  const window = await driverQuery(ctx, scope, filters, plan, sort).paginate({
    ...options,
    cursor: start.native,
    ...(typeof end === "string" && !covered ? { endCursor: readIndexCursor(end).native } : {}),
    numItems: length,
  });
  if (covered) {
    return {
      docs: window.page,
      isDone: window.isDone,
      continueCursor: window.continueCursor,
      splitCursor: window.splitCursor ?? null,
      pageStatus: window.pageStatus ?? null,
      scanned: window.page.length,
    };
  }

  // The window holds every document up to its cursor, so its last one is the
  // key the next page resumes after (an empty window resumes where it began).
  const field = ORDERED_FIELD[plan.driver];
  const last = window.page.at(-1);
  const after = last === undefined ? start.after : field !== undefined ? keyOf(last, field) : undefined;
  return {
    docs: window.page.filter((doc) => matches(doc, filters)),
    isDone: window.isDone,
    continueCursor: indexCursor(window.continueCursor, after),
    splitCursor: window.splitCursor ?? null,
    pageStatus: window.pageStatus ?? null,
    scanned: window.page.length,
  };
}

/**
 * One page of a text search. The search index returns a bounded,
 * relevance-ordered window (`TEXT_TAKE`), so every page reads that window,
 * filters and orders it the same way, and takes its slice by offset. All
 * loaded pages re-run together on the same data, so their slices stay
 * contiguous.
 */
async function textPage(
  ctx: QueryCtx,
  scope: string,
  filters: SearchFilters,
  plan: DriverPlan,
  sort: Sort,
  cursor: string | null,
  numItems: number,
): Promise<SearchWindow> {
  const found = await textMatches(ctx, scope, filters);
  const matched = found.filter((doc) => matches(doc, filters));
  const ordered = plan.orderedInWindow ? matched.sort((a, b) => compareListings(a, b, sort)) : matched;
  const offset = readTextOffset(cursor);
  const docs = ordered.slice(offset, offset + numItems);
  const next = offset + docs.length;
  const isDone = next >= ordered.length;
  return {
    docs,
    isDone,
    continueCursor: isDone ? "" : textCursor(next),
    splitCursor: null,
    pageStatus: null,
    scanned: found.length,
  };
}

/* ------------------------------------------------------------------- queries */

/**
 * One page of results, at most `numItems` cards (`indexPage`, `textPage`).
 * `splitCursor`/`pageStatus` are passed through, so `usePaginatedQuery` can
 * split a page Convex reports as incomplete instead of skipping its rest.
 */
export const search = query({
  args: {
    filters: searchFiltersV,
    sort: sortV,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listingCardV).extend({
    /** Documents the page covers in the index, for the "approximate" UI hint. */
    scanned: v.number(),
    /** True when the driver index could not honour `sort` on its own (text search). */
    orderedInWindow: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const plan = pickDriver(args.filters, args.sort);
    // A query that folds to nothing matches nothing (`matches` rejects every
    // listing for it): answer without reading. `count` and `mapPoints` too.
    if (isUnsearchableQuery(args.filters.q)) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        splitCursor: null,
        pageStatus: null,
        scanned: 0,
        orderedInWindow: plan.orderedInWindow,
      };
    }
    const sort = effectiveSort(args.filters, args.sort);
    const scope = listedScope(args.filters.transaction);
    const numItems = Math.min(Math.max(Math.floor(args.paginationOpts.numItems) || 1, 1), MAX_PAGE);

    const window =
      plan.driver === "text"
        ? await textPage(ctx, scope, args.filters, plan, sort, args.paginationOpts.cursor, numItems)
        : await indexPage(ctx, scope, args.filters, plan, sort, args.paginationOpts, numItems);

    const cards: ListingCard[] = [];
    const locations: LocationCache = new Map();
    for (const doc of window.docs) {
      cards.push(await toCard(ctx, doc, { gallery: SEARCH_CARD_FRAMES, locations }));
    }

    return {
      page: cards,
      isDone: window.isDone,
      continueCursor: window.continueCursor,
      splitCursor: window.splitCursor,
      pageStatus: window.pageStatus,
      scanned: window.scanned,
      orderedInWindow: plan.orderedInWindow,
    };
  },
});

/**
 * How many listings match, from one bounded read of the driver range
 * (`COUNT_SCAN` documents). `exact` is false when the range holds more than
 * that — the UI then renders "N+".
 */
export const count = query({
  args: { filters: searchFiltersV },
  returns: v.object({ count: v.number(), exact: v.boolean() }),
  handler: async (ctx, args) => {
    if (isUnsearchableQuery(args.filters.q)) return { count: 0, exact: true };
    const plan = rangeDriver(args.filters);
    const scope = listedScope(args.filters.transaction);
    if (plan.driver === "text") {
      const found = await textMatches(ctx, scope, args.filters);
      return {
        count: found.filter((doc) => matches(doc, args.filters)).length,
        exact: found.length < TEXT_TAKE,
      };
    }
    const docs = await driverQuery(ctx, scope, args.filters, plan, "newest").take(COUNT_SCAN + 1);
    const scanned = docs.slice(0, COUNT_SCAN);
    return {
      count: scanned.filter((doc) => matches(doc, args.filters)).length,
      exact: docs.length <= COUNT_SCAN,
    };
  },
});

/**
 * Every pin for a search, including `filters.bbox` when "search as I move the
 * map" is on — the same `matches()` as `search`, so the map and the list show
 * one result set.
 */
export const mapPoints = query({
  args: { filters: searchFiltersV },
  returns: v.object({
    points: v.array(mapPointV),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (isUnsearchableQuery(args.filters.q)) return { points: [], truncated: false };
    // The same driver as `search` and `count` (text search included), so a
    // text query puts the same listings on the map as in the list.
    const plan = rangeDriver(args.filters);
    const scope = listedScope(args.filters.transaction);
    const limit = plan.driver === "text" ? TEXT_TAKE : MAX_POINTS;
    const found =
      plan.driver === "text"
        ? await textMatches(ctx, scope, args.filters)
        : await driverQuery(ctx, scope, args.filters, plan, "newest").take(MAX_POINTS);

    const points = [];
    for (const doc of found) {
      if (!matches(doc, args.filters)) continue;
      points.push(await toMapPoint(ctx, doc));
    }

    return { points, truncated: found.length === limit };
  },
});

export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({ kind: v.literal("listing"), listing: listingDetailV }),
    v.object({ kind: v.literal("redirect"), slug: v.string() }),
    v.object({ kind: v.literal("missing") }),
  ),
  handler: async (ctx, args) => {
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (listing === null) {
      // A slug can be renamed away more than once (A leaves it, B takes it and
      // leaves it too): the latest rename is where the URL last pointed.
      const redirect = await ctx.db
        .query("slugRedirects")
        .withIndex("by_from", (q) => q.eq("from", args.slug))
        .order("desc")
        .first();
      if (redirect === null) return { kind: "missing" as const };
      const target = await ctx.db.get("listings", redirect.listingId);
      if (target === null || !isPublicScope(target.scope)) {
        return { kind: "missing" as const };
      }
      return { kind: "redirect" as const, slug: target.slug };
    }

    if (!isPublicScope(listing.scope)) return { kind: "missing" as const };

    const detail = await toDetail(ctx, listing);
    if (detail === null) return { kind: "missing" as const };
    return { kind: "listing" as const, listing: detail };
  },
});

/**
 * Staff-only preview of an unpublished listing, gated by a per-listing token.
 * `now` is an argument (queries must not read the clock) and the link expires:
 * otherwise a preview URL shared once grants permanent access to an unpublished
 * listing detail, including the exact street.
 */
export const previewBySlug = query({
  args: { slug: v.string(), token: v.string(), now: v.number() },
  returns: v.union(listingDetailV, v.null()),
  handler: async (ctx, args) => {
    if (args.token.length < 32) return null;
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (listing === null) return null;
    if (listing.previewToken === undefined || listing.previewToken !== args.token) {
      return null;
    }
    if (listing.previewExpiresAt === undefined || listing.previewExpiresAt < args.now) {
      return null;
    }
    return await toDetail(ctx, listing);
  },
});

export const featured = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(listingCardV),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 6, 1), 24);
    const docs: Doc<"listings">[] = [];
    for (const transaction of ["sale", "rent"] as const) {
      const found = await ctx.db
        .query("listings")
        .withIndex("by_isFeatured_and_scope", (q) =>
          q.eq("isFeatured", true).eq("scope", listedScope(transaction)),
        )
        .order("desc")
        // Twice the page, so a listing skipped below for a repeated cover still
        // leaves enough to fill the rail. Bounded: at most 2 x 24 per scope.
        .take(limit * 2);
      docs.push(...found);
    }
    docs.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

    // Two cards with the same photograph read as one room sold twice, so a
    // listing whose cover is already on the rail gives its place to the next.
    const cards: ListingCard[] = [];
    const covers = new Set<string>();
    for (const doc of docs) {
      if (cards.length === limit) break;
      const card = await toCard(ctx, doc);
      const cover = card.cover?.url;
      if (cover !== undefined) {
        if (covers.has(cover)) continue;
        covers.add(cover);
      }
      cards.push(card);
    }
    return cards;
  },
});

/**
 * PRD A5: same municipality and type, price within ±25%. A thin market (or a
 * listing without a municipality) would often leave that empty, and a sold
 * listing relies on this rail to keep the visitor, so the search widens in
 * bounded steps: municipality ±25% → city ±25% → city ±50%. Same property type
 * always ranks first.
 */
export const similar = query({
  args: { id: v.id("listings"), limit: v.optional(v.number()) },
  returns: v.array(listingCardV),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 4, 1), 12);
    const listing = await ctx.db.get("listings", args.id);
    if (listing === null || !isPublicScope(listing.scope)) return [];

    const scope = listedScope(listing.transaction);
    const range = (pct: number) => ({
      min: Math.round(listing.price * (1 - pct)),
      max: Math.round(listing.price * (1 + pct)),
    });

    const seen = new Set<string>([listing._id]);
    const sameType: Doc<"listings">[] = [];
    const others: Doc<"listings">[] = [];
    const collect = (docs: Doc<"listings">[]) => {
      for (const doc of docs) {
        if (seen.has(doc._id) || doc.visibility !== "public") continue;
        seen.add(doc._id);
        (doc.propertyType === listing.propertyType ? sameType : others).push(doc);
      }
    };

    if (listing.municipalityId !== undefined) {
      const { min, max } = range(0.25);
      collect(
        await ctx.db
          .query("listings")
          .withIndex("by_scope_and_municipalityId_and_price", (q) =>
            q.eq("scope", scope).eq("municipalityId", listing.municipalityId).gte("price", min).lte("price", max),
          )
          .take(24),
      );
    }
    for (const pct of [0.25, 0.5]) {
      if (sameType.length >= limit) break;
      const { min, max } = range(pct);
      collect(
        await ctx.db
          .query("listings")
          .withIndex("by_scope_and_cityId_and_price", (q) =>
            q.eq("scope", scope).eq("cityId", listing.cityId).gte("price", min).lte("price", max),
          )
          .take(24),
      );
    }

    const cards: ListingCard[] = [];
    for (const doc of [...sameType, ...others].slice(0, limit)) {
      cards.push(await toCard(ctx, doc));
    }
    return cards;
  },
});

/** Favorites and compare: ids come from localStorage, so cap the batch. */
export const byIds = query({
  args: { ids: v.array(v.id("listings")) },
  returns: v.array(listingCardV),
  handler: async (ctx, args) => {
    const cards: ListingCard[] = [];
    const locations: LocationCache = new Map();
    for (const id of args.ids.slice(0, 50)) {
      const doc = await ctx.db.get("listings", id);
      if (doc === null || !isPublicScope(doc.scope)) continue;
      cards.push(await toCard(ctx, doc, { locations }));
    }
    return cards;
  },
});

/** Detail data for the compare table — same DTO as the detail page. */
export const detailsByIds = query({
  args: { ids: v.array(v.id("listings")) },
  returns: v.array(listingDetailV),
  handler: async (ctx, args) => {
    const out = [];
    for (const id of args.ids.slice(0, 4)) {
      const doc = await ctx.db.get("listings", id);
      if (doc === null || !isPublicScope(doc.scope)) continue;
      const detail = await toDetail(ctx, doc);
      if (detail !== null) out.push(detail);
    }
    return out;
  },
});
