import { paginationOptsValidator } from "convex/server";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
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
  BATCH_SIZE,
  COUNT_BATCHES,
  MAX_BATCHES,
  MAX_POINTS,
  TEXT_TAKE,
  compareListings,
  driverDescending,
  isPublicScope,
  listedScope,
  matches,
  normalizeText,
  pickDriver,
} from "./lib/search";
import type { DriverPlan } from "./lib/search";
import { bboxV, searchFiltersV, sortV } from "./lib/validators";
import type { SearchFilters, Sort } from "./lib/validators";

/* -------------------------------------------------------------- driver pages */

type DriverPage = Pick<
  PaginationResult<Doc<"listings">>,
  "page" | "isDone" | "continueCursor"
>;

/**
 * Runs ONE page of the chosen driver index. Every branch is written out so the
 * Convex index-range types stay exact; `pickDriver` guarantees a range filter
 * only ever lands on the last indexed field.
 */
async function driverPage(
  ctx: QueryCtx,
  scope: string,
  filters: SearchFilters,
  plan: DriverPlan,
  sort: Sort,
  opts: PaginationOptions,
): Promise<DriverPage> {
  const order = driverDescending(sort) ? "desc" : "asc";
  const { priceMin, priceMax, areaMin, areaMax } = filters;

  switch (plan.driver) {
    case "price":
      return await ctx.db
        .query("listings")
        .withIndex("by_scope_and_price", (q) => {
          const base = q.eq("scope", scope);
          if (priceMin !== undefined && priceMax !== undefined) {
            return base.gte("price", priceMin).lte("price", priceMax);
          }
          if (priceMin !== undefined) return base.gte("price", priceMin);
          if (priceMax !== undefined) return base.lte("price", priceMax);
          return base;
        })
        .order(order)
        .paginate(opts);

    case "cityPrice": {
      const cityId = filters.cityId?.[0];
      if (cityId === undefined) {
        return await driverPage(ctx, scope, filters, { ...plan, driver: "price" }, sort, opts);
      }
      return await ctx.db
        .query("listings")
        .withIndex("by_scope_and_cityId_and_price", (q) => {
          const base = q.eq("scope", scope).eq("cityId", cityId);
          if (priceMin !== undefined && priceMax !== undefined) {
            return base.gte("price", priceMin).lte("price", priceMax);
          }
          if (priceMin !== undefined) return base.gte("price", priceMin);
          if (priceMax !== undefined) return base.lte("price", priceMax);
          return base;
        })
        .order(order)
        .paginate(opts);
    }

    case "municipalityPrice": {
      const municipalityId = filters.municipalityId?.[0];
      if (municipalityId === undefined) {
        return await driverPage(ctx, scope, filters, { ...plan, driver: "price" }, sort, opts);
      }
      return await ctx.db
        .query("listings")
        .withIndex("by_scope_and_municipalityId_and_price", (q) => {
          const base = q.eq("scope", scope).eq("municipalityId", municipalityId);
          if (priceMin !== undefined && priceMax !== undefined) {
            return base.gte("price", priceMin).lte("price", priceMax);
          }
          if (priceMin !== undefined) return base.gte("price", priceMin);
          if (priceMax !== undefined) return base.lte("price", priceMax);
          return base;
        })
        .order(order)
        .paginate(opts);
    }

    case "areaM2":
      return await ctx.db
        .query("listings")
        .withIndex("by_scope_and_areaM2", (q) => {
          const base = q.eq("scope", scope);
          if (areaMin !== undefined && areaMax !== undefined) {
            return base.gte("areaM2", areaMin).lte("areaM2", areaMax);
          }
          if (areaMin !== undefined) return base.gte("areaM2", areaMin);
          if (areaMax !== undefined) return base.lte("areaM2", areaMax);
          return base;
        })
        .order(order)
        .paginate(opts);

    case "pricePerM2":
      return await ctx.db
        .query("listings")
        .withIndex("by_scope_and_pricePerM2", (q) => q.eq("scope", scope))
        .order(order)
        .paginate(opts);

    case "neighborhoodPublishedAt": {
      const neighborhoodId = filters.neighborhoodId?.[0];
      if (neighborhoodId === undefined) {
        return await driverPage(
          ctx,
          scope,
          filters,
          { ...plan, driver: "publishedAt" },
          sort,
          opts,
        );
      }
      return await ctx.db
        .query("listings")
        .withIndex("by_scope_and_neighborhoodId_and_publishedAt", (q) => {
          const base = q.eq("scope", scope).eq("neighborhoodId", neighborhoodId);
          return filters.publishedAfter !== undefined
            ? base.gte("publishedAt", filters.publishedAfter)
            : base;
        })
        .order(order)
        .paginate(opts);
    }

    case "text": {
      const normalized = normalizeText(filters.q ?? "");
      const found = await ctx.db
        .query("listings")
        .withSearchIndex("search_text", (q) =>
          q.search("searchText", normalized).eq("scope", scope),
        )
        .take(TEXT_TAKE);
      // Relevance order only, and a hard 1024-document scan cap: text search is
      // therefore a single bounded page, never a cursor walk.
      return { page: found, isDone: true, continueCursor: "" };
    }

    case "publishedAt":
    default:
      return await ctx.db
        .query("listings")
        .withIndex("by_scope_and_publishedAt", (q) => {
          const base = q.eq("scope", scope);
          return filters.publishedAfter !== undefined
            ? base.gte("publishedAt", filters.publishedAfter)
            : base;
        })
        .order(order)
        .paginate(opts);
  }
}

type Collected = {
  docs: Doc<"listings">[];
  scanned: number;
  isDone: boolean;
  continueCursor: string;
  batches: number;
};

