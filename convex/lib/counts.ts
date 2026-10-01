import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ListingStatus } from "./validators";

/**
 * Denormalized listing counts. Convex has no count operator, so every write
 * that changes a listing adjusts these rows in the same transaction:
 *
 * - `locationCounts`: public (`listed:*`) listings per location and
 *   transaction, for the location cards (PRD A8);
 * - `listingStatusCounts`: listings per status, agency-wide (`bucket: "all"`)
 *   and per assigned agent, for the admin status tabs and dashboard KPIs.
 */
type CountableListing = Pick<
  Doc<"listings">,
  "_id" | "cityId" | "municipalityId" | "neighborhoodId" | "transaction" | "scope" | "status" | "agentId"
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

/* ----------------------------------------------------------- status counts */

/** `"all"` is the agency-wide row; an agent id is that agent's own row. */
export type StatusBucket = "all" | Id<"agents">;

async function bump(
  ctx: MutationCtx,
  bucket: StatusBucket,
  status: ListingStatus,
  delta: number,
): Promise<void> {
  const row = await ctx.db
    .query("listingStatusCounts")
    .withIndex("by_bucket_and_status", (q) => q.eq("bucket", bucket).eq("status", status))
    .unique();
  if (row === null) {
    if (delta > 0) await ctx.db.insert("listingStatusCounts", { bucket, status, count: delta });
    return;
  }
  await ctx.db.patch("listingStatusCounts", row._id, { count: Math.max(row.count + delta, 0) });
}

/**
 * Moves one listing's contribution to `listingStatusCounts` from what it is
 * currently counted as (its `listingCountKeys` row) to `next` (null: deleted).
 *
 * Idempotent: the decrement uses the recorded key, never the caller's
 * "before" document, so a repeated call is a no-op, a listing inserted
 * without a call is picked up by its next write, and a full re-apply
 * (`listingsInternal.rebuildLocationCounts`) cannot double-count.
 */
export async function syncStatusCount(
  ctx: MutationCtx,
  listingId: Id<"listings">,
  next: Pick<Doc<"listings">, "status" | "agentId"> | null,
): Promise<void> {
  const tracked = await ctx.db
    .query("listingCountKeys")
    .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
    .unique();
  if (tracked !== null && next !== null && tracked.status === next.status && tracked.agentId === next.agentId) {
    return;
  }
  if (tracked !== null) {
    await bump(ctx, "all", tracked.status, -1);
    await bump(ctx, tracked.agentId, tracked.status, -1);
  }
  if (next === null) {
    if (tracked !== null) await ctx.db.delete("listingCountKeys", tracked._id);
    return;
  }
  await bump(ctx, "all", next.status, 1);
  await bump(ctx, next.agentId, next.status, 1);
  if (tracked === null) {
    await ctx.db.insert("listingCountKeys", { listingId, status: next.status, agentId: next.agentId });
  } else {
    await ctx.db.patch("listingCountKeys", tracked._id, { status: next.status, agentId: next.agentId });
  }
}

/** Every listing status, in the admin tab order. */
export const LISTING_STATUSES: readonly ListingStatus[] = [
  "draft",
  "review",
  "published",
  "reserved",
  "sold",
  "rented",
  "withdrawn",
  "archived",
];

/** Rows read per status by the bootstrap scan; at the cap the count reads "500+". */
const SCAN_CAP = 501;

/**
 * Counts per status for one bucket (missing rows read as 0): one indexed read
 * of at most 8 rows.
 *
 * Until the counters were ever initialized (no listing tracked yet: a
 * deployment before its first `countsMigrations.recountListingStatus`, or
 * rows inserted without the hook) it falls back to the capped index scan the
 * counters replaced, so the tabs never show a wrong 0.
 */
export async function statusCounts(
  ctx: QueryCtx,
  bucket: StatusBucket,
): Promise<Partial<Record<ListingStatus, number>>> {
  const out: Partial<Record<ListingStatus, number>> = {};
  const initialized = (await ctx.db.query("listingCountKeys").first()) !== null;
  if (initialized) {
    const rows = await ctx.db
      .query("listingStatusCounts")
      .withIndex("by_bucket_and_status", (q) => q.eq("bucket", bucket))
      .take(16);
    for (const row of rows) out[row.status] = row.count;
    return out;
  }
  for (const status of LISTING_STATUSES) {
    const rows =
      bucket === "all"
        ? await ctx.db
            .query("listings")
            .withIndex("by_status_and_updatedAt", (q) => q.eq("status", status))
            .take(SCAN_CAP)
        : await ctx.db
            .query("listings")
            .withIndex("by_agentId_and_status_and_updatedAt", (q) => q.eq("agentId", bucket).eq("status", status))
            .take(SCAN_CAP);
    if (rows.length > 0) out[status] = rows.length;
  }
  return out;
}

/* ------------------------------------------------------------------ entry */

/**
 * Called on every listing insert (`before: null`), update and delete
 * (`after: null`).
 *
 * Autosave calls this on every patch, so both parts are guarded:
 * - location counters are touched only when scope, transaction or location
 *   changed (two agents editing listings in one city would otherwise contend
 *   on one `locationCounts` row for nothing);
 * - status counters cost one indexed read of the listing's own key row and
 *   write only when status or agent differ from what is counted. That read
 *   is what lets a listing inserted without this call heal on its next save.
 */
export async function applyCountDelta(
  ctx: MutationCtx,
  before: CountableListing | null,
  after: CountableListing | null,
): Promise<void> {
  const sameLocation =
    before !== null &&
    after !== null &&
    before.scope === after.scope &&
    before.transaction === after.transaction &&
    before.cityId === after.cityId &&
    before.municipalityId === after.municipalityId &&
    before.neighborhoodId === after.neighborhoodId;

  if (!sameLocation) {
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

  const listingId = after?._id ?? before?._id;
  if (listingId !== undefined) await syncStatusCount(ctx, listingId, after);
}
