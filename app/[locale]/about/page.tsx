import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { AboutNumbers, type AboutStat } from "@/components/site/about/AboutNumbers";
import { OfficeSection } from "@/components/site/about/OfficeSection";
import { ValuesList } from "@/components/site/about/ValuesList";
import { AgentCard } from "@/components/site/agents/AgentCard";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { Straddle } from "@/components/site/locations/Straddle";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { RichText } from "@/components/site/page/RichText";
import { Picture } from "@/components/site/Picture";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import { htmlLang, routing, type Locale } from "@/i18n/routing";
import { findBlock, HOME_BLOCKS, localizedText, type PublicPage } from "@/lib/content/pages";
import { fillPlaceholders, placeholderValues } from "@/lib/content/placeholders";
import { agencyRef, breadcrumbJsonLd, type JsonLd } from "@/lib/jsonld";
import { pickL10n, pickL10nList } from "@/lib/l10n";
import { artImage, mediaImage } from "@/lib/media";
import { getAgents, getPublicSettings, getSitePage } from "@/lib/page-data";
import { absoluteUrl, localizedUrl, pageMetadata, siteOrigin } from "@/lib/seo";

/**
 * About (PRD A10). The story, values and method are the managed blocks of
 * `pages.about` (Sadržaj sajta), with the agency's registered data filled into
 * their `{{placeholders}}`; the figures are the landing's `numbers` block, the
 * single source of the agency's numbers, flagged while they are demo values.
 * Then a team teaser, the office on the map and the compliance block from
 * Podešavanja. A missing block drops its section instead of inventing copy.
 */

/** "Ornate historic facades and a street lamp in central Belgrade" (docs/assets/demo-media.json). */
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1655245934655-bde35a9dae80";

const TEAM_TEASER = 4;

/** A managed text with `lang` set only when it fell back to Serbian. */
function managed(value: Parameters<typeof localizedText>[0], locale: Locale): { text: string; lang?: string } | null {
  const text = localizedText(value, locale);
  if (text === null) return null;
  return text.lang !== locale ? text : { text: text.text };
}

function stats(home: PublicPage | null, settingsStats: readonly AboutStatSource[], locale: Locale): AboutStat[] {
  const block = findBlock(home, HOME_BLOCKS.numbers.key, HOME_BLOCKS.numbers.type);
  return (block?.items ?? settingsStats).map((stat) => {
    const label = pickL10n(stat.label, locale);
    return {
      value: stat.value,
      label: label.lang !== locale ? { text: label.text, lang: label.lang } : { text: label.text },
      isDemo: stat.isDemo,
    };
  });
}

