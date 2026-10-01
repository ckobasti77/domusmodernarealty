import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { LISTING_STATUSES, syncStatusCount } from "./lib/counts";
import { listingStatusV } from "./lib/validators";

/**
 * Rebuilds `listingStatusCounts` + `listingCountKeys` from the listings
 * themselves (after the seed, which inserts listings without the counting
 * hook, or to repair drift). Batched and self-rescheduling:
 *
 *   npx convex run countsMigrations:recountListingStatus '{}'
 *
 * Phase "clear" deletes the counter and key rows, phase "count" walks the
 * listings page by page through `syncStatusCount`. Because that helper is
 * idempotent, a listing saved while the rebuild runs is counted exactly once.
 */

const BATCH = 200;

export const recountListingStatus = internalMutation({
  args: {
    phase: v.optional(v.union(v.literal("clear"), v.literal("count"))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    phase: v.union(v.literal("clear"), v.literal("count")),
    processed: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const phase = args.phase ?? "clear";

    if (phase === "clear") {
      const keys = await ctx.db.query("listingCountKeys").take(BATCH);
      for (const row of keys) await ctx.db.delete("listingCountKeys", row._id);
      const counters = await ctx.db.query("listingStatusCounts").take(BATCH);
      for (const row of counters) await ctx.db.delete("listingStatusCounts", row._id);
      const more = keys.length === BATCH || counters.length === BATCH;
      await ctx.scheduler.runAfter(
        0,
        internal.countsMigrations.recountListingStatus,
        more ? { phase: "clear" } : { phase: "count", cursor: null },
      );
      return { phase, processed: keys.length + counters.length, done: false };
    }

    const page = await ctx.db.query("listings").paginate({ numItems: BATCH, cursor: args.cursor ?? null });
    for (const listing of page.page) await syncStatusCount(ctx, listing._id, listing);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.countsMigrations.recountListingStatus, {
        phase: "count",
        cursor: page.continueCursor,
      });
    }
    return { phase, processed: page.page.length, done: page.isDone };
  },
});

/**
 * Counter vs. reality, agency-wide, to verify the rebuild:
 *
 *   npx convex run countsMigrations:checkListingStatus '{}'
 */
export const checkListingStatus = internalQuery({
  args: {},
  returns: v.object({
    rows: v.array(v.object({ status: listingStatusV, counted: v.number(), actual: v.number() })),
    keys: v.number(),
    listings: v.number(),
    ok: v.boolean(),
  }),
  handler: async (ctx) => {
    // The raw agency-wide rows, not `statusCounts` (which falls back to a scan).
    const counters = await ctx.db
      .query("listingStatusCounts")
      .withIndex("by_bucket_and_status", (q) => q.eq("bucket", "all"))
      .take(16);
    const listings = await ctx.db.query("listings").take(2000);
    const keys = await ctx.db.query("listingCountKeys").take(2001);
    const rows = LISTING_STATUSES.map((status) => ({
      status,
      counted: counters.find((row) => row.status === status)?.count ?? 0,
      actual: listings.filter((listing) => listing.status === status).length,
    }));
    return {
      rows,
      keys: keys.length,
      listings: listings.length,
      ok: rows.every((row) => row.counted === row.actual) && keys.length === listings.length,
    };
  },
});
