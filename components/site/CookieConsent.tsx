"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ScrollTrigger } from "@/components/motion/gsap";
import { isIntroDone, subscribeIntroDone } from "@/components/motion/intro";
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

/**
 * Cookie banner. Opt-in, per category, and it never appears for a visitor who
 * already chose (the store returns `null` only while undecided).
 *
 * It is a `role="dialog"` but deliberately NOT modal: a non-modal banner lets
 * the visitor read the privacy page before deciding, which is exactly what the
 * "freely given" requirement expects. Focus is therefore not trapped, and the
 * banner sits last in the DOM so it does not interrupt the page's tab order.
 *
 * Compact by design (one row from 1024px up, two equal buttons side by side on
 * a phone), and its height is reserved in the landing hero from the first
 * paint (`html[data-consent="pending"]` sets `--consent-reserve` in
 * globals.css), so the hero copy is never covered and nothing shifts when it
 * arrives. On a first visit it waits for the intro curtain and the hero's entrance, then slides in.
 */
export function CookieConsent() {
  const t = useTranslations("consent");
  const tLegal = useTranslations("legal");
  const record = useConsentRecord();
  const hydrated = useHydrated();
  const introDone = useSyncExternalStore(subscribeIntroDone, isIntroDone, () => false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const headingId = useId();
  const settingsId = useId();
  const panel = useRef<HTMLDivElement>(null);

  const visible = hydrated && record === null && introDone;
  useConsentHeight(panel, visible);

  // The pre-paint gate set this from storage; from here on the store owns it.
  // A decision removes the hero's reservation, so the hero copy moves down
  // right after the click: a shift caused by input, which CLS excludes.
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    const next = record === null ? "pending" : "decided";
    if (root.dataset.consent === next) return;
    root.dataset.consent = next;
    // On a short screen the reservation can change the hero's height, so the
    // pinned sections below it measure again.
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [hydrated, record]);

  // The server cannot know the stored choice, so the banner only appears once
  // the client has hydrated. Otherwise a visitor who already decided would see
  // the banner flash for one frame.
  if (!visible) return null;

  const save = (categories: ConsentCategories) => {
    // The banner unmounts on a decision; a keyboard user inside it would be
    // dropped on <body>. Hand focus to the page's main landmark instead.
    const hadFocus = panel.current?.contains(document.activeElement) === true;
    setConsent(categories);
    if (!hadFocus) return;
    const main = document.getElementById("main");
    if (main === null) return;
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={headingId}
      // The settings list can overflow on a short phone; Lenis must not take it.
      data-lenis-prevent
      className={cn(
        "fixed inset-x-0 bottom-0 z-(--z-overlay) max-h-[42svh] overflow-y-auto md:max-h-[70svh]",
        // Without this the last control sits under an iPhone's home indicator.
        "pb-[env(safe-area-inset-bottom)]",
        "border-t border-hairline-dark bg-ink text-ivory",
        // Rises from the bottom edge once, after the hero's own entrance has
        // settled (the curtain signals at 1.8 s, the hero copy lands by ~2.5 s),
        // so the two never move at the same time. The global reduced-motion
        // rule flattens the movement.
        "transition-[translate] delay-700 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] starting:translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-content flex-col gap-3 px-gutter py-4 md:px-gutter-md lg:flex-row lg:items-center lg:gap-12 lg:px-gutter-lg lg:py-5">
        <div className="min-w-0 flex-1">
          {/* A small label, not a serif title: over the hero a second display line
              would read as another headline. On a phone, and from 1024px to
              1279px where the text column is narrow, it is visually hidden (it
              costs a line the body needs) and stays the accessible name. */}
          <h2 id={headingId} className="eyebrow text-bronze max-sm:sr-only lg:max-xl:sr-only">
            {t("bannerHeading")}
          </h2>
          {/* One line from 1280px up: the body and both links share it, so the
              bar stays about 100px tall. */}
          <p className="mt-1.5 max-w-[80ch] text-pretty text-small text-mist lg:max-w-none lg:max-xl:mt-0 xl:mt-1">
            {fixOrphans(t("bannerBody"))}{" "}
            <Link
              href="/privacy"
              className="text-bronze underline decoration-bronze/40 underline-offset-4 transition-colors duration-200 pointer-fine:hover:decoration-bronze"
            >
              {tLegal("privacyHeading")}
            </Link>
            {" "}
            <span aria-hidden="true" className="text-mist/60">
              /
            </span>{" "}
            {/* A disclosure, so it stays where it is (and keeps focus) when open. */}
            <button
              type="button"
              aria-expanded={showSettings}
              aria-controls={settingsId}
              onClick={() => setShowSettings((open) => !open)}
              className="text-ivory underline decoration-ivory/40 underline-offset-4 transition-colors duration-200 pointer-fine:hover:text-bronze"
            >
              {t("settings")}
            </button>
          </p>

          {showSettings ? (
            <div id={settingsId} className="mt-5 space-y-4 border-t border-hairline-dark pt-5">
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
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:flex lg:gap-3">
          <Button
            variant="outlineDark"
            size="compact"
            onClick={() => save(ALL_CATEGORIES)}
            className="w-full justify-center px-2 max-sm:tracking-[0.06em] sm:px-5 lg:w-auto"
          >
            {t("acceptAll")}
          </Button>
          <Button
            variant="outlineDark"
            size="compact"
            onClick={() => save(NECESSARY_ONLY)}
            className="w-full justify-center px-2 max-sm:tracking-[0.06em] sm:px-5 lg:w-auto"
          >
            {t("necessaryOnly")}
          </Button>
          {showSettings ? (
            <Button
              variant="outlineDark"
              size="compact"
              onClick={() => save({ necessary: true, analytics, marketing })}
              className="col-span-2 w-full justify-center px-2 sm:px-5 lg:w-auto"
            >
              {t("save")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Publishes the banner's measured height as `--consent-h` on `<html>`, so
 * fixed bottom UI (the listing page's mobile action bar, the page-end padding in
 * globals.css) can sit above it. It is cleared when the banner unmounts, so the
 * offset disappears with it.
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
