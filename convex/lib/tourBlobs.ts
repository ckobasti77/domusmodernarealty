import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { deleteBlobIfPresent } from "./storage";
import type { Walk3d } from "./validators";

/**
 * Storage blobs owned by a listing's tours. Kept free of `media.ts` imports so
 * the listing cascade and the demo purge can use it without an import cycle.
 */

/** The uploaded files of a walkthrough (models and poster). */
export function walk3dBlobIds(walk: Walk3d | undefined): Id<"_storage">[] {
  if (walk === undefined) return [];
  const ids: Id<"_storage">[] = [];
  for (const asset of [walk.desktop, walk.mobile, walk.collision]) {
    if (asset?.source.kind === "storage") ids.push(asset.source.storageId);
  }
  if (walk.poster?.kind === "storage") ids.push(walk.poster.storageId);
  return ids;
}

/** The uploaded panoramas of a scene. */
export function sceneBlobIds(scene: Doc<"tourScenes">): Id<"_storage">[] {
  const ids: Id<"_storage">[] = [];
  for (const image of [scene.pano, scene.panoMobile, scene.thumb]) {
    if (image?.kind === "storage") ids.push(image.storageId);
  }
  return ids;
}

/**
 * Deletes a listing's scenes together with their uploaded panoramas, and the
 * walkthrough's uploaded files. Used when the listing itself goes away, so the
 * interior photos and scans are not left downloadable at their storage URLs.
 */
export async function deleteListingTours(ctx: MutationCtx, listing: Doc<"listings">): Promise<void> {
  const scenes = await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listing._id))
    .take(60);
  for (const scene of scenes) {
    for (const id of sceneBlobIds(scene)) await deleteBlobIfPresent(ctx, id);
    await ctx.db.delete("tourScenes", scene._id);
  }
  for (const id of walk3dBlobIds(listing.walk3d)) await deleteBlobIfPresent(ctx, id);
}
