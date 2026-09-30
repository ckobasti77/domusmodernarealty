/**
 * Public coordinates.
 *
 * Snapping, NOT jittering. A deterministic offset derived from the document id
 * is invertible — the id ships next to the coordinates in the same DTO and the
 * algorithm is in this repo, so anyone could subtract it and recover the exact
 * address. Rounding to a grid destroys the information instead:
 *  - "exact"  → untouched;
 *  - "street" → ~110 m cell, which hides the house number but keeps the street;
 *  - "area"   → ~550 m cell, i.e. roughly a neighborhood block.
 *
 * Lives on its own so the search post-filter (`lib/search.ts`) can test a map
 * bounding box against exactly the coordinates the map draws, without importing
 * the DTO module.
 */
import type { AddressVisibility } from "./validators";

const STREET_GRID = 0.001;
const AREA_GRID = 0.005;

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function publicCoords(
  lat: number,
  lng: number,
  visibility: AddressVisibility,
): { lat: number; lng: number; precision: AddressVisibility } {
  if (visibility === "exact") return { lat, lng, precision: "exact" };
  const grid = visibility === "street" ? STREET_GRID : AREA_GRID;
  return {
    lat: snap(lat, grid),
    lng: snap(lng, grid),
    precision: visibility,
  };
}

export type Bbox = { west: number; south: number; east: number; north: number };

/** Inclusive on every edge, so a pin exactly on the map border still counts. */
export function inBbox(point: { lat: number; lng: number }, bbox: Bbox): boolean {
  return (
    point.lng >= bbox.west &&
    point.lng <= bbox.east &&
    point.lat >= bbox.south &&
    point.lat <= bbox.north
  );
}
