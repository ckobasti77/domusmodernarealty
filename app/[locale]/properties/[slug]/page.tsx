import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { ContactForms } from "@/components/forms/ContactForms";
import { Badge } from "@/components/site/Badge";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { AgentCard } from "@/components/site/listing/AgentCard";
import { CostCalculator, MortgageCalculator } from "@/components/site/listing/Calculators";
import { FeatureGroups } from "@/components/site/listing/FeatureGroups";
import { displayFloor, displayTotalFloors } from "@/components/site/listing/floor";
import { KeyFacts } from "@/components/site/listing/KeyFacts";
import { LegalBlock } from "@/components/site/listing/LegalBlock";
import { ListingGallery } from "@/components/site/listing/ListingGallery";
import { LocationBlock } from "@/components/site/listing/LocationBlock";
import { MobileActionBar } from "@/components/site/listing/MobileActionBar";
import { PriceBlock } from "@/components/site/listing/PriceBlock";
import { ShareButtons } from "@/components/site/listing/ShareButtons";
import { SimilarRail } from "@/components/site/listing/SimilarRail";
import { VideoFacade } from "@/components/site/listing/VideoFacade";
import { ViewTracker } from "@/components/site/listing/ViewTracker";
import { Tabs, type SiteTab } from "@/components/site/Tabs";
import { Tour360Slot, Walk3DSlot } from "@/components/tours/TourSlot";
import type { Id } from "@/convex/_generated/dataModel";
import type { ListingDetail } from "@/convex/lib/dto";
import { getPathname, Link, permanentRedirect } from "@/i18n/navigation";
import { htmlLang, routing, type Locale } from "@/i18n/routing";
import { fixOrphans, formatArea, formatPrice, formatPricePerM2 } from "@/lib/format";
import { breadcrumbJsonLd, listingJsonLd, serializeJsonLd } from "@/lib/jsonld";
import { pickL10n, pickL10nList } from "@/lib/l10n";
import { getListingBySlug, getPublicSettings, getSimilarListings } from "@/lib/listing-data";
import { floorLabel, placeLine, placeShort, structureShort, structureTitle } from "@/lib/listing-text";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

type Params = PageProps<"/[locale]/properties/[slug]">["params"];

const CLOSED = new Set(["sold", "rented"]);

async function resolve(params: Params) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return { locale, slug, result: await getListingBySlug(slug) };
}

function href(slug: string) {
  return { pathname: "/properties/[slug]" as const, params: { slug } };
}

