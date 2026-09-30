"use client";

import { Info, Loader2, MapPin, Search, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState, type JSX } from "react";
import { useLoadDeadline } from "@/components/map/useLoadDeadline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddressSearch, type GeocodeHit } from "./AddressSearch";
import { insideSerbia, parseCoordinate, round6, type CoordAxis } from "./coords";

const PickerMap = dynamic(() => import("./PickerMap"), { ssr: false });

/** MapLibre 6 needs WebGL2; headless or locked-down browsers may not have it. */
function hasWebGL2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

type LocationPickerProps = {
  lat: number;
  lng: number;
  onChange: (next: { lat: number; lng: number }) => void;
  /** `addressVisibility`, for the helper text only. */
  precision: "exact" | "street" | "area";
  /** e.g. "Kralja Milana 12, Beograd"; prefills the address search. */
  addressQuery: string;
  onAddressPick: (hit: { lat: number; lng: number; street?: string; streetNo?: string; postalCode?: string }) => void;
};

/**
 * The listing pin (PRD B3 "Lokacija"): a MapLibre picker (click or drag), an
 * optional Nominatim address search, and latitude/longitude fields that always
 * work, so the pin can be set even when the tile server is unreachable.
 *
 * The map box is `data-lenis-prevent` (house rule) and carries
 * `data-map-state="loading|ready|unavailable|unsupported"`.
 */
export function LocationPicker({
  lat,
  lng,
  onChange,
  precision,
  addressQuery,
  onAddressPick,
}: LocationPickerProps): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const [mount, setMount] = useState<"idle" | "visible" | "unsupported">("idle");
  const [loaded, setLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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

  const handleAddressPick = (hit: GeocodeHit) => {
    const next = { lat: round6(hit.lat), lng: round6(hit.lng) };
    onAddressPick({
      ...next,
      ...(hit.street !== undefined ? { street: hit.street } : {}),
      ...(hit.streetNo !== undefined ? { streetNo: hit.streetNo } : {}),
      ...(hit.postalCode !== undefined ? { postalCode: hit.postalCode } : {}),
    });
    onChange(next);
    setSearchOpen(false);
  };

  const outside = !insideSerbia(lat, lng);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="flex items-start gap-1.5 text-sm">
            {precision === "exact" ? (
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            {precision === "exact"
              ? "Pin se na sajtu prikazuje tačno."
              : "Na sajtu se prikazuje približna zona, ne tačan pin."}
          </p>
          <p id={helpId} className="text-xs text-muted-foreground">
            Kliknite na mapu ili prevucite pin. Koordinate možete uneti i ručno.
          </p>
        </div>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Search aria-hidden="true" />
              Pronađi adresu
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] p-3">
            <AddressSearch initialQuery={addressQuery} onPick={handleAddressPick} />
          </PopoverContent>
        </Popover>
      </div>

      <div
        ref={box}
        role="region"
        aria-label="Mapa lokacije nekretnine"
        aria-describedby={helpId}
        data-lenis-prevent=""
        data-map-state={mapState}
        className="relative h-[360px] w-full overflow-clip rounded-lg border bg-muted"
      >
        {mount === "visible" ? (
          <PickerMap lat={lat} lng={lng} onPick={onChange} onLoad={handleLoad} onFailed={fail} />
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

      <div className="grid gap-3 sm:grid-cols-2">
        <CoordinateField axis="lat" value={lat} onCommit={(value) => onChange({ lat: value, lng })} />
        <CoordinateField axis="lng" value={lng} onCommit={(value) => onChange({ lat, lng: value })} />
      </div>
      {outside ? (
        <p className="flex items-start gap-1.5 text-xs text-warning-text dark:text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          Koordinate su van Srbije. Proverite unos — možda su geografska širina i dužina zamenjene.
        </p>
      ) : null}
    </div>
  );
}

/**
 * A typed coordinate, committed on blur or Enter (never per keystroke, so the
 * pin does not jump while typing). An invalid value stays in the field with
 * its error; Escape restores the current value.
 */
function CoordinateField({
  axis,
  value,
  onCommit,
}: {
  axis: CoordAxis;
  value: number;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const parsed = draft !== null ? parseCoordinate(draft, axis) : null;
  const error = attempted && parsed !== null && !parsed.ok ? parsed.error : null;

  const commit = () => {
    if (draft === null) return;
    const result = parseCoordinate(draft, axis);
    if (!result.ok) {
      setAttempted(true);
      return;
    }
    setDraft(null);
    setAttempted(false);
    if (result.value !== value) onCommit(result.value);
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{axis === "lat" ? "Geografska širina" : "Geografska dužina"}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft ?? String(value)}
        aria-invalid={error !== null ? true : undefined}
        aria-describedby={error !== null ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setAttempted(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Commit only; never submit an enclosing editor form.
            event.preventDefault();
            commit();
          } else if (event.key === "Escape" && draft !== null) {
            event.preventDefault();
            setDraft(null);
            setAttempted(false);
          }
        }}
      />
      {error !== null ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
