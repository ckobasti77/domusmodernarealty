import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { applyCountDelta } from "./counts";
import { deleteBlobIfPresent } from "./storage";
import { deleteListingTours } from "./tourBlobs";

/**
 * Deletes a listing and everything that hangs off it. Leads and viewings are
 * business records: they are kept, only their pointer to the listing is dropped.
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

  const splats = await ctx.db
    .query("splatAssets")
    .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
    .take(20);
  for (const splat of splats) await ctx.db.delete("splatAssets", splat._id);

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

  // Leads and viewings are business records: keep them, but drop the pointer so
  // the admin UI stops rendering a reference to a document that is gone.
  const viewings = await ctx.db
    .query("viewings")
    .withIndex("by_listingId_and_start", (q) => q.eq("listingId", doc._id))
    .take(100);
  for (const viewing of viewings) {
    await ctx.db.patch("viewings", viewing._id, { status: "cancelled" });
  }
  const leads = await ctx.db
    .query("leads")
    .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
    .take(200);
  for (const lead of leads) {
    await ctx.db.patch("leads", lead._id, { listingId: undefined });
  }

  await ctx.db.delete("listings", doc._id);
}
