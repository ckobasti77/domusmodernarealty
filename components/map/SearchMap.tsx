"use client";

import {
  Layer,
  Map as MapGL,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapEvent,
  type MapLayerMouseEvent,
  type MapProps,
  type MapRef,
  type MapSourceDataEvent,
  type MapStyleDataEvent,
  type PopupInstance,
  type ViewStateChangeEvent,
} from "@vis.gl/react-maplibre";
import { useQuery } from "convex/react";
import type { FeatureCollection, Point } from "geojson";
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  Offset,
} from "maplibre-gl";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { setHoveredListing, useHoveredListing, useIsHovered } from "@/components/site/search/hover-store";
import { api } from "@/convex/_generated/api";
import type { MapPoint } from "@/convex/lib/dto";
import type { SearchFilters } from "@/convex/lib/validators";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  fixTypography,
  formatArea,
  formatCount,
  formatPinPrice,
  formatPrice,
  formatPricePerM2,
} from "@/lib/format";
import { frameLoader } from "@/lib/image-loaders";
import { pickL10n } from "@/lib/l10n";
import type { Bbox } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { maplibregl } from "./maplibre";
import { applyHouseStyleOnce } from "./style";

/**
 * The results map of the property search (PRD A3). It draws exactly the result
 * set of the list: `listings.mapPoints` runs the list's own `matches()` over the
 * same filters, `bbox` included, so a pin can never exist without its card.
 *
 * Pins are HTML (a price label reads better than any GL symbol and gets a real
 * focus ring), clustered by a GeoJSON source and rebuilt from
 * `querySourceFeatures` whenever the camera settles or the data reloads. Past
 * {@link MAX_HTML_PINS} unclustered points in view the pins switch to a GL
 * circle layer, so a dense viewport never mounts hundreds of DOM nodes.
 *
 * Only ever imported through `next/dynamic({ ssr: false })` by
 * `SearchMapLoader`, which owns the WebGL check and the search-as-move toggle.
 */

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const SOURCE_ID = "search-results";
const POINTS_LAYER = "search-results-points";
const INTERACTIVE_LAYERS = [POINTS_LAYER];

/** Belgrade, where most of the stock is (brief), for a search with no results. */
const DEFAULT_VIEW = { latitude: 44.8125, longitude: 20.4612, zoom: 11 };
const FIT_MAX_ZOOM = 14;
const CLUSTER_RADIUS = 48;
const CLUSTER_MAX_ZOOM = 15;
const MAX_HTML_PINS = 150;
const MOVE_DEBOUNCE_MS = 400;
const EASE_MS = 600;

/** The pin's pointer triangle, and the rise per listing that shares a spot. */
const POINTER_PX = 5;
const STACK_STEP_PX = 28;
/** Where a pin's label ends above its point, so the card never covers it. */
const PIN_TOP_PX = POINTER_PX + 24 + 8;

const INK = "#0e0d0b";
const PAPER = "#fbf9f5";
const BRONZE_DEEP = "#8c6d3f";

const UNCLUSTERED: FilterSpecification = ["!", ["has", "point_count"]];

const POPUP_OFFSET: Offset = {
  center: [0, 0],
  top: [0, 8],
  "top-left": [8, 8],
  "top-right": [-8, 8],
  bottom: [0, -PIN_TOP_PX],
  "bottom-left": [8, -PIN_TOP_PX],
  "bottom-right": [-8, -PIN_TOP_PX],
  left: [36, -PIN_TOP_PX / 2],
  right: [-36, -PIN_TOP_PX / 2],
};

/**
 * MapLibre's own stylesheet is unlayered, so it beats every Tailwind utility on
 * the elements it styles; the overrides of its chrome need `!`. Scoped to this
 * map, never global.
 */
