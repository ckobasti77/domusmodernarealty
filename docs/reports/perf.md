# Performance report (step 12)

Measured on 2026-10-01 against the production build (`npm run build && npm run start`) on the build machine (localhost, Windows 11).

- **Tool:** `node scripts/lighthouse.mjs`, which runs Lighthouse 12.8.2 through `npx`, with `CHROME_PATH` set to Playwright's Chromium 1243 (`--headless=new`).
- **Runs:** 3 per route and form factor. Each table cell shows the **median run**, with all three scores in brackets.
- **Mobile:** Lighthouse's default Moto G Power profile: 412 × 823 at DPR 1.75, simulated slow 4G (150 ms RTT, 1.6 Mbps) and a 4× CPU slowdown.
- **Desktop:** `--preset=desktop`.
- **Throttling:** Lighthouse's default `simulate` method.
- **Raw reports:** `.shots/step12-lh/{before,after}/*.json` (gitignored). Re-run with:

```
node scripts/lighthouse.mjs --routes /sr,/sr/nekretnine,/sr/nekretnine/<slug> --runs 3 --label after
```

**Targets:** Performance ≥ 90 on desktop and ≥ 75 on mobile, CLS < 0.1, and no render-blocking surprises.

## Results

### Before (start of step 12, build from commit 9be1d4f + the SEO work)

| Route | Device | Perf (runs) | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | Weight |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/sr` | desktop | **93** (93/93/94) | 100 | 100 | 92 | 0.41 s | 1.47 s | 12 ms | 0.001 | 1.65 s | 2108 KB |
| `/sr` | mobile | **68** (66/68/70) | 100 | 100 | 100 | 1.51 s | 7.22 s | 101 ms | 0.000 | 7.13 s | 1567 KB |
| `/sr/nekretnine` | desktop | **93** (93/93/93) | 99 | 100 | 92 | 0.41 s | 1.50 s | 45 ms | 0.005 | 1.64 s | 2940 KB |
| `/sr/nekretnine` | mobile | **69** (63/69/70) | 99 | 100 | 100 | 1.66 s | 7.53 s | 192 ms | 0.000 | 4.69 s | 1652 KB |
| `/sr/nekretnine/…-me-1042` | desktop | **95** (94/95/95) | 100 | 96 | 100 | 0.41 s | 1.38 s | 0 ms | 0.003 | 1.39 s | 1118 KB |
| `/sr/nekretnine/…-me-1042` | mobile | **69** (69/69/70) | 100 | 96 | 100 | 2.79 s | 6.77 s | 114 ms | 0.027 | 4.53 s | 1042 KB |

### After

| Route | Device | Perf (runs) | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | Weight |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/sr` | desktop | **96** (96/96/96) | 100 | 100 | 100 | 0.45 s | 1.08 s | 11 ms | 0.030 | 1.56 s | 1803 KB |
| `/sr` | mobile | **75** (74/75/76) | 100 | 100 | 100 | 1.67 s | 5.60 s | 114 ms | 0.000 | 4.14 s | 1256 KB |
| `/sr/nekretnine` | desktop | **96** (96/96/97) | 99 | 100 | 92¹ | 0.41 s | 1.12 s | 5 ms | 0.014 | 1.59 s | 2647 KB |
| `/sr/nekretnine` | mobile | **74** (72/74/75) | 99 | 100 | 92¹ | 1.81 s | 5.63 s | 169 ms | 0.000 | 4.32 s | 1350 KB |
| `/sr/nekretnine/…-me-1042` | desktop | **97** (97/97/98) | 100 | 100 | 100 | 0.45 s | 1.05 s | 0 ms | 0.010 | 1.22 s | 841 KB |
| `/sr/nekretnine/…-me-1042` | mobile | **74** (72/74/77) | 100 | 100 | 100 | 1.66 s | 5.86 s | 51 ms | 0.027 | 5.06 s | 758 KB |

¹ **Intermittent.** In 3 of the 6 `/sr/nekretnine` runs, Lighthouse reported "no meta description"; the other 3 found it. The page does carry the description in `<head>`:
- in every crawl by `scripts/seo-audit.mjs` (as Bingbot, all 4 locales);
- in a Playwright load with Lighthouse's user agent, checked at 0, 1.5 and 5 s after `load`.

