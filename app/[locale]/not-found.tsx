import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ErrorScreen } from "@/components/site/errors/ErrorScreen";
import { errorLinks } from "@/components/site/errors/links";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Next resolves a not-found file's own metadata when it renders it, so the tab
 * reads "Stranica nije nađena — Mihajlo Estate" (the layout's template adds the
 * brand). Next adds `noindex` to every 404 response by itself.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors");
  return { title: t("notFoundHeading") };
}

/**
 * Shown for every `notFound()` inside a locale route: an unknown or withdrawn
 * listing slug, an unknown neighborhood, agent or article. It renders inside
 * the locale layout, so the header, the footer and `<main id="main">` are
 * already there; this file only fills the page.
 */
export default async function LocaleNotFound() {
  const locale = (await getLocale()) as Locale;
  const [t, tSearch, tNav] = await Promise.all([
    getTranslations("errors"),
    getTranslations("search"),
    getTranslations("nav"),
  ]);

  return (
    <ErrorScreen
      code="404"
      eyebrow={t("notFoundHeading")}
      title={t("notFoundTitle")}
      body={
        <>
          <p>{t("notFoundBody")}</p>
          <p className="mt-3">{t("notFoundHint")}</p>
        </>
      }
      search={{
        action: getPathname({ locale, href: "/properties" }),
        label: t("searchLabel"),
        placeholder: tSearch("queryPlaceholder"),
        submit: t("searchSubmit"),
        testId: "notfound-search",
      }}
      linksHeading={t("popularHeading")}
      links={errorLinks(locale, { search: tSearch, nav: tNav })}
    />
  );
}
