"use client";

import { usePaginatedQuery } from "convex/react";
import { useLenis } from "lenis/react";
import { List, Map as MapIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchMapLoader } from "@/components/map/SearchMapLoader";
import type { CardMortgage } from "@/components/site/PropertyCard";
import { api } from "@/convex/_generated/api";
import { useHydrated } from "@/hooks/useHydrated";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import type { SearchCard } from "@/lib/search-cards";
import { indexLocations, resolveLocations, type LocationNode } from "@/lib/search-locations";
import {
  PAGE_SIZE,
  effectiveSort,
  searchKey,
  toConvexFilters,
  type Bbox,
  type SearchState,
} from "@/lib/search-params";
import { searchTitle, titleIsSpecific } from "@/lib/search-text";
import { COMPARE_MIN, useCompareIds } from "@/lib/stores/compare";
import { cn } from "@/lib/utils";
import { ActiveChips } from "./ActiveChips";
import { CompareTray } from "./CompareTray";
import { FilterBar } from "./FilterBar";
import { ResultsGrid, type ResultsStatus } from "./ResultsGrid";
import { SearchHeader } from "./SearchHeader";
import { useResultCount, type ResultCount } from "./useResultCount";
import { useSearchTranslators } from "./useSearchTranslators";
import { useSearchUrl } from "./useSearchUrl";

/**
 * The interactive half of the search page (PRD A3). The server rendered the
 * first page for this exact URL; from here on Convex subscriptions keyed by
 * the URL drive the list, the count and the map, and the History API keeps
 * the URL the single source of truth (lib/search-params.ts).
 */
export type SearchInitial = {
  /** `searchKey()` of the state the server rendered. */
  key: string;
  /** The first page, projected for the request locale (`toSearchCard`). */
  page: SearchCard[];
  status: "CanLoadMore" | "Exhausted";
  count: ResultCount;
};

export type SearchExperienceProps = {
  initial: SearchInitial;
  tree: LocationNode[];
  mortgage?: CardMortgage;
  /** The server's clock, rounded by `publishedAfter`; keeps server and client args identical. */
  now: number;
  titleTemplate: string;
};

/** Extra index windows read automatically when a page comes back short. */
const MAX_AUTO_WINDOWS = 8;

type Shown = { key: string; cards: readonly SearchCard[]; status: ResultsStatus; signature: string };

/**
 * Identity of a result page by content (ids + prices), so the derived state
 * below updates exactly when what is on screen would change.
 */
function signatureOf(cards: readonly SearchCard[]): string {
  return cards.map((card) => `${card._id}:${card.price}:${card.status}`).join(",");
}

/** The fixed header's height, published by `Header` as `--header-h`. */
function headerHeight(): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h"));
  return Number.isFinite(value) ? value : 85;
}

