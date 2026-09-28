import { v } from "convex/values";
import { query } from "./_generated/server";
import { agentPublicV, listingCardV, toAgentPublic, toCard } from "./lib/dto";
import type { ListingCard } from "./lib/dto";
import { listedScope } from "./lib/search";

export const list = query({
  args: {},
  returns: v.array(agentPublicV),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("agents")
      .withIndex("by_isPublic_and_order", (q) => q.eq("isPublic", true))
      .take(60);
    const out = [];
    for (const doc of docs) out.push(await toAgentPublic(ctx, doc));
    return out;
  },
});

export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      agent: agentPublicV,
      active: v.array(listingCardV),
      closed: v.array(listingCardV),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (doc === null || !doc.isPublic) return null;

    const own = await ctx.db
      .query("listings")
      .withIndex("by_agentId", (q) => q.eq("agentId", doc._id))
      .take(120);

    const active: ListingCard[] = [];
    const closed: ListingCard[] = [];
    for (const listing of own) {
      if (listing.visibility !== "public") continue;
      if (listing.scope.startsWith("listed:")) {
        if (active.length < 12) active.push(await toCard(ctx, listing));
      } else if (listing.scope.startsWith("closed:")) {
        if (closed.length < 6) closed.push(await toCard(ctx, listing));
      }
    }

    return { agent: await toAgentPublic(ctx, doc), active, closed };
  },
});

/**
 * Free viewing slots for the public booking widget.
 *
 * `fromDay` is an absolute epoch ms for midnight of the first day — the client
 * supplies it, so this query never reads the wall clock.
 */
export const slots = query({
  args: {
    agentId: v.id("agents"),
    fromDay: v.number(),
    days: v.number(),
    slotMinutes: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      start: v.number(),
      end: v.number(),
      taken: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get("agents", args.agentId);
    if (agent === null || !agent.isPublic) return [];

    const days = Math.min(Math.max(Math.round(args.days), 1), 21);
    const slotMs = Math.min(Math.max(args.slotMinutes ?? 60, 30), 180) * 60_000;
    const dayMs = 86_400_000;
    const windowEnd = args.fromDay + days * dayMs;

    const booked = await ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) =>
        q.eq("agentId", args.agentId).gte("start", args.fromDay).lt("start", windowEnd),
      )
      .take(400);
    const blocking = booked.filter(
      (item) => item.status === "requested" || item.status === "confirmed",
    );

    const out: { start: number; end: number; taken: boolean }[] = [];
    for (let day = 0; day < days; day += 1) {
      const dayStart = args.fromDay + day * dayMs;
      const weekday = new Date(dayStart).getUTCDay();
      for (const slot of agent.availability) {
        if (slot.weekday !== weekday) continue;
        const from = parseHm(slot.from);
        const to = parseHm(slot.to);
        if (from === null || to === null || to <= from) continue;
        for (let t = dayStart + from; t + slotMs <= dayStart + to; t += slotMs) {
          const taken = blocking.some(
            (item) => item.start < t + slotMs && item.end > t,
          );
          out.push({ start: t, end: t + slotMs, taken });
          if (out.length >= 400) return out;
        }
      }
    }
    return out;
  },
});

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60 + minutes) * 60_000;
}
