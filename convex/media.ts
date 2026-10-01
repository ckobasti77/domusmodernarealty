import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { assertCanEditListing, requireRole } from "./lib/auth";
import { applyDerived, locationNamesFor } from "./lib/derive";
import { invalidInput, notFound } from "./lib/errors";
import { imageV, l10nV, mediaItemV, roomTagV } from "./lib/validators";
import type { MediaItem } from "./lib/validators";
import { assertFresh, deleteBlobIfPresent } from "./lib/storage";

const EDITORS = ["admin", "manager", "agent"] as const;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PANO_BYTES = 40 * 1024 * 1024;
const MAX_SPLAT_BYTES = 200 * 1024 * 1024;
const MAX_MEDIA_PER_LISTING = 60;
const ACTIVE_CONTENT = /^text\/|html|xml|javascript|ecmascript/i;

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireRole(ctx, EDITORS);
    return await ctx.storage.generateUploadUrl();
  },
});

type UploadKind = "image" | "panorama" | "splat";

/** Validates the uploaded blob against its declared purpose before we link it. */
async function assertUploadOk(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  kind: UploadKind,
): Promise<{ size: number; contentType?: string }> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (meta === null) notFound("Fajl");

  const limit =
    kind === "image"
      ? MAX_IMAGE_BYTES
      : kind === "panorama"
        ? MAX_PANO_BYTES
        : MAX_SPLAT_BYTES;
  if (meta.size > limit) {
    invalidInput(
      `Fajl je prevelik (${Math.round(meta.size / 1_048_576)} MB, dozvoljeno ${Math.round(limit / 1_048_576)} MB).`,
    );
  }
  if (
    (kind === "image" || kind === "panorama") &&
    (meta.contentType === undefined || !(IMAGE_TYPES as readonly string[]).includes(meta.contentType))
  ) {
    invalidInput("Dozvoljeni formati su JPEG, PNG, WebP i AVIF.");
  }
  // A model is served from our storage domain: never anything a browser would run or render as a page.
  if (kind === "splat" && meta.contentType !== undefined && ACTIVE_CONTENT.test(meta.contentType)) {
    invalidInput("Ovaj tip fajla nije dozvoljen za 3D model.");
  }
  return {
    size: meta.size,
    ...(meta.contentType !== undefined ? { contentType: meta.contentType } : {}),
  };
}

async function loadEditable(ctx: MutationCtx, listingId: Id<"listings">) {
  const viewer = await requireRole(ctx, EDITORS);
  const listing = await ctx.db.get("listings", listingId);
  if (listing === null) notFound("Nekretnina");
  assertCanEditListing(viewer, listing);
  return { viewer, listing };
}

