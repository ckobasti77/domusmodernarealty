import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ListingMapLoader } from "@/components/map/ListingMapLoader";
import { Reveal } from "@/components/motion/Reveal";
import { ContactChannels } from "@/components/site/contact/ContactChannels";
import { ContactForm } from "@/components/site/contact/ContactForm";
import { FaqSection } from "@/components/site/contact/FaqSection";
import { managedFaq, managedIntro } from "@/components/site/contact/managed";
import { OfficeDetails } from "@/components/site/contact/OfficeDetails";
import { prefillMessage } from "@/components/site/contact/prefill";
import { Container, Grid, Section } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { RichText } from "@/components/site/page/RichText";
import { htmlLang, routing } from "@/i18n/routing";
import { placeholderValues } from "@/lib/content/placeholders";
import { fixTypography } from "@/lib/format";
import { agencyRef, breadcrumbJsonLd } from "@/lib/jsonld";
import { getPublicSettings, getSitePage } from "@/lib/page-data";
import { localizedUrl, pageMetadata, siteOrigin } from "@/lib/seo";

/**
 * Contact (PRD A10): every channel in the band, the general contact form
 * (lead type `general`), the office with its hours and map, and the managed
 * questions. Channels, address, hours and the map pin all come from Settings,
 * so the owner edits them once; a channel that is not set is not shown, and
 * the map is left out until the office has coordinates. A `?message=` (the
 * empty search result's call to action) pre-fills the form.
 */

type Props = PageProps<"/[locale]/contact">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({ locale, href: "/contact", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function ContactPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, tNav, page, settings, query] = await Promise.all([
    getTranslations({ locale, namespace: "contact" }),
    getTranslations({ locale, namespace: "nav" }),
    getSitePage("contact"),
    getPublicSettings(),
    searchParams,
  ]);

  const values = placeholderValues(settings);
  const intro = managedIntro(page, locale, values);
  const title = intro?.title ?? { text: t("heading") };
  // The managed opening paragraph carries the channels and the one reply-time
  // promise; without it the built-in lede says the same.
  const lede = intro?.lead ?? { text: t("lede") };
  const faq = managedFaq(page, locale, values);

  const geo =
    settings?.officeLat !== undefined && settings.officeLng !== undefined
      ? { lat: settings.officeLat, lng: settings.officeLng }
      : undefined;

  const jsonLd = [
    breadcrumbJsonLd([
      { name: tNav("home"), url: localizedUrl("/", locale) },
      { name: title.text, url: localizedUrl("/contact", locale) },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      url: localizedUrl("/contact", locale),
      name: title.text,
      inLanguage: htmlLang[locale],
      // The agency node itself (address, hours, registry number) is the
      // sitewide block the locale layout renders on every page.
      ...(settings !== null ? { mainEntity: agencyRef(siteOrigin(), settings.companyName) } : {}),
    },
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />

      <PageHero
        crumbs={[{ label: tNav("contact") }]}
        eyebrow={t("eyebrow")}
        title={title.text}
        titleLang={title.lang}
        lede={lede.text}
        ledeLang={lede.lang}
        aside={
          settings !== null ? (
            <Reveal skipInView stagger={0}>
              <ContactChannels
                locale={locale}
                phones={settings.phones}
                email={settings.email}
                {...(settings.viber !== undefined ? { viber: settings.viber } : {})}
                {...(settings.whatsapp !== undefined ? { whatsapp: settings.whatsapp } : {})}
              />
            </Reveal>
          ) : undefined
        }
      />

      <Section tone="ivory" aria-labelledby="contact-form-title">
        <Container>
          <Grid className="gap-y-14">
            <div className="col-span-4 lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
              <SectionHeading id="contact-form-title" eyebrow={t("formEyebrow")} title={t("formHeading")} size="h2" />
              {intro?.rest !== null && intro?.rest !== undefined ? (
                <RichText html={intro.rest.html} lang={intro.rest.lang} className="mt-8 text-stone-text" />
              ) : null}
              <p className="mt-8 max-w-[44ch] border-l border-bronze pl-5 text-small text-stone-text">
                {fixTypography(t("formLede"))}
              </p>
            </div>
            {/* Column 6 is the page's right-hand spine: the form, the map and
                the questions all start on it, as on the sell page. */}
            <div className="col-span-4 lg:col-span-7 lg:col-start-6">
              <ContactForm initialMessage={prefillMessage(query.message)} />
            </div>
          </Grid>
        </Container>
      </Section>

      {settings !== null ? (
        <Section tone="ivory-2" aria-labelledby="contact-office-title">
          <Container>
            <Grid className="gap-y-12 lg:items-start">
              <div className="col-span-4 lg:col-span-4">
                <SectionHeading
                  id="contact-office-title"
                  eyebrow={t("officeHeading")}
                  title={t("visitHeading")}
                  size="h2"
                />
                <div className="mt-10">
                  <OfficeDetails
                    locale={locale}
                    address={settings.address}
                    hours={settings.officeHours}
                    {...(geo !== undefined ? { geo } : {})}
                  />
                </div>
              </div>
              {geo !== undefined ? (
                <figure className="col-span-4 self-start border border-hairline-light lg:col-span-7 lg:col-start-6">
                  <ListingMapLoader lat={geo.lat} lng={geo.lng} precision="exact" locale={locale} />
                  <figcaption className="sr-only">{t("mapLabel")}</figcaption>
                </figure>
              ) : null}
            </Grid>
          </Container>
        </Section>
      ) : null}

      <FaqSection id="contact-faq-title" eyebrow={t("faqEyebrow")} heading={t("faqHeading")} items={faq} />
    </>
  );
}
