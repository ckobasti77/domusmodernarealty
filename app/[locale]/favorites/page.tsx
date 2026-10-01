import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FavoritesView } from "@/components/site/favorites/FavoritesView";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { routing, type Locale } from "@/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { getPublicSettings } from "@/lib/page-data";
import { localizedUrl, pageMetadata } from "@/lib/seo";

type Props = PageProps<"/[locale]/favorites">;

async function resolveLocale(params: Props["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

/** Settings for the cards' monthly-rate line, and the server's clock for their "Novo" badge. */
async function cardContext() {
  const settings = await getPublicSettings();
  return { mortgage: settings?.mortgage, now: Date.now() };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "favorites" });
  // The list lives in one visitor's browser: followed, never indexed.
  return pageMetadata({
    locale,
    href: "/favorites",
    title: t("heading"),
    description: t("metaDescription"),
    noindex: true,
  });
}

/**
 * Favorites (PRD A12). The ids live in this browser's `localStorage`, so the
 * server renders the hero and a loading shell, and the island fills the grid
 * from Convex once it can read the list.
 */
export default async function FavoritesPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const [t, tNav, { mortgage, now }] = await Promise.all([
    getTranslations({ locale, namespace: "favorites" }),
    getTranslations({ locale, namespace: "nav" }),
    cardContext(),
  ]);

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: tNav("home"), url: localizedUrl("/", locale) },
          { name: t("heading"), url: localizedUrl("/favorites", locale) },
        ])}
      />
      <PageHero
        crumbs={[{ label: t("heading") }]}
        eyebrow={t("eyebrow")}
        title={t("heading")}
        lede={t("lede")}
      />
      <FavoritesView now={now} {...(mortgage !== undefined ? { mortgage } : {})} />
    </>
  );
}
