import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { agentPublicV, imageUrl, toAgentPublic } from "./lib/dto";
import { l10nV, postCategoryV, seoV } from "./lib/validators";

const postCardV = v.object({
  _id: v.id("posts"),
  slug: v.string(),
  title: l10nV,
  excerpt: l10nV,
  coverUrl: v.optional(v.string()),
  category: postCategoryV,
  tags: v.array(v.string()),
  publishedAt: v.optional(v.number()),
  featured: v.boolean(),
  readingMinutes: v.optional(v.number()),
  isDemo: v.boolean(),
});

const postDetailV = postCardV.extend({
  body: l10nV,
  author: v.optional(agentPublicV),
  seo: v.optional(seoV),
});

async function toCardDto(ctx: QueryCtx, doc: Doc<"posts">) {
  const coverUrl = doc.cover !== undefined ? await imageUrl(ctx, doc.cover) : null;
  return {
    _id: doc._id,
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    ...(coverUrl !== null ? { coverUrl } : {}),
    category: doc.category,
    tags: doc.tags,
    ...(doc.publishedAt !== undefined ? { publishedAt: doc.publishedAt } : {}),
    featured: doc.featured,
    ...(doc.readingMinutes !== undefined
      ? { readingMinutes: doc.readingMinutes }
      : {}),
    isDemo: doc.isDemo,
  };
}

export const list = query({
  args: {
    category: v.optional(postCategoryV),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(postCardV),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result =
      args.category !== undefined
        ? await ctx.db
            .query("posts")
            .withIndex("by_category_and_publishedAt", (q) =>
              q.eq("category", args.category!),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("posts")
            .withIndex("by_status_and_publishedAt", (q) =>
              q.eq("status", "published"),
            )
            .order("desc")
            .paginate(args.paginationOpts);

    const page = [];
    for (const doc of result.page) {
      if (doc.status !== "published") continue;
      page.push(await toCardDto(ctx, doc));
    }
    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(postDetailV, v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (doc === null || doc.status !== "published") return null;

    const agent =
      doc.authorAgentId !== undefined
        ? await ctx.db.get("agents", doc.authorAgentId)
        : null;

    return {
      ...(await toCardDto(ctx, doc)),
      body: doc.body,
      ...(agent !== null && agent.isPublic
        ? { author: await toAgentPublic(ctx, agent) }
        : {}),
      ...(doc.seo !== undefined ? { seo: doc.seo } : {}),
    };
  },
});

export const related = query({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  returns: v.array(postCardV),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 3, 1), 9);
    const current = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    const docs = await ctx.db
      .query("posts")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "published"))
      .order("desc")
      .take(limit + 4);
    const out = [];
    for (const doc of docs) {
      if (current !== null && doc._id === current._id) continue;
      if (out.length >= limit) break;
      out.push(await toCardDto(ctx, doc));
    }
    return out;
  },
});
