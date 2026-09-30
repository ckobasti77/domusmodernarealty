import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { assertCanEditListing, requireRole } from "./lib/auth";
import { applyDerived, locationNamesFor } from "./lib/derive";
import { notFound } from "./lib/errors";
import { assertUploadOk } from "./media";
import { imageV, l10nV, tour360V, walk3dV } from "./lib/validators";

const EDITORS = ["admin", "manager", "agent"] as const;

async function loadEditable(ctx: MutationCtx, listingId: Id<"listings">) {
  const viewer = await requireRole(ctx, EDITORS);
  const listing = await ctx.db.get("listings", listingId);
  if (listing === null) notFound("Nekretnina");
  assertCanEditListing(viewer, listing);
  return { viewer, listing };
}

/** Recomputes `hasTour` after any tour change. */
async function refreshDerived(
  ctx: MutationCtx,
  listingId: Id<"listings">,
): Promise<void> {
  const listing = await ctx.db.get("listings", listingId);
  if (listing === null) return;
  const scenes = await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listingId))
    .take(1);
  const names = await locationNamesFor(ctx, listing);
  const derived = applyDerived(listing, names, scenes.length > 0);
  await ctx.db.patch("listings", listingId, derived);
}

export const scenes = query({
  args: { listingId: v.id("listings") },
  returns: v.array(
    v.object({
      _id: v.id("tourScenes"),
      order: v.number(),
      title: l10nV,
      panoUrl: v.optional(v.string()),
      thumbUrl: v.optional(v.string()),
      links: v.array(
        v.object({
          toSceneId: v.id("tourScenes"),
          yaw: v.optional(v.number()),
          pitch: v.optional(v.number()),
        }),
      ),
      planXY: v.optional(v.array(v.number())),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null) return [];
    assertCanEditListing(viewer, listing);

    const docs = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", args.listingId))
      .take(60);

    const out = [];
    for (const doc of docs) {
      const panoUrl =
        doc.pano.kind === "url"
          ? doc.pano.url
          : await ctx.storage.getUrl(doc.pano.storageId);
      const thumbUrl =
        doc.thumb === undefined
          ? null
          : doc.thumb.kind === "url"
            ? doc.thumb.url
            : await ctx.storage.getUrl(doc.thumb.storageId);
      out.push({
        _id: doc._id,
        order: doc.order,
        title: doc.title,
        ...(panoUrl !== null ? { panoUrl } : {}),
        ...(thumbUrl !== null ? { thumbUrl } : {}),
        links: doc.links,
        ...(doc.planXY !== undefined ? { planXY: doc.planXY } : {}),
      });
    }
    return out;
  },
});

export const upsertScene = mutation({
  args: {
    listingId: v.id("listings"),
    sceneId: v.optional(v.id("tourScenes")),
    title: l10nV,
    pano: imageV,
    panoMobile: v.optional(imageV),
    thumb: v.optional(imageV),
    initialView: v.optional(v.object({ yaw: v.number(), pitch: v.number() })),
    planXY: v.optional(v.array(v.number())),
  },
  returns: v.object({ id: v.id("tourScenes") }),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);

    // ARCHITECTURE 7: panoramas are capped at 40 MB and must be an image.
    for (const image of [args.pano, args.panoMobile, args.thumb]) {
      if (image?.kind === "storage") {
        await assertUploadOk(ctx, image.storageId, "panorama");
      }
    }

    if (args.sceneId !== undefined) {
      const existing = await ctx.db.get("tourScenes", args.sceneId);
      if (existing === null || existing.listingId !== listing._id) {
        notFound("Scena");
      }
      await ctx.db.patch("tourScenes", args.sceneId, {
        title: args.title,
        pano: args.pano,
        ...(args.panoMobile !== undefined ? { panoMobile: args.panoMobile } : {}),
        ...(args.thumb !== undefined ? { thumb: args.thumb } : {}),
        ...(args.initialView !== undefined ? { initialView: args.initialView } : {}),
        ...(args.planXY !== undefined ? { planXY: args.planXY } : {}),
      });
      await logActivity(ctx, {
        entity: "tour",
        entityId: args.sceneId,
        action: "tour.scene.updated",
        summary: `${listing.ref}: ${args.title.sr}`,
        by: viewer._id,
      });
      return { id: args.sceneId };
    }

    const siblings = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listing._id))
      .take(60);

    const id = await ctx.db.insert("tourScenes", {
      listingId: listing._id,
      order: siblings.length,
      title: args.title,
      pano: args.pano,
      ...(args.panoMobile !== undefined ? { panoMobile: args.panoMobile } : {}),
      ...(args.thumb !== undefined ? { thumb: args.thumb } : {}),
      ...(args.initialView !== undefined ? { initialView: args.initialView } : {}),
      links: [],
      ...(args.planXY !== undefined ? { planXY: args.planXY } : {}),
    });

    await refreshDerived(ctx, listing._id);
    await logActivity(ctx, {
      entity: "tour",
      entityId: id,
      action: "tour.scene.created",
      summary: `${listing.ref}: ${args.title.sr}`,
      by: viewer._id,
    });
    return { id };
  },
});

