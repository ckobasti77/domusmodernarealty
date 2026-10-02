import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
    await bumpStat(ctx, args.listingId, "views", now);

    return { counted: true };
  },
});

/**
 * One "saved to favorites" per listing per browser session, for the admin
 * funnel (PRD B12: views → favorites → leads → viewings). The favorites list
 * itself stays in the visitor's localStorage; this only counts that a session
 * saved the listing. Increment-only and idempotent per session (the
 * `listingFavorites` row), rate-limited like `trackView`, and only for
 * listings on the site. Unlike the trackFavorite removed in step 13, nothing
 * here can lower a counter.
 */
export const trackFavorite = mutation({
  args: { listingId: v.id("listings"), sessionKey: v.string() },
  returns: v.object({ counted: v.boolean() }),
  handler: async (ctx, args) => {
    assertSessionKey(args.sessionKey);

    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isPublicScope(listing.scope)) {
      return { counted: false };
    }

    const seen = await ctx.db
      .query("listingFavorites")
      .withIndex("by_listingId_and_sessionKey", (q) =>
        q.eq("listingId", args.listingId).eq("sessionKey", args.sessionKey),
      )
      .unique();
    if (seen !== null) return { counted: false };

    await consumeLimit(ctx, "trackFavoritePerSession", args.sessionKey);

    const now = Date.now();
    await ctx.db.insert("listingFavorites", {
      listingId: args.listingId,
      sessionKey: args.sessionKey,
      at: now,
    });
    await bumpStat(ctx, args.listingId, "favorites", now);

    return { counted: true };
  },
});

/** +1 on one funnel counter, creating the listing's stats row on first use. */
async function bumpStat(
  ctx: MutationCtx,
  listingId: Id<"listings">,
  field: "views" | "favorites",
  now: number,
): Promise<void> {
  const stats = await ctx.db
    .query("listingStats")
    .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
    .unique();
  const viewed = field === "views" ? { lastViewedAt: now } : {};
  if (stats === null) {
    await ctx.db.insert("listingStats", {
      listingId,
      views: field === "views" ? 1 : 0,
      favorites: field === "favorites" ? 1 : 0,
      leads: 0,
      viewings: 0,
      ...viewed,
    });
  } else {
    await ctx.db.patch("listingStats", stats._id, { [field]: stats[field] + 1, ...viewed });
  }
}

/**
 * `listingViews` and `listingFavorites` exist only to make `trackView` and
 * `trackFavorite` idempotent per browser session (a session key never outlives
 * its tab). They are append-only and would otherwise grow forever, so a
 * nightly cron drops rows older than the retention window in bounded batches,
 * rescheduling itself while a full batch comes back.
 */
export const pruneSessionMarks = internalMutation({
  args: { olderThanDays: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, args) => {
    const days = Math.min(Math.max(args.olderThanDays ?? 30, 1), 365);
    const cutoff = Date.now() - days * 86_400_000;
    let deleted = 0;
    let more = false;
    for (const table of ["listingViews", "listingFavorites"] as const) {
      const stale = await ctx.db
        .query(table)
        .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
        .take(500);
      for (const row of stale) await ctx.db.delete(table, row._id);
      deleted += stale.length;
      more ||= stale.length === 500;
    }
    // A busy day leaves more than one batch; keep going until the backlog is gone.
    if (more) {
      await ctx.scheduler.runAfter(0, internal.stats.pruneSessionMarks, { olderThanDays: days });
    }
    return { deleted, more };
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
