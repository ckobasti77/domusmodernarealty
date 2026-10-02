import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/auth";
import { belgradeMidnight, belgradeWall, DAY_MS } from "./lib/belgradeTime";
import { statusCounts } from "./lib/counts";
import { listingStatusV } from "./lib/validators";
import type { LeadSource, LeadType } from "./lib/validators";

/**
 * Agency analytics (PRD B2 dashboard + B12). Managers and admins only. Every
 * read is an index range with a `.take` cap; when a cap is hit the result says
 * so (`capped`) and the screen prints it instead of pretending to be exact.
 * `now` is always an argument: queries never read the wall clock.
 */

const MANAGERS = ["admin", "manager"] as const;

/** Leads read for one period chart / response table. */
const LEADS_CAP = 2000;
/** Leads or viewings read for one listing's funnel. */
const FUNNEL_CAP = 500;
/** Open ("Novi") leads read for the unanswered counts. */
const OPEN_CAP = 1000;
/** Leads of the last 7 days read for the dashboard KPI. */
const RECENT_LEADS_CAP = 500;
/** Today's viewings read for the dashboard KPI (it prints "200+" at the cap). */
const TODAY_VIEWINGS_CAP = 200;
/** Viewings that take place: a cancelled request or a no-show is not one. */
const HELD_VIEWING_STATUSES = ["requested", "confirmed", "done"] as const;

function clampDays(days: number | undefined, fallback: number): number {
  return Math.min(Math.max(Math.round(days ?? fallback), 7), 365);
}

/** Leads created in `[since, now]`, oldest first, capped. */
async function leadsBetween(
  ctx: QueryCtx,
  since: number,
  now: number,
): Promise<{ leads: Doc<"leads">[]; capped: boolean }> {
  const rows = await ctx.db
    .query("leads")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", since).lte("_creationTime", now))
    .take(LEADS_CAP + 1);
  return { leads: rows.slice(0, LEADS_CAP), capped: rows.length > LEADS_CAP };
}

/* -------------------------------------------------------------- dashboard */

/** KPI cards + 30-day series. `now` is an argument so the query stays pure. */
export const dashboard = query({
  args: { now: v.number() },
  returns: v.object({
    activeListings: v.number(),
    draftListings: v.number(),
    newLeads7d: v.number(),
    /** More than `RECENT_LEADS_CAP` leads arrived: `newLeads7d` is a lower bound. */
    newLeads7dCapped: v.boolean(),
    viewingsToday: v.number(),
    avgFirstResponseMinutes: v.optional(v.number()),
    series: v.array(
      v.object({ day: v.string(), views: v.number(), leads: v.number() }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);

    // Exact, from the denormalized counters (lib/counts.ts): no listing reads.
    const byStatus = await statusCounts(ctx, "all");

    const weekAgo = args.now - 7 * 86_400_000;
    const leadRows = await ctx.db
      .query("leads")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", weekAgo))
      .take(RECENT_LEADS_CAP + 1);
    const recentLeads = leadRows.slice(0, RECENT_LEADS_CAP);

    // "Today" is the agency's day in Belgrade, not the UTC day. The next
    // midnight is computed on its own: a DST day is 23 or 25 hours long.
    const dayStart = belgradeMidnight(args.now);
    const dayEnd = belgradeMidnight(dayStart + 36 * 3_600_000);
    let viewingsToday = 0;
    for (const status of HELD_VIEWING_STATUSES) {
      if (viewingsToday >= TODAY_VIEWINGS_CAP) break;
      const rows = await ctx.db
        .query("viewings")
        .withIndex("by_status_and_start", (q) =>
          q.eq("status", status).gte("start", dayStart).lt("start", dayEnd),
        )
        .take(TODAY_VIEWINGS_CAP - viewingsToday);
      viewingsToday += rows.length;
    }

    // Clamped at 0 like `responseTimes`: a response stamped before the row's
    // creation (imported or seeded leads) must not pull the average negative.
    const waits = recentLeads.flatMap((lead) =>
      lead.firstResponseAt !== undefined ? [Math.max(0, lead.firstResponseAt - lead._creationTime)] : [],
    );
    const avgFirstResponseMinutes =
      waits.length === 0
        ? undefined
        : Math.round(waits.reduce((sum, wait) => sum + wait, 0) / waits.length / 60_000);

    const rollups = await ctx.db
      .query("dailyStats")
      .withIndex("by_day")
      .order("desc")
      .take(30);

    return {
      // On the market: a reserved listing is still advertised.
      activeListings: (byStatus.published ?? 0) + (byStatus.reserved ?? 0),
      draftListings: byStatus.draft ?? 0,
      newLeads7d: recentLeads.length,
      newLeads7dCapped: leadRows.length > RECENT_LEADS_CAP,
      viewingsToday,
      ...(avgFirstResponseMinutes !== undefined ? { avgFirstResponseMinutes } : {}),
      series: rollups
        .slice()
        .reverse()
        .map((row) => ({ day: row.day, views: row.views, leads: row.leads })),
    };
  },
});

/* ---------------------------------------------------------- top listings */

const topRowV = v.object({
  listingId: v.id("listings"),
  ref: v.string(),
  titleSr: v.string(),
  status: listingStatusV,
  views: v.number(),
  leads: v.number(),
  viewings: v.number(),
  favorites: v.number(),
  /** Leads created in the chosen period (`topListingsByLeads` only). */
  periodLeads: v.optional(v.number()),
});

/** Most viewed listings, all time (views are only counted per listing in total). */
export const topListings = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(topRowV),
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
        status: listing.status,
        views: row.views,
        leads: row.leads,
        viewings: row.viewings,
        favorites: row.favorites,
      });
    }
    return out;
  },
});