export const reorderScenes = mutation({
  args: { listingId: v.id("listings"), ids: v.array(v.id("tourScenes")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    let order = 0;
    for (const id of args.ids) {
      const scene = await ctx.db.get("tourScenes", id);
      if (scene === null || scene.listingId !== listing._id) continue;
      await ctx.db.patch("tourScenes", id, { order });
      order += 1;
    }
    await logActivity(ctx, {
      entity: "tour",
      entityId: listing._id,
      action: "tour.scenes.reordered",
      summary: listing.ref,
      by: viewer._id,
    });
    return null;
  },
});

export const setLinks = mutation({
  args: {
    listingId: v.id("listings"),
    sceneId: v.id("tourScenes"),
    links: v.array(
      v.object({
        toSceneId: v.id("tourScenes"),
        yaw: v.optional(v.number()),
        pitch: v.optional(v.number()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    const scene = await ctx.db.get("tourScenes", args.sceneId);
    if (scene === null || scene.listingId !== listing._id) notFound("Scena");

    // Links may only point at scenes of the same listing.
    const valid = [];
    for (const link of args.links.slice(0, 12)) {
      const target = await ctx.db.get("tourScenes", link.toSceneId);
      if (target === null || target.listingId !== listing._id) continue;
      valid.push(link);
    }
    await ctx.db.patch("tourScenes", args.sceneId, { links: valid });
    await logActivity(ctx, {
      entity: "tour",
      entityId: args.sceneId,
      action: "tour.scene.links",
      summary: `${listing.ref}: ${valid.length} veza`,
      by: viewer._id,
    });
    return null;
  },
});

export const removeScene = mutation({
  args: { listingId: v.id("listings"), sceneId: v.id("tourScenes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    const scene = await ctx.db.get("tourScenes", args.sceneId);
    if (scene === null || scene.listingId !== listing._id) notFound("Scena");

    if (scene.pano.kind === "storage") await ctx.storage.delete(scene.pano.storageId);
    if (scene.panoMobile?.kind === "storage") {
      await ctx.storage.delete(scene.panoMobile.storageId);
    }
    await ctx.db.delete("tourScenes", args.sceneId);

    // Drop dangling links from the remaining scenes.
    const rest = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listing._id))
      .take(60);
    let order = 0;
    for (const other of rest) {
      await ctx.db.patch("tourScenes", other._id, {
        order,
        links: other.links.filter((link) => link.toSceneId !== args.sceneId),
      });
      order += 1;
    }

    await refreshDerived(ctx, listing._id);
    await logActivity(ctx, {
      entity: "tour",
      entityId: args.sceneId,
      action: "tour.scene.removed",
      summary: listing.ref,
      by: viewer._id,
    });
    return null;
  },
});

export const setTour360 = mutation({
  args: { listingId: v.id("listings"), tour360: v.optional(tour360V) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    await ctx.db.patch("listings", listing._id, {
      tour360: args.tour360,
      updatedAt: Date.now(),
    });
    await refreshDerived(ctx, listing._id);
    await logActivity(ctx, {
      entity: "tour",
      entityId: listing._id,
      action: "tour.360.set",
      summary: `${listing.ref}: ${args.tour360?.provider ?? "none"} (${args.tour360?.published === true ? "objavljeno" : "skriveno"})`,
      by: viewer._id,
    });
    return null;
  },
});

export const setWalk3d = mutation({
  args: { listingId: v.id("listings"), walk3d: v.optional(walk3dV) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);

    // ARCHITECTURE 7: splats are capped at 200 MB.
    for (const asset of [
      args.walk3d?.desktop,
      args.walk3d?.mobile,
      args.walk3d?.collision,
    ]) {
      if (asset?.source.kind === "storage") {
        await assertUploadOk(ctx, asset.source.storageId, "splat");
      }
    }
    if (args.walk3d?.poster?.kind === "storage") {
      await assertUploadOk(ctx, args.walk3d.poster.storageId, "image");
    }

    await ctx.db.patch("listings", listing._id, {
      walk3d: args.walk3d,
      updatedAt: Date.now(),
    });
    await refreshDerived(ctx, listing._id);
    await logActivity(ctx, {
      entity: "tour",
      entityId: listing._id,
      action: "tour.walk3d.set",
      summary: `${listing.ref}: ${args.walk3d?.published === true ? "objavljeno" : "skriveno"}`,
      by: viewer._id,
    });
    return null;
  },
});

