import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { fontVariables } from "@/app/fonts";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
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
            <SmoothScroll>{children}</SmoothScroll>
          </ConvexClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
