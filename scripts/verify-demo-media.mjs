#!/usr/bin/env node
/**
 * Verifies every demo media URL in `docs/assets/demo-media.json` and writes the
 * survivors to `convex/seed/media.generated.ts`.
 *
 * Usage: node scripts/verify-demo-media.mjs
 *
 * Plain Node ESM, no dependencies. Each URL is probed with HEAD first and, if
 * that fails (some CDNs reject HEAD), once more with a 1-byte ranged GET.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "docs", "assets", "demo-media.json");
const OUTPUT = path.join(ROOT, "convex", "seed", "media.generated.ts");

const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;
/** Same transform the site applies, so we hit the same host + pipeline. */
const UNSPLASH_PROBE_QUERY = "?w=64&q=60&auto=format&fit=crop";
const HEADERS = {
  "user-agent":
    "mihajlo-estate-media-verifier/1.0 (+node scripts/verify-demo-media.mjs)",
  accept: "*/*",
};

/* ------------------------------------------------------------------ probing */

/** Releases the body so the socket is not held open. */
async function drain(response) {
  try {
    await response.arrayBuffer();
  } catch {
    /* body already consumed or aborted - nothing to do */
  }
}

async function request(url, init) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: HEADERS,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
  });
  await drain(response);
  return response;
}

function errorText(error) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "timeout";
    const cause = error.cause instanceof Error ? error.cause.message : null;
    return `${error.name}: ${cause ?? error.message}`;
  }
  return String(error);
}

/**
 * HEAD first, then one ranged GET retry.
 *
 * @param {string} url
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
async function probe(url) {
  let headDetail;
  try {
    const response = await request(url, { method: "HEAD" });
    if (response.status < 400) {
      return { ok: true, detail: `HEAD ${response.status}` };
    }
    headDetail = `HEAD ${response.status}`;
  } catch (error) {
    headDetail = `HEAD ${errorText(error)}`;
  }

  try {
    const response = await request(url, {
      method: "GET",
      headers: { ...HEADERS, range: "bytes=0-0" },
    });
    if (response.status < 400) {
      return { ok: true, detail: `GET ${response.status}` };
    }
    return { ok: false, detail: `${headDetail}, GET ${response.status}` };
  } catch (error) {
    return { ok: false, detail: `${headDetail}, GET ${errorText(error)}` };
  }
}

/** Runs `worker` over `items` with at most `limit` requests in flight. */
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    })(),
  );
  await Promise.all(runners);
  return results;
}

/* -------------------------------------------------------------------- tasks */

/**
 * @param {{ unsplash?: object[], panoramas?: object[], splats?: object[] }} media
 */
function buildTasks(media) {
  const tasks = [];

  for (const photo of media.unsplash ?? []) {
    tasks.push({
      group: "photos",
      category: photo.category,
      url: photo.url,
      probeUrl: `${photo.url}${UNSPLASH_PROBE_QUERY}`,
      record: {
        category: photo.category,
        url: photo.url,
        author: photo.author,
        alt: photo.alt,
        page: photo.page,
      },
    });
  }

  for (const panorama of media.panoramas ?? []) {
    tasks.push({
      group: "panoramas",
      category: "panoramas",
      url: panorama.url,
      probeUrl: panorama.url,
      record: {
        id: panorama.id,
        url: panorama.url,
        page: panorama.page,
        license: panorama.license,
      },
    });
  }

  for (const splat of media.splats ?? []) {
    tasks.push({
      group: "splats",
      category: "splats",
      url: splat.url,
      probeUrl: splat.url,
      record: {
        url: splat.url,
        format: splat.format,
        license: splat.license,
        desc: splat.desc,
      },
    });
  }

  return tasks;
}

/* ----------------------------------------------------------------- code gen */

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const lit = (value) => JSON.stringify(value);
const propKey = (name) => (IDENTIFIER.test(name) ? name : JSON.stringify(name));

/** Prettier defaults, so the generated file needs no reformatting. */
const PRINT_WIDTH = 80;
const TAB_WIDTH = 2;
/** Prettier keeps an overlong string on the key line when the key is short. */
const SHORT_KEY_WIDTH = TAB_WIDTH + 3;

function propertyLine(name, value, indent) {
  const pad = " ".repeat(indent);
  const key = propKey(name);
  const printed = lit(value);
  const oneLine = `${pad}${key}: ${printed},`;
  if (key.length < SHORT_KEY_WIDTH || oneLine.length <= PRINT_WIDTH) {
    return oneLine;
  }
  return `${pad}${key}:\n${" ".repeat(indent + TAB_WIDTH)}${printed},`;
}

function objectLiteral(record, indent) {
  const pad = " ".repeat(indent);
  const fields = Object.entries(record)
    .map(([name, value]) => propertyLine(name, value, indent + TAB_WIDTH))
    .join("\n");
  return `${pad}{\n${fields}\n${pad}}`;
}

