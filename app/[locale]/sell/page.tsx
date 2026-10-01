import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/site/Button";
import { Container, Grid, Section } from "@/components/site/Container";
import { FaqSection } from "@/components/site/contact/FaqSection";
import { ProcessSteps } from "@/components/site/home/ProcessSteps";
import { Straddle } from "@/components/site/locations/Straddle";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { RichText } from "@/components/site/page/RichText";
import { Picture } from "@/components/site/Picture";
import { SectionHeading } from "@/components/site/SectionHeading";
import { buildSellCopy, DOCUMENT_KEYS, sellLocationGroups } from "@/components/site/sell/content";
import { SellForm } from "@/components/site/sell/SellForm";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { localizedText } from "@/lib/content/pages";
import { placeholderValues } from "@/lib/content/placeholders";
import { fixTypography } from "@/lib/format";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { artImage, mediaImage } from "@/lib/media";
import { getLocations, getPublicSettings, getSitePage } from "@/lib/page-data";
import { absoluteUrl, localizedUrl, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * Sell with us `/prodajte` (PRD A7): the owner's page. The ink band states the
 * offer and points straight at the form; the entrance-hall still straddles
 * the seam; then what the owner receives, the five steps on their drawing
 * hairline (the landing's `ProcessSteps`), the documents to prepare, the
 * seller form (lead type `seller`) and the questions. Opening, benefits,
 * steps and questions are managed in `pages.sell`; the `sell.*` messages
 * stand in for any block that is missing.
 *
 * No `<main>` here — the locale layout owns it.
 */

type Props = PageProps<"/[locale]/sell">;

/** "Ornate historic facades and a street lamp in central Belgrade" (the landing's process fallback). */
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1655245934655-bde35a9dae80";
const FORM_ID = "prijava";

async function resolveLocale(params: Props["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

/** The location tree, or none when Convex is unreachable: the street field then carries the place. */
async function sellLocations() {
  try {
    return await getLocations();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[sell] locations.tree failed:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: "sell" }), getSitePage("sell")]);
  const ogImage = page?.seo?.ogImage;
  const image = ogImage !== undefined && ogImage.kind === "url" ? ogImage.url : artImage("sell", FALLBACK_IMAGE).src;

  return pageMetadata({
    locale,
    href: "/sell",
    title: localizedText(page?.seo?.metaTitle, locale)?.text ?? t("metaTitle"),
    description: localizedText(page?.seo?.metaDescription, locale)?.text ?? t("metaDescription"),
    image: image.startsWith("/") ? absoluteUrl(image) : image,
  });
}

export default async function SellPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const [t, tNav, page, settings, nodes] = await Promise.all([
    getTranslations({ locale, namespace: "sell" }),
    getTranslations({ locale, namespace: "nav" }),
    getSitePage("sell"),
    getPublicSettings(),
    sellLocations(),
  ]);

  const copy = buildSellCopy(page, locale, t, placeholderValues(settings));
  const groups = sellLocationGroups(nodes, locale, t);
  const phone = settings?.phones[0];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: tNav("home"), url: localizedUrl("/", locale) },
          { name: tNav("sell"), url: localizedUrl("/sell", locale) },
        ])}
      />

      <PageHero
        crumbs={[{ label: tNav("sell") }]}
        eyebrow={t("eyebrow")}
        title={copy.title.text}
        titleLang={copy.title.lang}
        lede={copy.lede.text}
        ledeLang={copy.lede.lang}
      >
        <div className="mt-4 flex flex-wrap items-center gap-x-10 gap-y-6">
          <a href={`#${FORM_ID}`} className={buttonClasses({ variant: "inverse" })}>
            <span>{t("heroCta")}</span>
          </a>
          <Link href="/valuation" className={textLinkClasses("dark", "text-small")}>
            {t("heroValuationCta")}
          </Link>
        </div>
      </PageHero>

      <Straddle>
        <ClipReveal from="bottom" className="relative aspect-[4/3] overflow-hidden md:aspect-[21/9]">
          <Picture
            image={artImage("sell", FALLBACK_IMAGE)}
            alt={mediaImage("sell") !== null ? t("mediaAlt") : ""}
            sizes="(min-width: 1440px) 1344px, 94vw"
            className="absolute inset-0"
            // The keys lie on the console at the lower left of the render.
            imgClassName="object-[30%_70%]"
          />
        </ClipReveal>
      </Straddle>

      <Section tone="ivory" aria-labelledby="sell-benefits-title">
        <Container>
          <Grid className="gap-y-14">
            <div className="col-span-4 lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <SectionHeading
                  id="sell-benefits-title"
                  eyebrow={t("benefitsEyebrow")}
                  title={
                    copy.benefits.title.lang !== undefined ? (
                      <span lang={copy.benefits.title.lang}>{copy.benefits.title.text}</span>
                    ) : (
                      copy.benefits.title.text
                    )
                  }
                  lede={fixTypography(t("benefitsLede"))}
                  size="h2"
                />
              </div>
            </div>
            <div className="col-span-4 lg:col-span-7 lg:col-start-6">
              {copy.more !== null ? (
                <RichText html={copy.more.html} lang={copy.more.lang} size="body-l" className="mb-12" />
              ) : null}
              <Reveal
                as="ul"
                lang={copy.benefits.lang}
                className="grid gap-x-8 sm:grid-cols-2 sm:[&>:last-child:nth-child(odd)]:col-span-2"
              >
                {copy.benefits.items.map((item, index) => (
                  <li
                    key={`${index}-${item}`}
                    className="flex gap-4 border-t border-hairline-light py-6 text-body text-ink"
                  >
                    <span aria-hidden="true" className="mt-[0.6em] h-px w-4 shrink-0 bg-bronze" />
                    <span className="text-pretty">{fixTypography(item)}</span>
                  </li>
                ))}
              </Reveal>
              <div className="mt-12 flex flex-col gap-4 border-l border-bronze pl-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
                <p className="max-w-[46ch] text-pretty text-body text-stone-text">
                  {fixTypography(t("valuationPrompt"))}
                </p>
                <Link href="/valuation" className={cn(textLinkClasses("light"), "shrink-0 text-small font-medium")}>
                  {t("valuationLink")}
                </Link>
              </div>
            </div>
          </Grid>
        </Container>
      </Section>

      <Section tone="ivory-2" aria-labelledby="sell-process-title">
        <Container>
          <Grid className="gap-y-16">
            <div className="col-span-4 lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <SectionHeading
                  id="sell-process-title"
                  eyebrow={t("processEyebrow")}
                  title={t("processHeading")}
                  lede={fixTypography(t("processLede"))}
                  size="h2"
                />
              </div>
            </div>
            <div className="col-span-4 lg:col-span-6 lg:col-start-7 lg:pt-4">
              <ProcessSteps steps={copy.steps} />
            </div>
          </Grid>
        </Container>
      </Section>

      <Section tone="ivory" aria-labelledby="sell-documents-title">
        <Container>
          <Grid className="gap-y-14">
            <div className="col-span-4 lg:col-span-4">
              <SectionHeading
                id="sell-documents-title"
                eyebrow={t("documentsEyebrow")}
                title={t("documentsHeading")}
                lede={fixTypography(t("documentsLede"))}
                size="h2"
              />
            </div>
            <div className="col-span-4 lg:col-span-7 lg:col-start-6">
              <Reveal as="dl" className="grid gap-x-8 md:grid-cols-2 md:[&>:last-child:nth-child(odd)]:col-span-2">
                {DOCUMENT_KEYS.map((key) => (
                  <div key={key} className="flex flex-col gap-2 border-t border-hairline-light py-6">
                    <dt className="font-display text-[1.375rem] leading-snug text-ink">
                      {fixTypography(t(`documents.${key}.title`))}
                    </dt>
                    <dd className="max-w-[44ch] text-pretty text-small text-stone-text">
                      {fixTypography(t(`documents.${key}.note`))}
                    </dd>
                  </div>
                ))}
              </Reveal>
              <p className="mt-8 max-w-[60ch] text-pretty text-small text-stone-text">
                {fixTypography(t("documentsNote"))}
              </p>
            </div>
          </Grid>
        </Container>
      </Section>

      <Section tone="ivory-2" id={FORM_ID} aria-labelledby="sell-form-title" className="scroll-mt-16">
        <Container>
          <Grid className="gap-y-14">
            <div className="col-span-4 lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
              <SectionHeading id="sell-form-title" eyebrow={t("formEyebrow")} title={t("formHeading")} size="h2" />
              <p className="mt-8 max-w-[44ch] border-l border-bronze pl-5 text-small text-stone-text">
                {fixTypography(t("formLede"))}
              </p>
            </div>
            <div className="col-span-4 border border-hairline-light bg-paper px-5 py-8 sm:p-10 lg:col-span-7 lg:col-start-6 xl:p-14">
              <SellForm groups={groups} {...(phone !== undefined ? { phone } : {})} />
            </div>
          </Grid>
        </Container>
      </Section>

      <FaqSection id="sell-faq-title" eyebrow={t("faqEyebrow")} heading={t("faqHeading")} items={copy.faq} />
    </>
  );
}
