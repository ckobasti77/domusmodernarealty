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
import { SkipLink } from "@/components/site/SkipLink";
import { htmlLang, locales, routing } from "@/i18n/routing";
import "@/app/globals.css";

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
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: {
      default: t("defaultTitle"),
      template: t("titleTemplate", { title: "%s" }),
    },
    description: t("defaultDescription"),
  };
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
    <html lang={htmlLang[locale]} className={fontVariables}>
      <body>
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
          </ConvexClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
