#!/usr/bin/env node
// Lighthouse lab runs for the perf report (step 12): each route on desktop and on mobile
// emulation (Lighthouse's default Moto G Power profile: simulated slow 4G + 4× CPU slowdown),
// N runs each, the median run (by performance score) reported.
//
// Usage:
//   node scripts/lighthouse.mjs [--base http://localhost:3000] [--routes /sr,/sr/nekretnine]
//                               [--runs 3] [--label after] [--out .shots/lighthouse]
//                               [--chrome-flags "--headless=new"] [--throttling simulate|devtools]
//
// On localhost every script arrives instantly and runs before the first paint, and the
// default "simulate" throttling then models the LCP as waiting for all of it over slow 4G.
// "devtools" throttles the real load (network + 4× CPU), so the trace shows what a phone on
// that network would actually paint first. The report states which method each table used.
//
// Requires a production server (npm run build && npm run start). Lighthouse is fetched with
// `npx lighthouse@12.8.2` and drives Playwright's Chromium (CHROME_PATH), so no system Chrome
// is needed. Writes <out>/<label>/<route>-<formfactor>-<run>.json plus <out>/<label>/summary.json
// and prints a markdown table.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const base = String(arg("base", "http://localhost:3000")).replace(/\/$/, "");
const routes = String(arg("routes", "/sr,/sr/nekretnine")).split(",").filter(Boolean);
const runs = Number(arg("runs", 3)) || 3;
const label = String(arg("label", "run"));
const outDir = join(String(arg("out", ".shots/lighthouse")), label);
const chromeFlags = String(arg("chrome-flags", "--headless=new"));
/** "simulate" (Lighthouse default) or "devtools" (real throttling while the page loads). */
const throttling = String(arg("throttling", "simulate"));
mkdirSync(outDir, { recursive: true });

const chromePath = process.env.CHROME_PATH ?? chromium.executablePath();
const slug = (route) => route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "root";

function runOnce(route, formFactor, index) {
  const file = join(outDir, `${slug(route)}-${formFactor}-${index}.json`);
  const args = [
    "--yes",
    "lighthouse@12.8.2",
    `${base}${route}`,
    "--quiet",
    `--chrome-path=${chromePath}`,
    `--chrome-flags=${chromeFlags}`,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    `--output-path=${file}`,
    ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
    `--throttling-method=${throttling}`,
  ];
  const result = spawnSync("npx", args, { shell: process.platform === "win32", stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) throw new Error(`lighthouse failed for ${route} (${formFactor}): ${result.stderr.slice(-800)}`);
  const lhr = JSON.parse(readFileSync(file, "utf8"));
  const audit = (id) => lhr.audits[id];
  const lcpElement = audit("largest-contentful-paint-element")?.details?.items?.[0]?.items?.[0]?.node;
  return {
    route,
    formFactor,
    file,
    performance: Math.round(lhr.categories.performance.score * 100),
    accessibility: Math.round(lhr.categories.accessibility.score * 100),
    bestPractices: Math.round(lhr.categories["best-practices"].score * 100),
    seo: Math.round(lhr.categories.seo.score * 100),
    fcp: audit("first-contentful-paint").numericValue,
    lcp: audit("largest-contentful-paint").numericValue,
    tbt: audit("total-blocking-time").numericValue,
    cls: audit("cumulative-layout-shift").numericValue,
    si: audit("speed-index").numericValue,
    ttfb: audit("server-response-time")?.numericValue,
    bytes: audit("total-byte-weight")?.numericValue,
    lcpElement: lcpElement?.snippet ?? lcpElement?.nodeLabel ?? null,
    renderBlocking: (audit("render-blocking-insight") ?? audit("render-blocking-resources"))?.details?.items?.map((i) => i.url) ?? [],
    unusedJsBytes: audit("unused-javascript")?.details?.overallSavingsBytes ?? 0,
  };
}

const summary = [];
for (const route of routes) {
  for (const formFactor of ["desktop", "mobile"]) {
    const all = [];
    for (let i = 0; i < runs; i += 1) all.push(runOnce(route, formFactor, i));
    all.sort((a, b) => a.performance - b.performance);
    const median = all[Math.floor(all.length / 2)];
    summary.push({ ...median, scores: all.map((r) => r.performance) });
    console.error(`${route} ${formFactor}: ${all.map((r) => r.performance).join(", ")}`);
  }
}
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

const s = (ms) => (ms === undefined ? "—" : `${(ms / 1000).toFixed(2)} s`);
console.log("| Route | Device | Perf (runs) | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | TTFB | KB |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of summary) {
  console.log(
    `| \`${r.route}\` | ${r.formFactor} | **${r.performance}** (${r.scores.join("/")}) | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${s(r.fcp)} | ${s(r.lcp)} | ${Math.round(r.tbt)} ms | ${r.cls.toFixed(3)} | ${s(r.si)} | ${r.ttfb === undefined ? "—" : `${Math.round(r.ttfb)} ms`} | ${Math.round((r.bytes ?? 0) / 1024)} |`,
  );
}
