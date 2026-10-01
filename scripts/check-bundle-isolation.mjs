#!/usr/bin/env node
// Verifies that the heavy immersive-tour libraries (Photo Sphere Viewer,
// three.js, Spark) stay out of every route's initial JavaScript and load only
// as dynamic chunks (IMPLEMENTATION-PLAN step 11, "bundle isolation").
//
// Usage (after `next build`): node scripts/check-bundle-isolation.mjs [--json]
//
// For every app route it reads the client reference manifest's `entryJSFiles`
// (the chunks a first visit loads), finds the chunks that contain one of the
// libraries' marker strings, and fails when a route's entry chunks include
// one. It also prints each route's initial JS size (gzip) and the dynamic
// chunks of the listing page.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import vm from "node:vm";

const ROOT = process.cwd();
const NEXT = path.join(ROOT, ".next");
const APP = path.join(NEXT, "server", "app");

/** Strings that survive minification in each library. */
const MARKERS = {
  "photo-sphere-viewer": ["psv-container", "PhotoSphereViewer"],
  spark: ["pcsogszip", "SparkRenderer"],
  three: ["THREE.WebGLRenderer"],
};

function walk(dir, match, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, match, out);
    else if (match(entry)) out.push(full);
  }
  return out;
}

const chunkCache = new Map();
function chunkInfo(rel) {
  if (!chunkCache.has(rel)) {
    const file = path.join(NEXT, rel);
    const source = readFileSync(file);
    const text = source.toString("utf8");
    const libraries = Object.entries(MARKERS)
      .filter(([, markers]) => markers.some((marker) => text.includes(marker)))
      .map(([name]) => name);
    chunkCache.set(rel, { gzip: gzipSync(source).length, libraries });
  }
  return chunkCache.get(rel);
}

function manifestOf(file) {
  const context = { self: {}, globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(file, "utf8"), context);
  const manifest = context.__RSC_MANIFEST ?? context.self.__RSC_MANIFEST;
  return Object.values(manifest)[0];
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const manifests = walk(APP, (name) => name === "page_client-reference-manifest.js");
const rows = [];
let failures = 0;
for (const file of manifests) {
  const route = "/" + path.relative(APP, path.dirname(file)).split(path.sep).join("/");
  const entry = manifestOf(file).entryJSFiles;
  const chunks = [...new Set(Object.values(entry).flat())].filter((rel) => rel.endsWith(".js"));
  let gzip = 0;
  const heavy = new Set();
  for (const rel of chunks) {
    const info = chunkInfo(rel);
    gzip += info.gzip;
    for (const library of info.libraries) heavy.add(library);
  }
  if (heavy.size > 0) failures += 1;
  rows.push({ route, chunks: chunks.length, gzip, heavy: [...heavy] });
}
rows.sort((a, b) => a.route.localeCompare(b.route));

const listingDir = path.join(APP, "[locale]", "properties", "[slug]", "page");
const loadable = JSON.parse(readFileSync(path.join(listingDir, "react-loadable-manifest.json"), "utf8"));
const dynamicChunks = Object.values(loadable).map((item) => ({
  files: item.files.filter((rel) => rel.endsWith(".js")),
  libraries: [...new Set(item.files.filter((rel) => rel.endsWith(".js")).flatMap((rel) => chunkInfo(rel).libraries))],
  gzip: item.files.filter((rel) => rel.endsWith(".js")).reduce((sum, rel) => sum + chunkInfo(rel).gzip, 0),
}));

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify({ rows, dynamicChunks }, null, 2) + "\n");
} else {
  process.stdout.write("Initial JS per route (gzip) and tour libraries in it:\n");
  for (const row of rows) {
    process.stdout.write(
      `  ${row.route.padEnd(48)} ${String(row.chunks).padStart(3)} chunks ${kb(row.gzip).padStart(10)}  ${row.heavy.length > 0 ? `HEAVY: ${row.heavy.join(", ")}` : "ok"}\n`,
    );
  }
  process.stdout.write("\nListing page dynamic imports (loaded on click):\n");
  for (const item of dynamicChunks) {
    process.stdout.write(`  ${kb(item.gzip).padStart(10)}  ${item.libraries.join(", ") || "(no tour library)"}  ${item.files.join(" ")}\n`);
  }
}

if (failures > 0) {
  process.stderr.write(`\n${failures} route(s) load a tour library up front.\n`);
  process.exit(1);
}
process.stdout.write(`\nOK: ${rows.length} routes, none loads Photo Sphere Viewer, three.js or Spark up front.\n`);
