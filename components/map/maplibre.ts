import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The one entry point to MapLibre for every map on the site.
 *
 * MapLibre 6 loads its worker as a separate module, and under Turbopack the
 * bundled worker URL does not resolve (ARCHITECTURE §8), so
 * `scripts/copy-maplibre-worker.mjs` serves the worker and its shared chunk from
 * `public/maplibre/`. Pointing MapLibre there at module load runs exactly once,
 * however many maps mount. Only ever imported from modules that are themselves
 * loaded through `next/dynamic({ ssr: false })`.
 */
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export { maplibregl };
