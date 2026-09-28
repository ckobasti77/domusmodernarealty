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
