import type { MutationCtx } from "../_generated/server";
import { assertUploadOk } from "../media";
import { invalidInput } from "./errors";
import { assertFresh, assertImageRef, deleteBlobIfPresent } from "./storage";
import { walk3dBlobIds } from "./tourBlobs";
import {
  TOUR_LIMITS,
  externalTourEmbedUrl,
  isAllowedSplatUrl,
  isSitePanoPath,
  isValidFloorPolygon,
} from "./tours";
import type { ImageRef, Walk3d } from "./validators";

/**
 * Server checks for tour data written by the admin (toursAdmin and the listing
 * editor's autosave through listingsAdmin.update). Only blobs that are new or
 * changed are validated, so a later save never trips the 6 h upload window on
 * an asset that was accepted earlier; replaced blobs are released after the
 * write.
 */

type Tour360 = { provider: "self" | "matterport" | "kuula"; externalId?: string; url?: string; published: boolean };
type AssetSlot = "desktop" | "mobile" | "collision";
const SLOTS: AssetSlot[] = ["desktop", "mobile", "collision"];


const MAX_TEXT = 300;
const MAX_BYTES = 2_000_000_000;

/**
 * A third-party tour must resolve to an embeddable player on its own host.
 * Returns the tour to store: a self-hosted tour keeps no URL or ID.
 */
export function normalizeTour360(tour: Tour360 | undefined): Tour360 | undefined {
  if (tour === undefined) return undefined;
  if (tour.provider === "self") return { provider: "self", published: tour.published };
  if ((tour.url ?? "").length > MAX_TEXT || (tour.externalId ?? "").length > MAX_TEXT) {
    invalidInput("Adresa ili ID ture je predugačak.");
  }
  const hasSource = (tour.url ?? "").trim() !== "" || (tour.externalId ?? "").trim() !== "";
  if ((hasSource || tour.published) && externalTourEmbedUrl(tour.provider, tour.url, tour.externalId) === null) {
    invalidInput(
      tour.provider === "matterport"
        ? "Matterport tura mora biti adresa https://my.matterport.com/show/?m=… ili ID modela."
        : "Kuula tura mora biti adresa https://kuula.co/share/… ili ID ture.",
    );
  }
  return tour;
}

/** A model's size or splat count from the client: a sane positive number, or nothing. */
function count(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 && value <= MAX_BYTES ? Math.round(value) : undefined;
}

/**
 * Validates a walkthrough before it is written and returns it with the stored
 * size of uploaded assets filled in. `before` is the value currently stored.
 */
export async function prepareWalk3d(
  ctx: MutationCtx,
  before: Walk3d | undefined,
  next: Walk3d,
): Promise<Walk3d> {
  const known = new Set(walk3dBlobIds(before));
  const out: Walk3d = { ...next };

  for (const slot of SLOTS) {
    const asset = next[slot];
    if (asset === undefined) continue;
    const { bytes: claimedBytes, splats: claimedSplats, ...rest } = asset;
    const splats = count(claimedSplats);
    if (asset.source.kind === "url") {
      if (!isAllowedSplatUrl(asset.source.url)) {
        invalidInput(
          "Model mora biti https adresa na dozvoljenom serveru (d28zzqy0iyovbz.cloudfront.net, storage.googleapis.com) ili otpremljen fajl.",
        );
      }
      const bytes = count(claimedBytes);
      out[slot] = { ...rest, ...(bytes !== undefined ? { bytes } : {}), ...(splats !== undefined ? { splats } : {}) };
      continue;
    }
    // An uploaded model's size always comes from storage, never from the client.
    const storageId = asset.source.storageId;
    const meta = await ctx.db.system.get("_storage", storageId);
    if (!known.has(storageId)) {
      if (meta !== null) assertFresh(meta._creationTime);
      await assertUploadOk(ctx, storageId, "splat");
    }
    if (meta === null) invalidInput("Otpremljeni model više ne postoji. Otpremite ga ponovo.");
    out[slot] = { ...rest, bytes: meta.size, ...(splats !== undefined ? { splats } : {}) };
  }

  if (next.poster?.kind === "storage" && !known.has(next.poster.storageId)) {
    const meta = await ctx.db.system.get("_storage", next.poster.storageId);
    if (meta !== null) assertFresh(meta._creationTime);
    await assertUploadOk(ctx, next.poster.storageId, "image");
  }
  // A URL poster: a site image or an allowed image host (the public CSP's img-src).
  if (next.poster?.kind === "url" && !isSitePanoPath(next.poster.url)) {
    await assertImageRef(ctx, next.poster);
  }
  if (next.credits !== undefined && next.credits.length > MAX_TEXT) {
    invalidInput(`Autor snimka može imati najviše ${MAX_TEXT} znakova.`);
  }

  if (next.floorPolygon !== undefined && !isValidFloorPolygon(next.floorPolygon)) {
    invalidInput(`Tlocrt poda mora imati od 3 do ${TOUR_LIMITS.floorPoints} tačaka [x, z].`);
  }
  if (
    next.eyeHeight !== undefined &&
    !(next.eyeHeight >= TOUR_LIMITS.eyeHeight.min && next.eyeHeight <= TOUR_LIMITS.eyeHeight.max)
  ) {
    invalidInput(
      `Visina pogleda mora biti između ${TOUR_LIMITS.eyeHeight.min} i ${TOUR_LIMITS.eyeHeight.max} jedinica modela.`,
    );
  }
  if (next.spawn !== undefined && !Object.values(next.spawn).every((value) => Number.isFinite(value))) {
    invalidInput("Početna tačka mora imati brojčane koordinate.");
  }
  const hotspots = next.hotspots ?? [];
  if (hotspots.length > TOUR_LIMITS.hotspots) {
    invalidInput(`Najviše ${TOUR_LIMITS.hotspots} prostorija za skok.`);
  }
  for (const hotspot of hotspots) {
    const labels = [hotspot.label.sr, hotspot.label.en, hotspot.label.ru, hotspot.label.de];
    if (hotspot.label.sr.trim() === "" || labels.some((label) => label !== undefined && label.length > 60)) {
      invalidInput("Svaka prostorija za skok mora imati naziv do 60 znakova.");
    }
    if (![hotspot.x, hotspot.z, hotspot.yaw].every((value) => Number.isFinite(value))) {
      invalidInput("Prostorija za skok mora imati brojčane koordinate.");
    }
  }
  if (next.published && next.desktop === undefined) {
    invalidInput("Za objavu 3D šetnje potreban je model za računar.");
  }
  return out;
}

/** Deletes blobs the old walkthrough used that the new one no longer does. */
export async function releaseWalk3dBlobs(
  ctx: MutationCtx,
  before: Walk3d | undefined,
  after: Walk3d | undefined,
): Promise<void> {
  const kept = new Set(walk3dBlobIds(after));
  for (const id of walk3dBlobIds(before)) {
    if (!kept.has(id)) await deleteBlobIfPresent(ctx, id);
  }
}

/** True when `next` points at a blob `before` did not. */
export function isNewBlob(before: ImageRef | undefined, next: ImageRef | undefined): boolean {
  if (next?.kind !== "storage") return false;
  return before?.kind !== "storage" || before.storageId !== next.storageId;
}
