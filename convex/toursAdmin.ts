import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { assertCanEditListing, requireRole } from "./lib/auth";
import { applyDerived, locationNamesFor } from "./lib/derive";
import { invalidInput, notFound } from "./lib/errors";
import { assertUploadOk } from "./media";
import { imageV, l10nV, tour360V, walk3dV } from "./lib/validators";
import type { ImageRef } from "./lib/validators";
import { assertFresh, deleteBlobIfPresent, releaseReplacedImage } from "./lib/storage";
import { TOUR_LIMITS, isSitePanoPath } from "./lib/tours";
import { isNewBlob, normalizeTour360, prepareWalk3d, releaseWalk3dBlobs } from "./lib/tourAssets";

/**
 * Admin API for the listing editor's "360° / 3D" tab: self-hosted 360° scenes
 * (panoramas, order, links, initial view) and the splat walkthrough.
 */

const EDITORS = ["admin", "manager", "agent"] as const;

const viewV = v.object({ yaw: v.number(), pitch: v.number() });
const linkV = v.object({
  toSceneId: v.id("tourScenes"),
  yaw: v.optional(v.number()),
  pitch: v.optional(v.number()),
});

async function loadEditable(ctx: MutationCtx, listingId: Id<"listings">) {
  const viewer = await requireRole(ctx, EDITORS);
  const listing = await ctx.db.get("listings", listingId);
  if (listing === null) notFound("Nekretnina");
  assertCanEditListing(viewer, listing);
  return { viewer, listing };
}

async function scenesOf(ctx: QueryCtx | MutationCtx, listingId: Id<"listings">) {
  return await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listingId))
    .take(TOUR_LIMITS.scenes + 1);
}

async function urlOf(ctx: QueryCtx, image: ImageRef | undefined): Promise<string | null> {
  if (image === undefined) return null;
  return image.kind === "url" ? image.url : await ctx.storage.getUrl(image.storageId);
}

/** Recomputes `hasTour` after any tour change. */
async function refreshDerived(ctx: MutationCtx, listingId: Id<"listings">): Promise<void> {
  const listing = await ctx.db.get("listings", listingId);
  if (listing === null) return;
  const scenes = await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listingId))
    .take(1);
  const names = await locationNamesFor(ctx, listing);
  await ctx.db.patch("listings", listingId, applyDerived(listing, names, scenes.length > 0));
}

/** A panorama is an uploaded image (≤ 40 MB, thumbnails ≤ 20 MB) or one shipped with the site. */
async function assertPano(
  ctx: MutationCtx,
  before: ImageRef | undefined,
  next: ImageRef,
  kind: "panorama" | "image" = "panorama",
): Promise<void> {
  if (next.kind === "url") {
    if (!isSitePanoPath(next.url)) invalidInput("Panoramu otpremite sa računara.");
    return;
  }
  if (!isNewBlob(before, next)) return;
  const meta = await ctx.db.system.get("_storage", next.storageId);
  if (meta !== null) assertFresh(meta._creationTime);
  await assertUploadOk(ctx, next.storageId, kind);
}

function assertView(view: { yaw: number; pitch: number } | undefined): void {
  if (view === undefined) return;
  if (!Number.isFinite(view.yaw) || !Number.isFinite(view.pitch) || Math.abs(view.pitch) > Math.PI / 2) {
    invalidInput("Pogled mora imati ispravan ugao (yaw) i nagib (pitch).");
  }
}

function assertTitle(title: Doc<"tourScenes">["title"]): void {
  for (const value of [title.sr, title.en, title.ru, title.de]) {
    if (value !== undefined && value.length > 80) invalidInput("Naziv scene može imati najviše 80 znakova.");
    // The 360° viewer renders titles inside its own HTML; markup is never a room name.
    if (value !== undefined && /[<>]/.test(value)) invalidInput("Naziv scene ne može sadržati znakove < i >.");
  }
  if (title.sr.trim() === "") invalidInput("Unesite naziv scene na srpskom.");
}

