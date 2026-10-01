import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { ContactForms } from "@/components/forms/ContactForms";
import { Reveal } from "@/components/motion/Reveal";
import { Badge } from "@/components/site/Badge";
import type { CardMortgage } from "@/components/site/PropertyCard";
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
import { toTourScenes, toWalkData } from "@/components/tours/data";
import { Tour360Slot, Walk3DSlot } from "@/components/tours/TourSlot";
import type { Id } from "@/convex/_generated/dataModel";
import type { ListingDetail } from "@/convex/lib/dto";
import { getPathname, Link, permanentRedirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { fixTypography, fixWidows, formatArea, formatPrice, formatPricePerM2 } from "@/lib/format";
import { breadcrumbJsonLd, listingJsonLd, serializeJsonLd } from "@/lib/jsonld";
import { pickL10n, pickL10nList } from "@/lib/l10n";
import {
  getListingBySlug,
  getListingPreview,
  getPublicSettings,
  getSimilarListings,
  getTourScenes,
  getWalk3d,
} from "@/lib/listing-data";
import { floorLabel, placeLine, placeShort, structureShort, structureTitle } from "@/lib/listing-text";
import { absoluteUrl, documentTitle, localizedAlternates, socialMetadata } from "@/lib/seo";

type Params = PageProps<"/[locale]/properties/[slug]">["params"];
type Search = PageProps<"/[locale]/properties/[slug]">["searchParams"];

const CLOSED = new Set(["sold", "rented"]);

async function resolve(params: Params, searchParams: Search) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  // `?preview=<token>` is the staff preview link from the admin editor. A
  // valid token shows the listing whatever its status; anything else falls
  // through to the public read, so a bad token is simply a 404.
  const token = typeof query.preview === "string" && query.preview.length >= 32 ? query.preview : undefined;
  // Settings are independent of the listing, so all reads start together.
  const [publicResult, settings, previewListing] = await Promise.all([
    getListingBySlug(slug),
    getPublicSettings(),
    token !== undefined ? getListingPreview(slug, token) : Promise.resolve(null),
  ]);
  const preview = previewListing !== null;
  const result = preview ? { kind: "listing" as const, listing: previewListing } : publicResult;
  // The server's clock for the "Novo" badge on similar cards, read once per request.
  return { locale, slug, now: Date.now(), result, preview, settings };
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const { locale, result, preview } = await resolve(params, searchParams);
  if (result.kind !== "listing") return {};
  if (preview) {
    // A staff preview must never be indexed or shared as a card.
    return { title: result.listing.ref, robots: { index: false, follow: false, nocache: true } };
  }
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
    type: "image/jpeg",
    alt: t("ogAlt", { title: pickL10n(listing.title, locale).text, price }),
  };

  return {
    title: documentTitle(title),
    description,
    alternates,
    ...socialMetadata({ locale, url: alternates.canonical as string, title, description, image }),
  };
}

