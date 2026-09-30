"use client";

import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { SearchFilters } from "@/convex/lib/validators";
import type { Bbox } from "@/lib/search-params";
import { cn } from "@/lib/utils";

const SearchMap = dynamic(() => import("./SearchMap"), { ssr: false });

export type SearchMapLoaderProps = {
  /** Exactly the filters listings.search receives — including `bbox` while search-as-move is on. */
  filters: SearchFilters;
  /** Mount the map only when true (the phone "Lista" view passes false so MapLibre never loads there). */
  active: boolean;
  searchAsMove: boolean;
  onSearchAsMoveChange: (on: boolean) => void;
  /** Called on `moveend` (debounce ~400 ms) ONLY while searchAsMove is on, and once immediately with the current bounds when the toggle is switched on. Round to 4 decimals. */
  onBoundsChange: (bbox: Bbox) => void;
  /** The URL's bbox, to restore the viewport on first load (then do NOT auto-fit). */
  initialBbox?: Bbox;
  className?: string;
};

/** MapLibre 6 needs WebGL2; headless or locked-down browsers may not have it. Probed once per page. */
let webgl2: boolean | undefined;
function supportsWebGL2(): boolean {
  if (webgl2 === undefined) {
    try {
      webgl2 = document.createElement("canvas").getContext("webgl2") !== null;
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

const neverChanges = () => () => undefined;

/**
 * The search page's map panel (PRD A3). It fills its parent, which must have a
 * height. The ~250 kB MapLibre chunk loads only once the panel is first
 * `active` (never on the phone list view) and then stays mounted, so switching
 * List/Map does not refetch tiles. Wrapped in `data-lenis-prevent` so dragging
 * or wheeling the map never scrolls the page (CLAUDE.md).
 */
export function SearchMapLoader({
  filters,
  active,
  searchAsMove,
  onSearchAsMoveChange,
  onBoundsChange,
  initialBbox,
  className,
}: SearchMapLoaderProps) {
  const t = useTranslations("search.map");
  const tSearch = useTranslations("search");

  const [mounted, setMounted] = useState(active);
  if (active && !mounted) setMounted(true);

  // Read on the client only, and only once the panel is wanted: the server
  // render and hydration see `null`, so the markup matches.
  const supported = useSyncExternalStore(
    neverChanges,
    () => (mounted ? supportsWebGL2() : null),
    () => null,
  );

  const [ready, setReady] = useState(false);
  const readBounds = useRef<(() => Bbox | null) | null>(null);

  const handleReady = useCallback((read: () => Bbox | null) => {
    readBounds.current = read;
    setReady(true);
  }, []);

  const state =
    supported === null ? "idle" : !supported ? "unsupported" : ready ? "ready" : "loading";

  function toggleSearchAsMove() {
    if (searchAsMove) {
      onSearchAsMoveChange(false);
      return;
    }
    onSearchAsMoveChange(true);
    const bbox = readBounds.current?.();
    if (bbox !== undefined && bbox !== null) onBoundsChange(bbox);
  }

  return (
    <div
      role="region"
      aria-label={t("label")}
      data-lenis-prevent=""
      data-testid="search-map"
      data-map-state={state}
      className={cn("relative isolate h-full w-full overflow-hidden bg-ivory-2", className)}
    >
      {supported === true ? (
        <SearchMap
          filters={filters}
          active={active}
          searchAsMove={searchAsMove}
          onBoundsChange={onBoundsChange}
          initialBbox={initialBbox}
          onReady={handleReady}
        />
      ) : null}

      {state === "ready" ? (
        <button
          type="button"
          role="switch"
          aria-checked={searchAsMove}
          data-testid="map-search-as-move"
          onClick={toggleSearchAsMove}
          className="absolute left-3 top-3 z-[3] flex min-h-11 cursor-pointer items-center gap-3 border border-hairline-light bg-paper px-3.5 text-small text-ink transition-colors duration-150 hover:bg-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-deep"
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative h-4 w-7 shrink-0 border transition-colors duration-150",
              searchAsMove ? "border-ink bg-ink" : "border-stone-text bg-transparent",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-1/2 size-2.5 -translate-y-1/2 transition-transform duration-150 motion-reduce:transition-none",
                searchAsMove ? "translate-x-3 bg-paper" : "translate-x-0 bg-stone-text",
              )}
            />
          </span>
          {t("searchAsMove")}
        </button>
      ) : null}

      {state === "loading" ? (
        <p
          role="status"
          className="absolute inset-0 z-[5] flex items-center justify-center bg-ivory-2 p-6 text-small text-stone-text"
        >
          {t("loading")}
        </p>
      ) : null}

      {state === "unsupported" ? (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 p-6 text-center text-stone-text">
          <MapPin aria-hidden="true" strokeWidth={1.25} className="size-6" />
          <p className="text-small">{tSearch("mapUnavailable")}</p>
        </div>
      ) : null}
    </div>
  );
}
