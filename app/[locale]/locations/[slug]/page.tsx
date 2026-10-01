import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ListingMapLoader } from "@/components/map/ListingMapLoader";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { photoGrade } from "@/components/site/home/art-direction";
import {
  clipText,
  getLocationBySlug,
  listingTotal,
  placeFigures,
  placeName,
  shareImage,
  siblingsOf,
  type LocationDetail,
  type LocationNode,
} from "@/components/site/locations/data";
import { HeroFigures } from "@/components/site/locations/HeroFigures";
import { ListingGrid } from "@/components/site/locations/ListingGrid";
import { PlaceIndex } from "@/components/site/locations/PlaceIndex";
import { Straddle } from "@/components/site/locations/Straddle";
import type { Crumb } from "@/components/site/page/Breadcrumbs";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import { htmlLang, routing, type Locale } from "@/i18n/routing";
import { fixTypography, formatCount } from "@/lib/format";
import { breadcrumbJsonLd, placeJsonLd } from "@/lib/jsonld";
import { pickL10n, pickL10nList } from "@/lib/l10n";
import { getLocations, getPublicSettings } from "@/lib/page-data";
import { searchQuery, valuationQuery } from "@/lib/search-params";
import { localizedUrl, pageMetadata } from "@/lib/seo";

/**
 * A city, municipality or neighbourhood (PRD A8): the localized introduction,
 * the key figures (average €/m² for sale and rent as entered in the admin, and
 * the live listing counts), the facts list when the admin wrote one, a map at
 * the place's centre, its listings, and the places within and beside it.
 */

type Params = PageProps<"/[locale]/locations/[slug]">["params"];

function hrefOf(slug: string) {
  return { pathname: "/locations/[slug]" as const, params: { slug } };
}

/** "Dorćol, Beograd": a neighbourhood or municipality with its city, for titles. */
function titleName(detail: LocationDetail, locale: Locale): string {
  const name = placeName(detail.location, locale).text;
  const city = detail.parents[0];
  return city !== undefined && detail.location.kind !== "city" ? `${name}, ${placeName(city, locale).text}` : name;
}

async function load(params: Params) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const detail = await getLocationBySlug(slug);
  if (detail === null) notFound();
  // The server's clock for the "Novo" badge on the cards, read once per request.
  return { locale, detail, now: Date.now() };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, detail } = await load(params);
  const t = await getTranslations({ locale, namespace: "locations" });
  const name = titleName(detail, locale);
  const intro = detail.intro !== undefined ? pickL10n(detail.intro, locale).text.trim() : "";
  return pageMetadata({
    locale,
    href: hrefOf(detail.location.slug),
    title: t("detailMetaTitle", { name }),
    description: intro.length > 0 ? clipText(intro) : t("detailMetaFallback", { name }),
    ...(detail.location.coverUrl !== undefined ? { image: shareImage(detail.location.coverUrl) } : {}),
  });
}

