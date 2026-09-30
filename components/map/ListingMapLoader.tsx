"use client";

import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListingMapProps } from "./ListingMap";
import { useLoadDeadline } from "./useLoadDeadline";

const ListingMap = dynamic(() => import("./ListingMap"), { ssr: false });

/** MapLibre 6 needs WebGL2; headless or locked-down browsers may not have it. */
function hasWebGL2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/**
 * Mounts the map only when its box scrolls near the viewport, so the ~250 kB
 * MapLibre bundle and the tiles never compete with the gallery for the first
 * paint. Wrapped in `data-lenis-prevent` so dragging the map never scrolls the
 * page (CLAUDE.md).
 *
 * The box clips with `overflow: clip`, NOT `hidden`. Lenis's stylesheet gives
 * every `[data-lenis-prevent]` element `overscroll-behavior: contain`, and an
 * `overflow: hidden` box is a scroll container, so a wheel over the map could
 * neither scroll it nor chain to the page: the page froze under the pointer.
 * `clip` is not a scroll container, so the wheel passes on (the map itself
 * zooms only with Ctrl/⌘ + wheel, `cooperativeGestures`).
 */
export function ListingMapLoader(props: ListingMapProps) {
  const t = useTranslations("listing.locationBlock");
  const tSearch = useTranslations("search");
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "visible" | "unsupported">("idle");
  const [loaded, setLoaded] = useState(false);
  const { failed, fail } = useLoadDeadline(state === "visible" && !loaded);
  const mapState =
    state !== "visible" ? state : loaded ? "ready" : failed ? "unavailable" : "loading";

  const handleLoad = useCallback(() => setLoaded(true), []);

  useEffect(() => {
    const node = box.current;
    if (node === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState(hasWebGL2() ? "visible" : "unsupported");
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={box}
      role="region"
      aria-label={t("mapLabel")}
      data-lenis-prevent=""
      data-map-state={mapState}
      className="relative aspect-[4/3] w-full overflow-clip bg-ivory-2 md:aspect-[16/9]"
    >
      {state === "visible" ? <ListingMap {...props} onLoad={handleLoad} onFailed={fail} /> : null}
      {mapState === "ready" || mapState === "loading" ? null : (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 bg-ivory-2 p-6 text-center text-stone-text">
          <MapPin aria-hidden="true" strokeWidth={1.25} className="size-6" />
          {mapState === "unsupported" ? <p className="text-small">{tSearch("mapUnavailable")}</p> : null}
          {mapState === "unavailable" ? (
            <p role="status" className="max-w-[28ch] text-small">
              {t("mapOffline")}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
