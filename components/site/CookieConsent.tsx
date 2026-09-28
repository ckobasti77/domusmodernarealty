"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { Link } from "@/i18n/navigation";
import {
  ALL_CATEGORIES,
  NECESSARY_ONLY,
  resetConsent,
  setConsent,
  useConsentRecord,
  type ConsentCategories,
} from "@/lib/stores/consent";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { CheckboxField } from "./Field";

/**
 * Cookie banner. Opt-in, per category, and it never appears for a visitor who
 * already chose (the store returns `null` only while undecided).
 *
 * It is a `role="dialog"` but deliberately NOT modal: a non-modal banner lets
 * the visitor read the privacy page before deciding, which is exactly what the
 * "freely given" requirement expects. Focus is therefore not trapped, and the
 * banner sits last in the DOM so it does not interrupt the page's tab order.
 */
export function CookieConsent() {
  const t = useTranslations("consent");
  const tLegal = useTranslations("legal");
  const record = useConsentRecord();
  const hydrated = useHydrated();
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // The server cannot know the stored choice, so the banner only appears once
  // the client has hydrated. Otherwise a visitor who already decided would see
  // the banner flash for one frame.
  if (!hydrated || record !== null) return null;

  const save = (categories: ConsentCategories) => {
    setConsent(categories);
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={headingId}
      // The settings list can overflow on a short phone; Lenis must not take it.
      data-lenis-prevent
      className={cn(
        "fixed inset-x-0 bottom-0 z-(--z-overlay) max-h-[85svh] overflow-y-auto",
        "border-t border-hairline-dark bg-ink text-ivory",
      )}
    >
      <div className="mx-auto flex max-w-content flex-col gap-6 px-gutter py-6 md:px-gutter-md lg:flex-row lg:items-start lg:gap-12 lg:px-gutter-lg lg:py-8">
        <div className="flex-1">
          <h2 id={headingId} className="font-display text-h3 font-normal text-ivory">
            {t("bannerHeading")}
          </h2>
          <p className="mt-3 max-w-[64ch] text-small text-mist">
            {t("bannerBody")}{" "}
            <Link
              href="/privacy"
              prefetch={false}
              className="text-bronze underline decoration-bronze/40 underline-offset-4 transition-colors duration-200 pointer-fine:hover:decoration-bronze"
            >
              {tLegal("privacyHeading")}
            </Link>
          </p>

          {showSettings ? (
            <div className="mt-6 space-y-4 border-t border-hairline-dark pt-5">
              {/* Necessary is locked on: without it the site cannot function. */}
              <CheckboxField
                label={t("necessary")}
                hint={t("necessaryHelp")}
                checked
                disabled
                readOnly
                className="[&_label]:text-ivory [&_p]:text-mist"
              />
              <CheckboxField
                label={t("analytics")}
                hint={t("analyticsHelp")}
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="[&_label]:text-ivory [&_p]:text-mist"
              />
              <CheckboxField
                label={t("marketing")}
                hint={t("marketingHelp")}
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="[&_label]:text-ivory [&_p]:text-mist"
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Button variant="inverse" size="compact" onClick={() => save(ALL_CATEGORIES)}>
            {t("acceptAll")}
          </Button>
          <Button variant="outlineDark" size="compact" onClick={() => save(NECESSARY_ONLY)}>
            {t("necessaryOnly")}
          </Button>
          {showSettings ? (
            <Button
              variant="outlineDark"
              size="compact"
              onClick={() => save({ necessary: true, analytics, marketing })}
            >
              {t("save")}
            </Button>
          ) : (
            <Button variant="ghost" size="compact" onClick={() => setShowSettings(true)}>
              <span className="text-ivory">{t("settings")}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Footer link that re-opens the banner. GDPR requires consent to be as easy to
 * withdraw as it was to give, which means a permanent entry point.
 */
export function ConsentSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("consent");

  return (
    <button
      type="button"
      onClick={resetConsent}
      className={cn(
        "inline-flex min-h-9 items-center text-left text-small text-mist transition-colors duration-200 pointer-fine:hover:text-ivory",
        className,
      )}
    >
      {t("settings")}
    </button>
  );
}
