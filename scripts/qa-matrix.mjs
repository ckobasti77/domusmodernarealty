#!/usr/bin/env node
// QA matrix crawler (night-run step 13): every public route × sr/en/ru/de × 390/768/1440.
//
// Usage:
//   node scripts/qa-matrix.mjs [--base http://localhost:3000] [--out .shots/qa]
//                              [--locales sr-Latn,en,ru,de] [--widths 390,768,1440]
//                              [--only home,search] [--concurrency 4] [--no-shots] [--axe]
//                              [--slice-locales sr-Latn]
//
// Per cell (route × locale × width) it records, in <out>/matrix.json:
//   - the document status and <html lang>;
//   - console errors and uncaught page errors;
//   - failed requests (network failures and HTTP >= 400), with the OpenFreeMap
//     tile host reported separately (it has been unreachable from this machine);
//   - broken images (complete, src set, naturalWidth 0) after a scroll-through;
//   - horizontal page overflow, elements that stick out of the viewport or
//     clip their own text, and words wider than a SplitText line mask;
//   - the h1 count and text;
//   - content smells: lorem ipsum, "undefined", "NaN", "null", "[object Object]",
//     raw message keys, "m2" instead of m², and EUR amounts not formatted the
//     way Intl.NumberFormat formats them for the locale.
// --axe also runs axe-core (WCAG 2.0/2.1 A+AA, 2.2 AA) on every sr-Latn cell
// at 390 and 1440 after the page has stopped animating.
// Screenshots: one full-page JPEG per cell (after every reveal has played), plus,
// for --slice-locales (default sr-Latn), the same page cut into tiles of about
// two viewports so a reviewer can read them at full resolution.
// Requires a running production server (npm run build && npm run start).
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const list = (value) =>
  String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const base = String(arg("base", "http://localhost:3000")).replace(/\/$/, "");
const outDir = String(arg("out", path.join(".shots", "qa")));
const locales = list(arg("locales", "sr-Latn,en,ru,de"));
const widths = list(arg("widths", "390,768,1440")).map(Number);
const only = arg("only", "") === "" ? null : new Set(list(arg("only", "")));
const concurrency = Number(arg("concurrency", 4)) || 4;
const shots = arg("no-shots", false) !== true;
const withAxe = arg("axe", false) === true;
const sliceLocales = new Set(list(arg("slice-locales", "sr-Latn")));
mkdirSync(path.join(outDir, "tiles"), { recursive: true });

const TILE_HOST = "tiles.openfreemap.org";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const heightFor = (w) => (w <= 400 ? 844 : w <= 800 ? 1024 : 900);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------- routing */

// The localized segments, read from the router's own table so they cannot drift.
const routingSource = readFileSync("i18n/routing.ts", "utf8");
function segment(route, locale) {
  const start = routingSource.indexOf(`"${route}":`);
  if (start === -1) throw new Error(`route ${route} not in i18n/routing.ts`);
  const rest = routingSource.slice(start + route.length + 3).trimStart();
  if (rest.startsWith('"')) return rest.slice(1, rest.indexOf('"', 1));
  const block = rest.slice(0, rest.indexOf("}"));
  const match = block.match(new RegExp(`(?:"${locale}"|\\b${locale}):\\s*"([^"]+)"`));
  if (match === null) throw new Error(`no ${locale} segment for ${route}`);
  return match[1];
}
function localized(route, locale, slug) {
  const seg = segment(route, locale).replace("[slug]", slug ?? "");
  const prefix = locale === "sr-Latn" ? "/sr" : `/${locale}`;
  return `${prefix}${seg === "/" ? "" : seg}`;
}

/* ---------------------------------------------------- convex lookups */

