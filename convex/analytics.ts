import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertCanEditListing, requireRole } from "./lib/auth";
import { leadSourceV, leadTypeV } from "./lib/validators";

const MANAGERS = ["admin", "manager"] as const;

/** KPI cards + 30-day series. `now` is an argument so the query stays pure. */
export const dashboard = query({
  args: { now: v.number() },
  returns: v.object({
    activeListings: v.number(),
    draftListings: v.number(),
    newLeads7d: v.number(),
    viewingsToday: v.number(),
    avgFirstResponseMinutes: v.optional(v.number()),
    series: v.array(
      v.object({ day: v.string(), views: v.number(), leads: v.number() }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);

    const published = await ctx.db
      .query("listings")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "published"))
      .take(501);
    const drafts = await ctx.db
      .query("listings")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "draft"))
      .take(501);

    const weekAgo = args.now - 7 * 86_400_000;
    const recentLeads = await ctx.db
      .query("leads")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", weekAgo))
      .take(500);

    const dayStart = args.now - (args.now % 86_400_000);
    const todayViewings = await ctx.db
      .query("viewings")
      .withIndex("by_start", (q) =>
        q.gte("start", dayStart).lt("start", dayStart + 86_400_000),
      )
      .take(200);

    const responded = recentLeads.filter((lead) => lead.firstResponseAt !== undefined);
    const avgFirstResponseMinutes =
      responded.length === 0
        ? undefined
        : Math.round(
            responded.reduce(
              (sum, lead) => sum + (lead.firstResponseAt! - lead._creationTime),
              0,
            ) /
              responded.length /
              60_000,
          );

    const rollups = await ctx.db
      .query("dailyStats")
      .withIndex("by_day")
      .order("desc")
      .take(30);

    return {
      activeListings: published.length,
      draftListings: drafts.length,
      newLeads7d: recentLeads.length,
      viewingsToday: todayViewings.length,
      ...(avgFirstResponseMinutes !== undefined ? { avgFirstResponseMinutes } : {}),
      series: rollups
        .slice()
        .reverse()
        .map((row) => ({ day: row.day, views: row.views, leads: row.leads })),
    };
  },
});

export const topListings = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      listingId: v.id("listings"),
      ref: v.string(),
      titleSr: v.string(),
      views: v.number(),
      leads: v.number(),
      viewings: v.number(),
      favorites: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
    // Indexed by views: taking 500 rows and sorting them in JS returned the
    // busiest of the OLDEST 500 listings, which is a different chart.
    const stats = await ctx.db
      .query("listingStats")
      .withIndex("by_views")
      .order("desc")
      .take(limit);

    const out = [];
    for (const row of stats) {
      const listing = await ctx.db.get("listings", row.listingId);
      if (listing === null) continue;
      out.push({
        listingId: row.listingId,
        ref: listing.ref,
        titleSr: listing.title.sr,
        views: row.views,
        leads: row.leads,
        viewings: row.viewings,
        favorites: row.favorites,
      });
    }
    return out;
  },
});

export const listingFunnel = query({
  args: { listingId: v.id("listings") },
  returns: v.union(
    v.object({
      views: v.number(),
      favorites: v.number(),
      leads: v.number(),
      viewings: v.number(),
      lastViewedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ["admin", "manager", "agent"]);
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null) return null;
    assertCanEditListing(viewer, listing);

    const row = await ctx.db
      .query("listingStats")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .unique();
    if (row === null) {
      return { views: 0, favorites: 0, leads: 0, viewings: 0 };
    }
    return {
      views: row.views,
      favorites: row.favorites,
      leads: row.leads,
      viewings: row.viewings,
      ...(row.lastViewedAt !== undefined ? { lastViewedAt: row.lastViewedAt } : {}),
    };
  },
});

export const leadsBySource = query({
  args: { sinceDays: v.optional(v.number()), now: v.number() },
  returns: v.object({
    bySource: v.array(v.object({ source: leadSourceV, count: v.number() })),
    byType: v.array(v.object({ type: leadTypeV, count: v.number() })),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const days = Math.min(Math.max(args.sinceDays ?? 30, 1), 365);
    const since = args.now - days * 86_400_000;

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
      .take(2000);

    const sources = new Map<string, number>();
    const types = new Map<string, number>();
    for (const lead of leads) {
      sources.set(lead.source, (sources.get(lead.source) ?? 0) + 1);
      types.set(lead.type, (types.get(lead.type) ?? 0) + 1);
    }

    return {
      bySource: (["web", "phone", "email", "portal", "walk_in"] as const).map(
        (source) => ({ source, count: sources.get(source) ?? 0 }),
      ),
      byType: (["inquiry", "viewing", "valuation", "seller", "general"] as const).map(
        (type) => ({ type, count: types.get(type) ?? 0 }),
      ),
    };
  },
});

export const agentResponse = query({
  args: { now: v.number(), sinceDays: v.optional(v.number()) },
  returns: v.array(
    v.object({
      agentId: v.id("agents"),
      name: v.string(),
      leads: v.number(),
      responded: v.number(),
      avgMinutes: v.optional(v.number()),
      won: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const days = Math.min(Math.max(args.sinceDays ?? 90, 1), 365);
    const since = args.now - days * 86_400_000;

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_isPublic_and_order", (q) => q.eq("isPublic", true))
      .take(60);

    const out = [];
    for (const agent of agents) {
      const leads = await ctx.db
        .query("leads")
        .withIndex("by_agentId_and_status", (q) => q.eq("agentId", agent._id))
        .take(500);
      const recent = leads.filter((lead) => lead._creationTime >= since);
      const responded = recent.filter((lead) => lead.firstResponseAt !== undefined);
      out.push({
        agentId: agent._id,
        name: agent.name,
        leads: recent.length,
        responded: responded.length,
        ...(responded.length > 0
          ? {
              avgMinutes: Math.round(
                responded.reduce(
                  (sum, lead) => sum + (lead.firstResponseAt! - lead._creationTime),
                  0,
                ) /
                  responded.length /
                  60_000,
              ),
            }
          : {}),
        won: recent.filter((lead) => lead.status === "won").length,
      });
    }
    return out;
  },
});
