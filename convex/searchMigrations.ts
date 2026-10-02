import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { applyDerived, locationNamesFor } from "./lib/derive";

/**
 * Listings re-derived per transaction. A listing is ~13 KB and needs up to
 * three location reads, so a batch stays far inside a mutation's read budget.
 */
const BATCH = 100;

/**
 * Recomputes `searchText` of every listing with the write path's own builder
 * (`applyDerived` over `locationNamesFor`), for haystacks stored before a
 * change to the fold (`lib/slug.ts::foldDiacritics`) — e.g. Russian titles and
 * Cyrillic place names, which used to fold to nothing. Run once against a
 * deployment; it pages itself, one batch per transaction:
 *
 *   npx convex run searchMigrations:rebuildListingSearchText '{}'
 *
 * Only a `searchText` that differs is patched. Nothing else is re-derived and
 * `updatedAt` stays, so no counter, slug, date or admin ordering moves.
 */
export const rebuildListingSearchText = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ scanned: v.number(), updated: v.number(), done: v.boolean() }),
  handler: async (ctx, args): Promise<{ scanned: number; updated: number; done: boolean }> => {
    const result = await ctx.db
      .query("listings")
      .paginate({ numItems: BATCH, cursor: args.cursor ?? null });
    let updated = 0;
    for (const listing of result.page) {
      const names = await locationNamesFor(ctx, listing);
      // The tour flag only feeds `hasTour`, which is not written here.
      const { searchText } = applyDerived(listing, names, false);
      if (searchText === listing.searchText) continue;
      await ctx.db.patch("listings", listing._id, { searchText });
      updated += 1;
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.searchMigrations.rebuildListingSearchText, {
        cursor: result.continueCursor,
      });
    }
    return { scanned: result.page.length, updated, done: result.isDone };
  },
});
