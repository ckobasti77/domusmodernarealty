import type { Id } from "@/convex/_generated/dataModel";
import type { L10nValue } from "./l10n";
import type { ResolvedLocations } from "./search-params";

/**
 * The city → municipality → neighborhood tree behind the location filter.
 * Pure helpers over `api.locations.tree`, shared by the server page (slug → id
 * resolution for the Convex args) and the multi-select (labels, nesting).
 */

export type LocationNode = {
  _id: Id<"locations">;
  kind: "city" | "municipality" | "neighborhood";
  parentId?: Id<"locations">;
  slug: string;
  name: L10nValue;
  order: number;
  saleCount: number;
  rentCount: number;
};

export type LocationIndex = {
  bySlug: Map<string, LocationNode>;
  byId: Map<string, LocationNode>;
  children: Map<string, LocationNode[]>;
  roots: LocationNode[];
};

export function indexLocations(nodes: readonly LocationNode[]): LocationIndex {
  const bySlug = new Map<string, LocationNode>();
  const byId = new Map<string, LocationNode>();
  const children = new Map<string, LocationNode[]>();
  const roots: LocationNode[] = [];
  for (const node of nodes) {
    bySlug.set(node.slug, node);
    byId.set(node._id, node);
  }
  for (const node of nodes) {
    const parent = node.parentId !== undefined ? byId.get(node.parentId) : undefined;
    if (parent === undefined) {
      roots.push(node);
      continue;
    }
    const list = children.get(parent._id) ?? [];
    list.push(node);
    children.set(parent._id, list);
  }
  const byOrder = (a: LocationNode, b: LocationNode) => a.order - b.order || a.slug.localeCompare(b.slug);
  roots.sort(byOrder);
  for (const list of children.values()) list.sort(byOrder);
  return { bySlug, byId, children, roots };
}

/** Parent chain, nearest first. Bounded: the tree is three levels deep. */
export function ancestorsOf(index: LocationIndex, node: LocationNode): LocationNode[] {
  const out: LocationNode[] = [];
  let parentId = node.parentId;
  for (let guard = 0; parentId !== undefined && guard < 4; guard += 1) {
    const parent = index.byId.get(parentId);
    if (parent === undefined) break;
    out.push(parent);
    parentId = parent.parentId;
  }
  return out;
}

/** Every node under `node` (not including it). */
export function descendantsOf(index: LocationIndex, node: LocationNode): LocationNode[] {
  const out: LocationNode[] = [];
  const stack = [...(index.children.get(node._id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined) break;
    out.push(next);
    stack.push(...(index.children.get(next._id) ?? []));
  }
  return out;
}

/**
 * Selected slugs that still mean something: unknown slugs are dropped, and a
 * place whose parent is also selected is redundant ("Beograd" already covers
 * "Vračar"), so the chips and the args stay minimal.
 */
export function effectiveSlugs(index: LocationIndex, slugs: readonly string[]): string[] {
  const selected = new Set(slugs.filter((slug) => index.bySlug.has(slug)));
  return [...selected].filter((slug) => {
    const node = index.bySlug.get(slug);
    if (node === undefined) return false;
    return !ancestorsOf(index, node).some((parent) => selected.has(parent.slug));
  });
}

/** Slugs → ids grouped by level, for `searchFiltersV` (OR-ed across levels). */
export function resolveLocations(index: LocationIndex, slugs: readonly string[]): ResolvedLocations {
  const out: ResolvedLocations = { cityId: [], municipalityId: [], neighborhoodId: [] };
  for (const slug of effectiveSlugs(index, slugs)) {
    const node = index.bySlug.get(slug);
    if (node === undefined) continue;
    if (node.kind === "city") out.cityId.push(node._id);
    else if (node.kind === "municipality") out.municipalityId.push(node._id);
    else out.neighborhoodId.push(node._id);
  }
  return out;
}

/** Listing count shown next to a place in the picker. */
export function countFor(node: LocationNode, transaction: "sale" | "rent"): number {
  return transaction === "sale" ? node.saleCount : node.rentCount;
}
