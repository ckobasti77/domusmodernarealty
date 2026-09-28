import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { imageUrl, listingCardV, toCard } from "./lib/dto";
import { listedScope, matches } from "./lib/search";
import { l10nListV, l10nV, locationKindV } from "./lib/validators";
import type { ListingCard } from "./lib/dto";

const locationNodeV = v.object({
  _id: v.id("locations"),
  kind: locationKindV,
  parentId: v.optional(v.id("locations")),
  slug: v.string(),
  name: l10nV,
  coverUrl: v.optional(v.string()),
  avgPricePerM2Sale: v.optional(v.number()),
  avgPricePerM2Rent: v.optional(v.number()),
  lat: v.number(),
  lng: v.number(),
  featured: v.boolean(),
  order: v.number(),
  saleCount: v.number(),
  rentCount: v.number(),
});

async function toNode(ctx: QueryCtx, doc: Doc<"locations">) {
  const counts = await ctx.db
    .query("locationCounts")
    .withIndex("by_locationId", (q) => q.eq("locationId", doc._id))
    .unique();
  const coverUrl = doc.cover !== undefined ? await imageUrl(ctx, doc.cover) : null;
  return {
    _id: doc._id,
    kind: doc.kind,
    ...(doc.parentId !== undefined ? { parentId: doc.parentId } : {}),
    slug: doc.slug,
    name: doc.name,
    ...(coverUrl !== null ? { coverUrl } : {}),
    ...(doc.avgPricePerM2Sale !== undefined
      ? { avgPricePerM2Sale: doc.avgPricePerM2Sale }
      : {}),
    ...(doc.avgPricePerM2Rent !== undefined
      ? { avgPricePerM2Rent: doc.avgPricePerM2Rent }
      : {}),
    lat: doc.lat,
    lng: doc.lng,
    featured: doc.featured,
    order: doc.order,
    saleCount: counts?.sale ?? 0,
    rentCount: counts?.rent ?? 0,
  };
}

/** The whole city → municipality → neighborhood tree with denormalized counts. */
export const tree = query({
  args: {},
  returns: v.array(locationNodeV),
  handler: async (ctx) => {
    const out = [];
    for (const kind of ["city", "municipality", "neighborhood"] as const) {
      const docs = await ctx.db
        .query("locations")
        .withIndex("by_kind_and_order", (q) => q.eq("kind", kind))
        .take(400);
      for (const doc of docs) out.push(await toNode(ctx, doc));
    }
    return out;
  },
});

export const featured = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(locationNodeV),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 6, 1), 24);
    const docs = await ctx.db
      .query("locations")
      .withIndex("by_featured_and_order", (q) => q.eq("featured", true))
      .take(limit);
    const out = [];
    for (const doc of docs) out.push(await toNode(ctx, doc));
    return out;
  },
});

export const bySlug = query({
  args: { slug: v.string(), listingLimit: v.optional(v.number()) },
  returns: v.union(
    v.object({
      location: locationNodeV,
      intro: v.optional(l10nV),
      facts: v.optional(l10nListV),
      parents: v.array(locationNodeV),
      children: v.array(locationNodeV),
      listings: v.array(listingCardV),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("locations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (doc === null) return null;

    const parents = [];
    let parentId: Id<"locations"> | undefined = doc.parentId;
    let guard = 0;
    while (parentId !== undefined && guard < 4) {
      const parent: Doc<"locations"> | null = await ctx.db.get("locations", parentId);
      if (parent === null) break;
      parents.unshift(await toNode(ctx, parent));
      parentId = parent.parentId;
      guard += 1;
    }

    const childDocs = await ctx.db
      .query("locations")
      .withIndex("by_parentId_and_order", (q) => q.eq("parentId", doc._id))
      .take(60);
    const children = [];
    for (const child of childDocs) children.push(await toNode(ctx, child));

    // Query by the location's OWN index. Scanning the 80 newest listings and
    // filtering in JS emptied a neighborhood page as soon as 80 newer listings
    // were published anywhere else in Serbia.
    const listingLimit = Math.min(Math.max(args.listingLimit ?? 9, 1), 24);
    const cards: ListingCard[] = [];
    for (const transaction of ["sale", "rent"] as const) {
      if (cards.length >= listingLimit) break;
      const scope = listedScope(transaction);
      const found =
        doc.kind === "neighborhood"
          ? await ctx.db
              .query("listings")
              .withIndex("by_scope_and_neighborhoodId_and_publishedAt", (q) =>
                q.eq("scope", scope).eq("neighborhoodId", doc._id),
              )
              .order("desc")
              .take(listingLimit * 2)
          : doc.kind === "municipality"
            ? await ctx.db
                .query("listings")
                .withIndex("by_scope_and_municipalityId_and_price", (q) =>
                  q.eq("scope", scope).eq("municipalityId", doc._id),
                )
                .take(listingLimit * 2)
            : await ctx.db
                .query("listings")
                .withIndex("by_scope_and_cityId_and_price", (q) =>
                  q.eq("scope", scope).eq("cityId", doc._id),
                )
                .take(listingLimit * 2);

      for (const listing of found) {
        if (cards.length >= listingLimit) break;
        if (!matches(listing, { transaction })) continue;
        cards.push(await toCard(ctx, listing));
      }
    }

    return {
      location: await toNode(ctx, doc),
      ...(doc.intro !== undefined ? { intro: doc.intro } : {}),
      ...(doc.facts !== undefined ? { facts: doc.facts } : {}),
      parents,
      children,
      listings: cards,
    };
  },
});