export default async function ListingPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, now, result, preview, settings } = await resolve(params, searchParams);
  if (result.kind === "redirect") {
    // A renamed listing keeps its old URLs alive (ARCHITECTURE §4 `slugHistory`).
    permanentRedirect({ href: href(result.slug), locale });
  }
  if (result.kind !== "listing") notFound();
  const listing = result.listing;

  const t = await getTranslations("listing");
  const tNav = await getTranslations("nav");
  const tUnits = await getTranslations("units");
  const m2 = tUnits("m2");

  const title = pickL10n(listing.title, locale);
  const description = pickL10n(listing.description, locale);
  const highlights = pickL10nList(listing.highlights, locale);
  const paragraphs = description.text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
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
  // Tour data is read only for listings that have a tour; the viewers load on click.
  const selfTour = listing.tour360?.provider === "self" && listing.sceneCount > 0;
  const [rawScenes, rawWalk] = await Promise.all([
    selfTour || listing.hasWalk3d ? getTourScenes(listing._id) : Promise.resolve([]),
    listing.hasWalk3d ? getWalk3d(listing._id) : Promise.resolve(null),
  ]);
  const scenes = toTourScenes(rawScenes, locale);
  const walk = rawWalk !== null ? toWalkData(rawWalk, locale) : null;
  const tour360 = listing.tour360;
  const externalTour = tour360 !== undefined && tour360.provider !== "self" && tour360.embedUrl !== undefined;
  if (tour360 !== undefined && ((tour360.provider === "self" && scenes.length > 0) || externalTour)) {
    mediaTabs.push({
      value: "tour360",
      label: t("tabs.tour360"),
      content: (
        <Tour360Slot
          title={title.text}
          isDemo={listing.isDemo}
          poster={listing.cover}
          provider={tour360.provider}
          scenes={scenes}
          {...(tour360.embedUrl !== undefined ? { embedUrl: tour360.embedUrl } : {})}
        />
      ),
    });
  }
  if (walk !== null) {
    mediaTabs.push({
      value: "walk3d",
      label: t("tabs.walk3d"),
      content: (
        <Walk3DSlot
          title={title.text}
          isDemo={listing.isDemo}
          poster={listing.cover}
          {...(rawWalk?.posterUrl !== undefined ? { posterUrl: rawWalk.posterUrl } : {})}
          walk={walk}
          scenes={scenes}
        />
      ),
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
      {preview ? (
        <p
          role="status"
          data-testid="listing-preview-banner"
          className="fixed inset-x-0 bottom-0 z-[var(--z-menu)] bg-bronze-deep px-4 py-3 text-center font-sans text-label uppercase tracking-[0.12em] text-paper"
        >
          {t("previewBanner")}
        </p>
      ) : (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
          <ViewTracker listingId={listing._id} />
        </>
      )}

      {/* ------------------------------------------ dark band: media + title */}
      <div className="bg-ink text-ivory" data-listing-status={listing.status}>
        <Container width="bleed" className="pt-24 md:pt-28">
          {/* Phones go straight to the photographs; the menu already links back. */}
          <nav aria-label={t("breadcrumbLabel")} className="mb-6 hidden md:block">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-label uppercase tracking-[0.12em] text-mist">
              <li>
                <Link href="/" className="transition-colors duration-200 pointer-fine:hover:text-ivory">
                  {tNav("home")}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/properties" className="transition-colors duration-200 pointer-fine:hover:text-ivory">
                  {tNav("properties")}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-ivory">
                {listing.ref}
              </li>
            </ol>
          </nav>
          {mediaTabs.length > 1 ? <Tabs tone="dark" ariaLabel={t("tabs.label")} tabs={mediaTabs} /> : gallery}
        </Container>

        {/* Title and price sit directly under the photographs, inside the first
            viewport at 1440×900 and 390×844, on the same 8/4 split as the
            content grid below. */}
        <Container className="pb-12 pt-10 md:pb-16 lg:pt-12">
          {/* Three grid items so a phone reads title → price → badges, while a
              desktop keeps the badges under the title and the price beside it. */}
          <header className="grid gap-6 lg:grid-cols-12 lg:gap-x-16 lg:gap-y-5">
            <div className="min-w-0 lg:col-span-8 lg:row-start-1">
              <Eyebrow tone="accentDark">{eyebrow}</Eyebrow>
              <h1 lang={title.lang} className="mt-4 max-w-[22ch] font-display text-display-m text-ivory">
                {fixWidows(title.text, 18)}
              </h1>
              <p className="mt-4 text-body-l text-mist">{placeLine(listing, locale)}</p>
            </div>
            <div className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
              <PriceBlock
                tone="dark"
                price={listing.price}
                pricePerM2={listing.pricePerM2}
                {...(listing.previousPrice !== undefined ? { previousPrice: listing.previousPrice } : {})}
                priceOnRequest={listing.priceOnRequest === true}
                transaction={listing.transaction}
                history={listing.priceHistory}
                {...(settings?.eurRsd !== undefined ? { eurRsd: settings.eurRsd } : {})}
                {...(listing.vatIncluded !== undefined ? { vatIncluded: listing.vatIncluded } : {})}
                {...(listing.rent?.deposit !== undefined ? { deposit: listing.rent.deposit } : {})}
                {...(closed && ribbon !== undefined ? { closedLabel: ribbon } : {})}
                company={company}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:col-span-8 lg:row-start-2">
              <span className="mr-2 font-mono text-label uppercase tracking-[0.08em] text-mist">
                {t("refCode", { ref: listing.ref })}
              </span>
              {listing.isExclusive ? <Badge className="border-bronze text-bronze">{t("exclusive")}</Badge> : null}
              {listing.legal.docsVerifiedAt !== undefined ? (
                <Badge className="gap-1.5 border-ivory/30 text-ivory">
                  <ShieldCheck aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                  {t("verifiedDocs")}
                </Badge>
              ) : null}
              {listing.constructionType !== "old" ? (
                <Badge className="border-ivory/30 text-ivory">{t(`construction.${listing.constructionType}`)}</Badge>
              ) : null}
            </div>
          </header>
        </Container>
      </div>

      {/* ---------------------------------------------------- content grid */}
      <Container className="py-12 md:py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="flex min-w-0 flex-col gap-16 lg:col-span-8 lg:gap-20">
            {closed || listing.status === "reserved" ? (
              <ClosedNotice status={listing.status} />
            ) : null}

            {/* Light motion only (DESIGN §6, RESEARCH "fast listing pages"):
                each block rises once as it scrolls in; whatever is already on
                screen at hydration is left alone, and the server HTML is
                complete without JavaScript. */}
            <Reveal stagger={0} distance={24} skipInView>
              <KeyFacts listing={listing} locale={locale} />
            </Reveal>

            <Reveal as="section" stagger={0} distance={24} skipInView aria-labelledby="description-heading">
              <h2 id="description-heading" className="font-display text-h2">
                {t("description")}
              </h2>
              {highlights.items.length > 0 ? (
                <div className="hairline-t hairline-b mt-8 py-6 md:py-8">
                  <p className="eyebrow text-stone-text">{t("highlights")}</p>
                  <ul lang={highlights.lang} className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {highlights.items.map((item) => (
                      <li key={item} className="flex gap-3 text-body text-ink">
                        <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-bronze-text" />
                        {fixTypography(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {/* The first paragraph is set as a serif lede; the rest keep a
                  ~65-character measure. */}
              <div lang={description.lang} className="mt-10 flex max-w-[40rem] flex-col gap-5 text-body-l text-ink">
                {paragraphs.map((paragraph, index) => (
                  <p
                    key={paragraph.slice(0, 48)}
                    className={index === 0 ? "font-display text-[1.5rem] leading-[1.3] md:text-[1.75rem]" : undefined}
                  >
                    {fixTypography(paragraph)}
                  </p>
                ))}
              </div>
            </Reveal>

            <Reveal stagger={0} distance={24} skipInView>
              <FeatureGroups listing={listing} />
            </Reveal>
            <Reveal stagger={0} distance={24} skipInView>
              <LegalBlock listing={listing} locale={locale} commission={listing.commissionText ?? settings?.commissionText ?? null} />
            </Reveal>
            <Reveal stagger={0} distance={24} skipInView>
              <LocationBlock listing={listing} locale={locale} />
            </Reveal>

            {showFinance ? (
              <Reveal as="section" stagger={0} distance={24} skipInView aria-labelledby="finance-heading">
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
              </Reveal>
            ) : null}

            {closed || preview ? null : (
              <ContactForms listingId={listing._id} agentId={listing.agent._id} refCode={listing.ref} />
            )}
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
        <SimilarListings
          id={listing._id}
          heading={t("similar")}
          now={now}
          {...(settings !== null ? { mortgage: settings.mortgage } : {})}
        />
      </Suspense>

      <MobileActionBar
        {...(listing.agent.phone !== undefined ? { phone: listing.agent.phone } : {})}
        {...(listing.agent.viber !== undefined ? { viber: listing.agent.viber } : {})}
        {...(listing.agent.whatsapp !== undefined ? { whatsapp: listing.agent.whatsapp } : {})}
        canBook={!closed && !preview}
      />
    </>
  );
}

async function ClosedNotice({ status }: { status: string }) {
  const t = await getTranslations("listing");
  const key = status === "sold" ? "sold" : status === "rented" ? "rented" : "reserved";
  const action: ReactNode =
    key === "reserved" ? null : (
      <Link href="/properties" className={buttonClasses({ variant: "primary", size: "compact" })}>
        {t("closed.browse")}
      </Link>
    );
  return (
    <div role="status" data-testid="listing-closed" className="flex flex-col items-start gap-5 border border-ink/15 p-6 md:p-8">
      <p className="max-w-[40rem] text-body-l text-ink">{fixTypography(t(`closed.${key}`))}</p>
      {action}
    </div>
  );
}

async function SimilarListings({
  id,
  heading,
  mortgage,
  now,
}: {
  id: Id<"listings">;
  heading: string;
  mortgage?: CardMortgage;
  now: number;
}) {
  const similar = await getSimilarListings(id);
  if (similar.length === 0) return null;
  return (
    <section aria-labelledby="similar-heading" className="hairline-t bg-ivory">
      <Container className="py-16 lg:py-24">
        <Reveal stagger={0} distance={24} skipInView>
          <SimilarRail heading={heading} listings={similar} now={now} {...(mortgage !== undefined ? { mortgage } : {})} />
        </Reveal>
      </Container>
    </section>
  );
}
