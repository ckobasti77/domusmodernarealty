import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { mediaItemV } from "./lib/validators";
import type { MediaItem } from "./lib/validators";
import { logActivity } from "./lib/activity";
import { applyCountDelta } from "./lib/counts";
import { applyDerived, locationNamesFor } from "./lib/derive";
import { deleteListingCascade } from "./lib/listingCascade";

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

/** Blobs copied per action run: small enough for the action's memory and time. */
const COPY_CHUNK = 5;
const MAX_MEDIA_PER_LISTING = 60;

/**
 * `listingsAdmin.duplicate` never lets two listings share a storage blob, so
 * the copy's uploaded photos are re-stored here as new blobs, a few per run,
 * each run merging what it copied and scheduling the next. One failing blob is
 * skipped (the copy simply lacks that photo) instead of losing the batch.
 */
export const copyStoredMedia = internalAction({
  args: {
    listingId: v.id("listings"),
    media: v.array(mediaItemV),
    floorPlans: v.array(mediaItemV),
  },
  returns: v.object({ copied: v.number() }),
  handler: async (ctx, args) => {
    const queue = [
      ...args.media.map((item) => ({ target: "media" as const, item })),
      ...args.floorPlans.map((item) => ({ target: "floorPlans" as const, item })),
    ];
    const chunk = queue.slice(0, COPY_CHUNK);
    const rest = queue.slice(COPY_CHUNK);

    const media: MediaItem[] = [];
    const floorPlans: MediaItem[] = [];
    for (const { target, item } of chunk) {
      if (item.image.kind !== "storage") continue;
      try {
        const blob = await ctx.storage.get(item.image.storageId);
        if (blob === null) continue;
        const storageId: Id<"_storage"> = await ctx.storage.store(blob);
        (target === "media" ? media : floorPlans).push({
          ...item,
          image: { kind: "storage", storageId },
        });
      } catch (error) {
        console.error(`[duplicate] could not copy media ${item.id}`, error);
      }
    }

    const keepGoing: boolean = await ctx.runMutation(internal.listingsInternal.mergeCopiedMedia, {
      listingId: args.listingId,
      media,
      floorPlans,
    });
    if (keepGoing && rest.length > 0) {
      await ctx.scheduler.runAfter(0, internal.listingsInternal.copyStoredMedia, {
        listingId: args.listingId,
        media: rest.filter((entry) => entry.target === "media").map((entry) => entry.item),
        floorPlans: rest.filter((entry) => entry.target === "floorPlans").map((entry) => entry.item),
      });
    }
    return { copied: media.length + floorPlans.length };
  },
});

/**
 * Merges copied blobs into the duplicate in their original order. Returns
 * false when the duplicate is gone (its blobs are then deleted, and the copy
 * stops). Items already present are skipped, a second cover is dropped, and
 * nothing past the 60-item limit is kept.
 */
export const mergeCopiedMedia = internalMutation({
  args: {
    listingId: v.id("listings"),
    media: v.array(mediaItemV),
    floorPlans: v.array(mediaItemV),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    const discard = async (items: MediaItem[]) => {
      for (const item of items) {
        if (item.image.kind === "storage") await ctx.storage.delete(item.image.storageId);
      }
    };
    if (listing === null) {
      await discard([...args.media, ...args.floorPlans]);
      return false;
    }

    const merge = async (current: MediaItem[], copied: MediaItem[], gallery: boolean) => {
      const present = new Set(current.map((item) => item.id));
      const fresh = copied.filter((item) => !present.has(item.id));
      await discard(copied.filter((item) => present.has(item.id)));

      const hasCover = current.some((item) => item.isCover === true);
      const incoming: MediaItem[] = fresh.map((item) => {
        const { isCover, ...rest } = item;
        return gallery && isCover === true && !hasCover ? { ...rest, isCover: true } : rest;
      });
      const all = [...current, ...incoming].sort((a, b) => a.order - b.order);
      const kept = all.slice(0, MAX_MEDIA_PER_LISTING);
      await discard(all.slice(MAX_MEDIA_PER_LISTING).filter((item) => !present.has(item.id)));

      const anyCover = kept.some((item) => item.isCover === true);
      return kept.map((item, index) => ({
        ...item,
        order: index,
        ...(gallery && !anyCover && index === 0 ? { isCover: true } : {}),
      }));
    };

    await ctx.db.patch("listings", listing._id, {
      media: await merge(listing.media, args.media, true),
      floorPlans: await merge(listing.floorPlans, args.floorPlans, false),
      updatedAt: Date.now(),
    });
    return true;
  },
});

/**
 * One demo listing, scheduled by `listingsAdmin.bulk({ action: "deleteDemo" })`
 * so every cascade runs in its own transaction. Re-checks `isDemo`.
 */
export const deleteDemoListing = internalMutation({
  args: { id: v.id("listings"), by: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("listings", args.id);
    if (doc === null || !doc.isDemo) return null;
    await deleteListingCascade(ctx, doc);
    await logActivity(ctx, {
      entity: "listing",
      entityId: args.id,
      action: "listing.deleted",
      summary: `${doc.ref} (demo, grupno)`,
      by: args.by,
    });
    return null;
  },
});