function convexUrl() {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("NEXT_PUBLIC_CONVEX_URL="));
  if (line === undefined) throw new Error("NEXT_PUBLIC_CONVEX_URL is missing from .env.local");
  return line.slice("NEXT_PUBLIC_CONVEX_URL=".length).trim().replace(/^"|"$/g, "");
}
async function query(fn, args) {
  const response = await fetch(`${convexUrl()}/api/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: fn, args, format: "json" }),
  });
  const body = await response.json();
  if (body.status !== "success") throw new Error(`${fn}: ${JSON.stringify(body).slice(0, 300)}`);
  return body.value;
}

const SHOWCASE = "penthaus-na-24-spratu-u-beogradu-na-vodi-pogled-na-savu-me-1049";
const ORDINARY = "trosoban-stan-u-neimaru-renoviran-2023-me-1042";
const SOLD = "dvoiposoban-stan-na-julinom-brdu-osmi-sprat-sa-lodjom-me-1063";

const [tree, agents, posts, cards] = await Promise.all([
  query("locations:tree", {}),
  query("agents:list", {}),
  query("posts:list", { paginationOpts: { numItems: 20, cursor: null } }),
  query("listings:search", { filters: { transaction: "sale" }, sort: "newest", paginationOpts: { numItems: 4, cursor: null } }),
]);
const city = tree.find((node) => node.kind === "city" && node.saleCount + node.rentCount > 0);
const hood = tree.find((node) => node.kind === "neighborhood" && node.saleCount + node.rentCount > 1);
const agent = agents[0];
const post = posts.page.find((entry) => !entry.slug.startsWith("e2e-"));
const ids = cards.page.slice(0, 3).map((card) => card._id);
if (!city || !hood || !agent || !post || ids.length < 2) throw new Error("the deployment lacks demo content");

/** key → [internal route, slug?, visitor preset] */
const ROUTES = [
  ["home", "/"],
  ["search", "/properties"],
  ["listing-showcase", "/properties/[slug]", SHOWCASE],
  ["listing-ordinary", "/properties/[slug]", ORDINARY],
  ["listing-sold", "/properties/[slug]", SOLD],
  ["locations", "/locations"],
  ["location-city", "/locations/[slug]", city.slug],
  ["location-hood", "/locations/[slug]", hood.slug],
  ["valuation", "/valuation"],
  ["sell", "/sell"],
  ["agents", "/agents"],
  ["agent", "/agents/[slug]", agent.slug],
  ["about", "/about"],
  ["contact", "/contact"],
  ["journal", "/journal"],
  ["post", "/journal/[slug]", post.slug],
  ["favorites", "/favorites"],
  ["compare", "/compare"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["cookies", "/cookies"],
].filter(([key]) => only === null || only.has(key));

/* ------------------------------------------------------- page checks */

// Intl output per locale for a sample amount; any EUR amount on the page must
// use the same grouping separator and the same € position.
function euroShape(locale) {
  const sample = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    125000,
  );
  return { sample, leading: sample.trim().startsWith("€") };
}

async function inspect(page, locale) {
  const shape = euroShape(locale);
  return await page.evaluate(
    ({ shape }) => {
      const vw = document.documentElement.clientWidth;
      const describe = (el) => {
        const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}`;
      };
      const visible = (el) => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      // Inside a container that clips or scrolls horizontally (carousels, rails, sr-only)?
      const clippedByAncestor = (el) => {
        for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (["hidden", "clip", "auto", "scroll"].includes(style.overflowX)) return true;
          if (style.position === "fixed") return true;
        }
        return false;
      };

      const pageOverflow = document.documentElement.scrollWidth - vw;

      const sticking = [];
      const clipped = [];
      for (const el of document.body.querySelectorAll("*")) {
        if (el.closest("[aria-hidden='true'], .sr-only, dialog:not([open]), [data-lenis-prevent] canvas, svg")) continue;
        if (!visible(el)) continue;
        const rect = el.getBoundingClientRect();
        if ((rect.right > vw + 1 || rect.left < -1) && !clippedByAncestor(el) && sticking.length < 12) {
          sticking.push(`${describe(el)} [${Math.round(rect.left)}→${Math.round(rect.right)} of ${vw}]`);
        }
        const style = getComputedStyle(el);
        const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (
          ownText &&
          ["hidden", "clip"].includes(style.overflowX) &&
          style.textOverflow !== "ellipsis" &&
          !style.webkitLineClamp?.match(/^\d/) &&
          el.scrollWidth > el.clientWidth + 2 &&
          clipped.length < 12
        ) {
          clipped.push(`${describe(el)} "${el.textContent.trim().slice(0, 60)}" (${el.scrollWidth}>${el.clientWidth})`);
        }
      }

      // A SplitText line mask clips its line, so a word wider than the column
      // (a long German compound) vanishes there without any page overflow.
      const maskClipped = Array.from(document.querySelectorAll(".split-line-mask"))
        .filter((mask) => mask.firstElementChild && mask.firstElementChild.scrollWidth > mask.clientWidth + 1)
        .slice(0, 6)
        .map((mask) => `"${mask.textContent.trim().slice(0, 60)}" (${mask.firstElementChild.scrollWidth}>${mask.clientWidth})`);

      const brokenImages = Array.from(document.images)
        .filter((img) => img.complete && (img.currentSrc || img.src) && img.naturalWidth === 0)
        .map((img) => (img.currentSrc || img.src).slice(0, 160));
      const pendingLazy = Array.from(document.images).filter((img) => !img.complete).length;

      const h1s = Array.from(document.querySelectorAll("h1")).map((h) => ({
        text: h.textContent.replace(/\s+/g, " ").trim().slice(0, 120),
        visible: visible(h) || h.classList.contains("sr-only"),
      }));

      // Visible text only (no scripts/styles/JSON-LD), plus alt/aria-label/title/placeholder.
      const text = document.body.innerText;
      const attrs = Array.from(document.querySelectorAll("[alt],[aria-label],[title],[placeholder]"))
        .flatMap((el) => ["alt", "aria-label", "title", "placeholder"].map((a) => el.getAttribute(a) ?? ""))
        .join(" \n ");
      const haystack = `${text}\n${attrs}`;
      const smells = [];
      const grab = (re, label) => {
        for (const match of haystack.matchAll(re)) {
          const at = match.index ?? 0;
          smells.push(`${label}: "…${haystack.slice(Math.max(0, at - 30), at + 40).replace(/\s+/g, " ")}…"`);
          if (smells.length > 25) return;
        }
      };
      grab(/lorem|ipsum dolor/gi, "lorem");
      grab(/\bundefined\b/g, "undefined");
      grab(/\bNaN\b/g, "NaN");
      grab(/(?<![\w-])null(?![\w-])/g, "null");
      grab(/\[object Object\]/g, "[object Object]");
      grab(/\bMISSING_MESSAGE\b|\b[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+\b(?!\.(com|rs|org|net|io))/g, "raw key?");
      grab(/\d\s?m2\b/g, "m2");

      // Money: every "<digits> €" / "€<digits>" must match the locale's Intl shape.
      const money = [];
      const wrongMoney = [];
      const moneyRe = /€\s?\d[\d.,   ]*\d|\d[\d.,   ]*\d\s?€/g;
      for (const match of text.matchAll(moneyRe)) {
        const value = match[0];
        money.push(value);
        const leading = value.startsWith("€");
        if (leading !== shape.leading) wrongMoney.push(value);
      }
      return {
        pageOverflow,
        sticking,
        clipped,
        maskClipped,
        brokenImages,
        pendingLazy,
        h1s,
        smells,
        money: money.slice(0, 8),
        wrongMoney: wrongMoney.slice(0, 8),
        lang: document.documentElement.lang,
        title: document.title,
      };
    },
    { shape },
  );
}

