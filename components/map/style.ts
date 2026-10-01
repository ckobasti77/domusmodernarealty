import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";

/**
 * The house map style, applied at runtime on `load` over OpenFreeMap Positron
 * (ARCHITECTURE §8). Positron is a cold grey card; on a warm ivory page it read
 * as a hole in the layout (design-critic, step 07), so the land takes the site
 * ivory, parks and built-up areas are warmed to match, water drops its blue for
 * a warm grey, and icon clutter (POIs, airports, road shields) is hidden so the
 * price pins are the only markers on the map. Roads and place labels stay.
 *
 * Rules key on the OpenMapTiles `source-layer`, not on layer ids, so a restyled
 * Positron keeps working; every layer touched comes from the live style, so a
 * layer the style no longer has is simply never visited.
 *
 * Maps call {@link applyHouseStyleOnce} from `onStyleData`: the first
 * `styledata` fires as the style finishes parsing, before a single tile is
 * requested, so there is no cold-grey first frame and the hidden shield layers
 * are never evaluated (Positron's shield filters warn on every null `ref`).
 */

/** `--color-ivory-2`. */
const LAND = "#EAE3D6";
const WATER = "#CBC6BC";
const WATER_LABEL = "#7D766B";

/** Fill tints per source-layer, each a step darker than the land beneath it. */
const FILL_TINTS = new Map<string, string>([
  ["water", WATER],
  ["landuse", "#E4DCCE"],
  ["aeroway", "#E4DCCE"],
  ["park", "#DEDDCC"],
  ["landcover", "#D8D8C5"],
  ["building", "#DCD3C3"],
]);

const WATER_LABEL_SOURCES = new Set(["water_name", "waterway"]);

/** City and district names: stone type on an ivory halo, so the price pins stay the loudest thing on the map. */
const PLACE_LABEL = "#5C564D";

/** Icon-led symbol layers: shops, transit stops, airports. */
const CLUTTER_SOURCES = new Set(["poi", "aerodrome_label"]);

function sourceLayerOf(layer: LayerSpecification): string | undefined {
  return "source-layer" in layer ? layer["source-layer"] : undefined;
}

function isClutter(layerId: string, sourceLayer: string | undefined): boolean {
  return (sourceLayer !== undefined && CLUTTER_SOURCES.has(sourceLayer)) || layerId.includes("shield");
}

/**
 * Positron prints every label twice ("Patrijarha Varnave Патријарха Варнаве").
 * One script per page: Latin everywhere, Cyrillic for Russian readers. Each
 * locale reads its own OpenMapTiles name first ("Beograd", "Belgrade",
 * "Белград"). Few streets have an English or German name, so those pages fall
 * back to the Serbian Latin one before `name:latin`, an ASCII transliteration
 * of the Cyrillic: the map then reads "Njegoševa" beside the office address,
 * not "Njegoseva".
 */
const LABEL_FIELDS: Record<string, readonly string[]> = {
  "sr-Latn": ["name:sr-Latn", "name:latin"],
  en: ["name:en", "name:sr-Latn", "name:latin"],
  de: ["name:de", "name:sr-Latn", "name:latin"],
  ru: ["name:ru", "name:nonlatin"],
};

function applyHouseStyle(map: MapLibreMap, locale: string) {
  const fields = LABEL_FIELDS[locale] ?? LABEL_FIELDS["sr-Latn"];
  const lookups = fields.map((field): ExpressionSpecification => ["get", field]);
  const label: ExpressionSpecification = ["coalesce", ...lookups, ["get", "name"]];

  for (const layer of map.getStyle().layers) {
    const sourceLayer = sourceLayerOf(layer);

    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", LAND);
    } else if (layer.type === "symbol") {
      if (isClutter(layer.id, sourceLayer)) {
        map.setLayoutProperty(layer.id, "visibility", "none");
        continue;
      }
      if (layer.layout?.["text-field"] !== undefined) {
        map.setLayoutProperty(layer.id, "text-field", label);
      }
      if (sourceLayer !== undefined && WATER_LABEL_SOURCES.has(sourceLayer)) {
        map.setPaintProperty(layer.id, "text-color", WATER_LABEL);
      }
      if (sourceLayer === "place") {
        map.setPaintProperty(layer.id, "text-color", PLACE_LABEL);
        map.setPaintProperty(layer.id, "text-halo-color", LAND);
        map.setPaintProperty(layer.id, "text-halo-width", 1.5);
      }
    } else if (layer.type === "fill" && sourceLayer !== undefined) {
      const tint = FILL_TINTS.get(sourceLayer);
      if (tint !== undefined) map.setPaintProperty(layer.id, "fill-color", tint);
    } else if (layer.type === "line" && sourceLayer === "waterway") {
      map.setPaintProperty(layer.id, "line-color", WATER);
    }
  }
}

const styledMaps = new WeakSet<MapLibreMap>();

/** {@link applyHouseStyle} on the first `styledata` of each map; later events are no-ops. */
export function applyHouseStyleOnce(map: MapLibreMap, locale: string) {
  if (styledMaps.has(map)) return;
  styledMaps.add(map);
  applyHouseStyle(map, locale);
}
