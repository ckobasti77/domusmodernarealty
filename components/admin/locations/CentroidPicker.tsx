"use client";

import { Loader2, MapPin, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { describedBy, FieldShell } from "@/components/admin/common/form";
import { insideSerbia, parseCoordinate, type CoordAxis } from "@/components/admin/listings/location/coords";
import { useLoadDeadline } from "@/components/map/useLoadDeadline";
import { Input } from "@/components/ui/input";

const CentroidMap = dynamic(() => import("./CentroidMap"), { ssr: false });

/** MapLibre 6 needs WebGL2; headless or locked-down browsers may not have it. */
function hasWebGL2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

const AXIS_LABEL: Record<CoordAxis, string> = {
  lat: "Geografska širina",
  lng: "Geografska dužina",
};

/**
 * Centroid of a location: a MapLibre picker plus latitude/longitude fields
 * that always work, so the point can be set even when the tile server is
 * unreachable (the map then says so after `MAP_LOAD_DEADLINE_MS`).
 *
 * The fields hold text (the form's draft); the pin shows the last valid point.
 */
export function CentroidPicker({
  latText,
  lngText,
  fallback,
  zoom,
  errors,
  onTextChange,
  onBlurAxis,
  onPick,
}: {
  latText: string;
  lngText: string;
  /** Shown while a field holds text that is not a coordinate yet. */
  fallback: { lat: number; lng: number };
  zoom: number;
  errors: Partial<Record<CoordAxis, string>>;
  onTextChange: (axis: CoordAxis, text: string) => void;
  onBlurAxis: (axis: CoordAxis) => void;
  onPick: (next: { lat: number; lng: number }) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const baseId = useId();
  const [mount, setMount] = useState<"idle" | "visible" | "unsupported">("idle");
  const [loaded, setLoaded] = useState(false);
  const { failed, fail } = useLoadDeadline(mount === "visible" && !loaded);
  const mapState =
    mount === "unsupported" ? "unsupported" : loaded ? "ready" : failed ? "unavailable" : "loading";
  const handleLoad = useCallback(() => setLoaded(true), []);

  // Mount MapLibre (~250 kB + tiles) only once the box is near the viewport.
  useEffect(() => {
    const node = box.current;
    if (node === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMount(hasWebGL2() ? "visible" : "unsupported");
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const lat = parseCoordinate(latText, "lat");
  const lng = parseCoordinate(lngText, "lng");
  const point = {
    lat: lat.ok ? lat.value : fallback.lat,
    lng: lng.ok ? lng.value : fallback.lng,
  };
  const outside = lat.ok && lng.ok && !insideSerbia(lat.value, lng.value);

  return (
    <div className="col-span-full flex flex-col gap-3">
      <p id={helpId} className="text-xs text-muted-foreground">
        Kliknite na mapu ili prevucite pin na središte lokacije. Koordinate možete uneti i ručno. Stranica
        lokacije i mapa pretrage centriraju se na ovu tačku.
      </p>
      <div
        ref={box}
        role="region"
        aria-label="Mapa središta lokacije"
        aria-describedby={helpId}
        data-map-state={mapState}
        className="relative h-64 w-full overflow-clip rounded-lg border bg-muted md:h-72"
      >
        {mount === "visible" ? (
          <CentroidMap
            lat={point.lat}
            lng={point.lng}
            zoom={zoom}
            onPick={onPick}
            onLoad={handleLoad}
            onFailed={fail}
          />
        ) : null}
        {mapState === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Učitavanje mape…
            </p>
          </div>
        ) : null}
        {mapState === "unavailable" || mapState === "unsupported" ? (
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-muted p-6 text-center">
            <MapPin aria-hidden="true" strokeWidth={1.25} className="size-6 text-muted-foreground" />
            <p role="status" className="max-w-xs text-sm">
              {mapState === "unavailable"
                ? "Mapa trenutno nije dostupna — unesite koordinate ručno."
                : "Ovaj pregledač ne može da prikaže mapu (nema podršku za WebGL2) — unesite koordinate ručno."}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["lat", "lng"] as const).map((axis) => {
          const id = `${baseId}-${axis}`;
          const error = errors[axis];
          return (
            <FieldShell key={axis} id={id} label={AXIS_LABEL[axis]} error={error}>
              <Input
                id={id}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                data-testid={axis === "lat" ? "location-lat" : "location-lng"}
                value={axis === "lat" ? latText : lngText}
                aria-invalid={error !== undefined || undefined}
                aria-describedby={describedBy(id, false, error !== undefined)}
                onChange={(event) => onTextChange(axis, event.currentTarget.value)}
                onBlur={() => onBlurAxis(axis)}
                onKeyDown={(event) => {
                  // Enter confirms the field; it must not submit the editor from here.
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onBlurAxis(axis);
                  }
                }}
              />
            </FieldShell>
          );
        })}
      </div>
      {outside ? (
        <p className="flex items-start gap-1.5 text-xs text-warning-text dark:text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          Tačka je van Srbije i neće biti sačuvana. Proverite da geografska širina i dužina nisu zamenjene.
        </p>
      ) : null}
    </div>
  );
}
