import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
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

/** Favorite counter, best-effort: the source of truth is the visitor's browser. */
export const trackFavorite = mutation({
  args: { listingId: v.id("listings"), delta: v.union(v.literal(1), v.literal(-1)) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isPublicScope(listing.scope)) return null;

    const stats = await ctx.db
      .query("listingStats")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .unique();
    if (stats === null) {
      await ctx.db.insert("listingStats", {
        listingId: args.listingId,
        views: 0,
        favorites: Math.max(args.delta, 0),
        leads: 0,
        viewings: 0,
      });
      return null;
    }
    await ctx.db.patch("listingStats", stats._id, {
      favorites: Math.max(stats.favorites + args.delta, 0),
    });
    return null;
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

    const published = await ctx.db
      .query("listings")
      .withIndex("by_status_and_updatedAt", (q) =>
        q.eq("status", "published").gte("updatedAt", dayStart).lt("updatedAt", todayStart),
      )
      .take(2000);

    const row = {
      day,
      views: views.length,
      leads: leads.length,
      viewings: viewings.length,
      published: published.length,
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