No soft navigation happens on that page. The likely trigger is the very large document (≈ 680 KB) still being hydrated when Lighthouse samples `<head>`. Step 13 should look at hydration warnings on this page.

### Against the targets

| Target | Result |
|---|---|
| Desktop Performance ≥ 90 | **Met:** 96 / 96 / 97 (was 93 / 93 / 95) |
| Mobile Performance ≥ 75 | **Met on `/sr` (75). Missed by 1 point on search and listing:** median 74, with best runs of 75 and 77 (was 68 / 69 / 69). See "Remaining causes". |
| CLS < 0.1 | **Met** on every run: max 0.030 |
| No render-blocking surprises | **Met:** no `render-blocking-insight` items. The two CSS files are 3 KB + 43 KB, and there is no parser-blocking script. |

## Initial JavaScript per route (gzip)

The table is from `node scripts/check-bundle-isolation.mjs`, which reads each route's client reference manifest. Next 16 no longer prints First Load JS, so this is the per-route figure. The step-11 run is the "before" baseline.

| Route | Before | After | Δ |
|---|---|---|---|
| `/[locale]` (home) | 261.8 KB | 164.8 KB | **−97.0** |
| `/[locale]/properties` (search) | 294.0 KB | 197.0 KB | **−97.0** |
| `/[locale]/properties/[slug]` (listing) | 289.7 KB | 218.3 KB | **−71.4** |
| `/[locale]/contact` | 250.5 KB | 178.3 KB | **−72.2** |
| `/[locale]/sell` | 252.0 KB | 179.8 KB | **−72.2** |
| `/[locale]/valuation` | 254.5 KB | 183.3 KB | **−71.2** |
| `/[locale]/about` (no forms) | 148.2 KB | 139.9 KB | −8.3 |
| other content pages | 139–171 KB | 131–163 KB | about −8 each |

None of the 41 routes loads Photo Sphere Viewer, three.js or Spark up front. The 360° viewer (176 KB) and the 3D walk (1,012 KB) stay click-loaded chunks.

### Heaviest chunks after the changes

Chunks were identified by their contents with `node scripts/analyze-chunks.mjs` (production chunks carry no module paths).

| Chunk (gzip) | Contents | Loaded by |
|---|---|---|
| 49.5 KB | GSAP core + ScrollTrigger + SplitText + CustomEase | every public page (scroll choreography, DESIGN §6) |
| 38.4 KB | react-hook-form + zod core (tree-shaken through `zod/mini`) | listing, contact, sell, valuation |
| 19.8 KB | Convex React client | every public page (live search, favorites, forms, view tracking) |
| 14.9 KB + 4.5 KB | lucide-react icons | every public page |
| 12.9 KB + 9.1 KB | landing-only motion (hero stage, rails) | home |
| 11.8 KB | next-intl + IntlMessageFormat | every public page |
| 11.2 KB | Lenis + motion providers | every public page |

