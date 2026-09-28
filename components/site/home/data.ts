import "server-only";

import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { getPublicSettings } from "@/components/site/Footer";
import { api } from "@/convex/_generated/api";
import type { ListingCard } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import type { LocationOption, NeighborhoodItem } from "./types";

/**
 * Everything the landing reads from Convex, in one round of parallel queries
 * (IMPLEMENTATION-PLAN §1.3). `allSettled`, not `all`: the landing is the one
 * page that must never turn into an error screen because the journal or a
 * counter query failed — each section degrades on its own and the failure is
 * logged on the server.
 */

export type LocationNode = FunctionReturnType<typeof api.locations.tree>[number];
export type PostCard = FunctionReturnType<typeof api.posts.list>["page"][number];
export type Testimonial = FunctionReturnType<typeof api.testimonials.verified>[number];
export type PublicSettings = NonNullable<FunctionReturnType<typeof api.settings.publicSettings>>;

export type HomeData = {
  featured: ListingCard[];
  locations: LocationNode[];
  posts: PostCard[];
  testimonials: Testimonial[];
  settings: PublicSettings | null;
};

function settled<T, F>(result: PromiseSettledResult<T>, fallback: F, label: string): T | F {
  if (result.status === "fulfilled") return result.value;
  console.error(`[home] ${label} failed:`, result.reason);
  return fallback;
}

export async function loadHomeData(): Promise<HomeData> {
  const [featured, locations, posts, testimonials, settings] = await Promise.allSettled([
    fetchQuery(api.listings.featured, { limit: 6 }),
    fetchQuery(api.locations.tree, {}),
    fetchQuery(api.posts.list, { paginationOpts: { numItems: 3, cursor: null } }),
    fetchQuery(api.testimonials.verified, { limit: 6 }),
    getPublicSettings(),
  ]);

  return {
    featured: settled(featured, [], "listings.featured"),
    locations: settled(locations, [], "locations.tree"),
    posts: settled(posts, null, "posts.list")?.page ?? [],
    testimonials: settled(testimonials, [], "testimonials.verified"),
    settings: settled(settings, null, "settings.publicSettings"),
  };
}

/* ----------------------------------------------------------- location views */

const DEPTH: Record<LocationNode["kind"], 0 | 1 | 2> = {
  city: 0,
  municipality: 1,
  neighborhood: 2,
};

/**
 * The tree flattened in reading order — each city, then its municipalities,
 * each followed by its neighborhoods — so a native `<select>` can show the
 * hierarchy by indentation alone.
 */
export function locationOptions(nodes: readonly LocationNode[], locale: Locale): LocationOption[] {
  const children = new Map<string, LocationNode[]>();
  const roots: LocationNode[] = [];
  for (const node of nodes) {
    if (node.parentId === undefined) roots.push(node);
    else children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }

  const byOrder = (a: LocationNode, b: LocationNode) => a.order - b.order;
  const out: LocationOption[] = [];
  const visit = (node: LocationNode) => {
    out.push({
      slug: node.slug,
      name: pickL10n(node.name, locale).text,
      depth: DEPTH[node.kind],
      sale: node.saleCount,
      rent: node.rentCount,
    });
    for (const child of (children.get(node._id) ?? []).sort(byOrder)) visit(child);
  };
  for (const root of roots.sort(byOrder)) visit(root);
  return out;
}

/**
 * The featured locations for DESIGN §6.5, Belgrade areas first. The capital
 * itself is left out: "Beograd" beside its own neighborhoods would be a row
 * that contains every other row.
 */
export function neighborhoodItems(nodes: readonly LocationNode[], locale: Locale): NeighborhoodItem[] {
  const byId = new Map(nodes.map((node) => [node._id as string, node]));
  const featured = nodes.filter(
    (node) => node.featured && !(node.kind === "city" && node.slug === "beograd"),
  );

  const rank = (node: LocationNode) => (node.kind === "city" ? 1 : 0);
  featured.sort((a, b) => rank(a) - rank(b) || a.order - b.order);

  return featured.map((node) => {
    const name = pickL10n(node.name, locale);
    const parent = node.parentId !== undefined ? byId.get(node.parentId) : undefined;
    return {
      id: node._id,
      slug: node.slug,
      name: name.text,
      ...(name.lang !== locale ? { lang: name.lang } : {}),
      ...(parent !== undefined ? { context: pickL10n(parent.name, locale).text } : {}),
      count: node.saleCount + node.rentCount,
      ...(node.coverUrl !== undefined ? { image: node.coverUrl } : {}),
    };
  });
}

/** The listing the 3D-tours teaser links to: the first featured one with a tour. */
export function tourListing(featured: readonly ListingCard[]): ListingCard | null {
  return featured.find((listing) => listing.hasTour) ?? null;
}

/**
 * A settings stat as a number the counter can run to, plus whatever text
 * surrounds it ("300+" → 300 and "+"). `null` when the owner typed something
 * that is not a figure, in which case it is shown verbatim.
 */
export function parseStat(value: string): { value: number; prefix: string; suffix: string } | null {
  const match = /^(\D*?)(\d[\d.,\s]*)(\D*)$/.exec(value.trim());
  if (match === null) return null;
  const digits = match[2].replace(/[.,\s]/g, "");
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return null;
  return { prefix: match[1], value: parsed, suffix: match[3] };
}
