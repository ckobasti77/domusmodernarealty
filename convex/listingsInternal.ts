import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { mediaItemV } from "./lib/validators";
import type { MediaItem } from "./lib/validators";
import { logActivity } from "./lib/activity";
import { applyCountDelta } from "./lib/counts";
import { applyDerived, locationNamesFor } from "./lib/derive";

/**
 * Daily cron: a published listing whose brokerage contract has expired must come
 * off the market — advertising without a valid mandate breaches the brokerage law
 * (Art. 18). Each unpublish is logged.
 */
export const expireMandates = internalMutation({
  args: {},
  returns: v.object({ withdrawn: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    // `undefined` sorts BELOW every number in a Convex index, so a bare
    // `lt("mandateEnd", now)` would fill the batch with listings that have no
    // mandate at all and never reach the genuinely expired ones. The `gte(0)`
    // lower bound excludes them from the range instead of filtering afterwards.
    const expired = await ctx.db
      .query("listings")
      .withIndex("by_status_and_mandateEnd", (q) =>
        q.eq("status", "published").gte("mandateEnd", 0).lt("mandateEnd", now),
      )
      .take(100);

    let withdrawn = 0;
    for (const listing of expired) {
      if (listing.mandateEnd === undefined) continue;

      const next = {
        ...listing,
        status: "withdrawn" as const,
        visibility: "private" as const,
      };
      const names = await locationNamesFor(ctx, next);
      const derived = applyDerived(next, names, listing.hasTour);
      await ctx.db.patch("listings", listing._id, {
        status: "withdrawn",
        visibility: "private",
        updatedAt: now,
        ...derived,
      });
      const after = await ctx.db.get("listings", listing._id);
      await applyCountDelta(ctx, listing, after);

      await logActivity(ctx, {
        entity: "listing",
        entityId: listing._id,
        action: "listing.mandateExpired",
        summary: `${listing.ref}: ugovor o posredovanju istekao ${new Date(listing.mandateEnd).toISOString().slice(0, 10)}`,
      });
      withdrawn += 1;
    }

    return { withdrawn };
  },
});

/** Rebuilds every `locationCounts` row from scratch (repair / after a seed). */
export const rebuildLocationCounts = internalMutation({
  args: {},
  returns: v.object({ locations: v.number(), listings: v.number() }),
  handler: async (ctx) => {
    const existing = await ctx.db.query("locationCounts").take(2000);
    for (const row of existing) await ctx.db.delete("locationCounts", row._id);

    const listings = await ctx.db.query("listings").take(2000);
    let counted = 0;
    for (const listing of listings) {
      await applyCountDelta(ctx, null, listing);
      if (listing.scope.startsWith("listed:")) counted += 1;
    }

    const rows = await ctx.db.query("locationCounts").take(2000);
    return { locations: rows.length, listings: counted };
  },
});

/**
 * Scheduled by `listingsAdmin.rotatePreviewToken` for the moment the link
 * expires. Only clears the token it was scheduled for: a newer link survives.
 */
export const expirePreviewToken = internalMutation({
  args: { id: v.id("listings"), token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.id);
    if (listing === null || listing.previewToken !== args.token) return null;
    await ctx.db.patch("listings", listing._id, {
      previewToken: undefined,
      previewExpiresAt: undefined,
    });
    return null;
  },
});

/**
 * `listingsAdmin.duplicate` never lets two listings share a storage blob, so
 * the copy's uploaded photos are re-stored here as new blobs and then merged
 * back in their original order.
 */
export const copyStoredMedia = internalAction({
  args: {
    listingId: v.id("listings"),
    media: v.array(mediaItemV),
    floorPlans: v.array(mediaItemV),
  },
  returns: v.object({ copied: v.number() }),
  handler: async (ctx, args) => {
    const copy = async (items: MediaItem[]): Promise<MediaItem[]> => {
      const out: MediaItem[] = [];
      for (const item of items) {
        if (item.image.kind !== "storage") continue;
        const blob = await ctx.storage.get(item.image.storageId);
        if (blob === null) continue;
        const storageId: Id<"_storage"> = await ctx.storage.store(blob);
        out.push({ ...item, image: { kind: "storage", storageId } });
      }
      return out;
    };
    const media = await copy(args.media);
    const floorPlans = await copy(args.floorPlans);
    await ctx.runMutation(internal.listingsInternal.mergeCopiedMedia, {
      listingId: args.listingId,
      media,
      floorPlans,
    });
    return { copied: media.length + floorPlans.length };
  },
});

export const mergeCopiedMedia = internalMutation({
  args: {
    listingId: v.id("listings"),
    media: v.array(mediaItemV),
    floorPlans: v.array(mediaItemV),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null) {
      // The copy was deleted while the blobs were being copied.
      for (const item of [...args.media, ...args.floorPlans]) {
        if (item.image.kind === "storage") await ctx.storage.delete(item.image.storageId);
      }
      return null;
    }
    const merge = (current: MediaItem[], copied: MediaItem[]): MediaItem[] => {
      const all = [...current, ...copied].sort((a, b) => a.order - b.order);
      const hasCover = all.some((item) => item.isCover === true);
      return all.map((item, index) => ({
        ...item,
        order: index,
        ...(hasCover ? {} : { isCover: index === 0 }),
      }));
    };
    await ctx.db.patch("listings", listing._id, {
      media: merge(listing.media, args.media),
      floorPlans: merge(listing.floorPlans, args.floorPlans).map((item) => {
        const { isCover: _floorPlanCover, ...rest } = item;
        return rest;
      }),
      updatedAt: Date.now(),
    });
    return null;
  },
});
