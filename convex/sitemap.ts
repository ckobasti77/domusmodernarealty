import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { imageUrl } from "./lib/dto";
import { listedScope } from "./lib/search";
import { pageKeyV, transactionV } from "./lib/validators";
import type { MediaItem } from "./lib/validators";

/**
 * The feed behind `app/sitemap.ts` (ARCHITECTURE §9): only what a public page
 * already shows, i.e. listed listings, published posts, public agents and the
 * locations a visitor can land on. Slugs, last-modified times and picture URLs,
 * nothing else.
 */

/** Google reads up to 1,000 images per URL; a listing page shows its first few prominently. */
const IMAGES_PER_LISTING = 5;

async function mediaUrls(ctx: QueryCtx, media: readonly MediaItem[], limit: number): Promise<string[]> {
  const ordered = [...media].sort(
    (a, b) => Number(b.isCover === true) - Number(a.isCover === true) || a.order - b.order,
  );
  const urls: string[] = [];
  for (const item of ordered.slice(0, limit)) {
    const url = await imageUrl(ctx, item.image);
    if (url !== null) urls.push(url);
  }
  return urls;
}

const listingEntryV = v.object({
  slug: v.string(),
  updatedAt: v.number(),
  images: v.array(v.string()),
});

/** Listed (published, not closed) listings of one transaction, newest first. */
export const listings = query({
  args: { transaction: transactionV, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(listingEntryV),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("listings")
      .withIndex("by_scope_and_publishedAt", (q) => q.eq("scope", listedScope(args.transaction)))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = [];
    for (const doc of result.page) {
      page.push({
        slug: doc.slug,
        updatedAt: doc.updatedAt,
        images: await mediaUrls(ctx, doc.media, IMAGES_PER_LISTING),
      });
    }
    return { ...result, page };
  },
});

/** Bounds for the small tables; an agency has far fewer rows than these. */
const MAX_LOCATIONS = 400;
const MAX_POSTS = 1000;
const MAX_AGENTS = 60;

async function hasListings(ctx: QueryCtx, location: Doc<"locations">): Promise<boolean> {
  const counts = await ctx.db
    .query("locationCounts")
    .withIndex("by_locationId", (q) => q.eq("locationId", location._id))
    .unique();
  return (counts?.sale ?? 0) + (counts?.rent ?? 0) > 0;
}

export const content = query({
  args: {},
  returns: v.object({
    pages: v.array(v.object({ key: pageKeyV, updatedAt: v.number() })),
    locations: v.array(v.object({ slug: v.string(), image: v.optional(v.string()) })),
    posts: v.array(
      v.object({ slug: v.string(), updatedAt: v.number(), image: v.optional(v.string()) }),
    ),
    agents: v.array(v.object({ slug: v.string(), image: v.optional(v.string()) })),
  }),
  handler: async (ctx) => {
    const pages = (await ctx.db.query("pages").take(20)).map((doc) => ({
      key: doc.key,
      updatedAt: doc.updatedAt,
    }));

    // A place with neither an introduction nor a single listing is a thin page:
    // reachable from the site, but not worth offering to a crawler.
    const locations = [];
    for (const kind of ["city", "municipality", "neighborhood"] as const) {
      const docs = await ctx.db
        .query("locations")
        .withIndex("by_kind_and_order", (q) => q.eq("kind", kind))
        .take(MAX_LOCATIONS);
      for (const doc of docs) {
        if (doc.intro === undefined && !(await hasListings(ctx, doc))) continue;
        const image = doc.cover !== undefined ? await imageUrl(ctx, doc.cover) : null;
        locations.push({ slug: doc.slug, ...(image !== null ? { image } : {}) });
      }
    }

    const postDocs = await ctx.db
      .query("posts")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "published"))
      .order("desc")
      .take(MAX_POSTS);
    const posts = [];
    for (const doc of postDocs) {
      const image = doc.cover !== undefined ? await imageUrl(ctx, doc.cover) : null;
      posts.push({
        slug: doc.slug,
        updatedAt: doc.updatedAt ?? doc.publishedAt ?? doc._creationTime,
        ...(image !== null ? { image } : {}),
      });
    }

    const agentDocs = await ctx.db
      .query("agents")
      .withIndex("by_isPublic_and_order", (q) => q.eq("isPublic", true))
      .take(MAX_AGENTS);
    const agents = [];
    for (const doc of agentDocs) {
      const image = doc.photo !== undefined ? await imageUrl(ctx, doc.photo) : null;
      agents.push({ slug: doc.slug, ...(image !== null ? { image } : {}) });
    }

    return { pages, locations, posts, agents };
  },
});
