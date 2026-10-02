import "server-only";

import { fetchQuery } from "convex/nextjs";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import type { PageKey } from "@/convex/lib/validators";

/**
 * Server-side reads shared by the content pages (PRD A6–A13). Each is wrapped
 * in `cache()` so `generateMetadata` and the page share one Convex round trip
 * per request. Managed page content degrades to `null` (the page then shows
 * its built-in `messages` copy) instead of failing the route.
 */

export { getPublicSettings } from "@/components/site/Footer";

/** One `pages` document (about, sell, valuation, contact, privacy, terms, cookies). */
export const getSitePage = cache(async (key: PageKey) => {
  try {
    return await fetchQuery(api.pages.get, { key });
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[pages] pages.get(${key}) failed:`, error);
    return null;
  }
});

/** The public team, in the admin's order. */
export const getAgents = cache(async () => {
  return await fetchQuery(api.agents.list, {});
});

/**
 * The whole city → municipality → neighborhood tree WITH covers, averages and
 * centroids (the search route's `getLocationTree` keeps only what the
 * filters need).
 */
export const getLocations = cache(async () => {
  return await fetchQuery(api.locations.tree, {});
});

/**
 * A place's introduction alone (the locations index shows the primary city's;
 * the tree carries none): one document read, no listing cards.
 */
export const getLocationIntro = cache(async (slug: string) => {
  return fetchQuery(api.locations.intro, { slug });
});
