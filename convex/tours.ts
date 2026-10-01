import { v } from "convex/values";
import { query } from "./_generated/server";
import { assetFormatV, l10nV, walkHotspotV } from "./lib/validators";
import { imageUrl } from "./lib/dto";
import { isPublicScope } from "./lib/search";

const sceneV = v.object({
  _id: v.id("tourScenes"),
  order: v.number(),
  title: l10nV,
  panoUrl: v.string(),
  panoMobileUrl: v.optional(v.string()),
  thumbUrl: v.optional(v.string()),
  initialView: v.optional(v.object({ yaw: v.number(), pitch: v.number() })),
  links: v.array(
    v.object({
      toSceneId: v.id("tourScenes"),
      yaw: v.optional(v.number()),
      pitch: v.optional(v.number()),
    }),
  ),
  planXY: v.optional(v.array(v.number())),
  credit: v.optional(v.string()),
});

/** Scenes for the self-hosted 360° tour. Empty unless the tour is published. */
export const scenes = query({
  args: { listingId: v.id("listings") },
  returns: v.array(sceneV),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isPublicScope(listing.scope)) return [];
    // Scenes stay stored when the tour switches to Matterport/Kuula; only a live self-hosted tour shows them.
    if (listing.tour360?.published !== true || listing.tour360.provider !== "self") return [];

    const docs = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", args.listingId))
      .take(40);

    const out = [];
    for (const doc of docs) {
      const panoUrl = await imageUrl(ctx, doc.pano);
      if (panoUrl === null) continue;
      const panoMobileUrl =
        doc.panoMobile !== undefined ? await imageUrl(ctx, doc.panoMobile) : null;
      const thumbUrl =
        doc.thumb !== undefined ? await imageUrl(ctx, doc.thumb) : null;
      out.push({
        _id: doc._id,
        order: doc.order,
        title: doc.title,
        panoUrl,
        ...(panoMobileUrl !== null ? { panoMobileUrl } : {}),
        ...(thumbUrl !== null ? { thumbUrl } : {}),
        ...(doc.initialView !== undefined ? { initialView: doc.initialView } : {}),
        links: doc.links,
        ...(doc.planXY !== undefined ? { planXY: doc.planXY } : {}),
        ...(doc.credit !== undefined ? { credit: doc.credit } : {}),
      });
    }
    return out;
  },
});

/** Splat walkthrough assets. Empty unless `walk3d.published` is true. */
export const walk3d = query({
  args: { listingId: v.id("listings") },
  returns: v.union(
    v.object({
      desktopUrl: v.optional(v.string()),
      desktopFormat: v.optional(assetFormatV),
      desktopBytes: v.optional(v.number()),
      mobileUrl: v.optional(v.string()),
      mobileFormat: v.optional(assetFormatV),
      mobileBytes: v.optional(v.number()),
      collisionUrl: v.optional(v.string()),
      posterUrl: v.optional(v.string()),
      spawn: v.optional(
        v.object({ x: v.number(), y: v.number(), z: v.number(), yaw: v.number() }),
      ),
      eyeHeight: v.optional(v.number()),
      floorPolygon: v.optional(v.array(v.array(v.number()))),
      hotspots: v.optional(v.array(walkHotspotV)),
      credits: v.optional(v.string()),
      aiGenerated: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isPublicScope(listing.scope)) return null;
    const walk = listing.walk3d;
    if (walk === undefined || !walk.published) return null;

    const desktopUrl =
      walk.desktop !== undefined ? await imageUrl(ctx, walk.desktop.source) : null;
    const mobileUrl =
      walk.mobile !== undefined ? await imageUrl(ctx, walk.mobile.source) : null;
    const collisionUrl =
      walk.collision !== undefined
        ? await imageUrl(ctx, walk.collision.source)
        : null;
    const posterUrl =
      walk.poster !== undefined ? await imageUrl(ctx, walk.poster) : null;

    return {
      ...(desktopUrl !== null ? { desktopUrl } : {}),
      ...(walk.desktop !== undefined ? { desktopFormat: walk.desktop.format } : {}),
      ...(walk.desktop?.bytes !== undefined ? { desktopBytes: walk.desktop.bytes } : {}),
      ...(mobileUrl !== null ? { mobileUrl } : {}),
      ...(walk.mobile !== undefined ? { mobileFormat: walk.mobile.format } : {}),
      ...(walk.mobile?.bytes !== undefined ? { mobileBytes: walk.mobile.bytes } : {}),
      ...(collisionUrl !== null ? { collisionUrl } : {}),
      ...(posterUrl !== null ? { posterUrl } : {}),
      ...(walk.spawn !== undefined ? { spawn: walk.spawn } : {}),
      ...(walk.eyeHeight !== undefined ? { eyeHeight: walk.eyeHeight } : {}),
      ...(walk.floorPolygon !== undefined
        ? { floorPolygon: walk.floorPolygon }
        : {}),
      ...(walk.hotspots !== undefined ? { hotspots: walk.hotspots } : {}),
      ...(walk.credits !== undefined ? { credits: walk.credits } : {}),
      ...(walk.aiGenerated !== undefined ? { aiGenerated: walk.aiGenerated } : {}),
    };
  },
});
