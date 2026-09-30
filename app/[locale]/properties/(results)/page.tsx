import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SearchExperience } from "@/components/site/search/SearchExperience";
import { api } from "@/convex/_generated/api";
import { getPathname } from "@/i18n/navigation";
import { htmlLang, routing, type Locale } from "@/i18n/routing";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/jsonld";
import { pickL10n } from "@/lib/l10n";
import { getPublicSettings } from "@/lib/listing-data";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { getLocationTree } from "@/lib/search-data";
import { effectiveSlugs, indexLocations, resolveLocations, type LocationIndex } from "@/lib/search-locations";
import {
  PAGE_SIZE,
  activeCount,
  canonicalState,
  effectiveSort,
  isCurated,
  parseSearchParams,
  searchKey,
  toConvexFilters,
  toQuery,
  type SearchState,
} from "@/lib/search-params";
import { searchTitle, type SearchTranslators } from "@/lib/search-text";

type Props = PageProps<"/[locale]/properties">;

async function translators(locale: Locale): Promise<SearchTranslators> {
  const [search, filters, listing, units] = await Promise.all([
    getTranslations({ locale, namespace: "search" }),
    getTranslations({ locale, namespace: "filters" }),
    getTranslations({ locale, namespace: "listing" }),
    getTranslations({ locale, namespace: "units" }),
  ]);
  return { search, filters, listing, units };
}

function placeNamer(index: LocationIndex, locale: Locale) {
  return (slug: string) => {
    const node = index.bySlug.get(slug);
    return node !== undefined ? pickL10n(node.name, locale).text : undefined;
  };
}

/** The URL's state with unknown and redundant places dropped (for titles and SEO). */
async function resolveState(props: Props) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const parsed = parseSearchParams(await props.searchParams);
  const index = indexLocations(await getLocationTree());
  const state: SearchState = { ...parsed, locations: effectiveSlugs(index, parsed.locations) };
  // The server clock anchors "added in the last N days"; the client island
  // reuses it, so both send identical Convex args (lib/search-params.ts).
  return { locale, parsed, state, index, now: Date.now() };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, state, index } = await resolveState(props);
  const t = await translators(locale);
  const title = searchTitle(t, state, placeNamer(index, locale));
  const description = t.search("metaDescription", { title });

  // Curated combinations (transaction + one type + one place) are landing
  // pages with a clean canonical; anything deeper is a filter state that
  // search engines should follow but not index (ARCHITECTURE §9).
  if (!isCurated(state)) {
    return { title, description, robots: { index: false, follow: true } };
  }
  const query = toQuery(canonicalState(state));
  const alternates = localizedAlternates(
    Object.keys(query).length > 0 ? { pathname: "/properties", query } : "/properties",
    locale,
  );
  return {
    title,
    description,
    alternates,
    openGraph: {
      type: "website",
      url: alternates.canonical as string,
      title,
      description,
      locale: htmlLang[locale],
      siteName: "Mihajlo Estate",
    },
  };
}

export default async function PropertiesPage(props: Props) {
  const { locale, parsed, state, index, now } = await resolveState(props);
  const filters = toConvexFilters(state, resolveLocations(index, state.locations), now);

  const [first, count, settings, t, tNav, tree] = await Promise.all([
    fetchQuery(api.listings.search, {
      filters,
      sort: effectiveSort(state),
      paginationOpts: { numItems: PAGE_SIZE, cursor: null },
    }),
    fetchQuery(api.listings.count, { filters }),
    getPublicSettings(),
    translators(locale),
    getTranslations({ locale, namespace: "nav" }),
    getLocationTree(),
  ]);

  const title = searchTitle(t, state, placeNamer(index, locale));
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const crumbs = [
    { name: tNav("home"), url: absoluteUrl(getPathname({ locale, href: "/" })) },
    { name: tNav("properties"), url: absoluteUrl(getPathname({ locale, href: "/properties" })) },
    ...(activeCount(state) > 0
      ? [{ name: title, url: absoluteUrl(getPathname({ locale, href: { pathname: "/properties", query: toQuery(state) } })) }]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }} />
      <SearchExperience
        initial={{
          key: searchKey(parsed),
          page: first.page,
          status: first.isDone ? "Exhausted" : "CanLoadMore",
          count,
        }}
        tree={tree}
        {...(settings !== null ? { mortgage: settings.mortgage } : {})}
        now={now}
        titleTemplate={tSeo("titleTemplate", { title: "%s" })}
      />
    </>
  );
}