const MAP_CHROME = [
  "[&_.maplibregl-ctrl-group]:rounded-none!",
  "[&_.maplibregl-ctrl-group]:shadow-none!",
  "[&_.maplibregl-ctrl-group]:bg-paper!",
  "[&_.maplibregl-ctrl-group]:border",
  "[&_.maplibregl-ctrl-group]:border-hairline-light",
  "[&_.maplibregl-ctrl-attrib]:rounded-[2px]!",
].join(" ");

const POPUP_CHROME = [
  "z-[4]",
  "[&_.maplibregl-popup-tip]:hidden",
  "[&_.maplibregl-popup-content]:p-0!",
  "[&_.maplibregl-popup-content]:rounded-none!",
  "[&_.maplibregl-popup-content]:shadow-none!",
  "[&_.maplibregl-popup-content]:bg-paper!",
  "[&_.maplibregl-popup-content]:border",
  "[&_.maplibregl-popup-content]:border-ink/15",
  "[&_.maplibregl-popup-close-button]:z-10",
  "[&_.maplibregl-popup-close-button]:flex",
  "[&_.maplibregl-popup-close-button]:size-8",
  "[&_.maplibregl-popup-close-button]:items-center",
  "[&_.maplibregl-popup-close-button]:justify-center",
  "[&_.maplibregl-popup-close-button]:text-[20px]",
  "[&_.maplibregl-popup-close-button]:leading-none",
  "[&_.maplibregl-popup-close-button]:text-paper",
  "[&_.maplibregl-popup-close-button]:rounded-none!",
  "[&_.maplibregl-popup-close-button]:bg-ink/75!",
  "[&_.maplibregl-popup-close-button]:transition-colors",
  "[&_.maplibregl-popup-close-button]:duration-150",
  "[&_.maplibregl-popup-close-button:hover]:bg-ink!",
  "[&_.maplibregl-popup-close-button:focus-visible]:outline-2",
  "[&_.maplibregl-popup-close-button:focus-visible]:-outline-offset-4",
  "[&_.maplibregl-popup-close-button:focus-visible]:outline-paper",
].join(" ");

const FILL = { width: "100%", height: "100%" };
const RAISED = { zIndex: 1 };
const FLAT = { zIndex: 0 };
const NO_POINTS: readonly MapPoint[] = [];

type PinProperties = {
  id: string;
  price: number;
  transaction: MapPoint["transaction"];
  priceOnRequest: boolean;
};

type ClusterItem = { id: number; count: number; lng: number; lat: number };
type PinItem = { id: string; stack: number };
type Visible = { clusters: ClusterItem[]; pins: PinItem[]; gl: boolean; signature: string };

const NOTHING_VISIBLE: Visible = { clusters: [], pins: [], gl: false, signature: "" };

export type SearchMapProps = {
  filters: SearchFilters;
  active: boolean;
  searchAsMove: boolean;
  onBoundsChange: (bbox: Bbox) => void;
  initialBbox?: Bbox;
  /** Fired on the map's `load`, with a reader of the live viewport for the toggle. */
  onReady: (readBounds: () => Bbox | null) => void;
};

const round = (value: number) => Math.round(value * 10_000) / 10_000;
const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/**
 * The viewport as a URL bbox, or null while the container is hidden: MapLibre
 * then sizes its canvas to a 400×300 fallback, and reporting that would narrow
 * the search to a box the visitor never saw.
 */
function readBbox(map: MapLibreMap): Bbox | null {
  const container = map.getContainer();
  if (container.clientWidth === 0 || container.clientHeight === 0) return null;
  const bounds = map.getBounds();
  return {
    west: round(clamp(bounds.getWest(), 180)),
    south: round(clamp(bounds.getSouth(), 90)),
    east: round(clamp(bounds.getEast(), 180)),
    north: round(clamp(bounds.getNorth(), 90)),
  };
}

