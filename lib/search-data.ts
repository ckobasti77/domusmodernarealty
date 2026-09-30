import "server-only";

import { fetchQuery } from "convex/nextjs";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import type { LocationNode } from "./search-locations";

/**
 * Server-side reads for the search route. `cache()` lets `generateMetadata`
 * and the page share one Convex round trip for the location tree (it resolves
 * `?location=` slugs for both the title and the query args).
 */
export const getLocationTree = cache(async (): Promise<LocationNode[]> => {
  const nodes = await fetchQuery(api.locations.tree, {});
  return nodes.map((node) => ({
    _id: node._id,
    kind: node.kind,
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
    slug: node.slug,
    name: node.name,
    order: node.order,
    saleCount: node.saleCount,
    rentCount: node.rentCount,
  }));
});
