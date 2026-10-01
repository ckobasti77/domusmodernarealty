import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { toCompareItem, type CompareItem } from "@/components/site/compare/compare-item";
import { CompareView, type SharedComparison } from "@/components/site/compare/CompareView";
import { parseIdsParam } from "@/components/site/compare/listing-ids";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { routing, type Locale } from "@/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { localizedUrl, pageMetadata } from "@/lib/seo";

type Props = PageProps<"/[locale]/compare">;

async function resolveLocale(params: Props["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

/**
 * Convex rejects an id that is well-formed but not a listing id (a typo that
 * breaks the checksum, an id from another deployment). That is a bad link, not
 * an outage: it is answered with "no longer available", while anything else
 * (Convex unreachable) still reaches the error boundary.
 */
function isRejectedId(error: unknown): boolean {
  return error instanceof Error && error.message.includes("ArgumentValidationError");
}

async function detailsOf(ids: Id<"listings">[]): Promise<CompareItem[]> {
  const details = await fetchQuery(api.listings.detailsByIds, { ids });
  return details.map(toCompareItem);
}

/**
 * The listings of a shared link, in link order. One rejected id fails the
 * whole batch, so a failed batch is retried id by id and only the bad ones
 * are left out.
 */
async function loadShared(ids: Id<"listings">[]): Promise<CompareItem[]> {
  if (ids.length === 0) return [];
  try {
    return await detailsOf(ids);
  } catch (error) {
    unstable_rethrow(error);
    if (!isRejectedId(error)) throw error;
    if (ids.length === 1) return [];
    const each = await Promise.all(
      ids.map(async (id) => {
        try {
          return await detailsOf([id]);
        } catch (single) {
          unstable_rethrow(single);
          if (!isRejectedId(single)) throw single;
          return [];
        }
      }),
    );
    return each.flat();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "compare" });
  // A comparison is one visitor's selection: followed, never indexed. The
  // canonical drops `?ids=`, so shared links never compete as pages.
  return pageMetadata({
    locale,
    href: "/compare",
    title: t("heading"),
    description: t("metaDescription"),
    noindex: true,
  });
}

/**
 * Compare (PRD A12): two to four listings side by side. A shared link
 * (`?ids=a,b,c`) is rendered here on the server; without one, the island reads
 * this device's selection. Malformed ids never reach Convex (`parseIdsParam`).
 */
export default async function ComparePage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const ids = parseIdsParam((await searchParams).ids);
  const [t, tNav, items] = await Promise.all([
    getTranslations({ locale, namespace: "compare" }),
    getTranslations({ locale, namespace: "nav" }),
    ids !== null ? loadShared(ids) : Promise.resolve(null),
  ]);
  const shared: SharedComparison | null = ids !== null && items !== null ? { requested: ids.length, items } : null;

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: tNav("home"), url: localizedUrl("/", locale) },
          { name: tNav("properties"), url: localizedUrl("/properties", locale) },
          { name: t("heading"), url: localizedUrl("/compare", locale) },
        ])}
      />
      <PageHero
        crumbs={[{ label: tNav("properties"), href: "/properties" }, { label: t("heading") }]}
        eyebrow={t("eyebrow")}
        title={t("heading")}
        lede={t("lede")}
      />
      {/* Keyed by the link, so following another comparison link starts clean. */}
      <CompareView key={ids?.join(",") ?? "local"} shared={shared} />
    </>
  );
}
