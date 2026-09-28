import { v } from "convex/values";
import { query } from "./_generated/server";
import { l10nV } from "./lib/validators";

/**
 * Only `verified: true` testimonials ever reach the public site — the demo
 * records are seeded with `verified: false` on purpose (docs/04-CONTENT.md).
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
    const limit = Math.min(Math.max(args.limit ?? 6, 1), 24);
    const docs = await ctx.db
      .query("testimonials")
      .withIndex("by_verified_and_order", (q) => q.eq("verified", true))
      .take(limit);
    return docs.map((doc) => ({
      _id: doc._id,
      quote: doc.quote,
      author: doc.author,
      ...(doc.context !== undefined ? { context: doc.context } : {}),
      order: doc.order,
    }));
  },
});
