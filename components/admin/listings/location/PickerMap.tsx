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
import { maplibregl } from "@/components/map/maplibre";
import { applyHouseStyleOnce } from "@/components/map/style";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { round6 } from "./coords";

/**
 * The admin pin picker (PRD B3 "Lokacija"): click the map or drag the pin.
 * Same stack as the public maps (OpenFreeMap Positron + the house style +
 * the worker set up in `components/map/maplibre`).
 *
 * Only ever imported through `next/dynamic({ ssr: false })` from LocationPicker.
 */

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const PICK_ZOOM = 16;
const MIN_FOLLOW_ZOOM = 15;

/** MapLibre's own UI strings, in the admin's language. */
const MAP_LOCALE: Record<string, string> = {
  "Map.Title": "Mapa za postavljanje pina",
  "Marker.Title": "Pin nekretnine",
  "NavigationControl.ZoomIn": "Uvećaj",
  "NavigationControl.ZoomOut": "Umanji",
  "NavigationControl.ResetBearing": "Vrati sever na vrh",
  "AttributionControl.ToggleAttribution": "Izvori podataka mape",
  "CooperativeGesturesHandler.WindowsHelpText": "Držite Ctrl i skrolujte da biste uvećali mapu",
  "CooperativeGesturesHandler.MacHelpText": "Držite ⌘ i skrolujte da biste uvećali mapu",
  "CooperativeGesturesHandler.MobileHelpText": "Mapu pomerajte sa dva prsta",
};

export type PickerMapProps = {
  lat: number;
  lng: number;
  /** Coordinates already rounded to 6 decimals. */
  onPick: (next: { lat: number; lng: number }) => void;
  onLoad: () => void;
  /** The style or its sources failed before the first `load`. */
  onFailed: () => void;
};

export default function PickerMap({ lat, lng, onPick, onLoad, onFailed }: PickerMapProps) {
  const reduced = useReducedMotion();
  const mapRef = useRef<MapRef>(null);
  const loaded = useRef(false);
  /**
   * The point this map last aimed at or set itself. A prop change to anything
   * else came from outside (an address pick, typed coordinates) and re-centres
   * the camera; the user's own clicks and drags never move the camera.
   */
  const known = useRef({ lat, lng });
  const [initialView] = useState(() => ({ latitude: lat, longitude: lng, zoom: PICK_ZOOM }));

  useEffect(() => {
    if (known.current.lat === lat && known.current.lng === lng) return;
    known.current = { lat, lng };
    const map = mapRef.current;
    if (map === null) return;
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), MIN_FOLLOW_ZOOM),
      duration: reduced ? 0 : 800,
    });
  }, [lat, lng, reduced]);

  const pick = (next: { lat: number; lng: number }) => {
    const rounded = { lat: round6(next.lat), lng: round6(next.lng) };
    known.current = rounded;
    onPick(rounded);
  };

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
        // A click on the pin itself bubbles to the map; it must not nudge the pin.
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
