import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { NamedTableInfo, OrderedQuery } from "convex/server";
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
import type { ListingCard } from "./lib/dto";
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
  listedScope,
  matches,
  normalizeText,
  pickDriver,
  rangeDriver,
} from "./lib/search";
import type { DriverPlan } from "./lib/search";
import { searchFiltersV, sortV } from "./lib/validators";
import type { SearchFilters, Sort } from "./lib/validators";

/** Gallery frames attached to each search result card (PRD A4 carousel). */
const SEARCH_CARD_FRAMES = 5;

/* ------------------------------------------------------------ driver queries */

type ListingQuery = OrderedQuery<NamedTableInfo<DataModel, "listings">>;

/**
 * The index range for a driver, ordered and ready to `.paginate()` or
 * `.take()`. Every branch is written out so the Convex index-range types stay
 * exact; `pickDriver` guarantees a range filter only ever lands on the last
 * indexed field. Text search is handled by the callers (relevance order only).
 */
function driverQuery(
  ctx: QueryCtx,
  scope: string,
  filters: SearchFilters,
  plan: DriverPlan,
  sort: Sort,
): ListingQuery {
  const order = driverDescending(sort) ? "desc" : "asc";
  const { priceMin, priceMax, areaMin, areaMax } = filters;
  const listings = ctx.db.query("listings");

  switch (plan.driver) {
    case "cityPrice": {
      const cityId = filters.cityId?.[0];
      if (cityId === undefined) break;
      return listings
        .withIndex("by_scope_and_cityId_and_price", (q) => {
          const base = q.eq("scope", scope).eq("cityId", cityId);
          if (priceMin !== undefined && priceMax !== undefined) {
            return base.gte("price", priceMin).lte("price", priceMax);
          }
          if (priceMin !== undefined) return base.gte("price", priceMin);
          if (priceMax !== undefined) return base.lte("price", priceMax);
          return base;
        })
        .order(order);
    }

    case "municipalityPrice": {
      const municipalityId = filters.municipalityId?.[0];
      if (municipalityId === undefined) break;
      return listings
        .withIndex("by_scope_and_municipalityId_and_price", (q) => {
          const base = q.eq("scope", scope).eq("municipalityId", municipalityId);
          if (priceMin !== undefined && priceMax !== undefined) {
            return base.gte("price", priceMin).lte("price", priceMax);
          }
          if (priceMin !== undefined) return base.gte("price", priceMin);
          if (priceMax !== undefined) return base.lte("price", priceMax);
          return base;
        })
        .order(order);
    }

    case "neighborhoodPublishedAt": {
      const neighborhoodId = filters.neighborhoodId?.[0];
      if (neighborhoodId === undefined) break;
      return listings
        .withIndex("by_scope_and_neighborhoodId_and_publishedAt", (q) => {
          const base = q.eq("scope", scope).eq("neighborhoodId", neighborhoodId);
          return filters.publishedAfter !== undefined
            ? base.gte("publishedAt", filters.publishedAfter)
            : base;
        })
        .order(order);
    }

    case "areaM2":
      return listings
        .withIndex("by_scope_and_areaM2", (q) => {
          const base = q.eq("scope", scope);
          if (areaMin !== undefined && areaMax !== undefined) {
            return base.gte("areaM2", areaMin).lte("areaM2", areaMax);
          }
          if (areaMin !== undefined) return base.gte("areaM2", areaMin);
          if (areaMax !== undefined) return base.lte("areaM2", areaMax);
          return base;
        })
        .order(order);

    case "pricePerM2":
      return listings
        .withIndex("by_scope_and_pricePerM2", (q) => q.eq("scope", scope))
        .order(order);

    case "publishedAt":
    case "text":
      break;

    case "price":
      return listings
        .withIndex("by_scope_and_price", (q) => {
          const base = q.eq("scope", scope);
          if (priceMin !== undefined && priceMax !== undefined) {
            return base.gte("price", priceMin).lte("price", priceMax);
          }
          if (priceMin !== undefined) return base.gte("price", priceMin);
          if (priceMax !== undefined) return base.lte("price", priceMax);
          return base;
        })
        .order(order);
  }

  // A location driver whose id went missing falls back to the date index; a
  // price range cannot, so it keeps the global price index.
  if (plan.driver === "cityPrice" || plan.driver === "municipalityPrice") {
    return driverQuery(ctx, scope, filters, { ...plan, driver: "price" }, sort);
  }
  return listings
    .withIndex("by_scope_and_publishedAt", (q) => {
      const base = q.eq("scope", scope);
      return filters.publishedAfter !== undefined
        ? base.gte("publishedAt", filters.publishedAfter)
        : base;
    })
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

/* ------------------------------------------------------------------- queries */

/**
 * One page of results. Convex allows ONE `.paginate()` per function, so a page
 * is a single window of the driver index:
 *  - when the index range expresses every filter (`coveredByDriver`), the page
 *    is exactly `paginationOpts` — `numItems` long with an exact cursor;
 *  - otherwise the window widens to at least `SEARCH_SCAN` documents and is
 *    post-filtered by `matches()`, so a selective filter can return a short
 *    (even empty) page with `isDone: false`; `usePaginatedQuery` handles
 *    short pages and "load more" reads the next window.
 * `paginationOpts` is forwarded whole (only `numItems` may widen), so `cursor`,
 * `endCursor`, `id` and `maximumRowsRead` keep their native behaviour.
 */
export const search = query({
  args: {
    filters: searchFiltersV,
    sort: sortV,
    paginationOpts: paginationOptsValidator,
  },
  // `splitCursor`/`pageStatus` are passed through, so `usePaginatedQuery` can
  // split a page Convex reports as incomplete instead of skipping its rest.
  returns: paginationResultValidator(listingCardV).extend({
    /** Documents read from the index, for the "approximate" UI hint. */
    scanned: v.number(),
    /** True when the driver index could not honour `sort` on its own (text search). */
    orderedInWindow: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const plan = pickDriver(args.filters, args.sort);
    const sort = effectiveSort(args.filters, args.sort);
    const scope = listedScope(args.filters.transaction);
    const numItems = Math.min(Math.max(Math.floor(args.paginationOpts.numItems) || 1, 1), MAX_PAGE);

    const window =
      plan.driver === "text"
        ? {
            page: await textMatches(ctx, scope, args.filters),
            isDone: true,
            continueCursor: "",
            splitCursor: null,
            pageStatus: null,
          }
        : await driverQuery(ctx, scope, args.filters, plan, sort).paginate({
            ...args.paginationOpts,
            numItems: coveredByDriver(args.filters, plan) ? numItems : Math.max(numItems, SEARCH_SCAN),
          });

    const matched = window.page.filter((doc) => matches(doc, args.filters));
    const ordered = plan.orderedInWindow
      ? matched.sort((a, b) => compareListings(a, b, sort))
      : matched;

    const cards: ListingCard[] = [];
    for (const doc of ordered) {
      cards.push(await toCard(ctx, doc, { gallery: SEARCH_CARD_FRAMES }));
    }

    return {
      page: cards,
      isDone: window.isDone,
      continueCursor: window.continueCursor,
      splitCursor: window.splitCursor ?? null,
      pageStatus: window.pageStatus ?? null,
      scanned: window.page.length,
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
      const redirect = await ctx.db
        .query("slugRedirects")
        .withIndex("by_from", (q) => q.eq("from", args.slug))
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
    for (const id of args.ids.slice(0, 50)) {
      const doc = await ctx.db.get("listings", id);
      if (doc === null || !isPublicScope(doc.scope)) continue;
      cards.push(await toCard(ctx, doc));
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

/** Sitemap feed: slugs + lastmod only, paginated. */
export const slugsForSitemap = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        slug: v.string(),
        updatedAt: v.number(),
        publishedAt: v.optional(v.number()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("listings")
      .withIndex("by_scope_and_publishedAt", (q) =>
        q.eq("scope", listedScope("sale")),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const rentResult = await ctx.db
      .query("listings")
      .withIndex("by_scope_and_publishedAt", (q) =>
        q.eq("scope", listedScope("rent")),
      )
      .order("desc")
      .take(500);

    const rows = [...result.page, ...(args.paginationOpts.cursor === null ? rentResult : [])].map(
      (doc) => ({
        slug: doc.slug,
        updatedAt: doc.updatedAt,
        ...(doc.publishedAt !== undefined ? { publishedAt: doc.publishedAt } : {}),
      }),
    );

    return {
      page: rows,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