async function scrollThrough(page) {
  let y = 0;
  for (let guard = 0; guard < 80; guard += 1) {
    const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    if (y >= max) break;
    y = Math.min(y + Math.round(heightFor(page.viewportSize().width) * 0.8), max);
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await sleep(220);
  }
  await sleep(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
}

async function settle(page, timeout = 12_000) {
  const until = performance.now() + timeout;
  while (performance.now() < until) {
    const calm = await page
      .evaluate(async () => {
        const signature = () =>
          Array.from(document.querySelectorAll("body [style]"))
            .map((element) => element.getAttribute("style") ?? "")
            .join("|");
        const running = () =>
          document.getAnimations().filter((animation) => {
            if (animation.playState !== "running") return false;
            const end = animation.effect?.getComputedTiming().endTime;
            return typeof end === "number" && Number.isFinite(end);
          }).length;
        const before = signature();
        await new Promise((resolve) => setTimeout(resolve, 250));
        return running() === 0 && signature() === before;
      })
      .catch(() => false);
    if (calm) return true;
  }
  return false;
}

/* ---------------------------------------------------------- the run */

const browser = await chromium.launch();
const cells = [];
for (const [key, route, slug] of ROUTES) {
  for (const locale of locales) for (const width of widths) cells.push({ key, route, slug, locale, width });
}

async function runCell(cell) {
  const url = localized(cell.route, cell.locale, cell.slug);
  const context = await browser.newContext({
    viewport: { width: cell.width, height: heightFor(cell.width) },
    deviceScaleFactor: 1,
    isMobile: cell.width <= 400,
    hasTouch: cell.width <= 800,
    locale: cell.locale === "sr-Latn" ? "sr-Latn-RS" : cell.locale,
    timezoneId: "Europe/Belgrade",
  });
  await context.addInitScript((favorites) => {
    window.localStorage.setItem(
      "me.consent.v1",
      JSON.stringify({ v: 1, decidedAt: Date.now(), categories: { necessary: true, analytics: false, marketing: false } }),
    );
    window.sessionStorage.setItem("me.preloaded.v1", "1");
    window.localStorage.setItem("me.favorites.v1", JSON.stringify({ v: 1, ids: favorites }));
    window.localStorage.setItem("me.compare.v1", JSON.stringify({ v: 1, ids: favorites }));
  }, ids);
  const page = await context.newPage();
  const consoleErrors = [];
  const failed = [];
  const tileFailures = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const where = message.location().url ?? "";
    const text = message.text();
    if (where.includes(TILE_HOST) || text.includes(TILE_HOST)) tileFailures.push(text.slice(0, 160));
    else consoleErrors.push(`${text.slice(0, 300)}${where ? ` [${where.slice(0, 120)}]` : ""}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 300)}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "";
    const target = request.url();
    // Aborted by the page itself (navigation, cancelled prefetch, video range) is not a failure.
    if (reason.includes("ERR_ABORTED")) return;
    if (target.includes(TILE_HOST)) tileFailures.push(`${reason} ${target.slice(0, 100)}`);
    else failed.push(`${reason} ${target.slice(0, 200)}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url() !== `${base}${url}`) {
      const target = response.url();
      if (target.includes(TILE_HOST)) tileFailures.push(`${response.status()} ${target.slice(0, 100)}`);
      else failed.push(`${response.status()} ${target.slice(0, 200)}`);
    }
  });

  const result = { ...cell, url, status: 0, error: null };
  try {
    const response = await page.goto(`${base}${url}`, { waitUntil: "load", timeout: 60_000 });
    result.status = response?.status() ?? 0;
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);
    await scrollThrough(page);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    result.settled = await settle(page);
    Object.assign(result, await inspect(page, cell.locale));
    if (shots) {
      const file = path.join(outDir, `${cell.key}__${cell.locale}__${cell.width}.jpg`);
      await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 62, timeout: 60_000 });
      result.shot = file;
      if (sliceLocales.has(cell.locale)) {
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        const tile = cell.width <= 400 ? 1600 : cell.width <= 800 ? 1800 : 1400;
        result.tiles = [];
        for (let y = 0, i = 0; y < total && i < 14; y += tile, i += 1) {
          const tileFile = path.join(outDir, "tiles", `${cell.key}__${cell.locale}__${cell.width}__${String(i).padStart(2, "0")}.jpg`);
          await page.screenshot({
            path: tileFile,
            fullPage: true,
            clip: { x: 0, y, width: cell.width, height: Math.min(tile, total - y) },
            type: "jpeg",
            quality: 70,
            timeout: 60_000,
          });
          result.tiles.push(tileFile);
        }
      }
    }
    if (withAxe && cell.locale === "sr-Latn" && cell.width !== 768) {
      const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      result.axe = axe.violations.map((violation) => ({
        impact: violation.impact,
        id: violation.id,
        help: violation.help,
        targets: violation.nodes.slice(0, 6).map((node) => node.target.join(" ")),
      }));
    }
  } catch (error) {
    result.error = String(error).slice(0, 400);
  }
  result.consoleErrors = consoleErrors;
  result.failedRequests = [...new Set(failed)];
  result.tileFailures = tileFailures.length;
  await context.close();
  return result;
}

