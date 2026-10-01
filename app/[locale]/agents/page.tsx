import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AgentCard } from "@/components/site/agents/AgentCard";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { fixTypography, fixWidows } from "@/lib/format";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { getAgents } from "@/lib/page-data";
import { localizedUrl, pageMetadata } from "@/lib/seo";

/**
 * The team (PRD A9): every public agent in the admin's order, each with a
 * photograph or a monogram (never a stock face), role, languages and areas,
 * linking to the profile. Closes with the office as the fallback contact.
 */

export async function generateMetadata({ params }: PageProps<"/[locale]/agents">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "agents" });
  return pageMetadata({
    locale,
    href: "/agents",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function AgentsPage({ params }: PageProps<"/[locale]/agents">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [agents, t, tNav] = await Promise.all([
    getAgents(),
    getTranslations({ locale, namespace: "agents" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  const jsonLd = breadcrumbJsonLd([
    { name: tNav("home"), url: localizedUrl("/", locale) },
    { name: tNav("agents"), url: localizedUrl("/agents", locale) },
  ]);

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <PageHero crumbs={[{ label: tNav("agents") }]} eyebrow={t("eyebrow")} title={t("heading")} lede={t("lede")} />

      <section aria-label={tNav("agents")} className="bg-ivory py-section text-ink lg:py-section-lg">
        <Container>
          {agents.length > 0 ? (
            <ul className="grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-20">
              {agents.map((agent) => (
                <li key={agent._id}>
                  <AgentCard agent={agent} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="max-w-[52ch] text-body-l text-stone-text">{fixTypography(t("empty"))}</p>
          )}
        </Container>
      </section>

      <section aria-labelledby="team-cta-title" className="bg-ivory-2 py-section text-ink lg:py-28">
        <Container className="grid grid-cols-4 gap-x-6 gap-y-8 lg:grid-cols-12 lg:items-end">
          <div className="col-span-4 lg:col-span-7">
            <h2 id="team-cta-title" className="max-w-[20ch] font-display text-display-m font-normal">
              {fixWidows(t("ctaHeading"))}
            </h2>
            <p className="mt-6 max-w-[52ch] text-pretty text-body-l text-stone-text">
              {fixTypography(`${t("ctaBody")} ${t("replyPromise")}`)}
            </p>
          </div>
          <div className="col-span-4 lg:col-span-4 lg:col-start-9 lg:justify-self-end">
            <Link href="/contact" className={buttonClasses({ variant: "primary" })}>
              <span className="transition-transform duration-200 ease-out pointer-fine:group-hover/btn:-translate-y-[2px]">
                {t("ctaLink")}
              </span>
              <ArrowRight aria-hidden="true" strokeWidth={1.25} className="size-4" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