function arrayLiteral(name, type, records) {
  if (records.length === 0) return `export const ${name}: ${type} = [];`;
  const body = records.map((record) => objectLiteral(record, 2)).join(",\n");
  return `export const ${name}: ${type} = [\n${body},\n];`;
}

function byCategoryLiteral(photos) {
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const photo of photos) {
    const bucket = groups.get(photo.category);
    if (bucket) bucket.push(photo);
    else groups.set(photo.category, [photo]);
  }

  const declaration =
    "export const DEMO_PHOTOS_BY_CATEGORY: Record<string, DemoPhoto[]>";
  if (groups.size === 0) return `${declaration} = {};`;

  const entries = [...groups]
    .map(([category, list]) => {
      const body = list.map((photo) => objectLiteral(photo, 4)).join(",\n");
      return `  ${propKey(category)}: [\n${body},\n  ],`;
    })
    .join("\n");
  return `${declaration} = {\n${entries}\n};`;
}

function renderModule({ verifiedAt, photos, panoramas, splats }) {
  const lines = [
    "// GENERATED FILE - do not edit by hand.",
    "// Written by scripts/verify-demo-media.mjs from docs/assets/demo-media.json.",
    "// Every URL below answered a non-error HTTP request at VERIFIED_AT; re-run",
    "// `node scripts/verify-demo-media.mjs` to re-check and regenerate.",
    "",
    "export type DemoPhoto = {",
    "  category: string;",
    "  url: string;",
    "  author: string;",
    "  alt: string;",
    "  page: string;",
    "};",
    "",
    "export type DemoPanorama = {",
    "  id: string;",
    "  url: string;",
    "  page: string;",
    "  license: string;",
    "};",
    "",
    "export type DemoSplat = {",
    "  url: string;",
    "  format: string;",
    "  license: string;",
    "  desc: string;",
    "};",
    "",
    `export const VERIFIED_AT = ${lit(verifiedAt)};`,
    "",
    arrayLiteral("DEMO_PHOTOS", "DemoPhoto[]", photos),
    "",
    byCategoryLiteral(photos),
    "",
    arrayLiteral("DEMO_PANORAMAS", "DemoPanorama[]", panoramas),
    "",
    arrayLiteral("DEMO_SPLATS", "DemoSplat[]", splats),
  ];
  return `${lines.join("\n")}\n`;
}

/* --------------------------------------------------------------------- main */

async function main() {
  const media = JSON.parse(await readFile(SOURCE, "utf8"));
  const tasks = buildTasks(media);

  console.log(
    `Checking ${tasks.length} demo media URLs ` +
      `(concurrency ${CONCURRENCY}, timeout ${TIMEOUT_MS / 1000}s)`,
  );

  const checks = await mapPool(tasks, CONCURRENCY, async (task) => {
    const result = await probe(task.probeUrl);
    process.stdout.write(result.ok ? "." : "x");
    return { task, ...result };
  });
  process.stdout.write("\n\n");

  /** @type {Map<string, { ok: number, total: number }>} */
  const summary = new Map();
  const dropped = [];
  const photos = [];
  const panoramas = [];
  const splats = [];

  for (const { task, ok, detail } of checks) {
    const counters = summary.get(task.category) ?? { ok: 0, total: 0 };
    counters.total += 1;
    if (ok) counters.ok += 1;
    summary.set(task.category, counters);

    if (!ok) {
      dropped.push({ category: task.category, url: task.url, detail });
      continue;
    }
    if (task.group === "photos") photos.push(task.record);
    else if (task.group === "panoramas") panoramas.push(task.record);
    else splats.push(task.record);
  }

  const labelWidth = Math.max(0, ...[...summary.keys()].map((k) => k.length));
  for (const [category, { ok, total }] of summary) {
    const note = ok === total ? "" : `   (${total - ok} dropped)`;
    console.log(`${category.padEnd(labelWidth)}  ${ok} / ${total}${note}`);
  }

  if (dropped.length > 0) {
    console.log("\nDropped URLs:");
    for (const { category, url, detail } of dropped) {
      console.log(`  - [${category}] ${url} -- ${detail}`);
    }
  }

  const verified = tasks.length - dropped.length;
  console.log(
    `\nverified ${verified} / total ${tasks.length} (dropped: ${dropped.length})`,
  );

  const verifiedAt = new Date().toISOString();
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    renderModule({ verifiedAt, photos, panoramas, splats }),
    "utf8",
  );
  console.log(
    `wrote convex/seed/media.generated.ts: ${photos.length} photos, ` +
      `${panoramas.length} panoramas, ${splats.length} splats (${verifiedAt})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
