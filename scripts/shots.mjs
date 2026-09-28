#!/usr/bin/env node
// Screenshot helper for visual QA (used by the night-run steps; Claude reads the PNGs with the Read tool).
//
// Usage:
//   node scripts/shots.mjs [--base http://localhost:3000] [--routes /sr,/sr/nekretnine] [--widths 390,1440]
//                          [--scroll-steps 6] [--delays 300,1200,2500] [--full] [--reduced] [--out .shots/name]
//
//   --routes        comma-separated paths (default: key public pages in sr-Latn)
//   --widths        viewport widths; height is derived (390 -> 844, 768 -> 1024, else 900)
//   --scroll-steps  after the first viewport, scroll N times by ~90% of the viewport (wheel events, so
//                   Lenis + ScrollTrigger react like for a real user) and capture each position
//   --delays        extra captures of the first viewport at these ms after load (intro animations)
//   --full          also capture a full-page screenshot per route/width
//   --reduced       emulate prefers-reduced-motion: reduce
// Before every capture the script waits for the network to go idle, for
// document.fonts.ready and for every <img> to decode, so a screenshot never
// shows an LQIP placeholder or a fallback face (which made a warm photograph
// look like a grey smear and hid a broken display font in step 04).
// Output: PNG files + report.json (console errors, failed requests, page errors) in the out dir.
// Requires a running server (npm run dev or npm run start). Exit code 0 even with console errors;
// read report.json for problems.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

const base = String(arg("base", "http://localhost:3000")).replace(/\/$/, "");
const routes = String(arg("routes", "/sr,/sr/nekretnine,/sr/procena,/sr/o-nama,/sr/kontakt"))
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);
const widths = String(arg("widths", "390,1440"))
  .split(",")
  .map((w) => Number(w.trim()))
  .filter((w) => w > 0);
const scrollSteps = Number(arg("scroll-steps", 0)) || 0;
const delays = String(arg("delays", ""))
  .split(",")
  .map((d) => Number(d.trim()))
  .filter((d) => d > 0);
const full = arg("full", false) === true;
const reduced = arg("reduced", false) === true;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = String(arg("out", path.join(".shots", stamp)));
mkdirSync(outDir, { recursive: true });

const heightFor = (w) => (w <= 400 ? 844 : w <= 800 ? 1024 : 900);
const slug = (r) => r.replace(/^\//, "").replace(/[^a-zA-Z0-9-]+/g, "_") || "root";
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Wait for fonts and images, but never longer than `ms`. `img.decode()` on an
 * image that never finishes loading returns a promise that never settles, so
 * the raw version of this deadlocked the whole run.
 */
async function settleAssets(page, ms = 4000) {
  await page
    .evaluate(async (limit) => {
      const cap = new Promise((res) => setTimeout(res, limit));
      const work = (async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((img) =>
            img.complete ? null : img.decode().catch(() => {}),
          ),
        );
      })();
      await Promise.race([work, cap]);
    }, ms)
    .catch(() => {});
}

const launchOptions = {};
if (process.env.SHOTS_CHROMIUM_PATH) launchOptions.executablePath = process.env.SHOTS_CHROMIUM_PATH;
const browser = await chromium.launch(launchOptions);
const report = { base, createdAt: new Date().toISOString(), pages: [] };
const files = [];

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: heightFor(width) },
      deviceScaleFactor: 1,
      reducedMotion: reduced ? "reduce" : "no-preference",
      hasTouch: width <= 800,
      isMobile: width <= 500,
    });
    for (const route of routes) {
      const page = await context.newPage();
      const entry = { route, width, consoleErrors: [], pageErrors: [], failedRequests: [], status: null };
      page.on("console", (m) => {
        if (m.type() === "error") entry.consoleErrors.push(m.text().slice(0, 500));
      });
      page.on("pageerror", (e) => entry.pageErrors.push(String(e).slice(0, 500)));
      page.on("requestfailed", (r) => entry.failedRequests.push(`${r.failure()?.errorText ?? "failed"} ${r.url()}`.slice(0, 300)));
      const name = `${slug(route)}_${width}`;
      try {
        const resp = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
        entry.status = resp ? resp.status() : null;
        for (const d of delays) {
          await sleep(d);
          const f = path.join(outDir, `${name}_t${d}.png`);
          await page.screenshot({ path: f });
          files.push(f);
        }
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        // Fonts and images must be resolved before the first capture, or the
        // shot shows a fallback face and an LQIP placeholder rather than the
        // thing under review.
        await settleAssets(page);
        await sleep(2200);
        const first = path.join(outDir, `${name}_00.png`);
        await page.screenshot({ path: first });
        files.push(first);
        for (let i = 1; i <= scrollSteps; i++) {
          await page.mouse.move(width / 2, heightFor(width) / 2);
          await page.mouse.wheel(0, Math.round(heightFor(width) * 0.9));
          await sleep(1400);
          await settleAssets(page, 2500);
          const f = path.join(outDir, `${name}_${String(i).padStart(2, "0")}.png`);
          await page.screenshot({ path: f });
          files.push(f);
        }
        if (full) {
          const f = path.join(outDir, `${name}_full.png`);
          await page.screenshot({ path: f, fullPage: true });
          files.push(f);
        }
      } catch (e) {
        entry.pageErrors.push(`navigation/screenshot failed: ${String(e).slice(0, 300)}`);
      }
      report.pages.push(entry);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
const problems = report.pages.filter((p) => p.consoleErrors.length || p.pageErrors.length || (p.status && p.status >= 400));
console.log(`[shots] ${files.length} screenshots -> ${outDir}`);
for (const f of files) console.log(`  ${f}`);
if (problems.length) {
  console.log(`[shots] pages with problems: ${problems.length} (see ${path.join(outDir, "report.json")})`);
  for (const p of problems) {
    console.log(`  ${p.route} @${p.width}: status=${p.status} console=${p.consoleErrors.length} pageErrors=${p.pageErrors.length}`);
  }
} else {
  console.log("[shots] no console/page errors");
}