/** Listings with the most leads created in the last `days` days. */
export const topListingsByLeads = query({
  args: { now: v.number(), days: v.optional(v.number()), limit: v.optional(v.number()) },
  returns: v.object({ rows: v.array(topRowV), capped: v.boolean() }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
    const since = args.now - clampDays(args.days, 30) * DAY_MS;
    const { leads, capped } = await leadsBetween(ctx, since, args.now);

    const counts = new Map<Id<"listings">, number>();
    for (const lead of leads) {
      if (lead.listingId === undefined) continue;
      counts.set(lead.listingId, (counts.get(lead.listingId) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

    const rows = [];
    for (const [listingId, periodLeads] of ranked) {
      const listing = await ctx.db.get("listings", listingId);
      if (listing === null) continue;
      const stats = await ctx.db
        .query("listingStats")
        .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
        .unique();
      rows.push({
        listingId,
        ref: listing.ref,
        titleSr: listing.title.sr,
        status: listing.status,
        views: stats?.views ?? 0,
        leads: stats?.leads ?? 0,
        viewings: stats?.viewings ?? 0,
        favorites: stats?.favorites ?? 0,
        periodLeads,
      });
    }
    return { rows, capped };
  },
});

/* ---------------------------------------------------------------- funnel */

/**
 * One listing's funnel, all time. Views and favorites are the public
 * counters in `listingStats`; leads and viewings are counted from their own
 * tables, so ones entered by staff are included too.
 * The id arrives from the URL, so it is a string checked with `normalizeId`.
 */
export const listingFunnel = query({
  args: { listingId: v.string() },
  returns: v.union(
    v.object({
      listing: v.object({
        _id: v.id("listings"),
        ref: v.string(),
        title: v.string(),
        status: listingStatusV,
      }),
      views: v.number(),
      favorites: v.number(),
      leads: v.number(),
      leadsWon: v.number(),
      viewings: v.number(),
      viewingsDone: v.number(),
      lastViewedAt: v.optional(v.number()),
      capped: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const id = ctx.db.normalizeId("listings", args.listingId);
    if (id === null) return null;
    const listing = await ctx.db.get("listings", id);
    if (listing === null) return null;

    const stats = await ctx.db
      .query("listingStats")
      .withIndex("by_listingId", (q) => q.eq("listingId", id))
      .unique();
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_listingId", (q) => q.eq("listingId", id))
      .take(FUNNEL_CAP + 1);
    const viewings = await ctx.db
      .query("viewings")
      .withIndex("by_listingId_and_start", (q) => q.eq("listingId", id))
      .take(FUNNEL_CAP + 1);

    const countedLeads = leads.slice(0, FUNNEL_CAP);
    const heldViewings = viewings.slice(0, FUNNEL_CAP).filter((row) => row.status !== "cancelled");

    return {
      listing: { _id: listing._id, ref: listing.ref, title: listing.title.sr, status: listing.status },
      views: stats?.views ?? 0,
      favorites: stats?.favorites ?? 0,
      leads: countedLeads.length,
      leadsWon: countedLeads.filter((lead) => lead.status === "won").length,
      viewings: heldViewings.length,
      viewingsDone: heldViewings.filter((row) => row.status === "done").length,
      ...(stats?.lastViewedAt !== undefined ? { lastViewedAt: stats.lastViewedAt } : {}),
      capped: leads.length > FUNNEL_CAP || viewings.length > FUNNEL_CAP,
    };
  },
});

/* ------------------------------------------------------- leads over time */

const sourceCountsV = v.object({
  web: v.number(),
  phone: v.number(),
  email: v.number(),
  portal: v.number(),
  walk_in: v.number(),
});
const typeCountsV = v.object({
  inquiry: v.number(),
  viewing: v.number(),
  valuation: v.number(),
  seller: v.number(),
  general: v.number(),
});

function emptySources(): Record<LeadSource, number> {
  return { web: 0, phone: 0, email: 0, portal: 0, walk_in: 0 };
}
function emptyTypes(): Record<LeadType, number> {
  return { inquiry: 0, viewing: 0, valuation: 0, seller: 0, general: 0 };
}

/**
 * Belgrade Monday 00:00 of the week containing `at`. Whole days are stepped
 * from noon, so a 23- or 25-hour DST day never lands on the wrong date.
 */
function weekStart(at: number): number {
  const midnight = belgradeMidnight(at);
  const weekday = new Date(belgradeWall(midnight + 12 * 3_600_000)).getUTCDay();
  const sinceMonday = (weekday + 6) % 7;
  return belgradeMidnight(midnight + 12 * 3_600_000 - sinceMonday * DAY_MS);
}

/**
 * Leads per calendar week (Monday–Sunday, Belgrade) by source and by type.
 * `days` picks how many weeks: 30 → 5, 90 → 13; the last week is the current,
 * unfinished one (`partial`).
 */
export const leadsOverTime = query({
  args: { now: v.number(), days: v.optional(v.number()) },
  returns: v.object({
    weeks: v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        partial: v.boolean(),
        total: v.number(),
        bySource: sourceCountsV,
        byType: typeCountsV,
      }),
    ),
    totals: v.object({ total: v.number(), bySource: sourceCountsV, byType: typeCountsV }),
    since: v.number(),
    capped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const weekCount = Math.ceil(clampDays(args.days, 30) / 7);
    const current = weekStart(args.now);
    const starts: number[] = [];
    for (let index = weekCount - 1; index >= 0; index -= 1) {
      starts.push(belgradeMidnight(current + 12 * 3_600_000 - index * 7 * DAY_MS));
    }
    const since = starts[0] ?? current;
    const { leads, capped } = await leadsBetween(ctx, since, args.now);

    const weeks = starts.map((start, index) => ({
      start,
      end: starts[index + 1] ?? args.now,
      partial: index === starts.length - 1,
      total: 0,
      bySource: emptySources(),
      byType: emptyTypes(),
    }));
    const totals = { total: 0, bySource: emptySources(), byType: emptyTypes() };

    let bucket = 0;
    for (const lead of leads) {
      // Leads arrive oldest first, so the bucket only ever moves forward.
      while (bucket < weeks.length - 1 && lead._creationTime >= (weeks[bucket]?.end ?? args.now)) bucket += 1;
      const week = weeks[bucket];
      if (week === undefined) continue;
      week.total += 1;
      week.bySource[lead.source] += 1;
      week.byType[lead.type] += 1;
      totals.total += 1;
      totals.bySource[lead.source] += 1;
      totals.byType[lead.type] += 1;
    }

    return { weeks, totals, since, capped };
  },
});

/* -------------------------------------------------------- response times */

const HOUR_MS = 3_600_000;

const responseRowV = v.object({
  agentId: v.optional(v.id("agents")),
  name: v.string(),
  /** Leads created in the period. */
  leads: v.number(),
  /** Of those, answered (moved past "Novi"). */
  responded: v.number(),
  medianMinutes: v.optional(v.number()),
  avgMinutes: v.optional(v.number()),
  /** Answered within 1 h, out of `eligible1h` (leads at least 1 h old or already answered). */
  within1h: v.number(),
  eligible1h: v.number(),
  within24h: v.number(),
  eligible24h: v.number(),
  /** Leads still in "Novi", whatever their age. */
  openUnanswered: v.number(),
});

type ResponseAcc = {
  leads: number;
  minutes: number[];
  within1h: number;
  eligible1h: number;
  within24h: number;
  eligible24h: number;
  openUnanswered: number;
};

function emptyAcc(): ResponseAcc {
  return { leads: 0, minutes: [], within1h: 0, eligible1h: 0, within24h: 0, eligible24h: 0, openUnanswered: 0 };
}

function median(sorted: readonly number[]): number | undefined {
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  if (upper === undefined) return undefined;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}

type ResponseRow = Infer<typeof responseRowV>;

function finish(acc: ResponseAcc): Omit<ResponseRow, "agentId" | "name"> {
  const sorted = [...acc.minutes].sort((a, b) => a - b);
  const med = median(sorted);
  const avg = sorted.length > 0 ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : undefined;
  return {
    leads: acc.leads,
    responded: sorted.length,
    ...(med !== undefined ? { medianMinutes: Math.round(med) } : {}),
    ...(avg !== undefined ? { avgMinutes: Math.round(avg) } : {}),
    within1h: acc.within1h,
    eligible1h: acc.eligible1h,
    within24h: acc.within24h,
    eligible24h: acc.eligible24h,
    openUnanswered: acc.openUnanswered,
  };
}

/**
 * First-response times per agent: `firstResponseAt - _creationTime` of the
 * leads created in the last `days` days, plus every lead still waiting in
 * "Novi". Unassigned leads get their own row (no `agentId`).
 */
export const responseTimes = query({
  args: { now: v.number(), days: v.optional(v.number()) },
  returns: v.object({
    rows: v.array(responseRowV),
    total: responseRowV,
    capped: v.boolean(),
    openCapped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const since = args.now - clampDays(args.days, 30) * DAY_MS;
    const { leads, capped } = await leadsBetween(ctx, since, args.now);
    const open = await ctx.db
      .query("leads")
      .withIndex("by_status_and_creation", (q) => q.eq("status", "new"))
      .take(OPEN_CAP + 1);

    const byAgent = new Map<Id<"agents"> | "none", ResponseAcc>();
    const total = emptyAcc();
    const accFor = (agentId: Id<"agents"> | undefined): ResponseAcc => {
      const key = agentId ?? "none";
      let acc = byAgent.get(key);
      if (acc === undefined) {
        acc = emptyAcc();
        byAgent.set(key, acc);
      }
      return acc;
    };

    for (const lead of leads) {
      const age = args.now - lead._creationTime;
      const took = lead.firstResponseAt !== undefined ? lead.firstResponseAt - lead._creationTime : undefined;
      for (const acc of [accFor(lead.agentId), total]) {
        acc.leads += 1;
        if (took !== undefined) acc.minutes.push(Math.max(0, took) / 60_000);
        if (took !== undefined || age >= HOUR_MS) acc.eligible1h += 1;
        if (took !== undefined || age >= 24 * HOUR_MS) acc.eligible24h += 1;
        if (took !== undefined && took <= HOUR_MS) acc.within1h += 1;
        if (took !== undefined && took <= 24 * HOUR_MS) acc.within24h += 1;
      }
    }
    for (const lead of open.slice(0, OPEN_CAP)) {
      if (lead.firstResponseAt !== undefined) continue;
      accFor(lead.agentId).openUnanswered += 1;
      total.openUnanswered += 1;
    }

    // Every public agent gets a row (a quiet agent is information too), then
    // any hidden agent that still holds leads, then the unassigned row.
    const publicAgents = await ctx.db
      .query("agents")
      .withIndex("by_isPublic_and_order", (q) => q.eq("isPublic", true))
      .take(100);
    const rows: ResponseRow[] = publicAgents.map((agent) => ({
      agentId: agent._id,
      name: agent.name,
      ...finish(byAgent.get(agent._id) ?? emptyAcc()),
    }));
    const listed = new Set<string>(publicAgents.map((agent) => agent._id));
    for (const [key, acc] of byAgent) {
      if (key === "none" || listed.has(key)) continue;
      const agent = await ctx.db.get("agents", key);
      rows.push({ agentId: key, name: agent?.name ?? "Obrisan agent", ...finish(acc) });
    }
    const unassigned = byAgent.get("none");
    if (unassigned !== undefined) rows.push({ name: "Nedodeljeni upiti", ...finish(unassigned) });

    return {
      rows,
      total: { name: "Ukupno", ...finish(total) },
      capped,
      openCapped: open.length > OPEN_CAP,
    };
  },
});
