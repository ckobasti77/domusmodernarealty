import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { PageKey, Transaction } from "@/convex/lib/validators";
import { locales } from "@/i18n/routing";
import { localizedAlternates } from "@/lib/seo";

/**
 * The XML sitemap (ARCHITECTURE §9): every indexable public page in all four
 * locales, each `<url>` carrying its hreflang alternates (+ `x-default`), its
 * pictures and a last-modified date where the data has one.
 *
 * Left out on purpose: favorites and compare (one visitor's selection,
 * `noindex`), filter states of the search (`noindex` unless curated), the
 * styleguide, and sold/rented listings.
 *
 * Regenerated at most hourly; a published listing therefore reaches the
 * sitemap within the hour, and every page is reachable by links before that.
 */
export const revalidate = 3600;

type Href = Parameters<typeof localizedAlternates>[0];
type Entry = MetadataRoute.Sitemap[number];

/**
 * Next writes these strings into the XML verbatim, and Unsplash/Convex image
 * URLs carry `&` in their query strings, so everything is escaped here.
 */
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** One `<url>` per locale, each listing all its language versions. */
function localized(href: Href, extra: { lastModified?: number; images?: readonly string[] } = {}): Entry[] {
  return locales.map((locale) => {
    const alternates = localizedAlternates(href, locale);
    const languages = Object.fromEntries(
      Object.entries(alternates.languages ?? {}).map(([lang, url]) => [lang, xml(String(url))]),
    );
    return {
      url: xml(String(alternates.canonical)),
      alternates: { languages },
      ...(extra.lastModified !== undefined ? { lastModified: new Date(extra.lastModified) } : {}),
      ...(extra.images !== undefined && extra.images.length > 0 ? { images: extra.images.map(xml) } : {}),
    };
  });
}

/** Static routes and the managed `pages` document each one renders. */
const STATIC_PAGES: ReadonlyArray<{ href: Href; page?: PageKey }> = [
  { href: "/", page: "home" },
  { href: "/properties" },
  { href: "/locations" },
  { href: "/valuation", page: "valuation" },
  { href: "/sell", page: "sell" },
  { href: "/agents" },
  { href: "/about", page: "about" },
  { href: "/contact", page: "contact" },
  { href: "/journal" },
  { href: "/privacy", page: "privacy" },
  { href: "/terms", page: "terms" },
  { href: "/cookies", page: "cookies" },
];

const LISTINGS_PER_REQUEST = 200;
/** A hard stop far above any agency's stock; past it, split with `generateSitemaps`. */
const MAX_LISTINGS = 10_000;

async function listedListings(transaction: Transaction) {
  const out: Array<FunctionReturnType<typeof api.sitemap.listings>["page"][number]> = [];
  let cursor: string | null = null;
  while (out.length < MAX_LISTINGS) {
    const result: FunctionReturnType<typeof api.sitemap.listings> = await fetchQuery(api.sitemap.listings, {
      transaction,
      paginationOpts: { numItems: LISTINGS_PER_REQUEST, cursor },
    });
    out.push(...result.page);
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [content, sale, rent] = await Promise.all([
    fetchQuery(api.sitemap.content, {}),
    listedListings("sale"),
    listedListings("rent"),
  ]);
  const listings = [...sale, ...rent];

  const pageUpdated = new Map(content.pages.map((page) => [page.key, page.updatedAt]));
  const newest = (times: readonly number[]) => (times.length > 0 ? Math.max(...times) : undefined);
  const lastModifiedOf: Partial<Record<string, number | undefined>> = {
    "/properties": newest(listings.map((listing) => listing.updatedAt)),
    "/journal": newest(content.posts.map((post) => post.updatedAt)),
  };

  return [
    ...STATIC_PAGES.flatMap(({ href, page }) => {
      const lastModified = page !== undefined ? pageUpdated.get(page) : lastModifiedOf[String(href)];
      return localized(href, lastModified !== undefined ? { lastModified } : {});
    }),
    ...listings.flatMap((listing) =>
      localized(
        { pathname: "/properties/[slug]", params: { slug: listing.slug } },
        { lastModified: listing.updatedAt, images: listing.images },
      ),
    ),
    ...content.locations.flatMap((location) =>
      localized(
        { pathname: "/locations/[slug]", params: { slug: location.slug } },
        location.image !== undefined ? { images: [location.image] } : {},
      ),
    ),
    ...content.posts.flatMap((post) =>
      localized(
        { pathname: "/journal/[slug]", params: { slug: post.slug } },
        { lastModified: post.updatedAt, ...(post.image !== undefined ? { images: [post.image] } : {}) },
      ),
    ),
    ...content.agents.flatMap((agent) =>
      localized(
        { pathname: "/agents/[slug]", params: { slug: agent.slug } },
        agent.image !== undefined ? { images: [agent.image] } : {},
      ),
    ),
  ];
}
