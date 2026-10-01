"use client";

import { RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { buttonClasses } from "@/components/site/Button";
import { ErrorScreen } from "@/components/site/errors/ErrorScreen";
import { errorLinks } from "@/components/site/errors/links";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Localized error boundary for every public page. It renders inside the locale
 * layout (header, footer and `<main id="main">` stay), so a failure in one
 * page never takes the navigation with it. `retry` (stable since Next 16.3)
 * re-fetches and re-renders the failed segment.
 *
 * A Client Component cannot export metadata, so the tab title is set for as
 * long as the boundary is shown and restored when a retry succeeds.
 */
export default function LocaleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("errors");
  const tSearch = useTranslations("search");
  const tNav = useTranslations("nav");
  const tSeo = useTranslations("seo");
  const title = tSeo("titleTemplate", { title: t("genericHeading") });

  useEffect(() => {
    // The server half of the error is in the server log under `digest`.
    console.error(error);
  }, [error]);

  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <ErrorScreen
      eyebrow={t("errorEyebrow")}
      title={t("genericHeading")}
      body={
        <>
          <p>{t("genericBody")}</p>
          <p className="mt-3">{t("genericHint")}</p>
        </>
      }
      actions={
        <button
          type="button"
          onClick={() => retry()}
          className={buttonClasses({ variant: "inverse" })}
        >
          <RotateCcw aria-hidden="true" strokeWidth={1.25} className="size-4" />
          {t("retry")}
        </button>
      }
      search={{
        action: getPathname({ locale, href: "/properties" }),
        label: t("searchLabel"),
        placeholder: tSearch("queryPlaceholder"),
        submit: t("searchSubmit"),
        testId: "error-search",
      }}
      linksHeading={t("popularHeading")}
      links={errorLinks(locale, { search: tSearch, nav: tNav })}
      footnote={
        error.digest !== undefined ? (
          <p className="font-mono text-label uppercase tracking-[0.08em]">
            {t("digest", { digest: error.digest })}
          </p>
        ) : undefined
      }
    />
  );
}
