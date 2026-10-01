import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FaqSection } from "@/components/site/contact/FaqSection";
import { Container } from "@/components/site/Container";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { buildValuationCopy, funnelInitial, locationGroups } from "@/components/site/valuation/content";
import {
  FunnelUnavailable,
  HeroFacts,
  HowWeCalculate,
  OnsiteSection,
  VALUATION_FALLBACK_IMAGE,
} from "@/components/site/valuation/sections";
import { ValuationFunnel } from "@/components/site/valuation/ValuationFunnel";
import { routing, type Locale } from "@/i18n/routing";
import { localizedText } from "@/lib/content/pages";
import { placeholderValues } from "@/lib/content/placeholders";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { artImage } from "@/lib/media";
import { getLocations, getPublicSettings, getSitePage } from "@/lib/page-data";
import { absoluteUrl, localizedUrl, pageMetadata } from "@/lib/seo";

/**
 * The valuation funnel `/procena` (PRD A6). The ink band is compact so the
 * funnel — a paper panel that rises into it — is in the first screen on a
 * desktop; the managed copy of `pages.valuation` frames it (how the estimate
 * is calculated, what an agent looks at on site, the FAQ, the on-site CTA),
 * with the `valuation.*` messages as the fallback for anything missing.
 *
 * The landing's mini-form arrives as `?location=<slug>&area=<m²>`; both are
 * prefilled when they are a valued place and a plausible area.
 *
 * No `<main>` here — the locale layout owns it.
 */

type Props = PageProps<"/[locale]/valuation">;

/** The location tree, or none when Convex is unreachable: the page then explains instead of failing. */
async function valuationLocations() {
  try {
    return await getLocations();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[valuation] locations.tree failed:", error);
    return [];
  }
}

async function resolveLocale(params: Props["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: "valuation" }), getSitePage("valuation")]);
  const ogImage = page?.seo?.ogImage;
  const image =
    ogImage !== undefined && ogImage.kind === "url" ? ogImage.url : artImage("valuation", VALUATION_FALLBACK_IMAGE).src;

  return pageMetadata({
    locale,
    href: "/valuation",
    title: localizedText(page?.seo?.metaTitle, locale)?.text ?? t("metaTitle"),
    description: localizedText(page?.seo?.metaDescription, locale)?.text ?? t("metaDescription"),
    image: image.startsWith("/") ? absoluteUrl(image) : image,
  });
}

export default async function ValuationPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const [page, nodes, settings, query, t, tNav] = await Promise.all([
    getSitePage("valuation"),
    valuationLocations(),
    getPublicSettings(),
    searchParams,
    getTranslations({ locale, namespace: "valuation" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  const copy = buildValuationCopy(page, locale, t, placeholderValues(settings));
  const groups = locationGroups(nodes, locale, t);

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: tNav("home"), url: localizedUrl("/", locale) },
          { name: tNav("valuation"), url: localizedUrl("/valuation", locale) },
        ])}
      />

      <PageHero
        crumbs={[{ label: tNav("valuation") }]}
        eyebrow={t("eyebrow")}
        title={copy.title.text}
        titleLang={copy.title.lang}
        lede={t("lede")}
        aside={<HeroFacts locale={locale} />}
        // Extra ink under the band for the funnel panel to rise into.
        className="pb-16 lg:pb-28"
      />

      <section aria-label={t("funnelLabel")} className="bg-ivory pb-section lg:pb-section-lg">
        <Container>
          <div className="grid gap-y-16 lg:grid-cols-12 lg:gap-x-6">
            <div className="relative z-10 -mt-16 border border-hairline-light bg-paper px-5 py-8 sm:p-10 lg:col-span-7 lg:-mt-28 xl:p-14">
              {groups.length > 0 ? (
                <ValuationFunnel groups={groups} initial={funnelInitial(query, groups, locale)} />
              ) : (
                <FunnelUnavailable locale={locale} />
              )}
            </div>
            <div className="lg:col-span-4 lg:col-start-9 lg:pt-16">
              <div className="lg:sticky lg:top-[calc(var(--header-h,85px)+2.5rem)]">
                <HowWeCalculate locale={locale} about={copy.about} />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <OnsiteSection locale={locale} lookAt={copy.lookAt} book={copy.book} />
      <FaqSection id="valuation-faq-title" eyebrow={t("faqEyebrow")} heading={t("faqHeading")} items={copy.faq} />
    </>
  );
}
