import "server-only";

import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { pathnames, type Locale } from "@/i18n/routing";
import { findBlock, type Localized, localizedText, type PublicPage } from "@/lib/content/pages";
import { fillPlaceholders, type PlaceholderValues } from "@/lib/content/placeholders";
import { formatInputNumber } from "@/lib/format";
import { pickL10n, pickL10nList } from "@/lib/l10n";
import { AREA_LIMITS, type FunnelInitial, type LocationChoice, type LocationGroup } from "./types";

/**
 * Everything the valuation page (PRD A6) resolves on the server: the managed
 * copy of `pages.valuation` with the `valuation.*` messages as the field-by-
 * field fallback, the location options of the funnel, and the prefill handed
 * over by the landing's mini-form.
 */

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** A text, and its language when it is not the page's (a Serbian fallback). */
export type Copy = { text: string; lang?: string };

function copyOf(managed: Localized | null, fallback: string, locale: Locale): Copy {
  if (managed === null) return { text: fallback };
  return managed.lang !== locale ? { text: managed.text, lang: managed.lang } : { text: managed.text };
}

/* ----------------------------------------------------------------- copy */

/** Static routes only: a managed CTA can point at `/contact`, never at a template like `/agents/[slug]`. */
type StaticPathname = Exclude<keyof typeof pathnames, `${string}[${string}`>;

function isStaticPathname(href: string): href is StaticPathname {
  return Object.hasOwn(pathnames, href) && !href.includes("[");
}

export type CtaTarget = { kind: "internal"; href: StaticPathname } | { kind: "external"; href: string };

/** The block's link when it is a known page or an absolute/tel/mailto URL; otherwise the contact page. */
function ctaTarget(href: string | undefined): CtaTarget {
  const value = href?.trim() ?? "";
  if (isStaticPathname(value)) return { kind: "internal", href: value };
  if (/^(https:\/\/|tel:|mailto:)/.test(value)) return { kind: "external", href: value };
  return { kind: "internal", href: "/contact" };
}

const LOOK_AT_KEYS = ["location", "size", "floor", "condition", "heating", "documents"] as const;
const FAQ_KEYS = ["free", "accuracy", "data"] as const;
const ABOUT_FALLBACK_KEYS = ["p1", "p2"] as const;

export type ValuationCopy = {
  title: Copy;
  /** Managed HTML (sanitized when rendered), or the built-in paragraphs. */
  about: { kind: "html"; html: string; lang?: string } | { kind: "text"; paragraphs: string[] };
  lookAt: { title: Copy; items: string[]; lang?: string };
  faq: { id: string; question: Copy; answer: Copy }[];
  book: { heading: Copy; sub: Copy; label: Copy; target: CtaTarget };
};

export function buildValuationCopy(
  page: PublicPage | null,
  locale: Locale,
  t: Translate,
  placeholders: PlaceholderValues | null,
): ValuationCopy {
  /** Plain managed text with `{{companyName}}`-style tokens resolved. */
  const plain = (localized: Localized | null): Localized | null =>
    localized !== null ? { ...localized, text: fillPlaceholders(localized.text, placeholders, false) } : null;

  const lede = findBlock(page, "lede", "richText");
  const ledeBody = lede !== undefined ? pickL10n(lede.body, locale) : null;
  const about: ValuationCopy["about"] =
    ledeBody !== null && ledeBody.text.trim().length > 0
      ? {
          kind: "html",
          html: fillPlaceholders(ledeBody.text, placeholders),
          ...(ledeBody.lang !== locale ? { lang: ledeBody.lang } : {}),
        }
      : { kind: "text", paragraphs: ABOUT_FALLBACK_KEYS.map((key) => t(`about.${key}`)) };

  const list = findBlock(page, "whatWeLookAt", "list");
  const listItems = list !== undefined ? pickL10nList(list.items, locale) : null;
  const lookAt: ValuationCopy["lookAt"] =
    listItems !== null && listItems.items.length > 0
      ? {
          title: copyOf(localizedText(list?.title, locale), t("lookAtTitle"), locale),
          items: listItems.items,
          ...(listItems.lang !== locale ? { lang: listItems.lang } : {}),
        }
      : { title: { text: t("lookAtTitle") }, items: LOOK_AT_KEYS.map((key) => t(`lookAt.${key}`)) };

  const faqBlock = findBlock(page, "faq", "faq");
  const faq: ValuationCopy["faq"] =
    faqBlock !== undefined && faqBlock.items.length > 0
      ? faqBlock.items.map((item, index) => ({
          id: `faq-${index}`,
          question: copyOf(plain(localizedText(item.q, locale)), "", locale),
          answer: copyOf(plain(localizedText(item.a, locale)), "", locale),
        }))
      : FAQ_KEYS.map((key) => ({
          id: key,
          question: { text: t(`faq.${key}.q`) },
          answer: { text: t(`faq.${key}.a`) },
        }));

  const cta = findBlock(page, "bookOnSite", "cta");

  return {
    title: copyOf(localizedText(lede?.title, locale), t("heading"), locale),
    about,
    lookAt,
    faq: faq.filter((item) => item.question.text.length > 0 && item.answer.text.length > 0),
    book: {
      heading: copyOf(plain(localizedText(cta?.heading, locale)), t("book.heading"), locale),
      sub: copyOf(plain(localizedText(cta?.sub, locale)), t("book.sub"), locale),
      label: copyOf(localizedText(cta?.label, locale), t("book.label"), locale),
      target: ctaTarget(cta?.href),
    },
  };
}

