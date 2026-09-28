import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { applyCountDelta } from "./lib/counts";
import { invalidInput } from "./lib/errors";

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
        await ctx.storage.delete(item.image.storageId);
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
          await ctx.storage.delete(doc.cover.storageId);
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
      const docs = (await ctx.db.query("agents").take(200))
        .filter((doc) => doc.isDemo)
        .slice(0, limit);
      for (const doc of docs) {
        if (doc.photo?.kind === "storage") {
          await ctx.storage.delete(doc.photo.storageId);
        }
        if (doc.userId !== undefined) {
          await ctx.db.patch("users", doc.userId, { agentId: undefined });
        }
        await ctx.db.delete("agents", doc._id);
      }
      return docs.length;
    }

    case "locations": {
      const docs = (await ctx.db.query("locations").take(600))
        .filter((doc) => doc.isDemo)
        .slice(0, limit);
      for (const doc of docs) {
        const counts = await ctx.db
          .query("locationCounts")
          .withIndex("by_locationId", (q) => q.eq("locationId", doc._id))
          .unique();
        if (counts !== null) await ctx.db.delete("locationCounts", counts._id);
        if (doc.cover?.kind === "storage") {
          await ctx.storage.delete(doc.cover.storageId);
        }
        await ctx.db.delete("locations", doc._id);
      }
      return docs.length;
    }
  }
}