function nextId(existing: readonly MediaItem[]): string {
  return `m-${Date.now().toString(36)}-${existing.length}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const attach = mutation({
  args: {
    listingId: v.id("listings"),
    target: v.union(v.literal("gallery"), v.literal("floorPlans")),
    items: v.array(
      v.object({
        image: imageV,
        alt: l10nV,
        w: v.optional(v.number()),
        h: v.optional(v.number()),
        blurDataURL: v.optional(v.string()),
        room: v.optional(roomTagV),
        author: v.optional(v.string()),
        sourcePage: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({ count: v.number() }),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    const current = args.target === "gallery" ? listing.media : listing.floorPlans;
    if (current.length + args.items.length > MAX_MEDIA_PER_LISTING) {
      invalidInput(`Najviše ${MAX_MEDIA_PER_LISTING} fajlova po nekretnini.`);
    }

    const added: MediaItem[] = [];
    let order = current.length;
    for (const item of args.items) {
      if (item.image.kind === "storage") {
        await assertUploadOk(ctx, item.image.storageId, "image");
        // A gallery item is always a new link: refuse an old (someone else's) blob.
        const meta = await ctx.db.system.get("_storage", item.image.storageId);
        if (meta !== null) assertFresh(meta._creationTime);
      }
      added.push({
        id: nextId([...current, ...added]),
        image: item.image,
        alt: item.alt,
        ...(item.w !== undefined ? { w: item.w } : {}),
        ...(item.h !== undefined ? { h: item.h } : {}),
        ...(item.blurDataURL !== undefined ? { blurDataURL: item.blurDataURL } : {}),
        ...(item.room !== undefined ? { room: item.room } : {}),
        ...(item.author !== undefined ? { author: item.author } : {}),
        ...(item.sourcePage !== undefined ? { sourcePage: item.sourcePage } : {}),
        order,
        ...(args.target === "gallery" && current.length === 0 && order === 0
          ? { isCover: true }
          : {}),
      });
      order += 1;
    }

    const next = [...current, ...added];
    await ctx.db.patch("listings", listing._id, {
      ...(args.target === "gallery" ? { media: next } : { floorPlans: next }),
      updatedAt: Date.now(),
    });

    await logActivity(ctx, {
      entity: "media",
      entityId: listing._id,
      action: "media.attached",
      summary: `${listing.ref}: +${added.length} (${args.target})`,
      by: viewer._id,
    });

    return { count: added.length };
  },
});

export const reorder = mutation({
  args: {
    listingId: v.id("listings"),
    target: v.union(v.literal("gallery"), v.literal("floorPlans")),
    ids: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    const current = args.target === "gallery" ? listing.media : listing.floorPlans;
    const byId = new Map(current.map((item) => [item.id, item]));

    const next: MediaItem[] = [];
    let order = 0;
    for (const id of args.ids) {
      const item = byId.get(id);
      if (item === undefined) continue;
      next.push({ ...item, order });
      byId.delete(id);
      order += 1;
    }
    for (const item of byId.values()) {
      next.push({ ...item, order });
      order += 1;
    }

    await ctx.db.patch("listings", listing._id, {
      ...(args.target === "gallery" ? { media: next } : { floorPlans: next }),
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      entity: "media",
      entityId: listing._id,
      action: "media.reordered",
      summary: `${listing.ref} (${args.target})`,
      by: viewer._id,
    });
    return null;
  },
});

export const updateMeta = mutation({
  args: {
    listingId: v.id("listings"),
    target: v.union(v.literal("gallery"), v.literal("floorPlans")),
    itemId: v.string(),
    alt: v.optional(l10nV),
    room: v.optional(roomTagV),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    const current = args.target === "gallery" ? listing.media : listing.floorPlans;
    if (!current.some((item) => item.id === args.itemId)) notFound("Fotografija");

    const next = current.map((item) =>
      item.id === args.itemId
        ? {
            ...item,
            ...(args.alt !== undefined ? { alt: args.alt } : {}),
            ...(args.room !== undefined ? { room: args.room } : {}),
          }
        : item,
    );
    await ctx.db.patch("listings", listing._id, {
      ...(args.target === "gallery" ? { media: next } : { floorPlans: next }),
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      entity: "media",
      entityId: listing._id,
      action: "media.meta",
      summary: `${listing.ref}: ${args.itemId}`,
      by: viewer._id,
    });
    return null;
  },
});

export const setCover = mutation({
  args: { listingId: v.id("listings"), itemId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    if (!listing.media.some((item) => item.id === args.itemId)) {
      notFound("Fotografija");
    }
    const media = listing.media.map((item) => ({
      ...item,
      isCover: item.id === args.itemId,
    }));
    await ctx.db.patch("listings", listing._id, { media, updatedAt: Date.now() });
    await logActivity(ctx, {
      entity: "media",
      entityId: listing._id,
      action: "media.cover",
      summary: `${listing.ref}: ${args.itemId}`,
      by: viewer._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    listingId: v.id("listings"),
    target: v.union(v.literal("gallery"), v.literal("floorPlans")),
    itemId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    const current = args.target === "gallery" ? listing.media : listing.floorPlans;
    const victim = current.find((item) => item.id === args.itemId);
    if (victim === undefined) notFound("Fotografija");

    const remaining = current
      .filter((item) => item.id !== args.itemId)
      .map((item, index) => ({ ...item, order: index }));

    // Keep a cover set whenever a gallery still has photos.
    if (
      args.target === "gallery" &&
      remaining.length > 0 &&
      !remaining.some((item) => item.isCover === true)
    ) {
      remaining[0] = { ...remaining[0], isCover: true };
    }

    await ctx.db.patch("listings", listing._id, {
      ...(args.target === "gallery" ? { media: remaining } : { floorPlans: remaining }),
      updatedAt: Date.now(),
    });

    if (victim.image.kind === "storage") {
      await deleteBlobIfPresent(ctx, victim.image.storageId);
    }

    await logActivity(ctx, {
      entity: "media",
      entityId: listing._id,
      action: "media.removed",
      summary: `${listing.ref}: ${args.itemId}`,
      by: viewer._id,
    });
    return null;
  },
});

/** Sets the video URL and recomputes `hasTour`-adjacent derived state. */
export const setVideoUrl = mutation({
  args: { listingId: v.id("listings"), videoUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer, listing } = await loadEditable(ctx, args.listingId);
    if (args.videoUrl !== undefined && !/^https:\/\//.test(args.videoUrl)) {
      invalidInput("Video adresa mora počinjati sa https://");
    }
    const names = await locationNamesFor(ctx, listing);
    const next: Doc<"listings"> = { ...listing, videoUrl: args.videoUrl };
    const derived = applyDerived(next, names, listing.hasTour);
    await ctx.db.patch("listings", listing._id, {
      videoUrl: args.videoUrl,
      updatedAt: Date.now(),
      ...derived,
    });
    await logActivity(ctx, {
      entity: "media",
      entityId: listing._id,
      action: "media.video",
      summary: listing.ref,
      by: viewer._id,
    });
    return null;
  },
});

export { mediaItemV, MAX_SPLAT_BYTES, assertUploadOk };