type AboutStatSource = { value: string; label: Parameters<typeof pickL10n>[0]; isDemo: boolean };

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "about" });
  const image = mediaImage("about");
  return pageMetadata({
    locale,
    href: "/about",
    title: t("metaTitle"),
    description: t("metaDescription"),
    ...(image !== null ? { image: absoluteUrl(image.fallback) } : {}),
  });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [page, home, settings, agents, t, tNav, tHome] = await Promise.all([
    getSitePage("about"),
    getSitePage("home"),
    getPublicSettings(),
    getAgents(),
    getTranslations({ locale, namespace: "about" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "home" }),
  ]);

  const values = placeholderValues(settings);
  const story = findBlock(page, "story", "richText");
  const valuesBlock = findBlock(page, "values", "list");
  const method = findBlock(page, "method", "richText");

  const storyTitle = managed(story?.title, locale);
  const storyBody = story?.body !== undefined ? pickL10n(story.body, locale) : null;
  const valuesTitle = managed(valuesBlock?.title, locale);
  const valueItems = valuesBlock !== undefined ? pickL10nList(valuesBlock.items, locale) : null;
  const methodTitle = managed(method?.title, locale);
  const methodBody = method?.body !== undefined ? pickL10n(method.body, locale) : null;

  const numbers = stats(home, settings?.stats ?? [], locale);
  const numbersTitle =
    managed(findBlock(home, HOME_BLOCKS.numbers.key, HOME_BLOCKS.numbers.type)?.title, locale) ?? {
      text: tHome("numbersHeading"),
    };
  const team = agents.slice(0, TEAM_TEASER);

  const art = mediaImage("about");
  const pageUrl = localizedUrl("/about", locale);

  const hasStory = storyBody !== null && storyBody.text.trim().length > 0;
  const hasValues = valueItems !== null && valueItems.items.some((item) => item.trim().length > 0);
  const hasMethod = methodBody !== null && methodBody.text.trim().length > 0;
  // Section numbers follow what is actually on the page.
  const shown = [
    hasStory ? "story" : null,
    hasValues ? "values" : null,
    hasMethod ? "method" : null,
    numbers.length > 0 ? "numbers" : null,
    team.length > 0 ? "team" : null,
    settings !== null ? "office" : null,
  ].filter((key) => key !== null);
  const indexOf = (key: string) => shown.indexOf(key) + 1;

  const jsonLd: JsonLd[] = [
    breadcrumbJsonLd([
      { name: tNav("home"), url: localizedUrl("/", locale) },
      { name: tNav("about"), url: pageUrl },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "@id": `${pageUrl}#page`,
      url: pageUrl,
      name: storyTitle?.text ?? t("heading"),
      inLanguage: htmlLang[locale],
      ...(settings !== null
        ? {
            mainEntity: agencyRef(siteOrigin(), settings.companyName),
          }
        : {}),
    },
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <PageHero
        crumbs={[{ label: tNav("about") }]}
        eyebrow={t("eyebrow")}
        title={storyTitle?.text ?? t("heading")}
        {...(storyTitle?.lang !== undefined ? { titleLang: storyTitle.lang } : {})}
        lede={t("lede")}
      />

      <Straddle>
        <ClipReveal from="bottom" className="relative aspect-[4/3] overflow-hidden md:aspect-[21/9]">
          <Picture
            image={artImage("about", FALLBACK_IMAGE)}
            alt={art !== null ? t("imageAlt") : ""}
            sizes="(min-width: 1440px) 1344px, 94vw"
            className="absolute inset-0"
            // The carved balconies sit in the right half of the facade.
            imgClassName="object-[70%_50%]"
          />
        </ClipReveal>
      </Straddle>

      {hasStory && storyBody !== null ? (
        <div className="bg-ivory py-section text-ink lg:py-section-lg">
          <Container className="grid grid-cols-4 gap-x-6 gap-y-8 lg:grid-cols-12">
            <div className="col-span-4 lg:col-span-4">
              <Eyebrow index={indexOf("story")} className="lg:sticky lg:top-28">
                {t("storyEyebrow")}
              </Eyebrow>
            </div>
            <RichText
              html={fillPlaceholders(storyBody.text, values)}
              lang={storyBody.lang}
              size="body-l"
              // The opening paragraph is the story's thesis, set as a serif lead.
              className="col-span-4 lg:col-span-7 lg:col-start-6 [&>p:first-child]:font-display [&>p:first-child]:text-[clamp(1.5rem,2.2vw,2rem)] [&>p:first-child]:leading-[1.3]"
            />
          </Container>
        </div>
      ) : null}

      {hasValues && valueItems !== null ? (
        <section aria-labelledby="values-title" className="bg-ink py-section text-ivory lg:py-section-lg">
          <Container>
            <SectionHeading
              id="values-title"
              tone="dark"
              eyebrow={t("valuesEyebrow")}
              eyebrowIndex={indexOf("values")}
              title={
                valuesTitle?.lang !== undefined ? (
                  <span lang={valuesTitle.lang}>{valuesTitle.text}</span>
                ) : (
                  (valuesTitle?.text ?? t("valuesHeading"))
                )
              }
            />
            <div className="mt-14 lg:mt-20">
              <ValuesList
                items={valueItems.items.map((item) => fillPlaceholders(item, values, false))}
                {...(valueItems.lang !== locale ? { lang: valueItems.lang } : {})}
              />
            </div>
          </Container>
        </section>
      ) : null}

      {hasMethod && methodBody !== null ? (
        <section aria-labelledby="method-title" className="bg-ivory py-section text-ink lg:py-section-lg">
          <Container className="grid grid-cols-4 gap-x-6 gap-y-10 lg:grid-cols-12">
            <div className="col-span-4 lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <SectionHeading
                  id="method-title"
                  eyebrow={t("methodEyebrow")}
                  eyebrowIndex={indexOf("method")}
                  title={
                    methodTitle?.lang !== undefined ? (
                      <span lang={methodTitle.lang}>{methodTitle.text}</span>
                    ) : (
                      (methodTitle?.text ?? t("methodHeading"))
                    )
                  }
                />
              </div>
            </div>
            <RichText
              html={fillPlaceholders(methodBody.text, values)}
              lang={methodBody.lang}
              size="body-l"
              className="col-span-4 lg:col-span-7 lg:col-start-6"
            />
          </Container>
        </section>
      ) : null}

      {numbers.length > 0 ? (
        <section aria-labelledby="numbers-title" className="bg-ivory-2 py-section text-ink lg:py-section-lg">
          <Container>
            <SectionHeading
              id="numbers-title"
              eyebrow={t("numbersEyebrow")}
              eyebrowIndex={indexOf("numbers")}
              title={
                numbersTitle.lang !== undefined ? (
                  <span lang={numbersTitle.lang}>{numbersTitle.text}</span>
                ) : (
                  numbersTitle.text
                )
              }
            />
            <div className="mt-12 lg:mt-16">
              <AboutNumbers stats={numbers} demoNote={tHome("numbersDemo")} />
            </div>
          </Container>
        </section>
      ) : null}

      {team.length > 0 ? (
        <section aria-labelledby="team-title" className="bg-ivory py-section text-ink lg:py-section-lg">
          <Container>
            <SectionHeading
              id="team-title"
              eyebrow={t("teamEyebrow")}
              eyebrowIndex={indexOf("team")}
              title={t("teamHeading")}
              action={
                <Link
                  href="/agents"
                  className={textLinkClasses("light", "group/team inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]")}
                >
                  {t("teamAll")}
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={1.25}
                    className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/team:translate-x-1"
                  />
                </Link>
              }
            />
            <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 lg:mt-16 lg:grid-cols-4">
              {team.map((agent) => (
                <li key={agent._id}>
                  <AgentCard agent={agent} locale={locale} variant="teaser" headingLevel={3} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {settings !== null ? <OfficeSection settings={settings} locale={locale} index={indexOf("office")} /> : null}
    </>
  );
}
