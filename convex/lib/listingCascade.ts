import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { applyCountDelta } from "./counts";
import { deleteBlobIfPresent } from "./storage";
import { deleteListingTours, sceneBlobIds, walk3dBlobIds } from "./tourBlobs";

/** Rows `demoListingKeepReason` reads per relation; a longer list counts as in use. */
const KEEP_SCAN = 100;

/**
 * Why "Obriši demo" must keep this demo listing, or `null` when it may go.
 * Staff have made a seeded listing their own once it holds an upload (photos,
 * floor plans, the share image, 360° panoramas, 3D files) or a real lead or
 * viewing points at it: purging would destroy that work for good. The purge
 * keeps demo agents and places that real records still use for the same reason.
 */
export async function demoListingKeepReason(
  ctx: QueryCtx,
  doc: Doc<"listings">,
): Promise<string | null> {
  const uploads = "Sadrži otpremljene fajlove (fotografije, ture ili 3D)";
  if (
    [...doc.media, ...doc.floorPlans].some((item) => item.image.kind === "storage") ||
    doc.seo?.ogImage?.kind === "storage" ||
    walk3dBlobIds(doc.walk3d).length > 0
  ) {
    return uploads;
  }
  const scenes = await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", doc._id))
    .take(KEEP_SCAN + 1);
  if (scenes.length > KEEP_SCAN || scenes.some((scene) => sceneBlobIds(scene).length > 0)) {
    return uploads;
  }

  const leads = await ctx.db
    .query("leads")
    .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
    .take(KEEP_SCAN + 1);
  if (leads.length > KEEP_SCAN || leads.some((lead) => !lead.isDemo)) return "Ima prave upite";
  const viewings = await ctx.db
    .query("viewings")
    .withIndex("by_listingId_and_start", (q) => q.eq("listingId", doc._id))
    .take(KEEP_SCAN + 1);
  if (viewings.length > KEEP_SCAN || viewings.some((viewing) => !viewing.isDemo)) {
    return "Ima prava razgledanja";
  }
  return null;
}

/**
 * Deletes a listing and everything that hangs off it. Leads and viewings are
 * business records: they are kept (a lead loses its pointer to the listing, an
 * open viewing is called off).
 */
export async function deleteListingCascade(ctx: MutationCtx, doc: Doc<"listings">): Promise<void> {
  await applyCountDelta(ctx, doc, null);

  for (const item of doc.media) {
    if (item.image.kind === "storage") await deleteBlobIfPresent(ctx, item.image.storageId);
  }
  for (const item of doc.floorPlans) {
    if (item.image.kind === "storage") await deleteBlobIfPresent(ctx, item.image.storageId);
  }

  await deleteListingTours(ctx, doc);

  const stats = await ctx.db
    .query("listingStats")
    .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
    .unique();
  if (stats !== null) await ctx.db.delete("listingStats", stats._id);

  const changes = await ctx.db
    .query("priceChanges")
    .withIndex("by_listingId_and_at", (q) => q.eq("listingId", doc._id))
    .take(60);
  for (const change of changes) await ctx.db.delete("priceChanges", change._id);

  const redirects = await ctx.db
    .query("slugRedirects")
    .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
    .take(100);
  for (const row of redirects) await ctx.db.delete("slugRedirects", row._id);

  const views = await ctx.db
    .query("listingViews")
    .withIndex("by_listingId_and_sessionKey", (q) => q.eq("listingId", doc._id))
    .take(500);
  for (const row of views) await ctx.db.delete("listingViews", row._id);

  // Leads and viewings are business records: they stay. A viewing keeps its
  // (required) listing id, so only an appointment still open is called off; a
  // held or missed one keeps its outcome. Newest first: the open ones are there.
  const viewings = await ctx.db
    .query("viewings")
    .withIndex("by_listingId_and_start", (q) => q.eq("listingId", doc._id))
    .order("desc")
    .take(100);
  for (const viewing of viewings) {
    if (viewing.status === "requested" || viewing.status === "confirmed") {
      await ctx.db.patch("viewings", viewing._id, { status: "cancelled" });
    }
  }
  // A lead drops its pointer, so the admin stops linking to a listing that is gone.
  const leads = await ctx.db
    .query("leads")
    .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
    .take(200);
  for (const lead of leads) {
    await ctx.db.patch("leads", lead._id, { listingId: undefined });
  }

  await ctx.db.delete("listings", doc._id);
}
