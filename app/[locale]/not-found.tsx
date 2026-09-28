import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Shown for every `notFound()` inside a locale route (unknown slug, unpublished
 * listing) and for unmatched paths that the proxy rewrote under `/[locale]`.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("errors");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-ink px-gutter text-center text-ivory">
      <p className="font-mono text-label uppercase text-bronze">404</p>
      <h1 className="mt-6 font-display text-display-m font-normal">{t("notFoundHeading")}</h1>
      <p className="mt-5 max-w-[44ch] text-body text-mist">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="mt-10 border-b border-bronze pb-1 font-sans text-small uppercase tracking-[0.18em] text-ivory transition-colors duration-200 hover:text-bronze"
      >
        {t("notFoundCta")}
      </Link>
    </main>
  );
}