/** "430.000 €" / "1.200 € mesečno" / "Cena na upit" — shared by the title and description. */
function priceText(
  listing: ListingDetail,
  locale: Locale,
  t: (key: string) => string,
  tUnits: (key: string) => string,
): string {
  if (listing.priceOnRequest === true) return t("priceOnRequest");
  const base = formatPrice(listing.price, locale);
  return listing.transaction === "rent" ? `${base} ${tUnits("perMonth")}` : base;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, result } = await resolve(params);
  if (result.kind !== "listing") return {};
  const listing = result.listing;
  const t = await getTranslations({ locale, namespace: "listing" });
  const tUnits = await getTranslations({ locale, namespace: "units" });
  const m2 = tUnits("m2");
  const price = priceText(listing, locale, t, tUnits);

  const title =
    listing.seoTitle !== undefined
      ? pickL10n(listing.seoTitle, locale).text
      : t("seoTitle", {
          structure: structureTitle(t, listing, locale, m2),
          place: placeShort(listing, locale),
          price,
        });
  const description =
    listing.seoDescription !== undefined
      ? pickL10n(listing.seoDescription, locale).text
      : t("seoDescription", {
          // Titles often end with a full stop; the pattern adds its own.
          title: pickL10n(listing.title, locale).text.replace(/[.s]+$/, ""),
          area: formatArea(listing.areaM2, locale, m2),
          floor: floorLabel(t, displayFloor(listing.floor, locale), displayTotalFloors(listing.totalFloors, locale)),
          price,
          perM2: formatPricePerM2(listing.pricePerM2, locale, m2),
          ref: listing.ref,
        });
  const alternates = localizedAlternates(href(listing.slug), locale);
  // The share image is a Route Handler at the localized public path (see its
  // file); `v` changes with the price so caches drop the old figure.
  const image = {
    url: `${absoluteUrl(
      getPathname({ locale, href: { pathname: "/properties/[slug]/opengraph-image", params: { slug: listing.slug } } }),
    )}?v=${listing.price}`,
    width: 1200,
    height: 630,
    alt: t("ogAlt", { title: pickL10n(listing.title, locale).text, price }),
  };

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
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function ListingPage({ params }: { params: Params }) {
  const { locale, result } = await resolve(params);
  if (result.kind === "redirect") {
    // A renamed listing keeps its old URLs alive (ARCHITECTURE §4 `slugHistory`).
    permanentRedirect({ href: href(result.slug), locale });
  }
  if (result.kind !== "listing") notFound();
  const listing = result.listing;

  const settings = await getPublicSettings();
  const t = await getTranslations("listing");
  const tNav = await getTranslations("nav");
  const tUnits = await getTranslations("units");
  const m2 = tUnits("m2");

  const title = pickL10n(listing.title, locale);
  const description = pickL10n(listing.description, locale);
  const highlights = pickL10nList(listing.highlights, locale);
  const closed = CLOSED.has(listing.status);
  const ribbon =
    listing.status === "sold"
      ? t("statusSold")
      : listing.status === "rented"
        ? t("statusRented")
        : listing.status === "reserved"
          ? t("statusReserved")
          : undefined;
  const pageUrl = absoluteUrl(getPathname({ locale, href: href(listing.slug) }));
  const company =
    settings !== null ? { name: settings.companyName, registryNo: settings.registryNo } : null;

  /* ------------------------------------------------------------ media tabs */
  const gallery = <ListingGallery images={listing.media} title={title.text} ribbon={ribbon} />;
  const mediaTabs: SiteTab[] = [{ value: "photos", label: t("tabs.photos"), content: gallery }];
  if (listing.floorPlans.length > 0) {
    mediaTabs.push({
      value: "plans",
      label: t("tabs.floorPlans"),
      content: <ListingGallery images={listing.floorPlans} title={title.text} variant="plans" />,
    });
  }
  if (listing.videoUrl !== undefined) {
    mediaTabs.push({
      value: "video",
      label: t("tabs.video"),
      content: <VideoFacade url={listing.videoUrl} title={title.text} />,
    });
  }
  if (listing.tour360 !== undefined && listing.sceneCount + (listing.tour360.url !== undefined ? 1 : 0) > 0) {
    mediaTabs.push({
      value: "tour360",
      label: t("tabs.tour360"),
      content: (
        <Tour360Slot
          listingId={listing._id}
          title={title.text}
          poster={listing.cover}
          sceneCount={listing.sceneCount}
          provider={listing.tour360.provider}
          {...(listing.tour360.url !== undefined ? { externalUrl: listing.tour360.url } : {})}
        />
      ),
    });
  }
  if (listing.hasWalk3d) {
    mediaTabs.push({
      value: "walk3d",
      label: t("tabs.walk3d"),
      content: <Walk3DSlot listingId={listing._id} title={title.text} poster={listing.cover} />,
    });
  }

  /* ---------------------------------------------------------------- JSON-LD */
  const jsonLd = [
    listingJsonLd({
      url: pageUrl,
      name: title.text,
      description: description.text,
      inLanguage: title.lang,
      images: listing.media.map((image) => image.url),
      datePosted: listing.publishedAt,
      ref: listing.ref,
      propertyType: listing.propertyType,
      transaction: listing.transaction,
      price: listing.price,
      priceOnRequest: listing.priceOnRequest === true,
      closed,
      areaM2: listing.areaM2,
      rooms: listing.rooms,
      ...(listing.bedrooms !== undefined ? { bedrooms: listing.bedrooms } : {}),
      ...(listing.bathrooms !== undefined ? { bathrooms: listing.bathrooms } : {}),
      ...(listing.yearBuilt !== undefined ? { yearBuilt: listing.yearBuilt } : {}),
      ...(typeof listing.floor === "number" ? { floorLevel: String(listing.floor) } : {}),
      address: {
        ...(listing.street !== undefined
          ? { street: [listing.street, listing.streetNo].filter(Boolean).join(" ") }
          : {}),
        locality: pickL10n((listing.city ?? { name: listing.locationLabel }).name, locale).text,
        ...(listing.municipality !== undefined
          ? { region: pickL10n(listing.municipality.name, locale).text }
          : {}),
      },
      ...(listing.coordPrecision === "exact" ? { geo: { lat: listing.lat, lng: listing.lng } } : {}),
      agency: {
        name: settings?.legalName ?? "Mihajlo Estate",
        registryNo: settings?.registryNo ?? "",
        url: absoluteUrl(getPathname({ locale, href: "/" })),
      },
    }),
    breadcrumbJsonLd([
      { name: tNav("home"), url: absoluteUrl(getPathname({ locale, href: "/" })) },
      { name: tNav("properties"), url: absoluteUrl(getPathname({ locale, href: "/properties" })) },
      { name: title.text, url: pageUrl },
    ]),
  ];

  const eyebrow = [
    t(`transaction.${listing.transaction}`),
    t(`propertyType.${listing.propertyType}`),
    listing.propertyType !== "land" && listing.propertyType !== "garage"
      ? structureShort(t, tUnits, listing.rooms)
      : formatArea(listing.areaM2, locale, m2),
  ].join(" · ");

  const showFinance = listing.transaction === "sale" && !closed && listing.priceOnRequest !== true;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <ViewTracker listingId={listing._id} />

      {/* ------------------------------------------------ dark media band */}
      <div className="bg-ink text-ivory" data-listing-status={listing.status}>
        <Container width="bleed" className="pb-10 pt-24 md:pt-28 lg:pb-14">
          <nav aria-label={t("breadcrumbLabel")}>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-label uppercase tracking-[0.12em] text-mist">
              <li>
                <Link href="/" className="transition-colors duration-200 pointer-fine:hover:text-ivory">
                  {tNav("home")}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/properties" prefetch={false} className="transition-colors duration-200 pointer-fine:hover:text-ivory">
                  {tNav("properties")}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-ivory">
                {listing.ref}
              </li>
            </ol>
          </nav>
          <div className="mt-6">
            {mediaTabs.length > 1 ? <Tabs tone="dark" ariaLabel={t("tabs.label")} tabs={mediaTabs} /> : gallery}
          </div>
        </Container>
      </div>

      {/* ---------------------------------------------------- content grid */}
      <Container className="py-12 md:py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="flex min-w-0 flex-col gap-16 lg:col-span-8 lg:gap-20">
            <header className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 max-w-2xl">
                <Eyebrow>{eyebrow}</Eyebrow>
                <h1 lang={title.lang} className="mt-4 font-display text-display-m">
                  {fixOrphans(title.text)}
                </h1>
                <p className="mt-4 text-body-l text-ink">{placeLine(listing, locale)}</p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="mr-2 font-mono text-label uppercase tracking-[0.08em] text-stone-text">
                    {t("refCode", { ref: listing.ref })}
                  </span>
                  {listing.isExclusive ? <Badge tone="accent">{t("exclusive")}</Badge> : null}
                  {listing.legal.docsVerifiedAt !== undefined ? (
                    <Badge className="gap-1.5" >
                      <ShieldCheck aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                      {t("verifiedDocs")}
                    </Badge>
                  ) : null}
                  {listing.constructionType !== "old" ? (
                    <Badge>{t(`construction.${listing.constructionType}`)}</Badge>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 xl:w-[320px]">
                <PriceBlock
                  price={listing.price}
                  pricePerM2={listing.pricePerM2}
                  {...(listing.previousPrice !== undefined ? { previousPrice: listing.previousPrice } : {})}
                  priceOnRequest={listing.priceOnRequest === true}
                  transaction={listing.transaction}
                  history={listing.priceHistory}
                  {...(settings?.eurRsd !== undefined ? { eurRsd: settings.eurRsd } : {})}
                  {...(listing.vatIncluded !== undefined ? { vatIncluded: listing.vatIncluded } : {})}
                  {...(listing.rent?.deposit !== undefined ? { deposit: listing.rent.deposit } : {})}
                  company={company}
                />
              </div>
            </header>

            {closed || listing.status === "reserved" ? (
              <ClosedNotice status={listing.status} />
            ) : null}

            <KeyFacts listing={listing} locale={locale} />

            <section aria-labelledby="description-heading">
              <h2 id="description-heading" className="font-display text-h2">
                {t("description")}
              </h2>
              {highlights.items.length > 0 ? (
                <div className="mt-8 bg-ivory-2 p-6 md:p-8">
                  <p className="eyebrow text-stone-text">{t("highlights")}</p>
                  <ul lang={highlights.lang} className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {highlights.items.map((item) => (
                      <li key={item} className="flex gap-3 text-body text-ink">
                        <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-bronze-text" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div lang={description.lang} className="mt-8 flex max-w-prose flex-col gap-5 text-body-l text-ink">
                {description.text
                  .split(/\n{2,}/)
                  .map((paragraph) => paragraph.trim())
                  .filter((paragraph) => paragraph.length > 0)
                  .map((paragraph) => (
                    <p key={paragraph.slice(0, 48)}>{fixOrphans(paragraph)}</p>
                  ))}
              </div>
            </section>

            <FeatureGroups listing={listing} />
            <LegalBlock listing={listing} locale={locale} commission={listing.commissionText ?? settings?.commissionText ?? null} />
            <LocationBlock listing={listing} locale={locale} />

            {showFinance ? (
              <section aria-labelledby="finance-heading">
                <h2 id="finance-heading" className="font-display text-h2">
                  {t("financeHeading")}
                </h2>
                <div className="mt-8 grid gap-12 xl:grid-cols-2">
                  <MortgageCalculator
                    price={listing.price}
                    defaults={settings?.mortgage ?? { rate: 5, years: 25, downPct: 20 }}
                  />
                  <CostCalculator
                    price={listing.price}
                    propertyType={listing.propertyType}
                    constructionType={listing.constructionType}
                    {...(listing.vatIncluded !== undefined ? { vatIncluded: listing.vatIncluded } : {})}
                  />
                </div>
              </section>
            ) : null}

            {closed ? null : <ContactForms listingId={listing._id} agentId={listing.agent._id} refCode={listing.ref} />}
          </div>

          <div className="lg:col-span-4">
            <div className="flex flex-col gap-8 lg:sticky lg:top-28">
              <AgentCard agent={listing.agent} locale={locale} refCode={listing.ref} closed={closed} />
              <ShareButtons url={pageUrl} title={title.text} />
            </div>
          </div>
        </div>
      </Container>

      <Suspense fallback={null}>
        <SimilarListings id={listing._id} heading={t("similar")} />
      </Suspense>

      <MobileActionBar
        {...(listing.agent.phone !== undefined ? { phone: listing.agent.phone } : {})}
        {...(listing.agent.viber !== undefined ? { viber: listing.agent.viber } : {})}
        {...(listing.agent.whatsapp !== undefined ? { whatsapp: listing.agent.whatsapp } : {})}
        canBook={!closed}
      />
    </>
  );
}

async function ClosedNotice({ status }: { status: string }) {
  const t = await getTranslations("listing");
  const key = status === "sold" ? "sold" : status === "rented" ? "rented" : "reserved";
  const action: ReactNode =
    key === "reserved" ? null : (
      <Link href="/properties" prefetch={false} className={buttonClasses({ variant: "primary", size: "compact" })}>
        {t("closed.browse")}
      </Link>
    );
  return (
    <div role="status" data-testid="listing-closed" className="flex flex-col items-start gap-5 border-l-2 border-bronze-text bg-ivory-2 p-6 md:p-8">
      <p className="text-body-l text-ink">{t(`closed.${key}`)}</p>
      {action}
    </div>
  );
}

async function SimilarListings({ id, heading }: { id: Id<"listings">; heading: string }) {
  const similar = await getSimilarListings(id);
  if (similar.length === 0) return null;
  return (
    <section aria-labelledby="similar-heading" className="hairline-t bg-ivory">
      <Container className="py-16 lg:py-24">
        <h2 id="similar-heading" className="font-display text-h2">
          {heading}
        </h2>
        <div className="mt-10">
          <SimilarRail listings={similar} />
        </div>
      </Container>
    </section>
  );
}
