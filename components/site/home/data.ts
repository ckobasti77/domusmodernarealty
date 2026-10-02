import "server-only";

import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { unstable_rethrow } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { ListingCard } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import type { PublicPage } from "@/lib/content/pages";
import { pickL10n } from "@/lib/l10n";
import { getPublicSettings, getSitePage } from "@/lib/page-data";
import type { LocationOption, NeighborhoodItem } from "./types";

/**
 * Everything the landing reads from Convex, in one round of parallel queries
 * (IMPLEMENTATION-PLAN §1.3). `allSettled`, not `all`: the landing is the one
 * page that must never turn into an error screen because the journal or a
 * counter query failed — each section degrades on its own and the failure is
 * logged on the server. The settings and the `home` page go through the same
 * `cache()`d reads as `generateMetadata`, so each is fetched once per request.
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
  /** The managed landing copy (`pages.home`); `null` → the built-in texts. */
  home: PublicPage | null;
};

function settled<T, F>(result: PromiseSettledResult<T>, fallback: F, label: string): T | F {
  if (result.status === "fulfilled") return result.value;
  // A no-store fetch during prerendering throws Next's own "dynamic usage"
  // signal; swallowing it would let the build bake an empty landing.
  unstable_rethrow(result.reason);
  console.error(`[home] ${label} failed:`, result.reason);
  return fallback;
}

export async function loadHomeData(): Promise<HomeData> {
  const [featured, locations, posts, testimonials, settings, home] = await Promise.allSettled([
    fetchQuery(api.listings.featured, { limit: 6 }),
    fetchQuery(api.locations.tree, {}),
    fetchQuery(api.posts.list, { paginationOpts: { numItems: 3, cursor: null } }),
    fetchQuery(api.testimonials.verified, { limit: 6 }),
    getPublicSettings(),
    getSitePage("home"),
  ]);

  return {
    featured: settled(featured, [], "listings.featured"),
    locations: settled(locations, [], "locations.tree"),
    posts: settled(posts, null, "posts.list")?.page ?? [],
    testimonials: settled(testimonials, [], "testimonials.verified"),
    settings: settled(settings, null, "settings.publicSettings"),
    home: settled(home, null, "pages.get(home)"),
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

  // DESIGN §6.5 names eight places; more rows turn the index into a wall.
  const shown = featured.slice(0, 8);

  // Below 1024px the cards keep every place when their count is even, so the
  // two-column phone grid (and the tablet grid NeighborhoodIndex picks) never
  // ends on an orphan. A "six busiest" rule used to cut exactly Dedinje and
  // Senjak, the addresses a premium agency is asked about first, because they
  // had the fewest listings. An odd count leaves out the quietest place that is
  // not a city (Novi Sad is the only proof of "all of Serbia"), the latest in
  // the editorial order on a tie.
  const total = (node: LocationNode) => node.saleCount + node.rentCount;
  const leftOut =
    shown.length % 2 === 1 && shown.length > 1
      ? [...shown].sort((a, b) => rank(a) - rank(b) || total(a) - total(b) || b.order - a.order)[0]
      : undefined;
  const onPhone = new Set(shown.filter((node) => node !== leftOut).map((node) => node._id as string));

  return shown.map((node) => {
    const name = pickL10n(node.name, locale);
    const parent = node.parentId !== undefined ? byId.get(node.parentId) : undefined;
    return {
      id: node._id,
      slug: node.slug,
      name: name.text,
      ...(name.lang !== locale ? { lang: name.lang } : {}),
      ...(parent !== undefined ? { context: pickL10n(parent.name, locale).text } : {}),
      count: total(node),
      ...(node.coverUrl !== undefined ? { image: node.coverUrl } : {}),
      onPhone: onPhone.has(node._id),
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
