import "server-only";

import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/routing";
import { formatCount, formatPricePerM2 } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import type { HeroFigure } from "./HeroFigures";

/**
 * Server-side reads and tree helpers for the location pages (PRD A8). The
 * index reads the whole tree once (`getLocations` in `lib/page-data.ts`); a
 * location page reads its own node, its parents, its children and its
 * listings in one `locations.bySlug` call, shared by `generateMetadata` and
 * the page through `cache()`.
 */

export type LocationNode = FunctionReturnType<typeof api.locations.tree>[number];
export type LocationDetail = NonNullable<FunctionReturnType<typeof api.locations.bySlug>>;
export type LocationKind = LocationNode["kind"];

/** Cards shown on a location page; the search link carries the rest. */
export const LISTING_LIMIT = 9;

/** Seeded and admin-made slugs are lowercase ASCII words joined by hyphens. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `null` for an unknown or malformed slug (the page turns that into a 404). */
export const getLocationBySlug = cache(async (slug: string): Promise<LocationDetail | null> => {
  if (slug.length > 96 || !SLUG.test(slug)) return null;
  return await fetchQuery(api.locations.bySlug, { slug, listingLimit: LISTING_LIMIT });
});

/** Published listings in a place, both transactions (the denormalized counters). */
export function listingTotal(node: Pick<LocationNode, "saleCount" | "rentCount">): number {
  return node.saleCount + node.rentCount;
}

export function byOrder(a: LocationNode, b: LocationNode): number {
  return a.order - b.order;
}

/** A node's direct children, in the admin's order. */
export function childrenOf(nodes: readonly LocationNode[], id: string): LocationNode[] {
  return nodes.filter((node) => node.parentId === id).sort(byOrder);
}

/** The cities (nodes without a parent), in the admin's order. */
export function rootsOf(nodes: readonly LocationNode[]): LocationNode[] {
  return nodes.filter((node) => node.parentId === undefined).sort(byOrder);
}

/**
 * The places beside `node`: the other children of its parent, or the other
 * cities for a city. The node itself is never in the list.
 */
export function siblingsOf(nodes: readonly LocationNode[], node: Pick<LocationNode, "_id" | "parentId">): LocationNode[] {
  const peers = node.parentId === undefined ? rootsOf(nodes) : childrenOf(nodes, node.parentId);
  return peers.filter((peer) => peer._id !== node._id);
}

/** A localized name; `lang` is set only when the text fell back to Serbian. */
export type PlaceName = { text: string; lang?: string };

export function placeName(node: Pick<LocationNode, "name">, locale: Locale): PlaceName {
  const picked = pickL10n(node.name, locale);
  return picked.lang !== locale ? { text: picked.text, lang: picked.lang } : { text: picked.text };
}

/** A `getTranslations` translator, as the plain function the helpers need. */
export type Translator = (key: string, values?: Record<string, string | number>) => string;

/**
 * The place's key figures (PRD A8): the average asking price per square metre
 * for sale and for rent as the admin entered them, and how many listings it
 * has now. A missing average is left out rather than shown as zero.
 */
export function placeFigures(
  node: Pick<LocationNode, "avgPricePerM2Sale" | "avgPricePerM2Rent" | "saleCount" | "rentCount">,
  locale: Locale,
  t: Translator,
  tUnits: Translator,
): HeroFigure[] {
  const m2 = tUnits("m2");
  const out: HeroFigure[] = [];
  if (node.avgPricePerM2Sale !== undefined) {
    out.push({ label: t("avgSale"), value: formatPricePerM2(node.avgPricePerM2Sale, locale, m2) });
  }
  if (node.avgPricePerM2Rent !== undefined) {
    out.push({
      label: t("avgRent"),
      note: tUnits("perMonth"),
      value: formatPricePerM2(node.avgPricePerM2Rent, locale, m2),
    });
  }
  out.push({ label: t("onOffer"), value: formatCount(listingTotal(node), locale) });
  return out;
}

/** A meta description: whole words, at most `max` characters, an ellipsis when cut. */
export function clipText(text: string, max = 158): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const end = cut.lastIndexOf(" ");
  return `${(end > max * 0.6 ? cut.slice(0, end) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** An absolute share image for a cover: Unsplash cropped to 1200×630, anything else as stored. */
export function shareImage(url: string): string {
  if (!url.startsWith("https://images.unsplash.com/")) return url;
  const [base] = url.split("?");
  return `${base}?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format`;
}
