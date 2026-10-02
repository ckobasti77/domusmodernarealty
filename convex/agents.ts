import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import {
  BOOKING_DAYS,
  belgradeMidnight,
  belgradeWall,
  DAY_MS,
  fromBelgradeWall,
  VIEWING_SLOT_MS,
} from "./lib/belgradeTime";
import { agentPublicV, listingCardV, toAgentPublic, toCard } from "./lib/dto";
import type { ListingCard } from "./lib/dto";
import { isPublicScope } from "./lib/search";
import type { ListingStatus } from "./lib/validators";

/** Cards per section of an agent's profile (PRD A9). */
const ACTIVE_CARDS = 12;
const CLOSED_CARDS = 6;

/**
 * The agent's most recently updated public listings in `statuses`, newest
 * first: one bounded read per status on `by_agentId_and_status_and_updatedAt`,
 * so archived or withdrawn listings can never crowd the live ones out. Each
 * status reads three times the cards, so the odd row skipped for its
 * `visibility` (unlisted, private) does not leave a section short.
 */
async function profileCards(
  ctx: QueryCtx,
  agentId: Id<"agents">,
  statuses: readonly ListingStatus[],
  cards: number,
): Promise<ListingCard[]> {
  const docs: Doc<"listings">[] = [];
  for (const status of statuses) {
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_agentId_and_status_and_updatedAt", (q) =>
        q.eq("agentId", agentId).eq("status", status),
      )
      .order("desc")
      .take(cards * 3);
    docs.push(...rows.filter((doc) => isPublicScope(doc.scope)));
  }
  docs.sort((a, b) => b.updatedAt - a.updatedAt);
  const out: ListingCard[] = [];
  for (const doc of docs.slice(0, cards)) out.push(await toCard(ctx, doc));
  return out;
}

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

    return {
      agent: await toAgentPublic(ctx, doc),
      // On the market (the `listed` scope) and sold or let (`closed`).
      active: await profileCards(ctx, doc._id, ["published", "reserved"], ACTIVE_CARDS),
      closed: await profileCards(ctx, doc._id, ["sold", "rented"], CLOSED_CARDS),
    };
  },
});

/**
 * Free viewing slots for the public booking widget.
 *
 * `fromDay` is any instant on the first day; the days are Belgrade calendar
 * days computed here, never from a client-supplied offset. Agent availability
 * is entered as Belgrade wall-clock time in `agentsAdmin.setAvailability`, so
 * each slot's start is the instant of that wall-clock time on that day, which
 * stays correct across a DST change inside the window. The grid is the one
 * `viewings.request` accepts: `VIEWING_SLOT_MS` steps from the start of each
 * availability window.
 */
export const slots = query({
  args: {
    agentId: v.id("agents"),
    fromDay: v.number(),
    days: v.number(),
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

    const days = Math.min(Math.max(Math.round(args.days), 1), BOOKING_DAYS);
    const first = belgradeMidnight(args.fromDay);
    const windowEnd = belgradeMidnight(first + days * DAY_MS + 12 * 60 * 60_000);

    const booked = await ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) =>
        q.eq("agentId", args.agentId).gte("start", first).lt("start", windowEnd),
      )
      .take(400);
    const blocking = booked.filter(
      (item) => item.status === "requested" || item.status === "confirmed",
    );

    const out: { start: number; end: number; taken: boolean }[] = [];
    for (let day = 0; day < days; day += 1) {
      // Midday is safely inside the day even when it has 23 or 25 hours.
      const noonWall = belgradeWall(first + day * DAY_MS + 12 * 60 * 60_000);
      const midnightWall = noonWall - (noonWall % DAY_MS);
      const weekday = new Date(noonWall).getUTCDay();
      for (const slot of agent.availability) {
        if (slot.weekday !== weekday) continue;
        const from = parseHm(slot.from);
        const to = parseHm(slot.to);
        if (from === null || to === null || to <= from) continue;
        for (let at = from; at + VIEWING_SLOT_MS <= to; at += VIEWING_SLOT_MS) {
          const start = fromBelgradeWall(midnightWall + at);
          const end = start + VIEWING_SLOT_MS;
          const taken = blocking.some((item) => item.start < end && item.end > start);
          out.push({ start, end, taken });
          if (out.length >= 400) return out;
        }
      }
    }
    return out;
  },
});

/** "09:30" → ms after midnight; `null` for anything that is not a valid time. */
export function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60 + minutes) * 60_000;
}
