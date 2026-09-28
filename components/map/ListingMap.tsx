"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layer, Map, Marker, NavigationControl, Source } from "@vis.gl/react-maplibre";
import type { Feature, Polygon } from "geojson";

/**
 * A single-listing map (PRD A5): an exact pin when the listing publishes its
 * address, otherwise a translucent circle over the snapped public coordinates,
 * so the page never implies more precision than the DTO allows.
 *
 * MapLibre 6 loads its worker from `public/maplibre/` (ARCHITECTURE §8: the
 * bundled worker URL does not resolve under Turbopack). This module is only
 * ever imported through `next/dynamic({ ssr: false })`.
 */
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

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
};

export default function ListingMap({ lat, lng, precision }: ListingMapProps) {
  const exact = precision === "exact";
  return (
    <Map
      mapLib={maplibregl}
      mapStyle={STYLE}
      initialViewState={{ latitude: lat, longitude: lng, zoom: exact ? 15.5 : precision === "street" ? 15 : 14 }}
      style={{ width: "100%", height: "100%" }}
      scrollZoom={false}
      dragRotate={false}
      touchPitch={false}
      cooperativeGestures
      attributionControl={{ compact: true }}
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
  );
}
