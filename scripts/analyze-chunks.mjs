#!/usr/bin/env node
// Lists the initial JS chunks of public routes (gzip size) and the npm packages / app
// folders each chunk contains, from the client reference manifests of the last `next build`.
// Usage: node scripts/analyze-chunks.mjs [route-substring ...]   e.g. "[locale]/page" "[locale]/about/page"
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const NEXT = path.join(process.cwd(), ".next");
const APP = path.join(NEXT, "server", "app");
const filters = process.argv.slice(2);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith("_client-reference-manifest.js")) out.push(full);
  }
  return out;
}

function manifestOf(file) {
  const context = { self: {}, globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(file, "utf8"), context);
  return Object.values(context.__RSC_MANIFEST ?? context.self.__RSC_MANIFEST)[0];
}

const chunkInfo = new Map();
function info(rel) {
  if (chunkInfo.has(rel)) return chunkInfo.get(rel);
  const source = readFileSync(path.join(NEXT, rel.replace(/^\/?_next\//, "")));
  const text = source.toString("utf8");
  const packages = new Map();
  for (const m of text.matchAll(/\[project\]\/(node_modules\/(?:@[^/]+\/)?[^/]+|app|components\/[^/\]]+|lib|convex|i18n)[^"\]]*/g)) {
    const key = m[1].replace(/^node_modules\//, "");
    packages.set(key, (packages.get(key) ?? 0) + 1);
  }
  const value = { gz: gzipSync(source).length, packages: [...packages.keys()] };
  chunkInfo.set(rel, value);
  return value;
}

for (const file of walk(APP)) {
  const route = path.relative(APP, file).split(path.sep).join("/").replace(/_client-reference-manifest\.js$/, "");
  if (route.startsWith("admin")) continue;
  if (filters.length > 0 && !filters.some((f) => route.includes(f))) continue;
  const manifest = manifestOf(file);
  const entries = Object.entries(manifest.entryJSFiles ?? {});
  const own = entries.find(([key]) => key.endsWith(route.replace(/\/page$/, "/page"))) ?? entries.at(-1);
  const all = new Set(entries.flatMap(([, files]) => files));
  let total = 0;
  const rows = [...all].map((rel) => {
    const i = info(rel);
    total += i.gz;
    return [rel, i];
  });
  console.log(`\n${route}: ${rows.length} chunks, ${(total / 1024).toFixed(1)} KB gz`);
  for (const [rel, i] of rows.sort((a, b) => b[1].gz - a[1].gz)) {
    console.log(`  ${(i.gz / 1024).toFixed(1).padStart(6)} KB  ${path.basename(rel)}  ${i.packages.slice(0, 14).join(", ")}`);
  }
  void own;
}
