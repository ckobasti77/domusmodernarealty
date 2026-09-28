import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { diffFields, logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { pageBlockV, pageKeyV, seoV } from "./lib/validators";

const CONTENT = ["admin", "manager", "editor"] as const;

export const get = query({
  args: { key: pageKeyV },
  returns: v.union(
    v.object({
      _id: v.id("pages"),
      key: pageKeyV,
      blocks: v.array(pageBlockV),
      seo: v.optional(seoV),
      updatedAt: v.number(),
      isDemo: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, CONTENT);
    const doc = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (doc === null) return null;
    return {
      _id: doc._id,
      key: doc.key,
      blocks: doc.blocks,
      ...(doc.seo !== undefined ? { seo: doc.seo } : {}),
      updatedAt: doc.updatedAt,
      isDemo: doc.isDemo,
    };
  },
});

export const listKeys = query({
  args: {},
  returns: v.array(
    v.object({ key: pageKeyV, blocks: v.number(), updatedAt: v.number(), isDemo: v.boolean() }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, CONTENT);
    const docs = await ctx.db.query("pages").take(40);
    return docs.map((doc) => ({
      key: doc.key,
      blocks: doc.blocks.length,
      updatedAt: doc.updatedAt,
      isDemo: doc.isDemo,
    }));
  },
});

export const upsert = mutation({
  args: {
    key: pageKeyV,
    blocks: v.array(pageBlockV),
    seo: v.optional(seoV),
  },
  returns: v.object({ id: v.id("pages") }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const now = Date.now();
    const existing = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing === null) {
      const id = await ctx.db.insert("pages", {
        key: args.key,
        blocks: args.blocks,
        seo: args.seo,
        updatedAt: now,
        isDemo: false,
      });
      await logActivity(ctx, {
        entity: "page",
        entityId: id,
        action: "page.created",
        summary: args.key,
        by: viewer._id,
      });
      return { id };
    }

    await ctx.db.patch("pages", existing._id, {
      blocks: args.blocks,
      seo: args.seo,
      updatedAt: now,
      // Editing a seeded page makes it real content.
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "page",
      entityId: existing._id,
      action: "page.updated",
      summary: args.key,
      diff: diffFields(
        { blocks: existing.blocks.length },
        { blocks: args.blocks.length },
      ),
      by: viewer._id,
    });
    return { id: existing._id };
  },
});
