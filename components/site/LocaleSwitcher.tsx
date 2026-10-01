"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/routing";

type RouteHref = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

const LABELS: Record<Locale, string> = {
  "sr-Latn": "SR",
  en: "EN",
  ru: "RU",
  de: "DE",
};

const FULL_NAMES: Record<Locale, string> = {
  "sr-Latn": "Srpski",
  en: "English",
  ru: "Русский",
  de: "Deutsch",
};

/**
 * Switches locale while staying on the same route — next-intl resolves the
 * localized pathname for the target locale (`/sr/nekretnine` -> `/de/immobilien`).
 *
 * Two presentations, because one does not fit both places:
 *  - `inline` is the four tracked codes in the desktop header (fine pointer,
 *    plenty of room, and the 44px rule is met by the row's own height);
 *  - `stacked` is what the mobile overlay menu uses — full-width serif rows
 *    with the language's own name, each one a comfortable touch target. Four
 *    15×11px codes beside a hamburger fail WCAG 2.5.8 and read as clutter.
 */
export function LocaleSwitcher({
  className,
  variant = "inline",
}: {
  className?: string;
  variant?: "inline" | "stacked";
}) {
  const active = useLocale() as Locale;
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  // `usePathname()` can return a dynamic template such as `/properties/[slug]`,
  // which `replace()` only accepts together with its `params`. The route-aware
  // overload cannot express "whatever the current route is", so the href is
  // asserted to the route type at the call — its values come straight from Next.
  const target = { pathname, params };

  // The query string is locale-independent (lib/search-params.ts), so a
  // filtered search keeps every filter across a language switch. It is read at
  // click time: the search page updates it through the History API, and a
  // `useSearchParams()` here would opt every page into client rendering.
  const switchTo = (locale: Locale) => {
    const query = Object.fromEntries(new URLSearchParams(window.location.search));
    router.replace({ ...target, query } as RouteHref, { locale });
  };

  const stacked = variant === "stacked";

  return (
    <nav aria-label={t("languageLabel")} className={className}>
      <ul className={cn(stacked ? "flex flex-col" : "flex items-center gap-4")}>
        {locales.map((locale) => {
          const isActive = locale === active;
          return (
            <li key={locale} className={stacked ? "hairline-b-dark" : undefined}>
              <button
                type="button"
                lang={locale}
                aria-current={isActive ? "true" : undefined}
                onClick={() => switchTo(locale)}
                className={cn(
                  "transition-colors duration-200",
                  stacked
                    ? "flex min-h-12 w-full items-baseline justify-between gap-4 py-2 font-display text-h3 font-normal"
                    : "inline-flex min-h-9 items-center font-mono text-label uppercase",
                  isActive ? "text-bronze" : "text-mist pointer-fine:hover:text-ivory focus-visible:text-ivory",
                )}
              >
                {stacked ? (
                  <>
                    <span>{FULL_NAMES[locale]}</span>
                    <span aria-hidden="true" className="font-mono text-label uppercase">
                      {LABELS[locale]}
                    </span>
                  </>
                ) : (
                  <>
                    {/* The name carries the visible code too (WCAG 2.5.3, label in name). */}
                    <span className="sr-only">{`${FULL_NAMES[locale]} (${LABELS[locale]})`}</span>
                    <span aria-hidden="true">{LABELS[locale]}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
