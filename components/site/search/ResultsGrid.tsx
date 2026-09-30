"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { buttonClasses } from "@/components/site/Button";
import { PropertyCard, type CardMortgage } from "@/components/site/PropertyCard";
import type { ListingCard } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";
import { activeChips, clearFilters, removeChip, type SearchState } from "@/lib/search-params";
import { chipLabel, searchSummary, type PlaceName } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import type { ResultCount } from "./useResultCount";
import { useSearchTranslators } from "./useSearchTranslators";

export type ResultsStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

/**
 * The result list: cards, skeletons, "load more" and the empty state (PRD A3).
 * `busy` dims the previous results while a new filter set loads; skeletons
 * appear only when there is nothing to show yet.
 */
export function ResultsGrid({
  cards,
  status,
  busy,
  count,
  onLoadMore,
  loadMoreReady,
  state,
  onChange,
  placeName,
  mortgage,
  now,
  wide,
  hoverSync,
}: {
  cards: readonly ListingCard[];
  status: ResultsStatus;
  busy: boolean;
  count: ResultCount | undefined;
  onLoadMore: () => void;
  /**
   * The live subscription can page. The first page on screen may still be the
   * server render, whose cursor the client cannot continue from.
   */
  loadMoreReady: boolean;
  state: SearchState;
  onChange: (next: SearchState) => void;
  placeName: PlaceName;
  mortgage?: CardMortgage;
  now: number;
  /** The map is hidden: three columns instead of two. */
  wide: boolean;
  /** Cards report hover to the map (only when a map is beside them). */
  hoverSync: boolean;
}) {
  const t = useTranslations("search");
  const locale = useLocale() as Locale;

  const grid = cn("grid gap-x-8 gap-y-14 md:grid-cols-2", wide && "xl:grid-cols-3");
  const sizes = wide
    ? "(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw"
    : "(min-width: 1024px) 26vw, (min-width: 768px) 45vw, 92vw";

  if (cards.length === 0 && (status === "LoadingFirstPage" || status === "LoadingMore")) {
    return (
      <div className={grid} aria-busy="true" aria-label={t("loadingResults")} data-testid="results-skeleton">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // "No results" only once the index is exhausted: an empty window with more
  // index behind it is not an empty search.
  if (cards.length === 0 && status === "Exhausted") {
    return <EmptyState state={state} onChange={onChange} placeName={placeName} />;
  }

  return (
    <div>
      <ul
        className={cn(grid, "transition-opacity duration-200", busy && "opacity-50")}
        aria-busy={busy}
        data-testid="results-list"
      >
        {cards.map((card, index) => (
          <li key={card._id}>
            <PropertyCard
              listing={card}
              images={card.images}
              ratio="3/2"
              sizes={sizes}
              priority={index < 2}
              mortgage={mortgage}
              now={now}
              compare
              hoverSync={hoverSync}
            />
          </li>
        ))}
      </ul>

      <div className="mt-16 flex flex-col items-center gap-4">
        {count !== undefined ? (
          <p data-numeric className="text-small text-stone-text" aria-live="polite" data-testid="results-shown">
            {t("shownOf", {
              shown: formatCount(cards.length, locale),
              total: count.exact ? formatCount(count.count, locale) : `${formatCount(count.count, locale)}+`,
            })}
          </p>
        ) : null}
        {status === "CanLoadMore" || status === "LoadingMore" ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={status === "LoadingMore" || !loadMoreReady}
            aria-busy={status === "LoadingMore" || !loadMoreReady}
            data-testid="load-more"
            className={buttonClasses({ variant: "outline", size: "default" })}
          >
            {status === "LoadingMore" ? t("loadingResults") : t("loadMore")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="aspect-[3/2] animate-pulse bg-ivory-2 motion-reduce:animate-none" />
      <div className="h-6 w-4/5 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
      <div className="h-4 w-2/5 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
      <div className="h-7 w-1/2 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
    </div>
  );
}

/**
 * PRD A3: suggestions (drop one of the active filters), "clear all", and a
 * way out for a visitor we cannot serve from the list — tell the agency what
 * they are looking for (the contact form arrives prefilled).
 */
function EmptyState({
  state,
  onChange,
  placeName,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  placeName: PlaceName;
}) {
  const t = useTranslations("search");
  const tFilters = useTranslations("filters");
  const translators = useSearchTranslators();
  const locale = useLocale() as Locale;
  const chips = activeChips(state).slice(-4).reverse();
  const summary = searchSummary(translators, state, locale, placeName);

  return (
    <div className="flex flex-col gap-12 border-t border-hairline-light pt-12" data-testid="results-empty">
      <div className="max-w-xl">
        <h2 className="text-balance font-display text-h2 font-normal">{t("noResults")}</h2>
        <p className="mt-4 text-body-l text-stone-text">{t("noResultsHelp")}</p>
        {chips.length > 0 ? (
          <div className="mt-8">
            <p className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">{t("empty.suggestionsLabel")}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => {
                const label = chipLabel(translators, chip, state, locale, placeName);
                return (
                  <li key={`${chip.kind}:${"value" in chip ? String(chip.value) : ""}`}>
                    <button
                      type="button"
                      onClick={() => onChange(removeChip(state, chip))}
                      aria-label={t("chips.remove", { label })}
                      className="inline-flex min-h-11 items-center gap-2 border border-ink/30 px-4 text-small text-ink transition-colors duration-200 pointer-fine:hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text"
                    >
                      {label}
                      <X aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-stone-text" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => onChange(clearFilters(state))}
              data-testid="empty-clear"
              // Secondary: the filled button in this state is the "tell us" CTA.
              className={cn(buttonClasses({ variant: "outline", size: "default" }), "mt-6")}
            >
              {tFilters("clearAll")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 bg-ivory-2 p-8 md:flex-row md:items-end md:justify-between md:p-10">
        <div className="max-w-xl">
          <h3 className="font-display text-h3 font-normal">{t("empty.ctaTitle")}</h3>
          <p className="mt-3 text-body text-stone-text">{t("empty.ctaBody")}</p>
        </div>
        <Link
          href={{ pathname: "/contact", query: { message: t("empty.messagePrefix", { summary }) } }}
          prefetch={false}
          data-testid="empty-cta"
          className={cn(buttonClasses({ variant: "primary", size: "default" }), "shrink-0")}
        >
          {t("empty.cta")}
        </Link>
      </div>
    </div>
  );
}
