import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Denormalized per-location listing counts. PRD A8 needs a count on every
 * location card and Convex has no count operator, so every write that changes a
 * listing's location or public visibility adjusts these rows in the same
 * transaction.
 */
type CountableListing = Pick<
  Doc<"listings">,
  "cityId" | "municipalityId" | "neighborhoodId" | "transaction" | "scope"
>;

function locationIdsOf(listing: CountableListing): Id<"locations">[] {
  const ids: Id<"locations">[] = [listing.cityId];
  if (listing.municipalityId !== undefined) ids.push(listing.municipalityId);
  if (listing.neighborhoodId !== undefined) ids.push(listing.neighborhoodId);
  return ids;
}

async function adjust(
  ctx: MutationCtx,
  locationId: Id<"locations">,
  transaction: "sale" | "rent",
  delta: number,
): Promise<void> {
  const row = await ctx.db
    .query("locationCounts")
    .withIndex("by_locationId", (q) => q.eq("locationId", locationId))
    .unique();
  if (row === null) {
    if (delta <= 0) return;
    await ctx.db.insert("locationCounts", {
      locationId,
      sale: transaction === "sale" ? delta : 0,
      rent: transaction === "rent" ? delta : 0,
    });
    return;
  }
  const next =
    transaction === "sale"
      ? { sale: Math.max(row.sale + delta, 0) }
      : { rent: Math.max(row.rent + delta, 0) };
  await ctx.db.patch("locationCounts", row._id, next);
}

/** Only `listed:*` listings are counted — those are the ones the cards link to. */
function isCounted(listing: CountableListing): boolean {
  return listing.scope.startsWith("listed:");
}

export async function applyCountDelta(
  ctx: MutationCtx,
  before: CountableListing | null,
  after: CountableListing | null,
): Promise<void> {
  if (before !== null && isCounted(before)) {
    for (const id of locationIdsOf(before)) {
      await adjust(ctx, id, before.transaction, -1);
    }
  }
  if (after !== null && isCounted(after)) {
    for (const id of locationIdsOf(after)) {
      await adjust(ctx, id, after.transaction, 1);
    }
  }
}
