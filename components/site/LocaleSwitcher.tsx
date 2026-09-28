"use client";

import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
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
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const active = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  // `usePathname()` can return a dynamic template such as `/properties/[slug]`,
  // which `replace()` only accepts together with its `params`. The route-aware
  // overload cannot express "whatever the current route is", so the pair is
  // asserted to the href type — the values themselves come straight from Next.
  const target = { pathname, params } as RouteHref;

  return (
    <nav aria-label={FULL_NAMES[active]} className={className}>
      <ul className="flex items-center gap-4">
        {locales.map((locale) => {
          const isActive = locale === active;
          return (
            <li key={locale}>
              <button
                type="button"
                lang={locale}
                aria-current={isActive ? "true" : undefined}
                onClick={() => router.replace(target, { locale })}
                className={
                  "font-mono text-label uppercase transition-colors duration-200 " +
                  (isActive
                    ? "text-bronze"
                    : "text-mist hover:text-ivory focus-visible:text-ivory")
                }
              >
                <span className="sr-only">{FULL_NAMES[locale]}</span>
                <span aria-hidden="true">{LABELS[locale]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
