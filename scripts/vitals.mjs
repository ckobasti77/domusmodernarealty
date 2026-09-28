#!/usr/bin/env node
// Lab probe for the two load metrics a page can get wrong on its own: which element is the
// Largest Contentful Paint, and whether anything shifts while the page loads (CLS).
//
// Usage:
//   node scripts/vitals.mjs [--base http://localhost:3000] [--routes /sr,/de] [--widths 390,1440]
//                           [--repeat] [--wait 6000]
//
//   --repeat  load as a returning visitor (skips the first-visit preloader); default is a first visit
//   --wait    ms to keep observing after `load` (default 6000), long enough for the preloader
//             curtain, the web fonts and the hero entrance to finish
//
// It is a lab sample on this machine, not field data: use it to catch a wrong LCP element or a
// shift, not to quote timings. Requires a running server (npm run start). Exit code 1 when any
// page has CLS > 0.1 or its LCP is not an <img>/<video> poster.
import { chromium } from "@playwright/test";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

const base = String(arg("base", "http://localhost:3000")).replace(/\/$/, "");
const routes = String(arg("routes", "/sr")).split(",").map((r) => r.trim()).filter(Boolean);
const widths = String(arg("widths", "390,1440")).split(",").map((w) => Number(w.trim())).filter((w) => w > 0);
const repeat = arg("repeat", false) === true;
const wait = Number(arg("wait", 6000)) || 6000;

const heightFor = (w) => (w <= 400 ? 844 : w <= 800 ? 1024 : 900);

const browser = await chromium.launch();
let failed = false;

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: heightFor(width) },
      deviceScaleFactor: width <= 500 ? 3 : 1,
      isMobile: width <= 500,
      hasTouch: width <= 800,
    });
    await context.addInitScript((isRepeat) => {
      if (isRepeat) window.sessionStorage.setItem("me.preloaded.v1", "1");
      // Record everything from the first byte; `buffered` alone misses nothing either,
      // but the observers must exist before the page's own scripts run.
      window.__vitals = { lcp: [], shifts: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const el = entry.element;
          window.__vitals.lcp.push({
            time: Math.round(entry.startTime),
            size: entry.size,
            tag: el ? el.tagName.toLowerCase() : null,
            id: el?.id || null,
            src: el && "currentSrc" in el ? el.currentSrc : entry.url || null,
            fetchPriority: el?.getAttribute?.("fetchpriority") ?? null,
            text: el && el.tagName !== "IMG" ? (el.textContent ?? "").trim().slice(0, 60) : null,
          });
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__vitals.shifts.push({
            time: Math.round(entry.startTime),
            value: Number(entry.value.toFixed(4)),
            hadRecentInput: entry.hadRecentInput,
            sources: (entry.sources ?? []).map((s) => {
              const n = s.node;
              const r = (rect) => `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
              const moved = ` [${r(s.previousRect)} -> ${r(s.currentRect)}]`;
              if (!n || n.nodeType !== 1) return String(n?.nodeName ?? "?") + moved;
              const cls = typeof n.className === "string" ? n.className.split(" ").slice(0, 3).join(".") : "";
              const hook = [...n.attributes].find((a) => a.name.startsWith("data-"))?.name ?? "";
              return `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${cls ? `.${cls}` : ""}${hook ? `[${hook}]` : ""}${moved}`;
            }),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    }, repeat);

    for (const route of routes) {
      const page = await context.newPage();
      await page.goto(base + route, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(wait);
      const result = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          ...window.__vitals,
          fontsStatus: document.fonts.status,
          ttfb: nav ? Math.round(nav.responseStart) : null,
        };
      });
      const last = result.lcp.at(-1) ?? null;
      const cls = result.shifts.filter((s) => !s.hadRecentInput).reduce((sum, s) => sum + s.value, 0);
      const lcpIsMedia = last !== null && (last.tag === "img" || last.tag === "video");
      console.log(`\n${route} @${width} (${repeat ? "repeat visit" : "first visit"})`);
      console.log(`  TTFB ${result.ttfb} ms, fonts ${result.fontsStatus}`);
      console.log(`  LCP  ${last ? `${last.tag}${last.id ? `#${last.id}` : ""} at ${last.time} ms, size ${last.size}, fetchpriority=${last.fetchPriority}` : "none"}`);
      if (last?.src) console.log(`       ${last.src}`);
      if (last?.text) console.log(`       "${last.text}"`);
      if (result.lcp.length > 1) {
        console.log(`  LCP candidates: ${result.lcp.map((c) => `${c.tag}@${c.time}ms(${c.size})`).join(" -> ")}`);
      }
      console.log(`  CLS  ${cls.toFixed(4)} from ${result.shifts.length} shift entr${result.shifts.length === 1 ? "y" : "ies"}`);
      for (const s of result.shifts) {
        console.log(`       +${s.value} at ${s.time} ms${s.hadRecentInput ? " (after input)" : ""}: ${s.sources.join(", ")}`);
      }
      if (cls > 0.1 || !lcpIsMedia) failed = true;
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

process.exit(failed ? 1 : 0);