The framework chunks (React DOM, the Next runtime and Next's polyfill module) come on top of these. Lighthouse counts 17 scripts and ~310 KB of script transfer on `/sr` (mobile, after), so the framework is roughly 145 KB beyond the 165 KB in the manifest.

## What changed and why

1. **Font preloads: 12 files (439 KB) → 4 files.**
   - next/font self-hosts every subset a Google family has and the browser picks files by `unicode-range`. Its `subsets` option only decides what is *preloaded*.
   - Every page used to preload latin, latin-ext and cyrillic of EB Garamond (upright + italic), Manrope and JetBrains Mono. On a phone those preloads compete with the hero photo for the first bytes.
   - Now only latin + latin-ext of the upright serif and of Manrope are preloaded.
   - The italic serif is its own non-preloaded family (`font-display-italic`, used only by article pull quotes and the error page). The mono accents and Cyrillic load on demand; `/ru` still gets Cyrillic through `unicode-range`.
   - A page now downloads 6 font files (228 KB) instead of 12 (439 KB).
2. **zod removed from the home and search bundles (−89 KB gz).**
   - `lib/search-params.ts` ran on every filter change with two zod schemas (an amount and a map bbox). They are now plain parsers, with identical behaviour; `lib/search-params.test.ts` passes 13/13.
3. **Forms validate with `zod/mini` (−60 KB gz on listing, contact, sell and valuation).**
   - The six public form schemas were rewritten in the functional `.check(z.trim(), z.minLength(…), z.refine(…))` style.
   - **The import style matters.** `import { z } from "zod/mini"` imports a namespace *value*, which still pulled in all of zod core (393 KB raw). `import * as z from "zod/mini"` lets Turbopack tree-shake it.
   - Fields whose output type used to be narrowed by a type-guard `refine` (valuation `condition`, the on-site `window`) are now `z.pipe(z.string(), z.enum(...))`.
   - The admin keeps classic zod; it has its own bundles.
4. **GSAP Flip is no longer registered (−8 KB gz on every page).** It was imported and registered, but nothing used it.
5. **Listing LCP.**
   - The gallery cover used `preload` without a fetch priority, so Lighthouse flagged "fetchpriority=high should be applied" and LCP had a 3.2 s load delay.
   - It is now `loading="eager"` + `fetchPriority="high"`, as the Next 16 `<Image>` docs recommend.
6. **Preconnects.**
   - `images.unsplash.com` (every card photo) and the Convex deployment (websocket + storage images) are preconnected from the locale layout through `ReactDOM.preconnect`.
   - The map tiles are not preconnected: maps are click- or scroll-loaded, and an unused preconnect costs a socket.
7. **Prefetching.**
   - The last step-04 `prefetch={false}` (on `PropertyCard`) is removed.
   - In Next 16 a dynamic route's default prefetch only fetches down to the nearest `loading.js`, not the full page, so a 24-card grid does not prefetch 24 listing pages.

### Already in place (verified, not changed)

- **Images:**
  - `next/image` with `sizes` on every grid.
  - Demo photos come from Unsplash's CDN with `auto=format`, so AVIF/WebP is negotiated.
  - Local media is AVIF/WebP via `scripts/optimize-media.mjs`.
  - The LCP images are discoverable in the HTML with `fetchpriority=high` (Lighthouse `lcp-discovery-insight`: pass on home and search).
- **Fonts:** `display: swap` with next/font's adjusted fallback metrics; CLS stays below 0.03.
- **Heavy modules:** maps, the 360° viewer, the 3D walk and the lightbox are loaded with `next/dynamic({ ssr: false })` on demand (bundle isolation check above).

## Remaining causes (mobile search and listing at 74)

1. **The lab method penalises localhost.**
   - On localhost every script arrives at once and runs before the first frame: Playwright's new-headless Chromium paints `/sr` only after `load` (≈ 1.25 s, unthrottled).
   - Lighthouse's `simulate` mode then models the LCP as waiting for all ~310 KB of JavaScript over slow 4G, so the "render delay" share of LCP is 2–3 s.
   - Real Chromium shows the opposite: the old headless shell has LCP at 324 ms (`scripts/vitals.mjs`, LCP = the hero `<img>`, CLS 0).
   - A hosted deployment with a CDN and HTTP/2 should be measured again (PageSpeed Insights + CrUX) before more work is spent on this.
2. **JavaScript on every public page:** 130–165 KB gzip of app chunks (manifest), plus the framework; Lighthouse counts ~310 KB of script transfer on `/sr`. The largest items are:
   - GSAP + ScrollTrigger + SplitText (49.5 KB), which the design's scroll choreography needs;
   - the Convex client (19.8 KB), mounted in the locale layout for every page, including pages with no live data;
   - lucide icons (19 KB).

   **Next candidates:**
   - mount `ConvexClientProvider` only under the routes that use live queries or mutations (search, listing, favorites/compare, forms);
   - import the few icons the shell uses as inline SVG.
3. **Web fonts: 6 files, 228 KB.** The two variable families (EB Garamond, Manrope) cover the whole weight range; Serbian needs latin-ext on every page.
4. **Next's polyfill module (13 KB, "legacy JavaScript")** ships with the framework chunk and is not under the app's control.

## A note on the throttling method

The same routes were also run with `--throttling devtools`, which applies real network and CPU throttling while the page loads (`.shots/step12-lh/devtools-test/`, before the changes). That method is much harsher on this machine:
- `/sr` mobile scored 42, with FCP 3.4 s and TBT 912 ms;
- `/sr/nekretnine` mobile scored 54.

It confirms the direction above: less JavaScript and fewer early requests. It is not the method behind the targets, which are defined on Lighthouse's default.
