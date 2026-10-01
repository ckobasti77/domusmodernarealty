import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { applyCountDelta } from "./lib/counts";
import { invalidInput } from "./lib/errors";
import { deleteBlobIfPresent } from "./lib/storage";

const ADMINS = ["admin"] as const;

/**
 * Tables that carry `isDemo` and can be purged in one click (PRD B14).
 *
 * Order matters: listings first, so their child rows (media, scenes, stats,
 * counters) are gone before the locations and agents they referenced.
 */
export const DEMO_TABLES = [
  "listings",
  "viewings",
  "leads",
  "contacts",
  "posts",
  "testimonials",
  "pages",
  "agents",
  "locations",
] as const;
export type DemoTable = (typeof DEMO_TABLES)[number];

async function countDemo(ctx: QueryCtx, table: DemoTable): Promise<number> {
  // Written out per table: a union table name loses Convex's per-table typing.
  switch (table) {
    case "listings":
      return (
        await ctx.db
          .query("listings")
          .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
          .take(1000)
      ).length;
    case "viewings":
      return (
        await ctx.db
          .query("viewings")
          .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
          .take(1000)
      ).length;
    case "leads":
      return (
        await ctx.db
          .query("leads")
          .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
          .take(1000)
      ).length;
    case "contacts":
      return (
        await ctx.db
          .query("contacts")
          .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
          .take(1000)
      ).length;
    case "posts":
      return (
        await ctx.db
          .query("posts")
          .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
          .take(1000)
      ).length;
    case "testimonials":
      return (
        await ctx.db
          .query("testimonials")
          .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
          .take(1000)
      ).length;
    case "agents":
      return (await ctx.db.query("agents").take(1000)).filter(
        (doc) => doc.isDemo,
      ).length;
    case "locations":
      return (await ctx.db.query("locations").take(1000)).filter(
        (doc) => doc.isDemo,
      ).length;
    case "pages":
      return (await ctx.db.query("pages").take(200)).filter((doc) => doc.isDemo)
        .length;
  }
}

export const counts = query({
  args: {},
  returns: v.object({
    rows: v.array(v.object({ table: v.string(), count: v.number() })),
    total: v.number(),
    settingsIsDemo: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);

    const rows: { table: string; count: number }[] = [];
    let total = 0;
    for (const table of DEMO_TABLES) {
      const count = await countDemo(ctx, table);
      rows.push({ table, count });
      total += count;
    }

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    return { rows, total, settingsIsDemo: settings?.isDemo ?? false };
  },
});

/**
 * Deletes demo data in batches. One table per call, rescheduled until the table
 * is empty, so a purge never blows the transaction limits.
 */
export const purge = mutation({
  args: { confirm: v.string() },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    if (args.confirm !== "OBRIŠI DEMO") {
      invalidInput("Za potvrdu upišite tačno: OBRIŠI DEMO");
    }
    await logActivity(ctx, {
      entity: "demo",
      action: "demo.purge.started",
      by: viewer._id,
    });
    await ctx.scheduler.runAfter(0, internal.demoInternal.purgeBatch, {
      tableIndex: 0,
      by: viewer._id,
    });
    return { scheduled: true };
  },
});

/**
 * True when any listing still points at this location through any of its three
 * foreign keys, in either transaction and either public bucket.
 */
export async function locationIsReferenced(
  ctx: MutationCtx | QueryCtx,
  locationId: Id<"locations">,
): Promise<boolean> {
  for (const bucket of ["listed", "closed", "hidden"] as const) {
    for (const transaction of ["sale", "rent"] as const) {
      const scope = `${bucket}:${transaction}`;
      const byCity = await ctx.db
        .query("listings")
        .withIndex("by_scope_and_cityId_and_price", (q) =>
          q.eq("scope", scope).eq("cityId", locationId),
        )
        .take(1);
      if (byCity.length > 0) return true;
      const byMunicipality = await ctx.db
        .query("listings")
        .withIndex("by_scope_and_municipalityId_and_price", (q) =>
          q.eq("scope", scope).eq("municipalityId", locationId),
        )
        .take(1);
      if (byMunicipality.length > 0) return true;
      const byNeighborhood = await ctx.db
        .query("listings")
        .withIndex("by_scope_and_neighborhoodId_and_publishedAt", (q) =>
          q.eq("scope", scope).eq("neighborhoodId", locationId),
        )
        .take(1);
      if (byNeighborhood.length > 0) return true;
    }
  }
  return false;
}

/** Removes a demo listing and everything that hangs off it. */
async function deleteDemoListings(ctx: MutationCtx, limit: number): Promise<number> {
  const docs = await ctx.db
    .query("listings")
    .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
    .take(limit);

  for (const doc of docs) {
    await applyCountDelta(ctx, doc, null);
    for (const item of [...doc.media, ...doc.floorPlans]) {
      if (item.image.kind === "storage") {
        await deleteBlobIfPresent(ctx, item.image.storageId);
      }
    }
    const scenes = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", doc._id))
      .take(60);
    for (const scene of scenes) await ctx.db.delete("tourScenes", scene._id);

    const splats = await ctx.db
      .query("splatAssets")
      .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
      .take(20);
    for (const splat of splats) await ctx.db.delete("splatAssets", splat._id);

    const stats = await ctx.db
      .query("listingStats")
      .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
      .unique();
    if (stats !== null) await ctx.db.delete("listingStats", stats._id);

    const redirects = await ctx.db
      .query("slugRedirects")
      .withIndex("by_from", (q) => q.eq("from", doc.slug))
      .take(10);
    for (const row of redirects) await ctx.db.delete("slugRedirects", row._id);

    const changes = await ctx.db
      .query("priceChanges")
      .withIndex("by_listingId_and_at", (q) => q.eq("listingId", doc._id))
      .take(40);
    for (const change of changes) await ctx.db.delete("priceChanges", change._id);

    await ctx.db.delete("listings", doc._id);
  }
  return docs.length;
}

