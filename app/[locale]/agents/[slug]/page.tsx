import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AgentContacts } from "@/components/site/agents/AgentContacts";
import { AgentPortrait } from "@/components/site/agents/AgentPortrait";
import { agentRole, getAgentBySlug, languageList } from "@/components/site/agents/data";
import { Container } from "@/components/site/Container";
import { clipText } from "@/components/site/locations/data";
import { ListingGrid } from "@/components/site/locations/ListingGrid";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { breadcrumbJsonLd, type JsonLd } from "@/lib/jsonld";
import { pickL10n } from "@/lib/l10n";
import { getPublicSettings } from "@/lib/page-data";
import { localizedUrl, pageMetadata } from "@/lib/seo";

/**
 * An agent's profile (PRD A9): bio, the channels they gave the agency, their
 * languages and areas, the broker ID card number when it is set, their active
 * listings and the ones already sold or let. A hidden or unknown profile is a 404.
 */

type Params = PageProps<"/[locale]/agents/[slug]">["params"];

function hrefOf(slug: string) {
  return { pathname: "/agents/[slug]" as const, params: { slug } };
}

async function load(params: Params) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const detail = await getAgentBySlug(slug);
  if (detail === null) notFound();
  // The server's clock for the "Novo" badge on the cards, read once per request.
  return { locale, detail, now: Date.now() };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, detail } = await load(params);
  const { agent } = detail;
  const t = await getTranslations({ locale, namespace: "agents" });
  const role = agentRole(agent, locale).text;
  const bio = agent.bio !== undefined ? pickL10n(agent.bio, locale).text.trim() : "";
  return pageMetadata({
    locale,
    href: hrefOf(agent.slug),
    title: t("profileMetaTitle", { name: agent.name, role }),
    description: bio.length > 0 ? clipText(bio) : t("profileMetaFallback", { name: agent.name, role }),
    ...(agent.photoUrl !== undefined ? { image: agent.photoUrl } : {}),
  });
}

