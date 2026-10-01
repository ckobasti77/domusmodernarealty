import { v } from "convex/values";
import { query } from "./_generated/server";
import { l10nV } from "./lib/validators";

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 24;

/** A whole number of rows in 1..24, whatever the caller sent (NaN, 2.5, -1, 1e9). */
function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);
}

/**
 * Only `verified: true` testimonials that are not demo records ever reach the
 * public site (docs/04-CONTENT.md: demo testimonials never render). The demo
 * rows are seeded unverified and `setVerified` refuses them; the index makes
 * the rule hold even for a row edited by hand.
 */
export const verified = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("testimonials"),
      quote: l10nV,
      author: v.string(),
      context: v.optional(l10nV),
      order: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("testimonials")
      .withIndex("by_verified_and_isDemo_and_order", (q) => q.eq("verified", true).eq("isDemo", false))
      .take(clampLimit(args.limit));
    return docs.map((doc) => ({
      _id: doc._id,
      quote: doc.quote,
      author: doc.author,
      ...(doc.context !== undefined ? { context: doc.context } : {}),
      order: doc.order,
    }));
  },
});