export function SearchExperience({ initial, tree, mortgage, now, titleTemplate }: SearchExperienceProps) {
  const t = useTranslations("search");
  const locale = useLocale() as Locale;
  const translators = useSearchTranslators();
  const { state, navigate } = useSearchUrl();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const hydrated = useHydrated();
  const lenis = useLenis();

  const index = useMemo(() => indexLocations(tree), [tree]);
  const placeName = useCallback(
    (slug: string) => {
      const node = index.bySlug.get(slug);
      return node !== undefined ? pickL10n(node.name, locale).text : undefined;
    },
    [index, locale],
  );

  const filters = useMemo(
    () => toConvexFilters(state, resolveLocations(index, state.locations), now),
    [state, index, now],
  );
  const sort = effectiveSort(state);
  const key = searchKey(state);

  const results = usePaginatedQuery(api.listings.search, { filters, sort }, { initialNumItems: PAGE_SIZE });
  const { status: pageStatus, loadMore } = results;
  const loadedCount = results.results.length;

  // A post-filtered window can hold fewer matches than a page — even none —
  // while more exist further down the index. Keep reading windows, a bounded
  // number of times per search, before settling on what there is.
  const autoLoads = useRef({ key, count: 0 });
  useEffect(() => {
    if (autoLoads.current.key !== key) autoLoads.current = { key, count: 0 };
    if (pageStatus !== "CanLoadMore" || loadedCount >= PAGE_SIZE) return;
    if (autoLoads.current.count >= MAX_AUTO_WINDOWS) return;
    autoLoads.current.count += 1;
    loadMore(PAGE_SIZE);
  }, [key, pageStatus, loadedCount, loadMore]);
  const { value: liveCount } = useResultCount(filters, key === initial.key ? initial.count : undefined);

  // What the grid shows: live results once loaded, the server's page for the
  // URL it rendered, and otherwise the previous results (dimmed) until the new
  // first page arrives.
  const [shown, setShown] = useState<Shown>({
    key: initial.key,
    cards: initial.page,
    status: initial.status,
    signature: signatureOf(initial.page),
  });
  const liveStatus = results.status as ResultsStatus;
  const liveSignature = signatureOf(results.results);
  if (
    liveStatus !== "LoadingFirstPage" &&
    (shown.key !== key || shown.signature !== liveSignature || shown.status !== liveStatus)
  ) {
    setShown({ key, cards: results.results, status: liveStatus, signature: liveSignature });
  }
  const busy = shown.key !== key;
  const cards = shown.cards;
  const status: ResultsStatus = busy ? "LoadingFirstPage" : shown.status;

  const known = useMemo(() => new Map(cards.map((card) => [card._id, card])), [cards]);

  const [view, setView] = useState<"list" | "map">("list");

  // The phone List/Mapa switch steps aside while the footer is on screen.
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("#main ~ footer");
    if (footer === null) return;
    const observer = new IntersectionObserver(([entry]) => setFooterInView(entry?.isIntersecting ?? false));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const [mapHidden, setMapHidden] = useState(false);
  const compareOpen = useCompareIds().length >= COMPARE_MIN;

  const change = useCallback((next: SearchState) => navigate(next, "push"), [navigate]);

  // "Search as I move the map": the first bounds create a history entry (the
  // toggle is a choice), every later move replaces it (a stream).
  const onBoundsChange = useCallback(
    (bbox: Bbox) => navigate({ ...state, bbox }, state.bbox === undefined ? "push" : "replace"),
    [navigate, state],
  );
  const onSearchAsMoveChange = useCallback(
    (on: boolean) => {
      if (on) return; // the map reports its bounds right away (onBoundsChange)
      const next: SearchState = { ...state };
      delete next.bbox;
      navigate(next, "push");
    },
    [navigate, state],
  );

  // Keep the tab title in step with the filters (the server set the first one).
  const title = searchTitle(translators, state, placeName);
  useEffect(() => {
    document.title = titleTemplate.replace("%s", title);
  }, [title, titleTemplate]);

  // A filter change while scrolled deep into the list brings the list's top
  // back under the filter bar. Map moves (bbox) do not scroll.
  const listTop = useRef<HTMLDivElement>(null);
  // `align` also pulls a list that sits BELOW the bar up to it (the phone map
  // view must fill the screen); otherwise only a list scrolled past is restored.
  const revealList = useCallback((align = false) => {
    const node = listTop.current;
    if (node === null) return;
    const chrome = (document.querySelector<HTMLElement>("[data-search-bar]")?.offsetHeight ?? 0) + headerHeight();
    const top = node.getBoundingClientRect().top;
    if (align ? Math.abs(top - chrome) < 1 : top >= chrome) return;
    if (lenis !== undefined) lenis.scrollTo(node, { offset: -chrome, immediate: true });
    else window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - chrome });
  }, [lenis]);
  const filterKey = searchKey({ ...state, bbox: undefined });
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    revealList();
  }, [filterKey, revealList]);

  const count = liveCount;
  const countText =
    count === undefined
      ? t("counting")
      : count.exact
        ? t("resultsCount", { count: count.count })
        : t("resultsApprox", { count: formatCount(count.count, locale) });

  // Layout is CSS (lg: for desktop, max-lg: for phones) so the server HTML
  // already has the split; the media query only decides what to MOUNT.
  const mapActive = desktop ? !mapHidden : view === "map";

  return (
    <>
      <SearchHeader
        title={title}
        showLeaf={titleIsSpecific(state)}
        mapHidden={mapHidden}
        state={state}
        onChange={change}
      />

      {/* ------------------------------------------------ sticky filter bar */}
      <div
        data-search-bar=""
        // Tests (and nothing else) wait for this before they interact.
        data-ready={hydrated ? "true" : "false"}
        className="sticky top-(--header-h,85px) z-(--z-sticky) border-b border-hairline-light bg-paper"
      >
        <div className="mx-auto flex h-16 max-w-bleed items-center px-gutter md:px-gutter-md lg:h-18 lg:px-gutter-lg">
          <div className="min-w-0 flex-1">
            <FilterBar
              state={state}
              onChange={change}
              onSheetApply={(next) => {
                change(next);
                revealList(true);
              }}
              index={index}
              now={now}
              countText={countText}
            />
          </div>
        </div>
      </div>

      <div ref={listTop} className={cn("lg:flex", compareOpen && "pb-20")}>
        {/* ---------------------------------------------------- results list */}
        <section
          aria-label={t("heading")}
          className={cn(
            // Phones keep room under the last card for the floating switch.
            "min-w-0 px-gutter pb-32 pt-4 md:px-gutter-md lg:px-gutter-lg lg:pb-24 lg:pt-8",
            mapHidden ? "lg:w-full" : "lg:w-[55%]",
            view === "map" && "max-lg:hidden",
          )}
        >
          <div className="mb-8 flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              {/* On phones the visible count lives in the sticky bar; this one
                  stays for screen readers (it is the live region). */}
              <p
                data-numeric
                className="font-sans text-small text-ink max-lg:sr-only"
                aria-live="polite"
                data-testid="results-count"
              >
                {countText}
              </p>
              <button
                type="button"
                onClick={() => setMapHidden((hidden) => !hidden)}
                aria-pressed={!mapHidden}
                className="hidden min-h-11 items-center font-sans text-label uppercase tracking-[0.12em] text-stone-text transition-colors duration-200 pointer-fine:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text lg:inline-flex"
              >
                {mapHidden ? t("showMap") : t("hideMap")}
              </button>
            </div>
            {/* With no results the empty state offers the same chips as suggestions. */}
            {count?.count === 0 ? null : <ActiveChips state={state} onChange={change} placeName={placeName} />}
          </div>

          <ResultsGrid
            cards={cards}
            status={status}
            busy={busy && cards.length > 0}
            count={count}
            onLoadMore={() => results.loadMore(PAGE_SIZE)}
            loadMoreReady={results.status === "CanLoadMore"}
            state={state}
            onChange={change}
            placeName={placeName}
            mortgage={mortgage}
            now={now}
            wide={mapHidden}
            hoverSync={desktop && !mapHidden}
          />
        </section>

        {/* -------------------------------------------------------- the map */}
        <div
          className={cn(
            "lg:sticky lg:top-[calc(var(--header-h,85px)+4.5rem)] lg:h-[calc(100svh-var(--header-h,85px)-4.5rem)] lg:w-[45%] lg:self-start",
            "h-[calc(100svh-var(--header-h,85px)-4rem)]",
            // The floating List/Mapa switch covers the map's bottom on phones.
            "[--map-inset-bottom:112px] lg:[--map-inset-bottom:0px]",
            mapHidden && "lg:hidden",
            view !== "map" && "max-lg:hidden",
          )}
        >
          <SearchMapLoader
            filters={filters}
            active={mapActive}
            searchAsMove={state.bbox !== undefined}
            onSearchAsMoveChange={onSearchAsMoveChange}
            onBoundsChange={onBoundsChange}
            {...(state.bbox !== undefined ? { initialBbox: state.bbox } : {})}
          />
        </div>
      </div>

      {/* ------------------------------------------- phone list/map switch */}
      <div
        className="pointer-events-none fixed inset-x-0 z-(--z-sticky) flex justify-center lg:hidden"
        inert={footerInView}
        // Above the compare tray when it shows, and above the map's OSM credit line.
        style={{
          bottom: compareOpen ? "5.5rem" : view === "map" ? "2.75rem" : "1.25rem",
          // A transform, not `bottom`: the cookie banner arrives after the intro,
          // and moving a fixed box by layout would count as a layout shift.
          translate: "0 calc(-1 * var(--consent-h, 0px))",
        }}
      >
        <div
          role="group"
          aria-label={t("view.label")}
          className={cn(
            "pointer-events-auto flex border border-ink/30 bg-paper p-0.5 text-ink transition-[opacity,translate] duration-200",
            // Over the footer it would sit on ink links; it steps aside there.
            footerInView && "pointer-events-none translate-y-[150%] opacity-0",
          )}
        >
          {(["list", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => {
                setView(option);
                revealList(option === "map");
              }}
              data-testid={`view-${option}`}
              className={cn(
                "inline-flex h-11 items-center gap-2 px-5 font-sans text-small uppercase tracking-[0.12em] transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text",
                // Pressed is ink, like the transaction switch and every chip.
                view === option ? "bg-ink text-paper" : "text-ink",
              )}
            >
              {option === "list" ? (
                <List aria-hidden="true" strokeWidth={1.25} className="size-4" />
              ) : (
                <MapIcon aria-hidden="true" strokeWidth={1.25} className="size-4" />
              )}
              {t(`view.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <CompareTray known={known} />
    </>
  );
}
