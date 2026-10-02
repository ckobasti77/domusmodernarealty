"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { buttonClasses } from "@/components/site/Button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { frameLoader } from "@/lib/image-loaders";
import { pickL10n } from "@/lib/l10n";
import { coverOf, type SearchCard } from "@/lib/search-cards";
import { COMPARE_MIN, clearCompare, removeFromCompare, useCompareIds } from "@/lib/stores/compare";
import { cn } from "@/lib/utils";

/**
 * The compare tray (PRD A12): it appears once two listings are selected and
 * links to `/uporedi?ids=…`, which step 10 builds and which is shareable.
 * It sits above the cookie banner (`--consent-h`) and never covers the last
 * result: the results list reserves the same height while the tray shows.
 *
 * Titles and thumbnails come from the cards already loaded on the page, so
 * the tray needs no query of its own; a selection made on another page shows
 * its reference slot without a photo.
 *
 * Below 1024px the tray states the count instead of the thumbnails: next to
 * the CTA (and "Očisti izbor" from 768px) four thumbnails do not fit, and a
 * strip sliced at the button read as broken. There the cards' own "Uporedi"
 * toggles remove a listing.
 */
export function CompareTray({ known }: { known: ReadonlyMap<string, SearchCard> }) {
  const t = useTranslations("compare");
  const locale = useLocale() as Locale;
  const ids = useCompareIds();
  if (ids.length < COMPARE_MIN) return null;

  return (
    <aside
      aria-label={t("trayLabel")}
      data-testid="compare-tray"
      className="fixed inset-x-0 z-(--z-sticky) border-t border-hairline-dark bg-ink text-ivory"
      // Lifted above the cookie banner by a transform, which is not a layout shift.
      style={{ bottom: 0, translate: "0 calc(-1 * var(--consent-h, 0px))" }}
    >
      <div className="mx-auto flex max-w-bleed items-center gap-4 px-gutter py-3 md:px-gutter-md lg:px-gutter-lg">
        <p
          className="min-w-0 flex-1 font-sans text-label uppercase tracking-[0.12em] text-mist lg:flex-none"
          aria-live="polite"
        >
          {t("traySelected", { count: ids.length })}
        </p>
        <ul className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          {ids.map((id) => {
            const card = known.get(id);
            const title = card !== undefined ? pickL10n(card.title, locale).text : "";
            const cover = card !== undefined ? coverOf(card) : undefined;
            return (
              <li key={id} className="relative flex shrink-0 items-center">
                <span className="relative block h-11 w-16 overflow-hidden bg-ink-3">
                  {cover !== undefined ? (
                    <Image
                      src={cover.url}
                      loader={frameLoader(cover.url, 11 / 16)}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromCompare(id)}
                  aria-label={t("trayRemove", { title: title.length > 0 ? title : (card?.ref ?? "") })}
                  // A 24px square to the eye, a 44px target to the finger (the
                  // pseudo-element); the thumbnails are 72px apart, so no two overlap.
                  className="absolute -right-1 -top-1 inline-flex size-6 items-center justify-center bg-ivory text-ink transition-colors duration-200 before:absolute before:-inset-2.5 before:content-[''] pointer-fine:hover:bg-bronze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
                >
                  <X aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={clearCompare}
          className="hidden shrink-0 font-sans text-small uppercase tracking-[0.12em] text-mist transition-colors duration-200 pointer-fine:hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze md:inline-flex md:min-h-11 md:items-center"
        >
          {t("trayClear")}
        </button>
        <Link
          href={{ pathname: "/compare", query: { ids: ids.join(",") } }}
          data-testid="compare-cta"
          className={cn(buttonClasses({ variant: "inverse", size: "compact" }), "shrink-0")}
        >
          {t("trayCta")}
        </Link>
      </div>
    </aside>
  );
}
