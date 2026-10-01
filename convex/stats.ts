import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertSessionKey, consumeLimit } from "./lib/rateLimit";
import { isPublicScope } from "./lib/search";

/**
 * One view per listing per browser session. The `listingViews` row makes it
 * idempotent even if the client retries, and the rate limiter caps abuse.
 */
export const trackView = mutation({
  args: { listingId: v.id("listings"), sessionKey: v.string() },
  returns: v.object({ counted: v.boolean() }),
  handler: async (ctx, args) => {
    assertSessionKey(args.sessionKey);

    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isPublicScope(listing.scope)) {
      return { counted: false };
    }

    const seen = await ctx.db
      .query("listingViews")
      .withIndex("by_listingId_and_sessionKey", (q) =>
        q.eq("listingId", args.listingId).eq("sessionKey", args.sessionKey),
      )
      .unique();
    if (seen !== null) return { counted: false };

    await consumeLimit(ctx, "trackViewPerSession", args.sessionKey);

    const now = Date.now();
    await ctx.db.insert("listingViews", {
      listingId: args.listingId,
      sessionKey: args.sessionKey,
      at: now,
    });

    const stats = await ctx.db
      .query("listingStats")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .unique();
    if (stats === null) {
      await ctx.db.insert("listingStats", {
        listingId: args.listingId,
        views: 1,
        favorites: 0,
        leads: 0,
        viewings: 0,
        lastViewedAt: now,
      });
    } else {
      await ctx.db.patch("listingStats", stats._id, {
        views: stats.views + 1,
        lastViewedAt: now,
      });
    }

    return { counted: true };
  },
});

/**
 * `listingViews` exists only to make `trackView` idempotent per session. It is
 * append-only and would otherwise grow forever, so a nightly cron drops rows
 * older than the retention window in bounded batches, rescheduling itself
 * while a full batch comes back.
 */
export const pruneListingViews = internalMutation({
  args: { olderThanDays: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, args) => {
    const days = Math.min(Math.max(args.olderThanDays ?? 30, 1), 365);
    const cutoff = Date.now() - days * 86_400_000;
    const stale = await ctx.db
      .query("listingViews")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(500);
    for (const row of stale) await ctx.db.delete("listingViews", row._id);
    const more = stale.length === 500;
    // A busy day leaves more than one batch; keep going until the backlog is gone.
    if (more) {
      await ctx.scheduler.runAfter(0, internal.stats.pruneListingViews, { olderThanDays: days });
    }
    return { deleted: stale.length, more };
  },
});

function dayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/**
 * Daily rollup for the admin dashboard charts (cron, 03:05). It counts only
 * yesterday's rows via indexed ranges, so it stays inside one transaction.
 */
export const rollupDaily = internalMutation({
  args: {},
  returns: v.object({ day: v.string(), views: v.number(), leads: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const todayStart = new Date(dayKey(now)).getTime();
    const dayStart = todayStart - 86_400_000;
    const day = dayKey(dayStart);

    const viewings = await ctx.db
      .query("viewings")
      .withIndex("by_start", (q) =>
        q.gte("start", dayStart).lt("start", todayStart),
      )
      .take(2000);

    // `listingViews` and `leads` have no time index (they are append-only and
    // ordered by _creationTime), so the by_creation_time index is the range.
    const views = await ctx.db
      .query("listingViews")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", dayStart).lt("_creationTime", todayStart),
      )
      .take(5000);

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", dayStart).lt("_creationTime", todayStart),
      )
      .take(2000);

    // Count by `publishedAt`, not `updatedAt`: any edit to a live listing would
    // otherwise show up as a new publication.
    const published = await ctx.db
      .query("listings")
      .withIndex("by_scope_and_publishedAt", (q) =>
        q
          .eq("scope", "listed:sale")
          .gte("publishedAt", dayStart)
          .lt("publishedAt", todayStart),
      )
      .take(2000);
    const publishedRent = await ctx.db
      .query("listings")
      .withIndex("by_scope_and_publishedAt", (q) =>
        q
          .eq("scope", "listed:rent")
          .gte("publishedAt", dayStart)
          .lt("publishedAt", todayStart),
      )
      .take(2000);

    const row = {
      day,
      views: views.length,
      leads: leads.length,
      viewings: viewings.length,
      published: published.length + publishedRent.length,
    };

    const existing = await ctx.db
      .query("dailyStats")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    if (existing === null) {
      await ctx.db.insert("dailyStats", row);
    } else {
      await ctx.db.replace("dailyStats", existing._id, row);
    }

    return { day, views: row.views, leads: row.leads };
  },
});
