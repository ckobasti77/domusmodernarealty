import "server-only";

import { fetchQuery } from "convex/nextjs";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Server-side reads for the listing detail route. `cache()` makes the page,
 * `generateMetadata` and `opengraph-image` share ONE Convex round trip per
 * request (IMPLEMENTATION-PLAN §1.3) instead of three.
 */
export const getListingBySlug = cache(async (slug: string) => {
  return await fetchQuery(api.listings.bySlug, { slug });
});

/** Similar listings stream in behind a Suspense boundary; a failure hides the rail. */
export const getSimilarListings = cache(async (id: Id<"listings">) => {
  try {
    return await fetchQuery(api.listings.similar, { id, limit: 6 });
  } catch (error) {
    console.error("[listing] listings.similar failed:", error);
    return [];
  }
});

export { getPublicSettings } from "@/components/site/Footer";

/**
 * Staff preview of an unpublished listing (`?preview=<token>` from the admin).
 * The expiry is checked against this server's clock, and
 * `listingsInternal.expirePreviewToken` also clears the token when it lapses.
 * Any failure means "no preview", so the page falls back to the public read.
 */
export const getListingPreview = cache(async (slug: string, token: string) => {
  try {
    return await fetchQuery(api.listings.previewBySlug, { slug, token, now: Date.now() });
  } catch (error) {
    console.error("[listing] listings.previewBySlug failed:", error);
    return null;
  }
});

/** Self-hosted 360° scenes; empty unless the tour is published. A failure hides the tab's viewer. */
export const getTourScenes = cache(async (listingId: Id<"listings">) => {
  try {
    return await fetchQuery(api.tours.scenes, { listingId });
  } catch (error) {
    console.error("[listing] tours.scenes failed:", error);
    return [];
  }
});

/** Splat walkthrough settings; `null` unless published. */
export const getWalk3d = cache(async (listingId: Id<"listings">) => {
  try {
    return await fetchQuery(api.tours.walk3d, { listingId });
  } catch (error) {
    console.error("[listing] tours.walk3d failed:", error);
    return null;
  }
});