/* ------------------------------------------------------------ locations */

type LocationNode = FunctionReturnType<typeof api.locations.tree>[number];

/** Em spaces survive `<option>` whitespace collapsing, unlike ordinary spaces. */
const INDENT = " ";

/**
 * The funnel's location select: one `<optgroup>` per city that has areas with
 * a price basis, its municipalities in the admin's order with their
 * neighborhoods indented under them, and the city itself last ("Beograd,
 * other areas"); cities without such areas share an "Other cities" group.
 *
 * A place is offered only when it, or a place above it, has an average sale
 * price per m² — the same walk up the tree `leads.createValuation` makes, so
 * every option can be valued.
 */
export function locationGroups(nodes: readonly LocationNode[], locale: Locale, t: Translate): LocationGroup[] {
  const byId = new Map(nodes.map((node) => [node._id as string, node]));
  const children = new Map<string, LocationNode[]>();
  const roots: LocationNode[] = [];
  for (const node of nodes) {
    if (node.parentId === undefined) roots.push(node);
    else children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }
  const byOrder = (a: LocationNode, b: LocationNode) => a.order - b.order;

  const valued = (node: LocationNode): boolean => {
    let current: LocationNode | undefined = node;
    // The server looks at most three levels up; the tree is three deep.
    for (let level = 0; current !== undefined && level < 4; level += 1) {
      if (current.avgPricePerM2Sale !== undefined) return true;
      current = current.parentId !== undefined ? byId.get(current.parentId) : undefined;
    }
    return false;
  };

  const choice = (node: LocationNode, depth: number, extra?: Partial<LocationChoice>): LocationChoice => {
    const name = pickL10n(node.name, locale);
    return {
      id: node._id,
      slug: node.slug,
      label: `${INDENT.repeat(depth)}${name.text}`,
      name: name.text,
      ...(name.lang !== locale ? { lang: name.lang } : {}),
      ...extra,
    };
  };

  /** A node's area options, depth-first; an unvalued parent stays as a disabled sub-heading. */
  const areaOptions = (node: LocationNode, depth: number): LocationChoice[] => {
    const below = (children.get(node._id) ?? []).sort(byOrder).flatMap((child) => areaOptions(child, depth + 1));
    if (valued(node)) return [choice(node, depth), ...below];
    return below.length > 0 ? [choice(node, depth, { disabled: true }), ...below] : [];
  };

  const groups: LocationGroup[] = [];
  const smallCities: LocationChoice[] = [];
  for (const root of roots.sort(byOrder)) {
    const areas = (children.get(root._id) ?? []).sort(byOrder).flatMap((child) => areaOptions(child, 0));
    const cityValued = valued(root);
    if (areas.some((area) => area.disabled !== true)) {
      const city = pickL10n(root.name, locale);
      groups.push({
        label: city.text,
        ...(city.lang !== locale ? { lang: city.lang } : {}),
        options: cityValued
          ? [...areas, choice(root, 0, { label: t("locationOtherAreas", { city: city.text }) })]
          : areas,
      });
    } else if (cityValued) {
      smallCities.push(choice(root, 0));
    }
  }
  if (smallCities.length > 0) groups.push({ label: t("locationOtherCities"), options: smallCities });
  return groups;
}

/* --------------------------------------------------------------- prefill */

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `?location=vracar&area=64` from the landing's mini-form (`valuationQuery`
 * in lib/search-params.ts). An unknown or unvalued place and an area outside
 * the funnel's bounds are dropped, not shown as errors: the visitor did not
 * type them here.
 */
export function funnelInitial(
  query: Record<string, string | string[] | undefined>,
  groups: readonly LocationGroup[],
  locale: Locale,
): FunnelInitial {
  const slug = single(query.location)?.trim();
  const location =
    slug !== undefined && slug.length > 0
      ? groups.flatMap((group) => group.options).find((option) => option.slug === slug && option.disabled !== true)
      : undefined;

  const rawArea = single(query.area)?.trim();
  const area = rawArea !== undefined && /^\d+(\.\d+)?$/.test(rawArea) ? Number(rawArea) : undefined;
  const areaOk = area !== undefined && area >= AREA_LIMITS.min && area <= AREA_LIMITS.max;

  return {
    ...(location !== undefined ? { locationId: location.id } : {}),
    ...(areaOk ? { area: formatInputNumber(area, locale) } : {}),
  };
}
