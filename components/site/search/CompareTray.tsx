"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { buttonClasses } from "@/components/site/Button";
import type { ListingCard } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { frameLoader } from "@/lib/image-loaders";
import { pickL10n } from "@/lib/l10n";
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
 */
export function CompareTray({ known }: { known: ReadonlyMap<string, ListingCard> }) {
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
        <p className="sr-only shrink-0 font-sans text-label uppercase tracking-[0.12em] text-mist sm:not-sr-only" aria-live="polite">
          {t("traySelected", { count: ids.length })}
        </p>
        <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {ids.map((id) => {
            const card = known.get(id);
            const title = card !== undefined ? pickL10n(card.title, locale).text : "";
            return (
              <li key={id} className="relative flex shrink-0 items-center">
                <span className="relative block h-11 w-16 overflow-hidden bg-ink-3">
                  {card?.cover !== undefined ? (
                    <Image
                      src={card.cover.url}
                      loader={frameLoader(card.cover.url, 11 / 16)}
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
                  className="absolute -right-1 -top-1 inline-flex size-6 items-center justify-center bg-ivory text-ink transition-colors duration-200 pointer-fine:hover:bg-bronze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
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
