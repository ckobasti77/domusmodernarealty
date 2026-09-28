import { v } from "convex/values";
import { query } from "./_generated/server";
import { pageBlockV, pageKeyV, seoV } from "./lib/validators";

export const get = query({
  args: { key: pageKeyV },
  returns: v.union(
    v.object({
      key: pageKeyV,
      blocks: v.array(pageBlockV),
      seo: v.optional(seoV),
      updatedAt: v.number(),
      isDemo: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (doc === null) return null;
    return {
      key: doc.key,
      blocks: doc.blocks,
      ...(doc.seo !== undefined ? { seo: doc.seo } : {}),
      updatedAt: doc.updatedAt,
      isDemo: doc.isDemo,
    };
  },
});