/** Deletes up to `limit` demo rows from one table. Returns how many went. */
export async function purgeDemoTable(
  ctx: MutationCtx,
  table: DemoTable,
  limit: number,
): Promise<number> {
  switch (table) {
    case "listings":
      return await deleteDemoListings(ctx, limit);

    case "viewings": {
      const docs = await ctx.db
        .query("viewings")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(limit);
      for (const doc of docs) await ctx.db.delete("viewings", doc._id);
      return docs.length;
    }

    case "leads": {
      const docs = await ctx.db
        .query("leads")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(limit);
      for (const doc of docs) {
        const notes = await ctx.db
          .query("leadNotes")
          .withIndex("by_leadId_and_at", (q) => q.eq("leadId", doc._id))
          .take(50);
        for (const note of notes) await ctx.db.delete("leadNotes", note._id);
        await ctx.db.delete("leads", doc._id);
      }
      return docs.length;
    }

    case "contacts": {
      const docs = await ctx.db
        .query("contacts")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(limit);
      for (const doc of docs) await ctx.db.delete("contacts", doc._id);
      return docs.length;
    }

    case "posts": {
      const docs = await ctx.db
        .query("posts")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(limit);
      for (const doc of docs) {
        if (doc.cover?.kind === "storage") {
          await deleteBlobIfPresent(ctx, doc.cover.storageId);
        }
        await ctx.db.delete("posts", doc._id);
      }
      return docs.length;
    }

    case "testimonials": {
      const docs = await ctx.db
        .query("testimonials")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(limit);
      for (const doc of docs) await ctx.db.delete("testimonials", doc._id);
      return docs.length;
    }

    case "pages": {
      const docs = (await ctx.db.query("pages").take(200))
        .filter((doc) => doc.isDemo)
        .slice(0, limit);
      for (const doc of docs) await ctx.db.delete("pages", doc._id);
      return docs.length;
    }

    case "agents": {
      const all = (await ctx.db.query("agents").take(200)).filter(
        (doc) => doc.isDemo,
      );
      // Keep any demo agent a listing still points at: deleting it would make
      // `toDetail` return null and 404 that listing publicly.
      const docs = [];
      for (const doc of all) {
        const used = await ctx.db
          .query("listings")
          .withIndex("by_agentId", (q) => q.eq("agentId", doc._id))
          .take(1);
        if (used.length > 0) continue;
        if (doc.userId !== undefined) continue;
        const invites = await ctx.db
          .query("invites")
          .withIndex("by_agentId", (q) => q.eq("agentId", doc._id))
          .take(20);
        if (invites.some((invite) => invite.acceptedAt === undefined && invite.revokedAt === undefined)) continue;
        const realLead = await ctx.db
          .query("leads")
          .withIndex("by_agentId", (q) => q.eq("agentId", doc._id))
          .take(50);
        if (realLead.some((lead) => !lead.isDemo)) continue;
        const realViewing = await ctx.db
          .query("viewings")
          .withIndex("by_agentId_and_start", (q) => q.eq("agentId", doc._id))
          .take(50);
        if (realViewing.some((viewing) => !viewing.isDemo)) continue;
        docs.push(doc);
        if (docs.length >= limit) break;
      }
      for (const doc of docs) {
        if (doc.photo?.kind === "storage") {
          await deleteBlobIfPresent(ctx, doc.photo.storageId);
        }
        if (doc.userId !== undefined) {
          await ctx.db.patch("users", doc.userId, { agentId: undefined });
        }
        await ctx.db.delete("agents", doc._id);
      }
      return docs.length;
    }

    case "locations": {
      const all = (await ctx.db.query("locations").take(600)).filter(
        (doc) => doc.isDemo,
      );
      // Same rule, plus: never orphan a child location.
      const docs = [];
      for (const doc of all) {
        const counts = await ctx.db
          .query("locationCounts")
          .withIndex("by_locationId", (q) => q.eq("locationId", doc._id))
          .unique();
        if (counts !== null && counts.sale + counts.rent > 0) continue;
        const children = await ctx.db
          .query("locations")
          .withIndex("by_parentId_and_order", (q) => q.eq("parentId", doc._id))
          .take(1);
        if (children.length > 0) continue;
        if (await locationIsReferenced(ctx, doc._id)) continue;
        docs.push(doc);
        if (docs.length >= limit) break;
      }
      for (const doc of docs) {
        const counts = await ctx.db
          .query("locationCounts")
          .withIndex("by_locationId", (q) => q.eq("locationId", doc._id))
          .unique();
        if (counts !== null) await ctx.db.delete("locationCounts", counts._id);
        if (doc.cover?.kind === "storage") {
          await deleteBlobIfPresent(ctx, doc.cover.storageId);
        }
        await ctx.db.delete("locations", doc._id);
      }
      return docs.length;
    }
  }
}
