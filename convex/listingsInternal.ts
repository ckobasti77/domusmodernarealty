import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
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