/** Frame the result set; one listing gets a street-level zoom instead of a degenerate box. */
function frame(map: MapLibreMap, points: readonly MapPoint[], duration: number) {
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (points.length === 0 || width === 0 || height === 0) return;
  if (points.length === 1) {
    map.easeTo({ center: [points[0].lng, points[0].lat], zoom: FIT_MAX_ZOOM, duration });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const point of points) bounds.extend([point.lng, point.lat]);
  // Scaled down on a small map, where 48 px a side would leave no room to fit
  // anything; the top also clears the toggle and the pins standing on the points.
  const pad = Math.min(48, Math.floor(Math.min(width, height) / 8));
  const top = pad + Math.min(56, Math.floor(height / 8));
  // The sticky panel starts below the page header band, so on first paint its
  // lower part can sit under the fold: frame the results in the part a
  // visitor can actually see (never more than half the panel).
  const hidden = Math.max(0, container.getBoundingClientRect().bottom - window.innerHeight);
  const bottom = pad + Math.min(hidden, Math.floor(height / 2));
  map.fitBounds(bounds, {
    padding: { top, right: pad, bottom, left: pad },
    maxZoom: FIT_MAX_ZOOM,
    duration,
  });
}

/**
 * The clusters and pins inside the viewport. `querySourceFeatures` returns
 * whole loaded tiles, which reach well past the map's edges, and repeats
 * features across tile borders, so both are clipped to the bounds and
 * de-duplicated. Listings that share a snapped coordinate never separate
 * however far the map zooms, so each gets a stack index and rises above the
 * one below instead of hiding under it.
 */
function collectVisible(map: MapLibreMap): Visible | null {
  if (map.getSource(SOURCE_ID) === undefined || !map.isSourceLoaded(SOURCE_ID)) return null;
  const bounds = map.getBounds();
  const clusters = new Map<number, ClusterItem>();
  const pins = new Map<string, PinItem>();
  const stacks = new Map<string, number>();

  for (const feature of map.querySourceFeatures(SOURCE_ID)) {
    if (feature.geometry.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates;
    if (!bounds.contains([lng, lat])) continue;
    const clusterId: unknown = feature.properties.cluster_id;
    const count: unknown = feature.properties.point_count;
    const id: unknown = feature.properties.id;
    if (typeof clusterId === "number" && typeof count === "number") {
      if (!clusters.has(clusterId)) clusters.set(clusterId, { id: clusterId, count, lng, lat });
    } else if (typeof id === "string" && !pins.has(id)) {
      const spot = `${lng},${lat}`;
      const stack = stacks.get(spot) ?? 0;
      stacks.set(spot, stack + 1);
      pins.set(id, { id, stack });
    }
  }

  const gl = pins.size > MAX_HTML_PINS;
  const clusterList = [...clusters.values()];
  const pinList = gl ? [] : [...pins.values()];
  const signature = [
    clusterList.map((c) => `${c.id}@${c.lng},${c.lat}#${c.count}`).join(";"),
    pinList.map((p) => `${p.id}^${p.stack}`).join(";"),
    String(gl),
  ].join("|");
  return { clusters: clusterList, pins: pinList, gl, signature };
}

/** A cancellable trailing timer: the viewport is reported once the camera has settled. */
function createDebounce(ms: number) {
  let timer: number | undefined;
  return {
    schedule(run: () => void) {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, ms);
    },
    cancel() {
      window.clearTimeout(timer);
    },
  };
}

function featureId(event: MapLayerMouseEvent): string | null {
  const id: unknown = event.features?.[0]?.properties.id;
  return typeof id === "string" ? id : null;
}

