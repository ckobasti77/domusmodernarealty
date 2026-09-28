import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { slugify } from "./lib/slug";
import {
  imageV,
  l10nV,
  postCategoryV,
  postStatusV,
  seoV,
} from "./lib/validators";

const CONTENT = ["admin", "manager", "editor"] as const;

/** Rough reading time from the Serbian body (200 wpm, HTML stripped). */
function readingMinutes(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  return Math.max(1, Math.round(words / 200));
}

export const list = query({
  args: {
    status: v.optional(postStatusV),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("posts"),
        slug: v.string(),
        title: l10nV,
        category: postCategoryV,
        status: postStatusV,
        publishedAt: v.optional(v.number()),
        featured: v.boolean(),
        coverUrl: v.optional(v.string()),
        missingLocales: v.array(v.string()),
        isDemo: v.boolean(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, CONTENT);
    const result =
      args.status !== undefined
        ? await ctx.db
            .query("posts")
            .withIndex("by_status_and_publishedAt", (q) => q.eq("status", args.status!))
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db.query("posts").order("desc").paginate(args.paginationOpts);

    const page = [];
    for (const doc of result.page) {
      const coverUrl =
        doc.cover === undefined
          ? null
          : doc.cover.kind === "url"
            ? doc.cover.url
            : await ctx.storage.getUrl(doc.cover.storageId);
      const missingLocales = (["en", "ru", "de"] as const).filter(
        (locale) =>
          (doc.title[locale] ?? "").length === 0 || (doc.body[locale] ?? "").length === 0,
      );
      page.push({
        _id: doc._id,
        slug: doc.slug,
        title: doc.title,
        category: doc.category,
        status: doc.status,
        ...(doc.publishedAt !== undefined ? { publishedAt: doc.publishedAt } : {}),
        featured: doc.featured,
        ...(coverUrl !== null ? { coverUrl } : {}),
        missingLocales,
        isDemo: doc.isDemo,
      });
    }
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const get = query({
  args: { id: v.id("posts") },
  returns: v.union(schema.doc("posts"), v.null()),
  handler: async (ctx, args) => {
    await requireRole(ctx, CONTENT);
    return await ctx.db.get("posts", args.id);
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("posts")),
    slug: v.optional(v.string()),
    title: l10nV,
    excerpt: l10nV,
    body: l10nV,
    cover: v.optional(imageV),
    category: postCategoryV,
    tags: v.array(v.string()),
    authorAgentId: v.optional(v.id("agents")),
    featured: v.boolean(),
    seo: v.optional(seoV),
  },
  returns: v.object({ id: v.id("posts"), slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    if (args.title.sr.trim().length < 5) invalidInput("Naslov je obavezan.");

    const base = args.slug !== undefined ? slugify(args.slug) : slugify(args.title.sr);
    let slug = base;
    let suffix = 2;
    for (;;) {
      const clash = await ctx.db
        .query("posts")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (clash === null || clash._id === args.id) break;
      slug = `${base}-${suffix}`;
      suffix += 1;
      if (suffix > 30) break;
    }

    const fields = {
      slug,
      title: args.title,
      excerpt: args.excerpt,
      body: args.body,
      cover: args.cover,
      category: args.category,
      tags: args.tags.slice(0, 12),
      authorAgentId: args.authorAgentId,
      featured: args.featured,
      seo: args.seo,
      readingMinutes: readingMinutes(args.body.sr),
    };

    if (args.id !== undefined) {
      const existing = await ctx.db.get("posts", args.id);
      if (existing === null) notFound("Članak");
      await ctx.db.patch("posts", args.id, fields);
      await logActivity(ctx, {
        entity: "post",
        entityId: args.id,
        action: "post.updated",
        summary: args.title.sr,
        by: viewer._id,
      });
      return { id: args.id, slug };
    }

    const id = await ctx.db.insert("posts", {
      ...fields,
      status: "draft",
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: id,
      action: "post.created",
      summary: args.title.sr,
      by: viewer._id,
    });
    return { id, slug };
  },
});

export const setStatus = mutation({
  args: { id: v.id("posts"), status: postStatusV },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await ctx.db.get("posts", args.id);
    if (doc === null) notFound("Članak");

    if (args.status === "published") {
      if (doc.body.sr.trim().length < 200) {
        invalidInput("Tekst na srpskom je prekratak za objavu.");
      }
      if (doc.excerpt.sr.trim().length < 40) {
        invalidInput("Unesite kratak opis (excerpt) na srpskom.");
      }
    }

    await ctx.db.patch("posts", args.id, {
      status: args.status,
      ...(args.status === "published"
        ? { publishedAt: doc.publishedAt ?? Date.now() }
        : {}),
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: args.id,
      action: `post.${args.status}`,
      summary: doc.title.sr,
      by: viewer._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ["admin", "manager"]);
    const doc = await ctx.db.get("posts", args.id);
    if (doc === null) notFound("Članak");
    if (doc.cover?.kind === "storage") await ctx.storage.delete(doc.cover.storageId);
    await ctx.db.delete("posts", args.id);
    await logActivity(ctx, {
      entity: "post",
      entityId: args.id,
      action: "post.deleted",
      summary: doc.title.sr,
      by: viewer._id,
    });
    return null;
  },
});