/**
 * Walks the driver index in bounded batches, post-filtering each batch, until
 * `target` matches exist or the index is exhausted. The FIRST call forwards
 * `opts` verbatim so reactive pagination keeps its native behaviour.
 */
async function collectMatches(
  ctx: QueryCtx,
  filters: SearchFilters,
  plan: DriverPlan,
  sort: Sort,
  opts: PaginationOptions,
  target: number,
  maxBatches: number,
): Promise<Collected> {
  const scope = listedScope(filters.transaction);
  const docs: Doc<"listings">[] = [];
  let scanned = 0;
  let isDone = false;
  let continueCursor = "";
  let batches = 0;
  let cursor: string | null = opts.cursor;

  while (batches < maxBatches) {
    const page = await driverPage(
      ctx,
      scope,
      filters,
      plan,
      sort,
      batches === 0 ? opts : { cursor, numItems: BATCH_SIZE },
    );
    scanned += page.page.length;
    for (const doc of page.page) {
      if (matches(doc, filters)) docs.push(doc);
    }
    isDone = page.isDone;
    continueCursor = page.continueCursor;
    cursor = page.continueCursor;
    batches += 1;
    if (isDone || docs.length >= target) break;
  }

  return { docs, scanned, isDone, continueCursor, batches };
}

/* ------------------------------------------------------------------- queries */

export const search = query({
  args: {
    filters: searchFiltersV,
    sort: sortV,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(listingCardV),
    isDone: v.boolean(),
    continueCursor: v.string(),
    /** Documents read from the index, for the "approximate" UI hint. */
    scanned: v.number(),
    /** True when the driver index could not honour `sort` on its own. */
    orderedInWindow: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const plan = pickDriver(args.filters, args.sort);
    const collected = await collectMatches(
      ctx,
      args.filters,
      plan,
      args.sort,
      args.paginationOpts,
      args.paginationOpts.numItems,
      MAX_BATCHES,
    );

    const ordered = plan.orderedInWindow
      ? [...collected.docs].sort((a, b) => compareListings(a, b, args.sort))
      : collected.docs;

    const cards: ListingCard[] = [];
    for (const doc of ordered) cards.push(await toCard(ctx, doc));

    return {
      page: cards,
      isDone: collected.isDone,
      continueCursor: collected.continueCursor,
      scanned: collected.scanned,
      orderedInWindow: plan.orderedInWindow,
    };
  },
});

export const count = query({
  args: { filters: searchFiltersV },
  returns: v.object({ count: v.number(), exact: v.boolean() }),
  handler: async (ctx, args) => {
    const plan = pickDriver(args.filters, "newest");
    const collected = await collectMatches(
      ctx,
      args.filters,
      plan,
      "newest",
      { cursor: null, numItems: BATCH_SIZE },
      Number.MAX_SAFE_INTEGER,
      COUNT_BATCHES,
    );
    return { count: collected.docs.length, exact: collected.isDone };
  },
});

export const mapPoints = query({
  args: { filters: searchFiltersV, bbox: v.optional(bboxV) },
  returns: v.object({
    points: v.array(mapPointV),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const scope = listedScope(args.filters.transaction);
    const found = await ctx.db
      .query("listings")
      .withIndex("by_scope_and_publishedAt", (q) => q.eq("scope", scope))
      .order("desc")
      .take(MAX_POINTS);

    const points = [];
    for (const doc of found) {
      if (!matches(doc, args.filters)) continue;
      const point = await toMapPoint(ctx, doc);
      if (args.bbox !== undefined) {
        const { west, south, east, north } = args.bbox;
        if (
          point.lng < west ||
          point.lng > east ||
          point.lat < south ||
          point.lat > north
        ) {
          continue;
        }
      }
      points.push(point);
    }

    return { points, truncated: found.length === MAX_POINTS };
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

/** Staff-only preview of an unpublished listing, gated by a per-listing token. */
export const previewBySlug = query({
  args: { slug: v.string(), token: v.string() },
  returns: v.union(listingDetailV, v.null()),
  handler: async (ctx, args) => {
    if (args.token.length < 16) return null;
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (listing === null) return null;
    if (listing.previewToken === undefined || listing.previewToken !== args.token) {
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
        .take(limit);
      docs.push(...found);
    }
    docs.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

    const cards: ListingCard[] = [];
    for (const doc of docs.slice(0, limit)) cards.push(await toCard(ctx, doc));
    return cards;
  },
});

export const similar = query({
  args: { id: v.id("listings"), limit: v.optional(v.number()) },
  returns: v.array(listingCardV),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 4, 1), 12);
    const listing = await ctx.db.get("listings", args.id);
    if (listing === null) return [];

    const scope = listedScope(listing.transaction);
    const min = Math.round(listing.price * 0.75);
    const max = Math.round(listing.price * 1.25);

    const candidates =
      listing.municipalityId !== undefined
        ? await ctx.db
            .query("listings")
            .withIndex("by_scope_and_municipalityId_and_price", (q) =>
              q
                .eq("scope", scope)
                .eq("municipalityId", listing.municipalityId)
                .gte("price", min)
                .lte("price", max),
            )
            .take(24)
        : await ctx.db
            .query("listings")
            .withIndex("by_scope_and_cityId_and_price", (q) =>
              q
                .eq("scope", scope)
                .eq("cityId", listing.cityId)
                .gte("price", min)
                .lte("price", max),
            )
            .take(24);

    const sameType = candidates.filter(
      (doc) =>
        doc._id !== listing._id &&
        doc.visibility === "public" &&
        doc.propertyType === listing.propertyType,
    );
    const others = candidates.filter(
      (doc) =>
        doc._id !== listing._id &&
        doc.visibility === "public" &&
        doc.propertyType !== listing.propertyType,
    );

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
