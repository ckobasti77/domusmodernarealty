import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { formatLongDate, isoDate } from "@/components/site/journal/shared";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { RichText } from "@/components/site/page/RichText";
import { textLinkClasses } from "@/components/site/TextLink";
import type { PageBlock } from "@/convex/lib/validators";
import { htmlLang, type Locale } from "@/i18n/routing";
import { fillPlaceholders, placeholderValues } from "@/lib/content/placeholders";
import { fixTypography } from "@/lib/format";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pickL10n } from "@/lib/l10n";
import { getPublicSettings, getSitePage } from "@/lib/page-data";
import { localizedUrl, pageMetadata } from "@/lib/seo";
import { CookieCategories } from "./CookieCategories";

/**
 * The three legal pages (PRD A13) share this one renderer: privacy, terms of
 * business and the cookie policy are all a list of titled rich-text sections
 * from the admin (`pages` table), with the agency's registered data filled in
 * from Podešavanja, a table of contents and the date of the last edit.
 *
 * The seeded documents open with a `notice` block — "NACRT — proveriti sa
 * pravnikom pre objave". That marker is for the staff and is shown in the
 * admin only: the public page renders every rich-text block EXCEPT `notice`.
 *
 * Each page adds what it owes on its own: the terms show the commission
 * summary and the general-terms PDF from the settings plus the broker's
 * registered details (Art. 18); the cookie policy lists the banner's three
 * categories with the visitor's current choice and a way to change it. When a
 * page document is missing, those parts still render under a short notice.
 */

export type LegalKey = "privacy" | "terms" | "cookies";

const NOTICE_KEY = "notice";

const COPY = {
  privacy: { heading: "privacyHeading", lede: "privacyLede", href: "/privacy" },
  terms: { heading: "termsHeading", lede: "termsLede", href: "/terms" },
  cookies: { heading: "cookiesHeading", lede: "cookiesLede", href: "/cookies" },
} as const satisfies Record<LegalKey, { heading: string; lede: string; href: string }>;

type RichTextBlock = Extract<PageBlock, { type: "richText" }>;

type LegalSection = {
  id: string;
  /** Untitled blocks render without a heading and stay out of the contents. */
  title?: { text: string; lang?: string };
  testId?: string;
  content: ReactNode;
};