export default function SearchMap({
  filters,
  active,
  searchAsMove,
  onBoundsChange,
  initialBbox,
  onReady,
}: SearchMapProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("search.map");
  const tCommon = useTranslations("common");
  const tZoom = useTranslations("listing.lightbox");
  const reduced = useReducedMotion();

  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState<Visible>(NOTHING_VISIBLE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glPointer, setGlPointer] = useState(false);
  const [settle] = useState(() => createDebounce(MOVE_DEBOUNCE_MS));

  // A URL viewport is restored as-is and never auto-fitted over (only the first
  // render's props count: the map reads its initial view once).
  const [restored] = useState(initialBbox !== undefined);
  const [initialView] = useState<NonNullable<MapProps["initialViewState"]>>(() =>
    initialBbox !== undefined
      ? {
          bounds: [
            [initialBbox.west, initialBbox.south],
            [initialBbox.east, initialBbox.north],
          ],
        }
      : DEFAULT_VIEW,
  );
  const [mapLocale] = useState(() => ({
    "Map.Title": t("label"),
    "Popup.Close": tCommon("close"),
    "NavigationControl.ZoomIn": tZoom("zoomIn"),
    "NavigationControl.ZoomOut": tZoom("zoomOut"),
    "AttributionControl.ToggleAttribution": t("attribution"),
  }));

  // While new filters load, `useQuery` returns undefined; the last result stays
  // on screen so the pins never flash off between two searches.
  const result = useQuery(api.listings.mapPoints, { filters });
  const [held, setHeld] = useState(result);
  if (result !== undefined && result !== held) setHeld(result);
  const data = result ?? held;
  const points = data?.points ?? NO_POINTS;
  const filtersKey = JSON.stringify(filters);

  const byId = useMemo(() => new Map<string, MapPoint>(points.map((point) => [point._id, point])), [points]);
  const collection = useMemo<FeatureCollection<Point, PinProperties>>(
    () => ({
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        properties: {
          id: point._id,
          price: point.price,
          transaction: point.transaction,
          priceOnRequest: point.priceOnRequest === true,
        },
      })),
    }),
    [points],
  );

  const refresh = useCallback((map: MapLibreMap) => {
    const next = collectVisible(map);
    if (next !== null) setVisible((current) => (current.signature === next.signature ? current : next));
  }, []);

  const expandCluster = useCallback(
    (cluster: ClusterItem) => {
      const map = mapRef.current?.getMap();
      const source = map?.getSource<GeoJSONSource>(SOURCE_ID);
      if (map === undefined || source === undefined) return;
      source.getClusterExpansionZoom(cluster.id).then(
        (zoom) => map.easeTo({ center: [cluster.lng, cluster.lat], zoom, duration: reduced ? 0 : EASE_MS }),
        // The result set changed under the click and the cluster is gone; the
        // markers already rebuilt from the new data show what is there now.
        () => undefined,
      );
    },
    [reduced],
  );

  // A pending report dies with the toggle: the visitor switched back to the list's own area.
  useEffect(() => {
    if (!searchAsMove) return undefined;
    return () => settle.cancel();
  }, [searchAsMove, settle]);

  // MapLibre watches its container, but a `display: none` container (the phone
  // list view) has no size to watch, so the canvas is re-measured on return.
  const shown = useRef(active);
  useEffect(() => {
    const wasShown = shown.current;
    shown.current = active;
    if (active && !wasShown) mapRef.current?.getMap().resize();
  }, [active]);

  // Frame each new result set once. The first frame is instant (the map should
  // open already framed); later ones glide unless motion is reduced. Nothing is
  // framed while the visitor drives the search with the map, over a restored
  // URL viewport, or while the map is hidden (retried when it shows again).
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!loaded || !active || map === undefined || result === undefined) return;
    if (fitted.current === filtersKey) return;
    const first = fitted.current === null;
    fitted.current = filtersKey;
    if (searchAsMove || (first && restored)) return;
    frame(map, result.points, first || reduced ? 0 : EASE_MS);
  }, [active, filtersKey, loaded, reduced, restored, result, searchAsMove]);

  function handleStyleData(event: MapStyleDataEvent) {
    applyHouseStyleOnce(event.target, locale);
  }

  function handleLoad(event: MapEvent) {
    const map = event.target;
    // No compass is shown, so nothing may leave north-up.
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    setLoaded(true);
    refresh(map);
    onReady(() => {
      const current = mapRef.current?.getMap();
      return current === undefined ? null : readBbox(current);
    });
  }

  function handleMoveEnd(event: ViewStateChangeEvent) {
    const map = event.target;
    refresh(map);
    if (!searchAsMove) return;
    settle.schedule(() => {
      const bbox = readBbox(map);
      if (bbox !== null) onBoundsChange(bbox);
    });
  }

  function handleSourceData(event: MapSourceDataEvent) {
    if (event.sourceId === SOURCE_ID && event.isSourceLoaded) refresh(event.target);
  }

  // The last `sourcedata` of a zoom change can fire before MapLibre marks the
  // parent tile as covered, leaving that zoom's clusters beside the new pins;
  // `idle` comes after the frame that settles it.
  function handleIdle(event: MapEvent) {
    refresh(event.target);
  }

  function handleClick(event: MapLayerMouseEvent) {
    const target = event.originalEvent.target;
    // Pins, clusters and the card are DOM inside the map, so MapLibre reports
    // their clicks as map clicks too; they handle their own.
    if (target instanceof Element && target.closest(".maplibregl-marker, .maplibregl-popup") !== null) return;
    setSelectedId(featureId(event));
  }

  function handleGlHover(event: MapLayerMouseEvent) {
    const id = featureId(event);
    if (id !== null) setHoveredListing(id, "map");
  }

  function handleGlLeave() {
    setGlPointer(false);
    setHoveredListing(null, "map");
  }

  const selected = selectedId === null ? undefined : byId.get(selectedId);
  const openId = selected?._id ?? null;

  // MapLibre anchors the card on the side with more room but never moves the
  // map, so a pin mid-way down a short map opens a card cut off at the edge.
  // The map pans just enough to show it whole, and only then does focus move
  // in (`preventScroll`: focusing a clipped card would scroll the map's
  // `overflow: hidden` container out from under the canvas). One frame late,
  // not on the popup's `open` event: dev StrictMode removes and re-adds a new
  // popup after every effect has run, which would drop the focus again.
  const popupRef = useRef<PopupInstance>(null);
  useEffect(() => {
    if (openId === null) return undefined;
    const request = requestAnimationFrame(() => {
      const map = mapRef.current?.getMap();
      const card = popupRef.current?.getElement();
      if (map === undefined || card === undefined) return;
      const box = card.getBoundingClientRect();
      const view = map.getContainer().getBoundingClientRect();
      const margin = 12;
      const dx =
        box.left < view.left + margin
          ? box.left - view.left - margin
          : Math.max(0, box.right - view.right + margin);
      // On a map shorter than the card, the top of the card wins.
      const dy = Math.min(Math.max(0, box.bottom - view.bottom + margin), box.top - view.top - margin);
      if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: reduced ? 0 : 300 });
      card.querySelector<HTMLElement>("[data-map-card]")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(request);
  }, [openId, reduced]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || selected === undefined) return;
    const fromCard = event.target instanceof Element && event.target.closest(".maplibregl-popup") !== null;
    setSelectedId(null);
    // Focus returns to the pin that opened the card, not to the top of the page.
    if (fromCard) {
      event.currentTarget.querySelector<HTMLElement>(`[data-listing-id="${selected._id}"]`)?.focus();
    }
  }

  return (
    <div className={cn("absolute inset-0", MAP_CHROME)} onKeyDown={handleKeyDown}>
      <MapGL
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={STYLE}
        initialViewState={initialView}
        locale={mapLocale}
        style={FILL}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        attributionControl={{ compact: true }}
        interactiveLayerIds={visible.gl ? INTERACTIVE_LAYERS : undefined}
        cursor={visible.gl && glPointer ? "pointer" : undefined}
        onStyleData={handleStyleData}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        onSourceData={handleSourceData}
        onIdle={handleIdle}
        onClick={handleClick}
        onMouseEnter={() => setGlPointer(true)}
        onMouseMove={handleGlHover}
        onMouseLeave={handleGlLeave}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source
          id={SOURCE_ID}
          type="geojson"
          data={collection}
          cluster
          clusterRadius={CLUSTER_RADIUS}
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
        >
          <PointsLayer shown={visible.gl} />
        </Source>

        {visible.clusters.map((cluster) => (
          <ClusterMarker key={cluster.id} cluster={cluster} onExpand={expandCluster} />
        ))}

        {visible.pins.map((pin) => {
          const point = byId.get(pin.id);
          return point === undefined ? null : (
            <PinMarker
              key={pin.id}
              point={point}
              stack={pin.stack}
              selected={pin.id === selectedId}
              onSelect={setSelectedId}
            />
          );
        })}

        {selected !== undefined ? (
          <Popup
            ref={popupRef}
            key={selected._id}
            longitude={selected.lng}
            latitude={selected.lat}
            offset={POPUP_OFFSET}
            maxWidth="240px"
            closeOnClick={false}
            focusAfterOpen={false}
            className={POPUP_CHROME}
            onClose={() => setSelectedId(null)}
          >
            <MiniCard point={selected} />
          </Popup>
        ) : null}
      </MapGL>

      {data?.truncated === true ? (
        <p
          role="status"
          className="pointer-events-none absolute bottom-3 left-3 z-[3] max-w-[calc(100%-4.5rem)] border border-hairline-light bg-paper px-3 py-2 text-small text-stone-text"
        >
          {t("truncated", { count: data.points.length })}
        </p>
      ) : null}

      {searchAsMove && data !== undefined && data.points.length === 0 ? (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-3 top-16 z-[3] mx-auto w-fit max-w-sm border border-hairline-light bg-paper px-4 py-3 text-center text-small text-ink"
        >
          {t("emptyArea")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Unclustered points as GL circles. Always on the map, because MapLibre only
 * loads tiles for a source that has a visible layer, and the HTML markers read
 * those tiles; transparent until the viewport is too dense for DOM pins.
 */
function PointsLayer({ shown }: { shown: boolean }) {
  const { id } = useHoveredListing();
  const paint = useMemo<CircleLayerSpecification["paint"]>(() => {
    const hovered: ExpressionSpecification = ["==", ["get", "id"], id ?? ""];
    const opacity = shown ? 1 : 0;
    return {
      "circle-radius": ["case", hovered, 8, 6],
      "circle-color": ["case", hovered, BRONZE_DEEP, INK],
      "circle-stroke-color": PAPER,
      "circle-stroke-width": 1.5,
      "circle-opacity": opacity,
      "circle-stroke-opacity": opacity,
    };
  }, [id, shown]);
  return <Layer id={POINTS_LAYER} source={SOURCE_ID} type="circle" filter={UNCLUSTERED} paint={paint} />;
}

const ClusterMarker = memo(function ClusterMarker({
  cluster,
  onExpand,
}: {
  cluster: ClusterItem;
  onExpand: (cluster: ClusterItem) => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("search.map");
  const size = cluster.count < 10 ? "size-8" : cluster.count < 100 ? "size-10" : "size-12";
  return (
    <Marker longitude={cluster.lng} latitude={cluster.lat} anchor="center">
      <button
        type="button"
        data-testid="map-cluster"
        data-numeric
        aria-label={t("cluster", { count: cluster.count })}
        onClick={() => onExpand(cluster)}
        className={cn(
          "flex cursor-pointer items-center justify-center bg-ink font-mono text-[12px] leading-none text-paper ring-1 ring-inset ring-bronze/70 transition-colors duration-150 hover:bg-bronze-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-deep",
          size,
        )}
      >
        {formatCount(cluster.count, locale)}
      </button>
    </Marker>
  );
});

type PinMarkerProps = {
  point: MapPoint;
  stack: number;
  selected: boolean;
  onSelect: (id: string) => void;
};

/**
 * A price pin. It subscribes to its own hover state, so a card hover re-renders
 * two pins, not all of them.
 */
const PinMarker = memo(function PinMarker({ point, stack, selected, onSelect }: PinMarkerProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("search.map");
  const tListing = useTranslations("listing");
  const hovered = useIsHovered(point._id);
  const lifted = hovered || selected;

  const onRequest = point.priceOnRequest === true;
  const label = onRequest ? tListing("priceOnRequest") : formatPinPrice(point.price, locale);
  const price = onRequest ? label : formatPrice(point.price, locale);

  return (
    <Marker
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      offset={[0, -(POINTER_PX + stack * STACK_STEP_PX)]}
      style={lifted ? RAISED : FLAT}
    >
      <button
        type="button"
        data-testid="map-pin"
        data-listing-id={point._id}
        data-hovered={hovered ? "true" : "false"}
        data-numeric
        aria-label={t("pin", { price, title: pickL10n(point.title, locale).text })}
        aria-haspopup="dialog"
        aria-expanded={selected}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setHoveredListing(point._id, "map");
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") setHoveredListing(null, "map");
        }}
        onFocus={() => setHoveredListing(point._id, "map")}
        onBlur={() => setHoveredListing(null, "map")}
        onClick={() => onSelect(point._id)}
        className={cn(
          "relative flex h-6 min-w-6 cursor-pointer items-center justify-center whitespace-nowrap px-2 font-mono text-[12px] leading-none text-paper transition-colors duration-150",
          "after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-x-[5px] after:border-t-[5px] after:border-x-transparent after:transition-colors after:duration-150 after:content-['']",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-deep",
          lifted ? "bg-bronze-deep after:border-t-bronze-deep" : "bg-ink after:border-t-ink",
        )}
      >
        {label}
      </button>
    </Marker>
  );
});

/**
 * The card a pin opens: photo, price with €/m², title, size, and the way in.
 * A non-modal dialog that takes focus itself (no ring: it is not a control),
 * so Escape reaches the map from a mouse click as well as from the keyboard,
 * and Tab goes on to the link.
 */
function MiniCard({ point }: { point: MapPoint }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("search.map");
  const tListing = useTranslations("listing");
  const tCard = useTranslations("card");
  const tUnits = useTranslations("units");

  const title = pickL10n(point.title, locale);
  const onRequest = point.priceOnRequest === true;
  const facts = [formatArea(point.areaM2, locale, tUnits("m2"))];
  if (point.rooms > 0) facts.push(tCard("rooms", { rooms: point.rooms }));

  return (
    <div
      role="dialog"
      aria-label={title.text}
      tabIndex={-1}
      data-map-card=""
      className="w-60 font-sans text-small text-ink outline-none"
    >
      {point.coverUrl !== undefined ? (
        <div className="relative aspect-[3/2] w-full bg-ivory-2">
          <Image
            src={point.coverUrl}
            alt={title.text}
            fill
            sizes="240px"
            loader={frameLoader(point.coverUrl, 2 / 3)}
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 p-4">
        {onRequest ? (
          <p className="text-body font-medium">{tListing("priceOnRequest")}</p>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span data-numeric className="text-body font-medium">
              {formatPrice(point.price, locale)}
              {point.transaction === "rent" ? (
                <span className="ml-1 text-small font-normal text-stone-text">{tUnits("perMonth")}</span>
              ) : null}
            </span>
            {point.pricePerM2 > 0 ? (
              <span data-numeric className="text-small text-stone-text">
                {formatPricePerM2(point.pricePerM2, locale, tUnits("m2"))}
              </span>
            ) : null}
          </p>
        )}

        <p
          lang={title.lang === locale ? undefined : title.lang}
          className="line-clamp-2 font-display text-[1.125rem] leading-[1.3]"
        >
          {fixTypography(title.text)}
        </p>

        <p data-numeric className="text-stone-text">
          {facts.join(" · ")}
        </p>

        <Link
          href={{ pathname: "/properties/[slug]", params: { slug: point.slug } }}
          prefetch={false}
          className="mt-1 self-start font-medium text-bronze-text underline decoration-bronze/60 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink"
        >
          {t("viewListing")}
        </Link>
      </div>
    </div>
  );
}
