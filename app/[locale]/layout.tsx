import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { fontVariables } from "@/app/fonts";
import { PageTransition } from "@/components/motion/PageTransition";
import { Preloader } from "@/components/motion/Preloader";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { CookieConsent } from "@/components/site/CookieConsent";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { validSlots } from "@/components/site/contact/hours";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { SkipLink } from "@/components/site/SkipLink";
import { getPathname } from "@/i18n/navigation";
import { htmlLang, locales, routing, type Locale } from "@/i18n/routing";
import { agencyJsonLd } from "@/lib/jsonld";
import { getPublicSettings } from "@/lib/page-data";
import { absoluteUrl, defaultShareImage, siteOrigin } from "@/lib/seo";
import "@/app/globals.css";

/** Resting states for everything the motion layer starts hidden. */
const NO_SCRIPT_CSS =
  "[data-hero-reveal],[data-split]{opacity:1!important}[data-image-reveal]{clip-path:none!important}[data-hero-frame]{transform:none!important}";

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
  colorScheme: "light",
};

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "seo" });

  return {
    metadataBase: new URL(siteOrigin()),
    title: {
      default: t("defaultTitle"),
      template: t("titleTemplate", { title: "%s" }),
    },
    description: t("defaultDescription"),
  };
}

/**
 * The sitewide `RealEstateAgent` node (ARCHITECTURE §9) from the public
 * settings; nothing is rendered until the settings exist.
 */
async function AgencyJsonLd({ locale }: { locale: Locale }) {
  const settings = await getPublicSettings();
  if (settings === null) return null;
  const socials = Object.values(settings.socials).filter((url): url is string => url !== undefined && url.length > 0);
  return (
    <JsonLdScript
      data={agencyJsonLd({
        origin: siteOrigin(),
        url: absoluteUrl(getPathname({ locale, href: "/" })),
        inLanguage: htmlLang[locale],
        name: settings.companyName,
        legalName: settings.legalName,
        address: settings.address,
        taxId: settings.pib,
        companyId: settings.mb,
        registryNo: settings.registryNo,
        ...(settings.phones[0] !== undefined ? { phone: settings.phones[0] } : {}),
        email: settings.email,
        logo: absoluteUrl("/apple-icon.png"),
        image: settings.seo.ogImageUrl ?? defaultShareImage(locale).url,
        ...(settings.officeLat !== undefined && settings.officeLng !== undefined
          ? { geo: { lat: settings.officeLat, lng: settings.officeLng } }
          : {}),
        hours: validSlots(settings.officeHours),
        sameAs: socials,
      })}
    />
  );
}

/**
 * PUBLIC root layout (root layout #1). There is deliberately no
 * `app/layout.tsx`: the admin panel has its own root at `app/admin/layout.tsx`
 * with a different `lang`, no Lenis and no GSAP.
 *
 * Shell order matters:
 *  - `SkipLink` is the first focusable element on the page (WCAG 2.4.1);
 *  - `Preloader` and `PageTransition` own the two curtain moments and both
 *    render nothing at all under `prefers-reduced-motion: reduce`;
 *  - `<main id="main">` lives here so every route has the skip-link target and
 *    no page has to remember it;
 *  - `CookieConsent` is last in the DOM so an undecided visitor still tabs
 *    through the page in reading order before reaching the banner.
 */
export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages({ locale });

  return (
    // The preloader gate script writes `data-intro` onto <html> before React
    // hydrates it, so the attribute is expected to differ from the server tree.
    <html lang={htmlLang[locale]} className={fontVariables} suppressHydrationWarning>
      <body>
        {/* Without JavaScript nothing may stay in its pre-animation state. */}
        <noscript dangerouslySetInnerHTML={{ __html: `<style>${NO_SCRIPT_CSS}</style>` }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ConvexClientProvider>
            <SmoothScroll>
              <Preloader />
              <SkipLink />
              <Header />
              <PageTransition>
                <main id="main">{children}</main>
                <Footer />
              </PageTransition>
              <CookieConsent />
            </SmoothScroll>
            <AgencyJsonLd locale={locale} />
          </ConvexClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
