"use client";

import {
  Map,
  Marker,
  NavigationControl,
  type MapLayerMouseEvent,
  type MapRef,
  type MapStyleDataEvent,
  type MarkerDragEvent,
} from "@vis.gl/react-maplibre";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { insideSerbia, round6 } from "@/components/admin/listings/location/coords";
import { maplibregl } from "@/components/map/maplibre";
import { applyHouseStyleOnce } from "@/components/map/style";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The centroid picker of a location: click the map or drag the pin. Same stack
 * as the listing pin picker (OpenFreeMap Positron + the house style), but the
 * zoom follows the kind of place (a city is not picked at street level) and
 * the camera only moves when a typed point leaves the view.
 *
 * Only ever imported through `next/dynamic({ ssr: false })` from CentroidPicker.
 */

const STYLE = "https://tiles.openfreemap.org/styles/positron";

const MAP_LOCALE: Record<string, string> = {
  "Map.Title": "Mapa za središte lokacije",
  "Marker.Title": "Središte lokacije",
  "NavigationControl.ZoomIn": "Uvećaj",
  "NavigationControl.ZoomOut": "Umanji",
  "NavigationControl.ResetBearing": "Vrati sever na vrh",
  "AttributionControl.ToggleAttribution": "Izvori podataka mape",
  "CooperativeGesturesHandler.WindowsHelpText": "Držite Ctrl i skrolujte da biste uvećali mapu",
  "CooperativeGesturesHandler.MacHelpText": "Držite ⌘ i skrolujte da biste uvećali mapu",
  "CooperativeGesturesHandler.MobileHelpText": "Mapu pomerajte sa dva prsta",
};

export type CentroidMapProps = {
  lat: number;
  lng: number;
  zoom: number;
  onPick: (next: { lat: number; lng: number }) => void;
  onLoad: () => void;
  onFailed: () => void;
};

export default function CentroidMap({ lat, lng, zoom, onPick, onLoad, onFailed }: CentroidMapProps) {
  const reduced = useReducedMotion();
  const mapRef = useRef<MapRef>(null);
  const loaded = useRef(false);
  const [initialView] = useState(() => ({ latitude: lat, longitude: lng, zoom }));

  // Typed coordinates: follow only when the pin would leave the view, so each
  // keystroke does not throw the camera around.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !insideSerbia(lat, lng)) return;
    if (map.getBounds().contains([lng, lat])) return;
    map.easeTo({ center: [lng, lat], duration: reduced ? 0 : 400 });
  }, [lat, lng, reduced]);

  const pick = (next: { lat: number; lng: number }) => onPick({ lat: round6(next.lat), lng: round6(next.lng) });

  return (
    <Map
      ref={mapRef}
      mapLib={maplibregl}
      mapStyle={STYLE}
      initialViewState={initialView}
      style={{ width: "100%", height: "100%" }}
      locale={MAP_LOCALE}
      dragRotate={false}
      touchPitch={false}
      pitchWithRotate={false}
      cooperativeGestures
      attributionControl={{ compact: true }}
      cursor="crosshair"
      onStyleData={(event: MapStyleDataEvent) => applyHouseStyleOnce(event.target, "sr-Latn")}
      onLoad={() => {
        loaded.current = true;
        onLoad();
      }}
      // Before `load` an error means no map at all; later ones are single tiles MapLibre retries.
      onError={() => {
        if (!loaded.current) onFailed();
      }}
      onClick={(event: MapLayerMouseEvent) => {
        const target = event.originalEvent.target;
        if (target instanceof Element && target.closest(".maplibregl-marker") !== null) return;
        pick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <Marker
        latitude={lat}
        longitude={lng}
        anchor="bottom"
        draggable
        onDragEnd={(event: MarkerDragEvent) => pick({ lat: event.lngLat.lat, lng: event.lngLat.lng })}
      >
        <MapPin
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-9 cursor-grab fill-primary stroke-background drop-shadow-md active:cursor-grabbing"
        />
      </Marker>
    </Map>
  );
}