export const scenes = query({
  args: { listingId: v.id("listings") },
  returns: v.array(
    v.object({
      _id: v.id("tourScenes"),
      order: v.number(),
      title: l10nV,
      pano: imageV,
      panoUrl: v.optional(v.string()),
      panoMobile: v.optional(imageV),
      panoMobileUrl: v.optional(v.string()),
      thumb: v.optional(imageV),
      thumbUrl: v.optional(v.string()),
      initialView: v.optional(viewV),
      links: v.array(linkV),
      planXY: v.optional(v.array(v.number())),
      credit: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null) return [];
    assertCanEditListing(viewer, listing);

    const out = [];
    for (const doc of await scenesOf(ctx, args.listingId)) {
      const panoUrl = await urlOf(ctx, doc.pano);
      const panoMobileUrl = await urlOf(ctx, doc.panoMobile);
      const thumbUrl = await urlOf(ctx, doc.thumb);
      out.push({
        _id: doc._id,
        order: doc.order,
        title: doc.title,
        pano: doc.pano,
        ...(panoUrl !== null ? { panoUrl } : {}),
        ...(doc.panoMobile !== undefined ? { panoMobile: doc.panoMobile } : {}),
        ...(panoMobileUrl !== null ? { panoMobileUrl } : {}),
        ...(doc.thumb !== undefined ? { thumb: doc.thumb } : {}),
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

/**
 * Creates a scene (no `sceneId`) or updates one. `panoMobile` / `thumb` /
 * `initialView`: omitted keeps the stored value, `null` removes it.
 */
export const upsertScene = mutation({
  args: {
    listingId: v.id("listings"),
    sceneId: v.optional(v.id("tourScenes")),
    title: l10nV,
    pano: imageV,
    panoMobile: v.optional(v.union(imageV, v.null())),
    thumb: v.optional(v.union(imageV, v.null())),
    initialView: v.optional(v.union(viewV, v.null())),
    planXY: v.optional(v.array(v.number())),
    credit: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("tourScenes") }),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    assertTitle(args.title);
    assertView(args.initialView ?? undefined);
    if (args.credit !== undefined && args.credit.length > 300) {
      invalidInput("Napomena o izvoru može imati najviše 300 znakova.");
    }

    const existing =
      args.sceneId !== undefined ? await ctx.db.get("tourScenes", args.sceneId) : null;
    if (args.sceneId !== undefined && (existing === null || existing.listingId !== listing._id)) {
      notFound("Scena");
    }

    await assertPano(ctx, existing?.pano, args.pano);
    if (args.panoMobile) await assertPano(ctx, existing?.panoMobile, args.panoMobile);
    if (args.thumb) await assertPano(ctx, existing?.thumb, args.thumb, "image");
    // One blob per slot: releasing a replaced slot must never delete a file another slot still shows.
    const stored = [args.pano, args.panoMobile, args.thumb].flatMap((image) =>
      image?.kind === "storage" ? [image.storageId] : [],
    );
    if (new Set(stored).size !== stored.length) invalidInput("Ista slika ne može biti u dva polja scene.");
    if (
      args.planXY !== undefined &&
      !(args.planXY.length === 2 && args.planXY.every((value) => Number.isFinite(value) && value >= 0 && value <= 1))
    ) {
      invalidInput("Položaj na tlocrtu mora biti par brojeva između 0 i 1.");
    }

    if (existing !== null) {
      const panoMobile = args.panoMobile === undefined ? existing.panoMobile : (args.panoMobile ?? undefined);
      const thumb = args.thumb === undefined ? existing.thumb : (args.thumb ?? undefined);
      const initialView =
        args.initialView === undefined ? existing.initialView : (args.initialView ?? undefined);
      await ctx.db.patch("tourScenes", existing._id, {
        title: args.title,
        pano: args.pano,
        panoMobile,
        thumb,
        initialView,
        ...(args.planXY !== undefined ? { planXY: args.planXY } : {}),
        ...(args.credit !== undefined ? { credit: args.credit.trim() || undefined } : {}),
      });
      await releaseReplacedImage(ctx, existing.pano, args.pano);
      await releaseReplacedImage(ctx, existing.panoMobile, panoMobile);
      await releaseReplacedImage(ctx, existing.thumb, thumb);
      await logActivity(ctx, {
        entity: "tour",
        entityId: listing._id,
        action: "tour.scene.updated",
        summary: `${listing.ref}: ${args.title.sr}`,
        by: viewer._id,
      });
      return { id: existing._id };
    }

    const siblings = await scenesOf(ctx, listing._id);
    if (siblings.length >= TOUR_LIMITS.scenes) {
      invalidInput(`Tura može imati najviše ${TOUR_LIMITS.scenes} scena.`);
    }
    const id = await ctx.db.insert("tourScenes", {
      listingId: listing._id,
      order: siblings.length,
      title: args.title,
      pano: args.pano,
      ...(args.panoMobile ? { panoMobile: args.panoMobile } : {}),
      ...(args.thumb ? { thumb: args.thumb } : {}),
      ...(args.initialView ? { initialView: args.initialView } : {}),
      links: [],
      ...(args.planXY !== undefined ? { planXY: args.planXY } : {}),
      ...(args.credit !== undefined && args.credit.trim() !== "" ? { credit: args.credit.trim() } : {}),
    });

    await refreshDerived(ctx, listing._id);
    await logActivity(ctx, {
      entity: "tour",
      entityId: listing._id,
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
    if (args.ids.length > TOUR_LIMITS.scenes) invalidInput(`Tura može imati najviše ${TOUR_LIMITS.scenes} scena.`);
    const current = await scenesOf(ctx, listing._id);
    const known = new Set(current.map((scene) => scene._id));
    // The given order first, then any scene the client did not know about.
    const given = [...new Set(args.ids)].filter((id) => known.has(id));
    const givenSet = new Set(given);
    const ordered = [...given, ...current.map((scene) => scene._id).filter((id) => !givenSet.has(id))];
    for (const [order, id] of ordered.entries()) {
      await ctx.db.patch("tourScenes", id, { order });
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
    links: v.array(linkV),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    const scene = await ctx.db.get("tourScenes", args.sceneId);
    if (scene === null || scene.listingId !== listing._id) notFound("Scena");
    if (args.links.length > TOUR_LIMITS.linksPerScene) {
      invalidInput(`Scena može imati najviše ${TOUR_LIMITS.linksPerScene} veza.`);
    }

    // Links may only point at other scenes of the same listing, once each.
    const valid = [];
    const seen = new Set<Id<"tourScenes">>();
    for (const link of args.links) {
      if (link.toSceneId === args.sceneId || seen.has(link.toSceneId)) continue;
      if (link.yaw !== undefined || link.pitch !== undefined) {
        assertView({ yaw: link.yaw ?? 0, pitch: link.pitch ?? 0 });
      }
      const target = await ctx.db.get("tourScenes", link.toSceneId);
      if (target === null || target.listingId !== listing._id) continue;
      seen.add(link.toSceneId);
      valid.push(link);
    }
    await ctx.db.patch("tourScenes", args.sceneId, { links: valid });
    await logActivity(ctx, {
      entity: "tour",
      entityId: listing._id,
      action: "tour.scene.links",
      summary: `${listing.ref}: ${scene.title.sr}, ${valid.length} veza`,
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

    for (const image of [scene.pano, scene.panoMobile, scene.thumb]) {
      if (image?.kind === "storage") await deleteBlobIfPresent(ctx, image.storageId);
    }
    await ctx.db.delete("tourScenes", args.sceneId);

    // Drop dangling links from the remaining scenes and close the order gap.
    const rest = await scenesOf(ctx, listing._id);
    for (const [order, other] of rest.entries()) {
      await ctx.db.patch("tourScenes", other._id, {
        order,
        links: other.links.filter((link) => link.toSceneId !== args.sceneId),
      });
    }

    await refreshDerived(ctx, listing._id);
    await logActivity(ctx, {
      entity: "tour",
      entityId: listing._id,
      action: "tour.scene.removed",
      summary: `${listing.ref}: ${scene.title.sr}`,
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
    const tour360 = normalizeTour360(args.tour360);
    await ctx.db.patch("listings", listing._id, {
      tour360,
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
    const walk3d =
      args.walk3d !== undefined ? await prepareWalk3d(ctx, listing.walk3d, args.walk3d) : undefined;
    await ctx.db.patch("listings", listing._id, { walk3d, updatedAt: Date.now() });
    await releaseWalk3dBlobs(ctx, listing.walk3d, walk3d);
    await refreshDerived(ctx, listing._id);
    await logActivity(ctx, {
      entity: "tour",
      entityId: listing._id,
      action: "tour.walk3d.set",
      summary: `${listing.ref}: ${walk3d?.published === true ? "objavljeno" : "skriveno"}`,
      by: viewer._id,
    });
    return null;
  },
});