export default async function LocationPage({ params }: { params: Params }) {
  const { locale, detail, now } = await load(params);
  const [nodes, settings, t, tNav, tUnits] = await Promise.all([
    getLocations(),
    getPublicSettings(),
    getTranslations({ locale, namespace: "locations" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "units" }),
  ]);

  const { location, parents, children, listings } = detail;
  const name = placeName(location, locale);
  const intro = detail.intro !== undefined ? pickL10n(detail.intro, locale) : null;
  const introText = intro !== null && intro.text.trim().length > 0 ? intro : null;
  const facts = detail.facts !== undefined ? pickL10nList(detail.facts, locale) : null;
  const factItems = facts?.items.filter((item) => item.trim().length > 0) ?? [];
  const parent = parents.at(-1);
  const siblings = siblingsOf(nodes, location);
  const total = listingTotal(location);
  const pageUrl = localizedUrl(hrefOf(location.slug), locale);

  const context = [...parents].reverse().map((node) => placeName(node, locale).text);
  const eyebrow = [t(`kind.${location.kind}`), context.length > 0 ? context.join(", ") : t("country")].join(" · ");

  const crumbs: Crumb[] = [
    { label: tNav("locations"), href: "/locations" },
    ...parents.map((node) => ({ label: placeName(node, locale).text, href: hrefOf(node.slug) })),
    { label: name.text },
  ];

  const jsonLd = [
    breadcrumbJsonLd([
      { name: tNav("home"), url: localizedUrl("/", locale) },
      { name: tNav("locations"), url: localizedUrl("/locations", locale) },
      ...parents.map((node) => ({ name: placeName(node, locale).text, url: localizedUrl(hrefOf(node.slug), locale) })),
      { name: name.text, url: pageUrl },
    ]),
    placeJsonLd({
      url: pageUrl,
      name: name.text,
      ...(introText !== null ? { description: introText.text } : {}),
      inLanguage: htmlLang[locale],
      ...(location.coverUrl !== undefined ? { image: shareImage(location.coverUrl) } : {}),
      geo: { lat: location.lat, lng: location.lng },
      ...(parent !== undefined
        ? { containedIn: { name: placeName(parent, locale).text, url: localizedUrl(hrefOf(parent.slug), locale) } }
        : {}),
    }),
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <PageHero
        crumbs={crumbs}
        eyebrow={eyebrow}
        title={name.text}
        {...(name.lang !== undefined ? { titleLang: name.lang } : {})}
        lede={introText?.text ?? t("detailLedeFallback")}
        {...(introText !== null && introText.lang !== locale ? { ledeLang: introText.lang } : {})}
        aside={
          <HeroFigures
            layout="rows"
            label={t("figuresLabel")}
            items={placeFigures(location, locale, t, tUnits)}
          />
        }
      />

      {location.coverUrl !== undefined ? (
        <Straddle>
          <ImageReveal
            src={location.coverUrl}
            alt=""
            ratio="aspect-[4/3] md:aspect-[21/9]"
            sizes="(min-width: 1440px) 1344px, 94vw"
            imageClassName={photoGrade(location.coverUrl)}
          />
        </Straddle>
      ) : null}

      {/* At a glance: what the place belongs to, the listing split, the
          admin's facts, and the map at its centre. */}
      <section aria-labelledby="glance-title" className="bg-ivory py-section text-ink lg:py-section-lg">
        <Container>
          <div className="grid grid-cols-4 gap-x-6 gap-y-14 lg:grid-cols-12">
            <div className="col-span-4 lg:col-span-5">
              <SectionHeading id="glance-title" eyebrow={t("factsEyebrow")} title={t("factsHeading")} size="h2" />
              <dl className="mt-10 border-t border-hairline-light text-body">
                {parent !== undefined ? (
                  <FactRow label={t("partOf")}>
                    <Link href={hrefOf(parent.slug)} className={textLinkClasses("light")}>
                      <span lang={placeName(parent, locale).lang}>{context.join(", ")}</span>
                    </Link>
                  </FactRow>
                ) : null}
                <FactRow label={t("forSale")}>
                  <span data-numeric="">{formatCount(location.saleCount, locale)}</span>
                </FactRow>
                <FactRow label={t("forRent")}>
                  <span data-numeric="">{formatCount(location.rentCount, locale)}</span>
                </FactRow>
              </dl>

              {factItems.length > 0 ? (
                <Reveal
                  as="ul"
                  lang={facts !== null && facts.lang !== locale ? facts.lang : undefined}
                  className="mt-10 flex flex-col gap-4"
                >
                  {factItems.map((item, index) => (
                    <li key={`${index}-${item}`} className="flex gap-4 text-body">
                      <span aria-hidden="true" className="mt-[0.8em] h-px w-5 shrink-0 bg-bronze" />
                      <span className="text-pretty">{fixTypography(item)}</span>
                    </li>
                  ))}
                </Reveal>
              ) : null}

              <p className="mt-10 max-w-[52ch] text-small text-stone-text">{fixTypography(t("avgNote"))}</p>
            </div>

            <figure className="col-span-4 lg:col-span-7 lg:col-start-6 lg:pl-6">
              <ListingMapLoader lat={location.lat} lng={location.lng} precision="area" locale={locale} />
              <figcaption className="mt-4 flex flex-wrap justify-between gap-x-6 gap-y-1 text-small text-stone-text">
                <span>{t("mapCaption")}</span>
                <span data-numeric="" className="font-mono text-label">
                  {location.lat.toFixed(4)}° N · {location.lng.toFixed(4)}° E
                </span>
              </figcaption>
            </figure>
          </div>
        </Container>
      </section>

      <section id="ponuda" aria-labelledby="listings-title" className="bg-ivory-2 py-section text-ink lg:py-section-lg">
        <Container>
          <SectionHeading
            id="listings-title"
            eyebrow={total > 0 ? t("count", { count: total }) : t("noOffers")}
            title={t("listingsHeading", { name: name.text })}
            lede={
              total > listings.length
                ? t("listingsShown", { shown: listings.length, total })
                : undefined
            }
            action={<SearchLinks location={location} locale={locale} />}
          />

          {listings.length > 0 ? (
            <div className="mt-12 lg:mt-16">
              <ListingGrid
                listings={listings}
                now={now}
                {...(settings !== null ? { mortgage: settings.mortgage } : {})}
              />
            </div>
          ) : (
            <div className="mt-12 max-w-[60ch] border-t border-hairline-light pt-8 lg:mt-16">
              <p className="font-display text-h3">{t("emptyTitle")}</p>
              <p className="mt-3 text-pretty text-body text-stone-text">{fixTypography(t("emptyBody"))}</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/contact" className={buttonClasses({ variant: "primary" })}>
                  {t("emptyContact")}
                </Link>
                <Link href="/properties" className={buttonClasses({ variant: "outline" })}>
                  {t("emptyAll")}
                </Link>
              </div>
            </div>
          )}

          <div className="mt-16 flex flex-col gap-4 border-t border-hairline-light pt-8 md:flex-row md:items-center md:justify-between lg:mt-24">
            <p className="max-w-[48ch] text-pretty text-body text-ink">{fixTypography(t("sellPrompt"))}</p>
            <Link
              href={{ pathname: "/valuation", query: valuationQuery({ location: location.slug }) }}
              className={textLinkClasses("light", "group/val inline-flex items-center gap-3 self-start text-small uppercase tracking-[0.12em] md:self-auto")}
            >
              {t("sellCta")}
              <ArrowRight
                aria-hidden="true"
                strokeWidth={1.25}
                className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/val:translate-x-1"
              />
            </Link>
          </div>
        </Container>
      </section>

      {children.length > 0 || siblings.length > 0 ? (
        <section aria-label={t("exploreLabel")} className="bg-ivory py-section text-ink lg:py-section-lg">
          <Container className="flex flex-col gap-20 lg:gap-28">
            {children.length > 0 ? (
              <PlaceGroup
                id="within-title"
                eyebrow={name.text}
                eyebrowLang={name.lang}
                title={childrenHeading(children, t)}
                items={children}
                locale={locale}
              />
            ) : null}
            {siblings.length > 0 ? (
              <PlaceGroup
                id="nearby-title"
                eyebrow={parent !== undefined ? placeName(parent, locale).text : t("country")}
                eyebrowLang={parent !== undefined ? placeName(parent, locale).lang : undefined}
                title={location.kind === "city" ? t("otherCitiesHeading") : t("nearbyHeading")}
                items={siblings}
                locale={locale}
              />
            ) : null}
          </Container>
        </section>
      ) : null}
    </>
  );
}

