"use client";

import {
  Layer,
  Map,
  Marker,
  NavigationControl,
  Source,
  type MapSourceDataEvent,
  type MapStyleDataEvent,
} from "@vis.gl/react-maplibre";
import type { Feature, Polygon } from "geojson";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { foldAttributionOnce, MAP_CHROME } from "./chrome";
import { maplibregl } from "./maplibre";
import { applyHouseStyleOnce } from "./style";
import { useMapLocale } from "./useMapLocale";

/**
 * A single-listing map (PRD A5): an exact pin when the listing publishes its
 * address, otherwise a translucent circle over the snapped public coordinates,
 * so the page never implies more precision than the DTO allows.
 *
 * This module is only ever imported through `next/dynamic({ ssr: false })`.
 */

const STYLE = "https://tiles.openfreemap.org/styles/positron";

/** Radii that match the snapping grid in `convex/lib/dto.ts::publicCoords`. */
const RADIUS_M = { street: 180, area: 650 } as const;

function circle(lat: number, lng: number, radiusM: number, steps = 64): Feature<Polygon> {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

export type ListingMapProps = {
  lat: number;
  lng: number;
  precision: "exact" | "street" | "area";
  locale: string;
};

type ListingMapEvents = {
  onLoad: () => void;
  /** The style or its sources failed before the first `load`. */
  onFailed: () => void;
};

export default function ListingMap({ lat, lng, precision, locale, onLoad, onFailed }: ListingMapProps & ListingMapEvents) {
  const exact = precision === "exact";
  const loaded = useRef(false);
  const t = useTranslations("listing.locationBlock");
  const mapLocale = useMapLocale(t("mapLabel"));
  return (
    <div className={cn("absolute inset-0", MAP_CHROME)}>
      <Map
        mapLib={maplibregl}
        mapStyle={STYLE}
        initialViewState={{ latitude: lat, longitude: lng, zoom: exact ? 15.5 : precision === "street" ? 15 : 14 }}
        locale={mapLocale}
        style={{ width: "100%", height: "100%" }}
        scrollZoom={false}
        dragRotate={false}
        touchPitch={false}
        cooperativeGestures
        attributionControl={{ compact: true }}
        onStyleData={(event: MapStyleDataEvent) => applyHouseStyleOnce(event.target, locale)}
        onSourceData={(event: MapSourceDataEvent) => foldAttributionOnce(event.target)}
        onLoad={() => {
          loaded.current = true;
          onLoad();
        }}
        // Before `load` an error means no map at all; later ones are single tiles MapLibre retries.
        onError={() => {
          if (!loaded.current) onFailed();
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {exact ? (
          <Marker latitude={lat} longitude={lng} anchor="bottom">
            <span aria-hidden="true" className="block size-5 -translate-y-1 rounded-full border-2 border-paper bg-bronze-deep outline outline-1 outline-ink/40" />
          </Marker>
        ) : (
          <Source id="listing-area" type="geojson" data={circle(lat, lng, RADIUS_M[precision])}>
            <Layer id="listing-area-fill" type="fill" paint={{ "fill-color": "#8c6d3f", "fill-opacity": 0.16 }} />
            <Layer id="listing-area-line" type="line" paint={{ "line-color": "#8c6d3f", "line-width": 1.5 }} />
          </Source>
        )}
      </Map>
    </div>
  );
}
