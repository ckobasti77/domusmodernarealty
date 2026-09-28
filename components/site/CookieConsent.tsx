"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { fixOrphans } from "@/lib/format";
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
import { textLinkClasses } from "./TextLink";

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

  const visible = hydrated && record === null;
  useConsentHeight(panel, visible);

  // The server cannot know the stored choice, so the banner only appears once
  // the client has hydrated. Otherwise a visitor who already decided would see
  // the banner flash for one frame.
  if (!visible) return null;

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
        // Capped at 38svh on a phone: at 85svh the bar ate 40% of the screen
        // and buried the hero's CTAs and scroll cue.
        "fixed inset-x-0 bottom-0 z-(--z-overlay) max-h-[42svh] overflow-y-auto md:max-h-[70svh]",
        // Without this the last control sits under an iPhone's home indicator.
        "pb-[env(safe-area-inset-bottom)]",
        "border-t border-hairline-dark bg-ink text-ivory",
      )}
    >
      <div className="mx-auto flex max-w-content flex-col gap-4 px-gutter py-4 md:px-gutter-md md:gap-6 md:py-6 lg:flex-row lg:items-start lg:gap-12 lg:px-gutter-lg lg:py-8">
        <div className="flex-1">
          {/* The serif title is a luxury flourish on a compliance notice; at
              390px it costs a line the body needs. Kept as the accessible name
              at every size, shown from md up. */}
          <h2
            id={headingId}
            className="eyebrow text-bronze md:font-display md:text-h3 md:font-normal md:normal-case md:tracking-normal md:text-ivory"
          >
            {t("bannerHeading")}
          </h2>
          <p className="mt-1.5 max-w-[64ch] text-small text-mist md:mt-3">
            {fixOrphans(t("bannerBody"))}{" "}
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

        {/* Both choices get identical weight. An emphasised "accept all" beside
            a quiet "necessary only" is a dark pattern under EDPB guidance, and a
            quiet-luxury site should not be shouting either way. */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:gap-3 lg:w-[260px] lg:flex-col">
          <Button
            variant="outlineDark"
            onClick={() => save(ALL_CATEGORIES)}
            className="w-full justify-center"
          >
            {t("acceptAll")}
          </Button>
          <Button
            variant="outlineDark"
            onClick={() => save(NECESSARY_ONLY)}
            className="w-full justify-center"
          >
            {t("necessaryOnly")}
          </Button>
          {showSettings ? (
            <Button
              variant="outlineDark"
              onClick={() => save({ necessary: true, analytics, marketing })}
              className="w-full justify-center"
            >
              {t("save")}
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className={textLinkClasses("dark", "self-center py-2 text-small")}
            >
              {t("settings")}
            </button>
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
/**
 * Publishes the banner's height as `--consent-h` on `<html>` so a `min-h-svh`
 * hero can hold its CTAs above it (`app/[locale]/page.tsx`). It is cleared when
 * the banner unmounts, so the padding disappears with it.
 */
function useConsentHeight(panel: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    const el = panel.current;
    const root = document.documentElement;
    if (!active || el === null) {
      root.style.removeProperty("--consent-h");
      return;
    }
    const write = () => {
      root.style.setProperty("--consent-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--consent-h");
    };
  }, [panel, active]);
}

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
