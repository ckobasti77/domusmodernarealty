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
 * Three presentations, because one does not fit every place:
 *  - `inline` is the four tracked codes in the footer, where a phone reaches
 *    them too: each code sits in its own 44×44 hit area (WCAG 2.5.5, Apple's
 *    44pt), centred, and the row is pulled back by the padding so the first
 *    code still lines up with the column and the row keeps its height. Only
 *    the space between the codes grows; the type is unchanged;
 *  - `compact` is the same codes in the desktop header (fine pointer, a tight
 *    nav row), 36px tall;
 *  - `stacked` is what the mobile overlay menu uses — full-width serif rows
 *    with the language's own name, each one a comfortable touch target. Four
 *    15×11px codes beside a hamburger fail WCAG 2.5.8 and read as clutter.
 */
export function LocaleSwitcher({
  className,
  variant = "inline",
}: {
  className?: string;
  variant?: "inline" | "compact" | "stacked";
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
      <ul
        className={cn(
          variant === "stacked" && "flex flex-col",
          variant === "compact" && "flex items-center gap-4",
          // 14px = (44px box - 15px code) / 2; 4px = (44 - 36) / 2.
          variant === "inline" && "-mx-3.5 -my-1 flex items-center",
        )}
      >
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
                  variant === "stacked" &&
                    "flex min-h-12 w-full items-baseline justify-between gap-4 py-2 font-display text-h3 font-normal",
                  variant === "compact" && "inline-flex min-h-9 items-center font-mono text-label uppercase",
                  variant === "inline" &&
                    "inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-label uppercase",
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
