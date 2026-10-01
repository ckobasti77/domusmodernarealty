import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * MapLibre's controls in the house style, for the wrapper of every map: sharp,
 * hairline, paper, no shadow, and the OSM credit in the site's sans.
 *
 * MapLibre's own stylesheet is unlayered, so it beats every Tailwind utility on
 * the elements it styles; the overrides of its chrome need `!`. Scoped to a
 * map's wrapper, never global.
 */
export const MAP_CHROME = [
  "[&_.maplibregl-ctrl-group]:rounded-none!",
  "[&_.maplibregl-ctrl-group]:shadow-none!",
  "[&_.maplibregl-ctrl-group]:bg-paper!",
  "[&_.maplibregl-ctrl-group]:border",
  "[&_.maplibregl-ctrl-group]:border-hairline-light",
  "[&_.maplibregl-ctrl-attrib]:rounded-[2px]!",
  "[&_.maplibregl-ctrl-attrib]:font-sans",
  "[&_.maplibregl-ctrl-attrib]:text-[11px]",
  "[&_.maplibregl-ctrl-attrib.maplibregl-compact]:bg-paper!",
  "[&_.maplibregl-ctrl-attrib-button]:rounded-none!",
].join(" ");

const foldedMaps = new WeakSet<MapLibreMap>();

/**
 * The compact OSM credit opens unfolded the moment the attribution fills in,
 * and MapLibre folds it only after the first drag: on a phone the two-line box
 * covers a fifth of a listing map, or the search map's List/Mapa switch. Fold
 * it once, as soon as it exists, behind its "i" button, which keeps the credit
 * one tap away. Closing the `<details>` too keeps that button's expanded state
 * true for screen readers; MapLibre's toggle handles both states.
 *
 * Call from `sourcedata`: MapLibre fills the credit in on that event, and its
 * control subscribed before the React map did, so it has run by then.
 */
export function foldAttributionOnce(map: MapLibreMap) {
  if (foldedMaps.has(map)) return;
  const credit = map.getContainer().querySelector(".maplibregl-ctrl-attrib.maplibregl-compact");
  if (credit === null) return;
  foldedMaps.add(map);
  credit.classList.remove("maplibregl-compact-show");
  credit.removeAttribute("open");
}