const results = [];
let next = 0;
async function worker() {
  while (next < cells.length) {
    const cell = cells[next];
    next += 1;
    const result = await runCell(cell);
    results.push(result);
    const problems = [
      result.error && "ERROR",
      result.status !== 200 && `status ${result.status}`,
      result.consoleErrors?.length && `${result.consoleErrors.length} console`,
      result.failedRequests?.length && `${result.failedRequests.length} failed req`,
      result.brokenImages?.length && `${result.brokenImages.length} broken img`,
      result.maskClipped?.length && `${result.maskClipped.length} mask-clipped`,
      result.pageOverflow > 0 && `overflow ${result.pageOverflow}px`,
      result.h1s && result.h1s.length !== 1 && `${result.h1s.length} h1`,
      result.smells?.length && `${result.smells.length} smells`,
      result.wrongMoney?.length && `${result.wrongMoney.length} money`,
      result.axe?.length && `${result.axe.length} axe`,
    ].filter(Boolean);
    console.log(`[${results.length}/${cells.length}] ${result.url} @${result.width} ${problems.join(", ") || "ok"}`);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
await browser.close();

results.sort((a, b) => (a.key + a.locale + a.width).localeCompare(b.key + b.locale + b.width));
writeFileSync(
  path.join(outDir, "matrix.json"),
  JSON.stringify({ base, slugs: { city: city.slug, hood: hood.slug, agent: agent.slug, post: post.slug }, results }, null, 2),
);
console.log(`wrote ${path.join(outDir, "matrix.json")} (${results.length} cells)`);