/** `legalBasis` → `legal-basis`: stable, readable anchors from the block keys. */
function anchorOf(key: string, taken: Set<string>): string {
  const base =
    key
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function pad(index: number): string {
  return String(index).padStart(2, "0");
}

export async function legalMetadata(key: LegalKey, locale: Locale): Promise<Metadata> {
  const [page, t] = await Promise.all([getSitePage(key), getTranslations({ locale, namespace: "legal" })]);
  const seo = page?.seo;
  const image = seo?.ogImage?.kind === "url" ? seo.ogImage.url : undefined;
  return pageMetadata({
    locale,
    href: COPY[key].href,
    title: seo?.metaTitle !== undefined ? pickL10n(seo.metaTitle, locale).text : t(COPY[key].heading),
    description: seo?.metaDescription !== undefined ? pickL10n(seo.metaDescription, locale).text : t(COPY[key].lede),
    ...(image !== undefined ? { image } : {}),
  });
}

export async function LegalDocument({ pageKey, locale }: { pageKey: LegalKey; locale: Locale }) {
  const [page, settings, t, tNav] = await Promise.all([
    getSitePage(pageKey),
    getPublicSettings(),
    getTranslations({ locale, namespace: "legal" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  const copy = COPY[pageKey];
  const heading = t(copy.heading);
  const values = placeholderValues(settings);
  const lang = htmlLang[locale];
  const foreign = (picked: { lang: string }) => (picked.lang !== lang ? picked.lang : undefined);

  const blocks = (page?.blocks ?? []).filter(
    (block): block is RichTextBlock => block.type === "richText" && block.key !== NOTICE_KEY,
  );

  /* ----------------------------------------------------- page-specific parts */
  const commission = settings !== null ? pickL10n(settings.commissionText, locale) : null;
  const commissionText = commission !== null && commission.text.trim().length > 0 ? commission : null;
  const commissionSummary = (titled: boolean) =>
    commissionText !== null ? (
      <div className={titled ? "mt-10 border-l border-bronze pl-6 lg:pl-8" : undefined}>
        {titled ? <h3 className="font-display text-h3 font-normal">{t("commission.summary")}</h3> : null}
        <p lang={foreign(commissionText)} className={titled ? "mt-3 max-w-[60ch] text-pretty text-body-l" : "max-w-[60ch] text-pretty text-body-l"}>
          {fixTypography(commissionText.text)}
        </p>
      </div>
    ) : null;

  /* ---------------------------------------------------------------- sections */
  const taken = new Set<string>();
  const sections: LegalSection[] = blocks.map((block) => {
    const title = block.title !== undefined ? pickL10n(block.title, locale) : null;
    const body = pickL10n(block.body, locale);
    const titleText = title !== null ? fillPlaceholders(title.text, values, false).trim() : "";
    return {
      id: anchorOf(block.key, taken),
      ...(titleText.length > 0 && title !== null ? { title: { text: titleText, lang: foreign(title) } } : {}),
      testId: "legal-section",
      content: (
        <>
          <RichText html={fillPlaceholders(body.text, values)} profile="page" lang={foreign(body)} />
          {pageKey === "terms" && block.key === "commission" ? commissionSummary(true) : null}
        </>
      ),
    };
  });

  if (pageKey === "terms" && commissionText !== null && !blocks.some((block) => block.key === "commission")) {
    sections.push({
      id: anchorOf("commission", taken),
      title: { text: t("commission.heading") },
      content: commissionSummary(false),
    });
  }

  if (pageKey === "cookies") {
    const choices: LegalSection = {
      id: anchorOf("your-consent", taken),
      title: { text: t("cookieChoices.heading") },
      content: (
        <>
          <p className="mb-10 max-w-[60ch] text-pretty text-body-l">{t("cookieChoices.lede")}</p>
          <CookieCategories />
        </>
      ),
    };
    // Right after the policy's own description of the categories, if it has one.
    const after = blocks.findIndex((block) => block.key === "categories");
    sections.splice(after === -1 ? sections.length : after + 1, 0, choices);
  }

  if (pageKey === "terms" && settings !== null) {
    const rows: { label: string; value: ReactNode }[] = [
      { label: t("agency.legalName"), value: settings.legalName },
      { label: t("agency.address"), value: settings.address },
      { label: t("agency.registryNo"), value: <span data-numeric>{settings.registryNo}</span> },
      { label: t("agency.pib"), value: <span data-numeric>{settings.pib}</span> },
      { label: t("agency.mb"), value: <span data-numeric>{settings.mb}</span> },
      {
        label: t("agency.email"),
        value: (
          <a href={`mailto:${settings.email}`} className={textLinkClasses("light")}>
            {settings.email}
          </a>
        ),
      },
    ];
    sections.push({
      id: anchorOf("broker", taken),
      title: { text: t("agency.heading") },
      content: (
        <>
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="hairline-t py-4">
                <dt className="eyebrow text-stone-text">{row.label}</dt>
                <dd className="mt-2 text-body">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-[60ch] text-pretty text-small text-stone-text">{t("complianceNote")}</p>
        </>
      ),
    });
  }

  const contents = sections.flatMap((section) => (section.title !== undefined ? [section] : []));
  const pdfUrl = pageKey === "terms" ? settings?.termsPdfUrl : undefined;

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: tNav("home"), url: localizedUrl("/", locale) },
          { name: heading, url: localizedUrl(copy.href, locale) },
        ])}
      />
      <PageHero crumbs={[{ label: heading }]} eyebrow={t("eyebrow")} title={heading} lede={t(copy.lede)} size="display-m">
        {page !== null || pdfUrl !== undefined ? (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            {page !== null ? (
              <p className="font-mono text-label uppercase text-mist">
                <time dateTime={isoDate(page.updatedAt)}>
                  {t("lastUpdated", { date: formatLongDate(page.updatedAt, locale) })}
                </time>
              </p>
            ) : null}
            {pdfUrl !== undefined ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: "outlineDark", size: "compact" })}
              >
                {t("termsPdf")}
              </a>
            ) : null}
          </div>
        ) : null}
      </PageHero>

      <div className="bg-ivory text-ink">
        <Container className="pb-section pt-14 lg:pb-section-lg lg:pt-24">
          <div className="grid grid-cols-4 gap-x-6 gap-y-14 lg:grid-cols-12">
            {contents.length > 1 ? (
              <aside className="col-span-4 lg:sticky lg:top-[calc(var(--header-h,85px)+2.5rem)] lg:col-span-3 lg:self-start">
                <nav aria-labelledby="legal-contents">
                  <p id="legal-contents" className="eyebrow text-stone-text">
                    {t("tocHeading")}
                  </p>
                  <ol className="mt-5 hairline-t">
                    {contents.map((section, index) => (
                      <li key={section.id} className="hairline-b">
                        <a
                          href={`#${section.id}`}
                          lang={section.title?.lang}
                          className="flex min-h-11 items-baseline gap-4 py-3 text-small text-ink transition-colors duration-200 pointer-fine:hover:text-bronze-text"
                        >
                          <span aria-hidden="true" data-numeric className="font-mono text-label text-stone-text">
                            {pad(index + 1)}
                          </span>
                          <span>{section.title?.text}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
            ) : null}

            <div className="col-span-4 lg:col-span-8 lg:col-start-5">
              {blocks.length === 0 ? (
                <div className="mb-14 border-l border-bronze pl-6 lg:pl-8">
                  <p className="max-w-[40ch] font-display text-h3 font-normal">{t("unavailable")}</p>
                  {settings !== null && settings.email.length > 0 ? (
                    <p className="mt-3 text-body-l text-stone-text">
                      {t.rich("unavailableContact", {
                        email: settings.email,
                        link: (chunks) => (
                          <a href={`mailto:${settings.email}`} className={textLinkClasses("light")}>
                            {chunks}
                          </a>
                        ),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {sections.map((section) => {
                const number = contents.indexOf(section) + 1;
                return (
                  <section
                    key={section.id}
                    id={section.id}
                    aria-labelledby={section.title !== undefined ? `${section.id}-title` : undefined}
                    data-testid={section.testId}
                    className="scroll-mt-28 hairline-t py-12 first:border-t-0 first:pt-0 last:pb-0 lg:py-16"
                  >
                    {section.title !== undefined ? (
                      <>
                        <p aria-hidden="true" data-numeric className="font-mono text-label text-bronze-text">
                          {pad(number)}
                        </p>
                        <h2
                          id={`${section.id}-title`}
                          lang={section.title.lang}
                          className="mt-3 max-w-[30ch] text-balance font-display text-h2 font-normal"
                        >
                          {section.title.text}
                        </h2>
                      </>
                    ) : null}
                    <div className={section.title !== undefined ? "mt-8" : undefined}>{section.content}</div>
                  </section>
                );
              })}
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
