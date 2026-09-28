#!/usr/bin/env node
// MapLibre GL v6 is ESM-only and loads its worker as a separate module. With
// Turbopack (the Next 16 default) the bundled worker URL does not resolve, so we
// serve it from public/ and call setWorkerUrl('/maplibre/maplibre-gl-worker.mjs').
// BOTH files are required: the worker imports the shared chunk at runtime.
// Wired to predev/prebuild. Idempotent: copies only when the source is newer.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

const from = path.join(process.cwd(), "node_modules", "maplibre-gl", "dist");
const to = path.join(process.cwd(), "public", "maplibre");

mkdirSync(to, { recursive: true });

let copied = 0;
for (const file of FILES) {
  const source = path.join(from, file);
  const target = path.join(to, file);

  let sourceStat;
  try {
    sourceStat = statSync(source);
  } catch {
    console.error(`x maplibre: ${file} not found in node_modules/maplibre-gl/dist`);
    process.exit(1);
  }

  let upToDate = false;
  try {
    upToDate = statSync(target).mtimeMs >= sourceStat.mtimeMs;
  } catch {
    upToDate = false;
  }

  if (!upToDate) {
    copyFileSync(source, target);
    copied += 1;
  }
}

console.log(
  copied === 0
    ? "maplibre worker: up to date"
    : `maplibre worker: copied ${copied}/${FILES.length} file(s) to public/maplibre`,
);
