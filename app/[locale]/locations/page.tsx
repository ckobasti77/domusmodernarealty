import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { photoGrade } from "@/components/site/home/art-direction";
import {
  childrenOf,
  getLocationBySlug,
  listingTotal,
  placeFigures,
  placeName,
  rootsOf,
  type LocationNode,
} from "@/components/site/locations/data";
import { HeroFigures } from "@/components/site/locations/HeroFigures";
import { PlaceCard } from "@/components/site/locations/PlaceCard";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { fixTypography, fixWidows, formatCount } from "@/lib/format";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pickL10n } from "@/lib/l10n";
import { getLocations } from "@/lib/page-data";
import { searchQuery } from "@/lib/search-params";
import { localizedUrl, pageMetadata } from "@/lib/seo";

/**
 * The locations index (PRD A8): the primary city — Belgrade, first in the
 * admin's order — with its municipalities and their neighbourhoods, then the
 * other markets. Every place links to its own page; every figure (listing
 * counts, average €/m²) comes from the location tree in Convex. Places without
 * a photograph get a plate, never someone else's picture.
 */

export async function generateMetadata({ params }: PageProps<"/[locale]/locations">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "locations" });
  return pageMetadata({
    locale,
    href: "/locations",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function LocationsPage({ params }: PageProps<"/[locale]/locations">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [nodes, t, tNav] = await Promise.all([
    getLocations(),
    getTranslations({ locale, namespace: "locations" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  const roots = rootsOf(nodes);
  const [primary, ...others] = roots;
  const areaCount = nodes.filter((node) => node.kind !== "city").length;
  const listingCount = roots.reduce((sum, node) => sum + listingTotal(node), 0);

  const jsonLd = breadcrumbJsonLd([
    { name: tNav("home"), url: localizedUrl("/", locale) },
    { name: tNav("locations"), url: localizedUrl("/locations", locale) },
  ]);

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <PageHero
        crumbs={[{ label: tNav("locations") }]}
        eyebrow={t("eyebrow")}
        title={t("heading")}
        lede={t("lede")}
        aside={
          roots.length > 0 ? (
            <HeroFigures
              label={t("summaryLabel")}
              items={[
                { value: formatCount(roots.length, locale), label: t("summaryCities", { count: roots.length }) },
                { value: formatCount(areaCount, locale), label: t("summaryAreas") },
                { value: formatCount(listingCount, locale), label: t("summaryListings", { count: listingCount }) },
              ]}
            />
          ) : undefined
        }
      />

      {primary === undefined ? (
        <section className="bg-ivory py-section text-ink lg:py-section-lg">
          <Container>
            <p className="max-w-[48ch] text-body-l text-stone-text">{fixTypography(t("emptyIndex"))}</p>
          </Container>
        </section>
      ) : (
        <PrimaryPlace locale={locale} node={primary} districts={childrenOf(nodes, primary._id)} nodes={nodes} />
      )}

      {others.length > 0 ? (
        <section aria-labelledby="markets-title" className="bg-ivory-2 py-section text-ink lg:py-section-lg">
          <Container>
            <SectionHeading
              id="markets-title"
              eyebrow={t("citiesEyebrow")}
              eyebrowIndex={2}
              title={t("citiesHeading")}
              lede={t("citiesLede")}
            />
            <ul className="mt-14 grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-y-20">
              {others.map((city) => (
                <li key={city._id}>
                  <PlaceCard node={city} locale={locale} areas={childrenOf(nodes, city._id)} surface="ivory-2" />
                </li>
              ))}
            </ul>
            <p className="mt-16 max-w-[60ch] text-small text-stone-text lg:mt-20">{fixTypography(t("avgNote"))}</p>
          </Container>
        </section>
      ) : null}
    </>
  );
}

/**
 * The primary city, given the most room: its photograph beside its name,
 * introduction and figures, then every municipality as a card with its own
 * neighbourhoods.
 */
async function PrimaryPlace({
  locale,
  node,
  districts,
  nodes,
}: {
  locale: Locale;
  node: LocationNode;
  districts: readonly LocationNode[];
  nodes: readonly LocationNode[];
}) {
  const [t, tUnits] = await Promise.all([
    getTranslations({ locale, namespace: "locations" }),
    getTranslations({ locale, namespace: "units" }),
  ]);
  // The tree carries no introductions; the city's own read does (and is cached).
  const detail = await getLocationBySlug(node.slug);
  const name = placeName(node, locale);
  const intro = detail?.intro !== undefined ? pickL10n(detail.intro, locale) : null;
  const href = { pathname: "/locations/[slug]" as const, params: { slug: node.slug } };
  const origin = { lat: node.lat, lng: node.lng };

  return (
    <section aria-labelledby="primary-title" className="bg-ivory py-section text-ink lg:py-section-lg">
      <Container>
        <article
          data-testid="location-card"
          className="grid grid-cols-4 gap-x-6 gap-y-12 lg:grid-cols-12 lg:items-end"
        >
          {node.coverUrl !== undefined ? (
            <div className="col-span-4 lg:col-span-7">
              <ImageReveal
                src={node.coverUrl}
                alt=""
                ratio="aspect-[4/3]"
                crop={3 / 4}
                sizes="(min-width: 1440px) 800px, (min-width: 1024px) 56vw, 92vw"
                imageClassName={photoGrade(node.coverUrl)}
              />
            </div>
          ) : null}
          <div
            className={
              node.coverUrl !== undefined ? "col-span-4 lg:col-span-5 lg:col-start-8" : "col-span-4 lg:col-span-8"
            }
          >
            <Eyebrow index={1}>{t("primaryEyebrow")}</Eyebrow>
            <h2 id="primary-title" lang={name.lang} className="mt-6 font-display text-display-l font-normal">
              <SplitReveal as="span" className="block">
                {fixWidows(name.text)}
              </SplitReveal>
            </h2>
            {intro !== null ? (
              <p lang={intro.lang !== locale ? intro.lang : undefined} className="mt-6 max-w-[52ch] text-pretty text-body-l text-stone-text">
                {fixTypography(intro.text)}
              </p>
            ) : null}
            <HeroFigures
              tone="light"
              layout="rows"
              label={t("figuresLabel")}
              items={placeFigures(node, locale, t, tUnits)}
              className="mt-10"
            />
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
              <Link href={href} className={buttonClasses({ variant: "primary" })}>
                {t("guideCta")}
              </Link>
              {listingTotal(node) > 0 ? (
                <Link
                  href={{ pathname: "/properties", query: searchQuery({ transaction: "sale", location: node.slug }) }}
                  className={textLinkClasses("light", "group/all inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]")}
                >
                  {t("searchCta")}
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={1.25}
                    className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/all:translate-x-1"
                  />
                </Link>
              ) : null}
            </div>
          </div>
        </article>

        {districts.length > 0 ? (
          <div className="mt-24 lg:mt-36">
            <p className="eyebrow border-b border-hairline-light pb-5 text-bronze-text">{t("districtsHeading")}</p>
            <ul className="mt-12 grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-y-20">
              {districts.map((district) => (
                <li key={district._id}>
                  <PlaceCard node={district} locale={locale} areas={childrenOf(nodes, district._id)} origin={origin} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
