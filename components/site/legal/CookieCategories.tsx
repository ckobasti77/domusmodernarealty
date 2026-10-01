"use client";

import { useLocale, useTranslations } from "next-intl";
import { buttonClasses } from "@/components/site/Button";
import { ConsentSettingsButton } from "@/components/site/CookieConsent";
import { formatLongDate } from "@/components/site/journal/shared";
import { useHydrated } from "@/hooks/useHydrated";
import type { Locale } from "@/i18n/routing";
import { useConsentRecord } from "@/lib/stores/consent";
import { cn } from "@/lib/utils";

type Category = "necessary" | "analytics" | "marketing";

const CATEGORIES: readonly Category[] = ["necessary", "analytics", "marketing"];

/**
 * The three categories the cookie banner asks about, with what each is for,
 * whether it is on by default (only `necessary`) and the visitor's own current
 * choice, read live from the consent store — so this page and the banner can
 * never disagree. The button re-opens the banner (GDPR: withdrawing consent
 * must be as easy as giving it).
 *
 * The stored choice is only known in the browser: until hydration the
 * "your choice" cells stay blank instead of guessing.
 */
export function CookieCategories() {
  const locale = useLocale() as Locale;
  const t = useTranslations("legal.cookieChoices");
  const tConsent = useTranslations("consent");
  const hydrated = useHydrated();
  const record = useConsentRecord();

  function current(category: Category): string {
    if (category === "necessary") return t("on");
    if (record === null) return t("undecided");
    return record.categories[category] ? t("on") : t("off");
  }

  return (
    <div data-testid="cookie-categories">
      <ul className="hairline-t">
        {CATEGORIES.map((category) => (
          <li key={category} className="grid gap-x-10 gap-y-5 hairline-b py-7 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              {/* The legal pages' in-section sub-heading step (`.rich-text-nested h3`). */}
              <h3 className="font-display text-[1.375rem] font-normal leading-[1.3]">{tConsent(category)}</h3>
              <p className="mt-2 max-w-[48ch] text-pretty text-body text-stone-text">{tConsent(`${category}Help`)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 md:min-w-[20rem]">
              <div>
                <dt className="eyebrow text-stone-text">{t("default")}</dt>
                <dd className="mt-2 text-small text-ink">
                  {category === "necessary" ? t("alwaysOn") : t("offByDefault")}
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-stone-text">{t("current")}</dt>
                <dd className="mt-2 min-h-[1.3125rem] text-small text-ink">{hydrated ? current(category) : null}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-8 max-w-[32em] text-pretty text-body">{t("change")}</p>
      {hydrated && record !== null ? (
        <p className="mt-2 text-small text-stone-text">
          {t("decidedAt", { date: formatLongDate(record.decidedAt, locale) })}
        </p>
      ) : null}
      <ConsentSettingsButton
        className={cn(
          buttonClasses({ variant: "outline", size: "compact" }),
          "mt-6 text-ink pointer-fine:hover:text-bronze-text",
        )}
      />
    </div>
  );
}