export default async function AgentPage({ params }: { params: Params }) {
  const { locale, detail, now } = await load(params);
  const { agent, active, closed } = detail;
  const [settings, t, tNav, tLocations, tCommon] = await Promise.all([
    getPublicSettings(),
    getTranslations({ locale, namespace: "agents" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "locations" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  const role = agentRole(agent, locale);
  const bio = agent.bio !== undefined ? pickL10n(agent.bio, locale) : null;
  const bioText = bio !== null && bio.text.trim().length > 0 ? bio : null;
  const pageUrl = localizedUrl(hrefOf(agent.slug), locale);
  const mortgage = settings !== null ? { mortgage: settings.mortgage } : {};

  const jsonLd: JsonLd[] = [
    breadcrumbJsonLd([
      { name: tNav("home"), url: localizedUrl("/", locale) },
      { name: tNav("agents"), url: localizedUrl("/agents", locale) },
      { name: agent.name, url: pageUrl },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${pageUrl}#person`,
      name: agent.name,
      jobTitle: role.text,
      url: pageUrl,
      ...(agent.photoUrl !== undefined ? { image: agent.photoUrl } : {}),
      ...(agent.languages.length > 0 ? { knowsLanguage: agent.languages } : {}),
      ...(bioText !== null ? { description: bioText.text } : {}),
      worksFor: {
        "@type": "RealEstateAgent",
        name: settings?.companyName ?? tCommon("brand"),
        url: localizedUrl("/", locale),
      },
    },
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <PageHero
        crumbs={[{ label: tNav("agents"), href: "/agents" }, { label: agent.name }]}
        eyebrow={<span lang={role.lang}>{role.text}</span>}
        title={agent.name}
        {...(bioText !== null ? { lede: bioText.text } : {})}
        {...(bioText !== null && bioText.lang !== locale ? { ledeLang: bioText.lang } : {})}
        aside={
          <AgentPortrait
            monogram={agent.monogram}
            {...(agent.photoUrl !== undefined ? { photoUrl: agent.photoUrl, alt: agent.name } : {})}
            tone="dark"
            priority
            sizes="(min-width: 1024px) 30vw, 92vw"
            // A monogram is two letters: on a phone it gets a band, not a whole screen.
            className={`${agent.photoUrl !== undefined ? "aspect-[4/5]" : "aspect-[2/1]"} w-full max-lg:max-w-sm lg:ml-auto lg:aspect-[4/5] lg:max-w-[26rem]`}
          />
        }
      >
        <AgentContacts agent={agent} locale={locale} />
      </PageHero>

      <section aria-labelledby="profile-title" className="bg-ivory py-section text-ink lg:py-28">
        <Container className="grid grid-cols-4 gap-x-6 gap-y-10 lg:grid-cols-12">
          <div className="col-span-4 lg:col-span-4">
            <SectionHeading id="profile-title" eyebrow={t("profileEyebrow")} title={t("profileHeading")} size="h2" />
          </div>
          <dl className="col-span-4 border-t border-hairline-light text-body lg:col-span-7 lg:col-start-6">
            {agent.languages.length > 0 ? (
              <DetailRow label={t("languages")}>{languageList(agent.languages, locale)}</DetailRow>
            ) : null}
            {agent.areas.length > 0 ? (
              <DetailRow label={t("areas")}>
                <ul className="flex flex-wrap gap-x-5 gap-y-1">
                  {agent.areas.map((area) => {
                    const name = pickL10n(area.name, locale);
                    return (
                      <li key={area._id}>
                        <Link
                          href={{ pathname: "/locations/[slug]", params: { slug: area.slug } }}
                          className={textLinkClasses("light")}
                        >
                          <span lang={name.lang !== locale ? name.lang : undefined}>{name.text}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </DetailRow>
            ) : null}
            {agent.licenseId !== undefined ? (
              <DetailRow label={t("license")}>
                <span data-numeric="" className="font-mono text-small">
                  {agent.licenseId}
                </span>
              </DetailRow>
            ) : null}
            {agent.email !== undefined ? (
              <DetailRow label={t("email")}>
                <a href={`mailto:${agent.email}`} className={textLinkClasses("light", "break-all")}>
                  {agent.email}
                </a>
              </DetailRow>
            ) : null}
          </dl>
        </Container>
      </section>

      <section
        data-testid="agent-listings"
        aria-labelledby="active-title"
        className="bg-ivory-2 py-section text-ink lg:py-section-lg"
      >
        <Container>
          <SectionHeading
            id="active-title"
            eyebrow={active.length > 0 ? tLocations("count", { count: active.length }) : tLocations("noOffers")}
            title={t("listingsHeading")}
          />
          {active.length > 0 ? (
            <div className="mt-12 lg:mt-16">
              <ListingGrid listings={active} now={now} {...mortgage} />
            </div>
          ) : (
            <div className="mt-10 max-w-[56ch] border-t border-hairline-light pt-8">
              <p className="text-pretty text-body-l text-stone-text">{fixTypography(t("listingsEmpty"))}</p>
              <Link
                href="/properties"
                className={textLinkClasses("light", "group/all mt-6 inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]")}
              >
                {t("listingsAll")}
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.25}
                  className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/all:translate-x-1"
                />
              </Link>
            </div>
          )}
        </Container>
      </section>

      {closed.length > 0 ? (
        <section aria-labelledby="closed-title" className="bg-ivory py-section text-ink lg:py-section-lg">
          <Container>
            <SectionHeading
              id="closed-title"
              eyebrow={t("closedEyebrow")}
              title={t("closedHeading")}
              lede={t("closedLede")}
            />
            <div className="mt-12 lg:mt-16">
              <ListingGrid listings={closed} now={now} />
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-hairline-light py-5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-6">
      <dt className="font-mono text-label uppercase text-stone-text sm:pt-1">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
