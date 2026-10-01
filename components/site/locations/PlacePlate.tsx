import { cn } from "@/lib/utils";

/**
 * The picture slot of a place that has no photograph yet: a surveyor's plate
 * instead of a stock photo of somewhere else, or a broken image. The bronze
 * mark sits where the place lies relative to its parent's centre (a city
 * relative to the middle of Serbia), so every plate is a tiny, true map and no
 * two look alike. Decorative: the card's heading names the place.
 */

/** Degrees from the reference point to the plate's edge, per kind of place. */
const SPAN: Record<"city" | "municipality" | "neighborhood", number> = {
  city: 2.6,
  municipality: 0.09,
  neighborhood: 0.03,
};

/** Roughly the geographic middle of Serbia, the reference for cities. */
const SERBIA = { lat: 44.0, lng: 20.9 };

function clampPct(value: number): number {
  return Math.min(84, Math.max(16, value));
}

export function PlacePlate({
  kind,
  kindLabel,
  lat,
  lng,
  coordinates,
  origin,
  surface = "ivory",
  className,
}: {
  kind: keyof typeof SPAN;
  /** "Opština", "Kraj"… in the page language. */
  kindLabel: string;
  lat: number;
  lng: number;
  /** `lat` and `lng` as the page's language writes them (`formatCoordinates`). */
  coordinates: { lat: string; lng: string };
  /** The parent's centroid; cities are placed relative to the middle of Serbia. */
  origin?: { lat: number; lng: number };
  /** The surface the card sits on; the plate takes the other ivory. */
  surface?: "ivory" | "ivory-2";
  className?: string;
}) {
  const ref = origin ?? SERBIA;
  const span = SPAN[kind];
  // Longitude degrees shrink with latitude; at 44° N one is ~0.72 of a latitude degree.
  const x = clampPct(50 + ((lng - ref.lng) * Math.cos((lat * Math.PI) / 180) * 50) / span);
  const y = clampPct(50 - ((lat - ref.lat) * 50) / span);
  const plate = surface === "ivory" ? "bg-ivory-2" : "bg-ivory";
  // The labels are knocked out of the crosshair (the plate's own colour behind
  // the text, a hair wider than it), and the mark is painted after them, so a
  // line never strikes through a digit and a label never hides the place.
  const label = cn("absolute -mx-1 px-1 font-mono text-label text-stone-text", plate);

  return (
    <div aria-hidden="true" className={cn("relative size-full overflow-hidden", plate, className)}>
      <span className="absolute inset-3 border border-hairline-light transition-colors duration-300 ease-out pointer-fine:group-hover/place:border-bronze/60" />
      {/* The reference point: where the parent's centre (or Serbia's) is. */}
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone/60" />
      <span className="absolute inset-x-3 h-px bg-bronze/35" style={{ top: `${y}%` }} />
      <span className="absolute inset-y-3 w-px bg-bronze/35" style={{ left: `${x}%` }} />
      <span className={cn(label, "left-6 top-6 uppercase tracking-[0.12em]")}>{kindLabel}</span>
      <span data-numeric="" className={cn(label, "bottom-6 left-6")}>
        <span className="whitespace-nowrap">{coordinates.lat}</span> ·{" "}
        <span className="whitespace-nowrap">{coordinates.lng}</span>
      </span>
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bronze ring-4 ring-bronze/15"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
    </div>
  );
}
