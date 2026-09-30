/** Six decimals ≈ 11 cm: more than a pin can mean, and what the editor stores. */
export function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** A generous box around Serbia; outside it the admin warns but never blocks. */
export const SERBIA_BOUNDS = { latMin: 41.8, latMax: 46.3, lngMin: 18.8, lngMax: 23.1 } as const;

export function insideSerbia(lat: number, lng: number): boolean {
  return (
    lat >= SERBIA_BOUNDS.latMin &&
    lat <= SERBIA_BOUNDS.latMax &&
    lng >= SERBIA_BOUNDS.lngMin &&
    lng <= SERBIA_BOUNDS.lngMax
  );
}

export type CoordAxis = "lat" | "lng";

const LIMIT: Record<CoordAxis, number> = { lat: 90, lng: 180 };

/**
 * Parses a typed coordinate. Accepts a decimal comma (Serbian keyboards) or a
 * point; rejects exponents, text and anything outside the globe.
 */
export function parseCoordinate(
  text: string,
  axis: CoordAxis,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: "Unesite koordinatu." };
  if (!/^[-+]?\d{1,3}(?:[.,]\d+)?$/.test(trimmed)) {
    return { ok: false, error: axis === "lat" ? "Unesite broj, npr. 44.8125." : "Unesite broj, npr. 20.4612." };
  }
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || Math.abs(value) > LIMIT[axis]) {
    return {
      ok: false,
      error: axis === "lat" ? "Geografska širina mora biti između −90 i 90." : "Geografska dužina mora biti između −180 i 180.",
    };
  }
  return { ok: true, value: round6(value) };
}