function childrenHeading(children: readonly LocationNode[], t: (key: string) => string): string {
  return children.every((child) => child.kind === "municipality")
    ? t("childrenMunicipalities")
    : t("childrenNeighborhoods");
}

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-baseline justify-between gap-6 border-b border-hairline-light py-4">
      <dt className="font-mono text-label uppercase text-stone-text">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** "Sve na prodaju" / "Sve za izdavanje": the search, filtered to this place. */
async function SearchLinks({ location, locale }: { location: LocationNode; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "locations" });
  const links = [
    ...(location.saleCount > 0
      ? [{ key: "sale", label: t("searchSale"), count: location.saleCount, transaction: "sale" as const }]
      : []),
    ...(location.rentCount > 0
      ? [{ key: "rent", label: t("searchRent"), count: location.rentCount, transaction: "rent" as const }]
      : []),
  ];
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-3">
      {links.map((link) => (
        <li key={link.key}>
          <Link
            href={{ pathname: "/properties", query: searchQuery({ transaction: link.transaction, location: location.slug }) }}
            className={textLinkClasses("light", "group/search inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]")}
          >
            {link.label}
            <span data-numeric="" className="font-mono text-label text-stone-text">
              {formatCount(link.count, locale)}
            </span>
            <ArrowRight
              aria-hidden="true"
              strokeWidth={1.25}
              className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/search:translate-x-1"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PlaceGroup({
  id,
  eyebrow,
  eyebrowLang,
  title,
  items,
  locale,
}: {
  id: string;
  eyebrow: string;
  eyebrowLang?: string;
  title: string;
  items: readonly LocationNode[];
  locale: Locale;
}) {
  return (
    <div className="grid grid-cols-4 gap-x-6 gap-y-10 lg:grid-cols-12">
      <div className="col-span-4 lg:col-span-3">
        <Eyebrow>
          <span lang={eyebrowLang}>{eyebrow}</span>
        </Eyebrow>
        <h2 id={id} className="mt-4 font-display text-h2 font-normal">
          {title}
        </h2>
      </div>
      <div className="col-span-4 lg:col-span-9">
        <PlaceIndex items={items} locale={locale} label={title} />
      </div>
    </div>
  );
}
