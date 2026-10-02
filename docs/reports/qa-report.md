# QA report — night-run step 13 (2026-10-02)

Full QA sweep of the public site, the admin and the Convex backend, against the production build (`next build` + `next start`) and the dev Convex deployment.

## How it ran

1. **Matrix crawl** (`scripts/qa-matrix.mjs`): 21 public routes (home, search, 3 listings — showcase ME-1049, ordinary ME-1042, sold ME-1063 —, locations, the city `beograd`, the neighborhood `dorcol`, valuation, sell, agents, one agent, about, contact, journal, one article, favorites, compare, privacy, terms, cookies) × sr/en/ru/de × 390/768/1440 = **252 cells**. Each cell records the status, `<html lang>`, console and page errors, failed requests, broken images, page overflow, elements sticking out of the viewport, words wider than their SplitText mask, the h1, content smells (lorem, `undefined`, `NaN`, `null`, `[object Object]`, raw message keys, `m2`) and the € position against `Intl.NumberFormat` per locale; axe (WCAG 2.0/2.1 A+AA, 2.2 AA) runs on every sr cell at 390 and 1440. Full-page JPEGs per cell plus readable tiles for sr.
2. **Audit workflow** (12 agents): convex-auditor, a security reviewer and a content/i18n reviewer (read-only), and three qa-engineers that wrote the missing Playwright tests (accessibility, public flows, admin flows). An independent verifier per dimension tried to refute every finding (reproducing with convex-test, curl or throwaway Playwright scripts).
3. **Visual workflow** (10 agents): five design-critics, one per route group (landing, search + listings, places + people, funnels, editorial + utility), reviewed the matrix screenshots against `docs/03-DESIGN-SYSTEM.md`; five verifiers re-checked every finding against the pixels.
4. **Fixes**: security, Convex, accessibility and cross-cutting items directly; the rest by a fix workflow of six agents with disjoint file ownership (cards/listing, maps, content pages, editorial, content/i18n, landing), each re-confirming a finding before fixing it. Handoffs between groups were applied afterwards.
5. **Re-verification**: `npm run verify`, a fresh production build, the matrix crawl again, the full Playwright suite, and screenshot review of the changed pages.

## Matrix: routes × locales × viewports

**Round 1** (before fixes): 246/252 cells clean. Defects: the city page's "Sve za izdavanje" link ran off the right edge at 390 in sr/ru/de (fixed in `SectionHeading`); en map pins showed "430k €" instead of "€430k" (fixed in `formatPinPrice`). The other flags were crawler false positives (a `max-lg:sr-only` live region; two adjacent pins read as one amount — the crawler's € pattern no longer crosses a line break). Zero console errors, failed requests, broken images, page overflow, h1 problems, content smells or axe violations in any cell. OpenFreeMap was reachable this time, so every map rendered.

**Round 2** (after all fixes, new build): **252/252 cells clean**; axe on the 42 sr cells: **0 violations**.

| Route | sr-Latn | en | ru | de |
|---|---|---|---|---|
| about | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| agent | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| agents | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| compare | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| contact | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| cookies | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| favorites | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| home | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| journal | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| listing-ordinary | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| listing-showcase | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| listing-sold | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| location-city | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| location-hood | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| locations | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| post | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| privacy | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| search | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| sell | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| terms | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |
| valuation | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ | 390 ✓ · 768 ✓ · 1440 ✓ |

252/252 cells clean.

Checks per cell: HTTP 200, `lang`, no console/page errors, no failed requests (OpenFreeMap reported separately: 0 failures), no broken images, no page or element overflow, no mask-clipped words, exactly one non-empty h1, no content smells, € placed as `Intl` places it, and (sr, 390/1440) no axe violations. Data: `.shots/qa/matrix.json` (round 2) and `.shots/qa-round1/matrix.json`.

## Findings

All 117 findings were adversarially verified before anything was fixed (102 confirmed, 12 refuted, 3 uncertain); severities below are the verifiers' corrected ones. No critical finding was raised.

| Dimension | Findings | Critical | High | Medium | Low | Fixed | Refuted | Open |
|---|---|---|---|---|---|---|---|---|
| Convex (CVX) | 9 | 0 | 0 | 4 | 5 | 9 | 0 | 0 |
| Security (SEC) | 6 | 0 | 1 | 2 | 3 | 6 | 0 | 0 |
| Accessibility (A11Y) | 2 | 0 | 0 | 1 | 1 | 2 | 0 | 0 |
| Content/i18n (CNT) | 11 | 0 | 1 | 4 | 6 | 11 | 0 | 0 |
| Public flows (PUB) | 7 | 0 | 0 | 5 | 2 | 7 | 0 | 0 |
| Admin flows (ADM) | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |
| Landing (visual) (LND) | 12 | 0 | 0 | 2 | 9 | 11 | 1 | 0 |
| Search/listing (visual) (SRL) | 19 | 0 | 1 | 4 | 13 | 18 | 1 | 0 |
| Places/people (visual) (PLC) | 16 | 0 | 2 | 1 | 11 | 13 | 2 | 1 |
| Funnels (visual) (FUN) | 15 | 0 | 1 | 2 | 9 | 12 | 3 | 0 |
| Editorial/utility (visual) (EDU) | 19 | 0 | 0 | 6 | 10 | 16 | 3 | 0 |
| **Total** | **117** | **0** | **6** | **31** | **70** | **106** | **10** | **1** |


Two refuted findings (SRL-10, SRL-18) were still improved because the change was cheap; they count as fixed. The one open item, PLC-14 (the team page reads as four ink monogram tiles), is accepted by design: agents without a real photo get a monogram, never a stock face (CLAUDE.md hard rule); it resolves when the owner uploads photos.

### Highlights

- **Security (high, fixed):** stored XSS through 360° scene titles (Photo Sphere Viewer's gallery writes node names into `innerHTML`; any agent could plant a script on a public listing page) — titles are escaped and the server refuses `<`/`>`. Open redirect after admin login via `next=/admin/..//evil.example` — the target is resolved as a URL and must stay under `/admin/`.
- **Security (medium/low, fixed):** the admin was served the public CSP (header order); URL images in `media.attach` skipped the host allowlist (reached the share-image renderer); valuation numbers unchecked; `X-Powered-By` sent.
- **Convex (all fixed):** status changes could re-list a withdrawn listing without the publish checklist (server transition table now); the mandate-expiry cron ignored reserved listings; bulk feature/assign wrote no per-listing activity; `media.setVideoUrl` accepted any https URL; the public sitemap query took an uncapped page size; an unused public favourites write could zero any counter (removed); staff e-mails shown to managers/editors; the draft legal notice was readable through the public `pages.get`.
- **Visual (high, fixed):** SplitText masks cut descenders on every display heading; "Immobilienbewertung" cut at 390; the desktop filter bar ran under the sort control at ≤1350 px (ru at 1440); the city-page link off-screen at 390.
- **Content (high, fixed):** the listing key facts invented "Infostan ~0 €" when only one monthly cost was entered.
- **Flows (medium, fixed):** the preloader could not be skipped (PRD A2); card photos could not be swiped on phones; the card arrows were named "Nazad"/"Saznajte više"; the footer lacked Viber/WhatsApp and the language switcher (PRD A1); the listing page had no favourite heart although the favorites page promised one; consent-gated analytics was never loaded (PRD A1/B11).

## Convex audit (clean)

`node scripts/audit-convex.mjs`: 184 functions scanned, no problems. The convex-auditor traced every function; its 9 findings were all reproduced at HEAD by the verifier (convex-test against a copy of `convex/`) and all are fixed, with regression tests in `convex/tests/{adminListings,onsiteValuation,tours}.test.ts`. Confirmed clean:

- **No unauthenticated admin path.** Every admin query/mutation/action calls `requireRole` first; agent ownership is enforced in the index range and again per document. `admin-modules.spec.ts` calls 47 admin functions from 18 modules anonymously and every one answers `UNAUTHENTICATED`; an agent reading another agent's lead or viewing gets `null`, writing gets `FORBIDDEN`.
- **No data leaks.** Public DTOs never return the brokerage contract, owner contact, preview token, `createdBy`, raw storage ids, or street/number unless the address visibility is "exact"; coordinates are grid-snapped and POI distances rounded. Drafts, scheduled posts, unverified testimonials and non-public agents never reach public queries. The legal pages' staff notice is now dropped by `pages.get` too (PUB-7).
- **Public writes**: every form mutation has a honeypot, server-side privacy consent, length limits, and per-session + per-e-mail (hashed) + global rate-limit buckets; the valuation's numeric answers are now range-checked.
- **Tokens**: preview tokens are ~244-bit CSPRNG values with a server-scheduled expiry (the old step-07 M9 is resolved); invites are hashed, expire and are single-use.
- **Indexes/pagination**: no `.filter` on growing tables; public page sizes are capped server-side (the sitemap query now too).

## Security

- **Fixed**: SEC-1 stored XSS (360° titles), SEC-2 open redirect, SEC-3 admin CSP overridden by the public one, SEC-4 URL images without the host allowlist (blind SSRF through the share image), SEC-5 valuation numbers, SEC-6 `X-Powered-By`.
- **Rich text**: 46 payloads (javascript:/vbscript:/data: in every encoding, on* handlers, style, iframe/object/embed/svg/math/form/base/meta, mXSS) through `sanitizePostHtml`, `sanitizePageHtml` and the write-side `htmlProblem`: no bypass. JSON-LD is serialized with `</script>` escaping.
- **Secrets**: every non-`NEXT_PUBLIC_` value from `.env.local` was searched for in `.next/static` by value (and private-key/JWKS/deploy-key patterns): none found. `.env.local` is ignored; no secret is tracked by git.
- **Headers**: `/sr` and `/admin/login` carry a CSP with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, plus nosniff, Referrer-Policy, Permissions-Policy and `X-Frame-Options: DENY`; the admin now gets `frame-src 'none'`; no `X-Powered-By` (all asserted in `security-crawl.spec.ts`).
- **Analytics** (PUB-6), verified against the dev deployment with a temporary GA4 ID: with "necessary only" no script and no request; after accepting analytics, `script#me-ga4` loads `googletagmanager.com/gtag/js?id=…`; 0 CSP violations either way; the setting was restored to `{}`.

## Accessibility

- axe (WCAG 2.0/2.1 A+AA, 2.2 AA) on **every public route in sr, the localized 404 and `/admin/login`, on desktop 1440 and Pixel 7**: 0 serious or critical violations (the 404 numeral and the 360° viewer controls were fixed). The matrix crawl's own axe pass: 0 violations of any impact on 42 cells.
- Keyboard: no traps in 250 Tab presses on home, search, the showcase listing and contact (maps mounted); focus moves into and back out of the phone filter sheet, the 360° and 3D dialogs, the lightbox and the mobile menu; the cookie banner is reachable and never traps; valuation step changes and empty form submits move focus to something meaningful.
- Reduced motion: no Lenis, no pinned sections, headings visible without scrolling (home, search, listing, about; both projects).
- The admin shell's built-in names are Serbian now (ADM-1).

## Content

No lorem ipsum, no `undefined`/`NaN`/`null`/raw message keys in any of the 252 cells; € placement matches `Intl` in every locale; `npm run i18n:check`: 1242 keys × 4 locales. Owner rules hold: capitalized Vi/Vaš everywhere, one reply-time promise (the shortened meta-description variant was removed), the instant valuation is described exactly as computed (average price in the area adjusted for condition, floor and lift), no invented numbers outside demo-flagged blocks.

## Test inventory

Playwright, production build, `npm run test:e2e` (2026-10-02, after the last change): **465 passed, 0 failed, 0 flaky, 255 skipped** in 6.1 min. Every spec runs on two projects (desktop 1440 and Pixel 7); the skips are project-scoped cases (a desktop-only or phone-only layout, a data flow proven once), not environment skips — OpenFreeMap was reachable, so the map tests ran. A second identical full run (JSON reporter) gave the same result.

| Spec | Tests (desktop + mobile) | Passed | Skipped by project | Failed |
|---|---|---|---|---|
| a11y-focus.spec.ts | 16 | 15 | 1 | 0 |
| a11y-keyboard.spec.ts | 8 | 8 | 0 | 0 |
| a11y-motion.spec.ts | 8 | 8 | 0 | 0 |
| a11y.spec.ts | 58 | 52 | 6 | 0 |
| admin-crm.spec.ts | 14 | 7 | 7 | 0 |
| admin-modules.spec.ts | 32 | 16 | 16 | 0 |
| admin-tours.spec.ts | 4 | 2 | 2 | 0 |
| admin.spec.ts | 26 | 13 | 13 | 0 |
| landing.spec.ts | 58 | 33 | 25 | 0 |
| listing-detail.spec.ts | 40 | 37 | 3 | 0 |
| pages-flows.spec.ts | 16 | 8 | 8 | 0 |
| pages-routes.spec.ts | 134 | 67 | 67 | 0 |
| public-flows.spec.ts | 66 | 51 | 15 | 0 |
| search.spec.ts | 28 | 18 | 10 | 0 |
| security-crawl.spec.ts | 160 | 80 | 80 | 0 |
| shell.spec.ts | 24 | 23 | 1 | 0 |
| smoke.spec.ts | 22 | 22 | 0 | 0 |
| tours.spec.ts | 6 | 5 | 1 | 0 |
| **Total** | **720** | **465** | **255** | **0** |

Unit/backend: `npx vitest run` **360/360** (28 files, incl. convex-test suites and the new `safe-next`, `formatPinPrice`, typography and server-guard tests). `node scripts/audit-convex.mjs`: 184 functions, no problems. `npm run i18n:check`: 1242 keys × 4 locales.

New this step: `a11y-focus`, `a11y-keyboard`, `a11y-motion`, `public-flows`, `admin-modules` specs and the extended `a11y` (every route × 2 projects); `admin-crm` now edits the hero lede instead of the h1, so it no longer races `landing`/`shell` in parallel runs.

### PRD acceptance criteria with a user flow → specs

| PRD | Covered by |
|---|---|
| A1 shell | smoke, shell (switcher, consent persists, header solid, mobile menu), public-flows (footer legal data + Viber/WhatsApp + switcher; switcher keeps the listing slug and the location page; header solid at 80 px with CLS < 0.1; analytics only after consent), security-crawl (19 routes × 4 locales, clean console, CSP), pages-routes (localized 404) |
| A2 landing | landing (sections from Convex, hero search on bar and phone sheet, valuation mini-form, reduced motion, pins, banner never covers the hero, axe), public-flows (preloader once per session, ≤ 1.8 s, skippable) |
| A3 search | search (9 filters against Convex, deep combo noindex, curated canonical, sort, URL round-trip + Back, language switch keeps filters, load more, map pins + hover sync + bbox, phone sheet, compare tray, clean console, axe), public-flows (added-within, empty state + clear, €/m² sort) |
| A4 card | public-flows (arrows + keyboard, touch swipe, arrow names, €/m² and monthly rate) |
| A5 listing | listing-detail (SSR + Art. 18 line + JSON-LD, share image, slug 301, unknown 404, lightbox keyboard, room chips, inquiry → lead, viewing → requested viewing + lead, rate limit, sold ribbon without forms, mobile action bar, works without JS, one view per session, 360°/3D tabs, calculators, map, rental), public-flows (share links, similar, tabs only with data, heart), tours (360° rooms, 3D walk, Matterport facade) |
| A6 valuation | pages-flows (prefill from the landing, 3 steps → range, lead with every answer, on-site request) |
| A7 sell | pages-flows (seller lead with the property answers) |
| A8 locations | pages-routes (all locales), public-flows (card count = listings on the neighborhood page) |
| A9 agents | public-flows (profile lists that agent's active listings) |
| A10 about/contact | pages-flows (contact → general lead with subject and opt-in), pages-routes |
| A11 journal | pages-flows (post published in admin → listed, Article JSON-LD), public-flows (category filter, reading time, share) |
| A12 favorites/compare | public-flows (heart → counter → /omiljeno → removal), pages-flows (shared compare link SSR, standout marks, removal rewrites the URL, stored selection) |
| A13 legal | public-flows (4 locales, no draft notice) |
| B1 auth & roles | admin (gate redirect, login errors, sign-in/out, invite accept, reuse refused, agent scoping), admin-crm (manager-only calls refused), admin-modules (47 functions refuse anonymous callers; agent/manager/editor matrices; shell) |
| B2 dashboard | admin-modules (KPIs against the server, chart, to-do lists, activity) |
| B3 listings | admin (create → 3 photos → checklist refuses → 5 photos → publish → public + search; unpublish → 404; preview noindex), admin-modules (status change with confirmation + log, duplicate, bulk archive), admin-tours (360°/3D tab) |
| B4 leads | admin-crm (pipeline, loss reason, every stage logged), admin-modules (note, assign, next action, timeline, agent sees own leads only) |
| B5 viewings | admin-modules (requested → confirmed → done with feedback, logged) |
| B6 contacts | admin-crm (CSV export), admin-modules (anonymize; consent record kept) |
| B7 team | admin-crm and admin (invites), admin-modules (role change, deactivation ends sessions) |
| B8 locations | admin-modules (create, rename, delete a neighborhood; logged) |
| B9 journal | admin-crm (Tiptap post → public query) |
| B10 site content | admin-crm (hero lede edit → landing) |
| B11 settings | admin-modules (office hours → /sr/kontakt, restored exactly) |
| B12 analytics | admin-modules (cards, chart, funnel, period switch) |
| B13 activity | admin-modules (entity filter, field-level diff) |
| B14 demo content | admin (hidden from agents), admin-modules (per-table counts; purge guarded by the typed phrase, never pressed) |
| C | a11y, a11y-focus, a11y-keyboard, a11y-motion, security-crawl; SEO/JSON-LD audits from step 12 (`scripts/seo-audit.mjs`, `scripts/validate-jsonld.mjs`) |

Not driven end to end (their server logic is covered by convex-test instead): the map pin drag in the listing and location editors, the price-history UI, a slug change → 301 from the editor, bulk publish/assign, the viewings week-calendar rendering, agent profile fields, PDF/OG uploads in settings.

## Remaining issues (none critical or high)

- **PLC-14** (low, accepted): the team page shows ink monogram tiles until real agent photos are uploaded, as the no-stock-faces rule requires.
- **404 server HTML** (known since step 10, low): `notFound()` pages are server-rendered as Next's error shell (no `lang`/h1 in the HTML; status 404, `noindex` and the localized title are correct; the page paints on the client). Investigated again in this step; see DECISIONS [13].
- **e2e residue** (low): each `admin-modules` run leaves one anonymized contact with its general lead (no personal data); activity rows are append-only by design.
- **Analytics after withdrawal** (low, documented): a tracker that has loaded stays for the rest of the page view; a withdrawn consent applies from the next load.
- Carried over, unchanged: Turnstile not wired (needs keys), mobile Lighthouse 74 on search/listing (`docs/reports/perf.md`), Spark LoD time for very large splats.

## Artifacts

- `scripts/qa-matrix.mjs` — the crawler (`node scripts/qa-matrix.mjs --axe` against a running production build).
- `.shots/qa/` (round 2) and `.shots/qa-round1/` — matrix JSON, full-page captures, tiles, and `findings.json` with every finding and its verification (gitignored).

## Appendix: every finding

| ID | Severity | Finding | Status |
|---|---|---|---|
| CNT-3 | high | Listing key facts invent a "0 €" utility cost when only one monthly cost is entered | fixed |
| FUN-1 | high | German valuation h1 'Immobilienbewertung' is clipped on phones ('Immobilienbewertur') | fixed |
| PLC-1 | high | SplitText line masks cut off descenders on every display heading (g, j, p, J) | fixed |
| PLC-2 | high | City page 'Sve za izdavanje' link runs off the right edge on phones (clipped in sr, ru, de) | fixed |
| SEC-1 | high | Stored XSS: 360° scene titles are injected as raw HTML by the Photo Sphere Viewer gallery on public listing pages | fixed |
| SRL-1 | high | Desktop filter bar runs into the sort control: 'Все фильтры' overlaps 'СОРТИРОВКА' (RU), and every locale will collide below about 1350 px | fixed |
| A11Y-2 | medium | 360° tour viewer: Photo Sphere Viewer navbar buttons and gallery thumbnails are keyboard stops with no role (and the thumbnails have no name) | fixed |
| CNT-1 | medium | Single-listing map (listing, contact, about, location pages) shows MapLibre's English UI strings in every locale | fixed |
| CNT-2 | medium | Property card shows rooms and floor for land plots ("0 soba", "Sprat PR" / "0 rooms", "Ground floor") | fixed |
| CNT-4 | medium | Valuation page says the instant estimate is adjusted for year of construction; the calculation ignores it and the same page says "condition, floor and lift" | fixed |
| CNT-5 | medium | Rental listing detail shows no €/m² next to the price | fixed |
| CVX-1 | medium | listingsAdmin.setStatus can put a listing back on the public site without passing the publish checklist (Art. 18 / mandate gate) | fixed |
| CVX-2 | medium | Mandate-expiry cron ignores reserved listings, so they stay advertised with an expired brokerage contract | fixed |
| CVX-3 | medium | media.attach accepts arbitrary {kind:"url"} images (no host/protocol allowlist), which reach public DTOs and a server-side fetch in the OG image route | fixed |
| CVX-4 | medium | Bulk feature/unfeature/assign change listings without a per-listing activity row (PRD B13 field-level log) | fixed |
| EDU-1 | medium | Legal pages: heading hierarchy is inverted on phone and tablet (H3 sub-heading reads heavier than the H2 section title) | fixed |
| EDU-2 | medium | Compare tray on phones: 24px remove buttons, and the third thumbnail is clipped under the CTA in ru/de | fixed |
| EDU-5 | medium | Internal drafting notes are published on the privacy policy | fixed |
| EDU-6 | medium | Cookie policy points visitors to a footer link „Kolačići” that does not exist (the footer shows 'Podešavanja') | fixed |
| EDU-8 | medium | Compare: listing titles truncated with an ellipsis at 768 (sr) and 390 (ru) | fixed |
| EDU-11 | medium | Favorite hearts on card photos have no backplate, so the bronze heart drops below 3:1 on bright interiors | fixed |
| FUN-2 | medium | Map attribution opens expanded on phones and covers about a fifth of the office map | fixed |
| FUN-5 | medium | Sell process: the five step titles are the same size as the section h2, so the hierarchy is flat | fixed |
| LND-1 | medium | Services rows (desktop): the arrow is pushed into an implicit second grid row, so every row carries ~45px of dead space and the arrow lines up with nothing | fixed |
| LND-9 | medium | Tour-film pause button straddles the film edge mid-zoom and loses its outline over the bright frame | fixed |
| PLC-3 | medium | Favorite heart almost disappears on bright listing photos | fixed |
| PUB-1 | medium | First-visit preloader cannot be skipped (PRD A2 'is skippable') | fixed |
| PUB-2 | medium | Listing-card photo carousel cannot be swiped on touch screens; only the cover photo can be reached on phones | fixed |
| PUB-3 | medium | Card carousel arrows have misleading accessible names ('Nazad' / 'Saznajte više') | fixed |
| PUB-4 | medium | Footer has no Viber/WhatsApp links and no language switcher (PRD A1 footer) | fixed |
| PUB-6 | medium | Analytics IDs from Podešavanja are never loaded, even after 'Prihvatam sve' (consent-gated analytics not implemented) | fixed |
| SEC-2 | medium | Open redirect after admin login via `next=/admin/..//evil.example` | fixed |
| SEC-4 | medium | media.attach accepts any URL for gallery images (no host allowlist), so the listing OG-image route can be made to fetch arbitrary URLs server-side (blind SSRF) | fixed |
| SRL-2 | medium | At 768 the gallery mosaic turns every photo into a portrait crop, and the images are upscaled and blurry | fixed |
| SRL-4 | medium | The 'saved' heart (solid bronze, no outline) disappears on warm photos | fixed |
| SRL-5 | medium | Phone compare tray: 24 px remove buttons, and in DE/RU the third thumbnail is cut off by the CTA | fixed |
| SRL-7 | medium | RU at 390: the third media tab is sliced mid-word ('3D-ПРОГУ') | fixed |
| A11Y-1 | low | Localized 404 (and every notFound()/global 404) fails axe: serious color-contrast on the decorative "404" numeral | fixed |
| ADM-1 | low | English accessible names and tooltip in the Serbian admin shell ("Toggle Sidebar", "breadcrumb") | fixed |
| CNT-6 | low | Two listing-lightbox accessibility labels stay in English ("Caption", "Thumbnails") | fixed |
| CNT-7 | low | A shortened reply-time promise remains in the About meta description (all 4 locales) | fixed |
| CNT-8 | low | Publicly reachable /styleguide shows invented stats and a mistranslated, off-policy sample answer | fixed |
| CNT-9 | low | og:locale uses BCP-47 tags instead of Open Graph's language_TERRITORY format | fixed |
| CNT-10 | low | Coordinates are hard-coded with Latin N/E and a dot decimal in every locale | fixed |
| CNT-11 | low | Apartment-specific wording is used for offices and land (room-structure adjective, German "Wohnfläche") | fixed |
| CVX-5 | low | Public sitemap.listings forwards the client's paginationOpts without capping numItems | fixed |
| CVX-6 | low | stats.trackFavorite is an unused public write that anyone can use to inflate or zero any listing's favorites count | fixed |
| CVX-7 | low | media.setVideoUrl accepts any https URL, bypassing the YouTube/Vimeo rule enforced in listingsAdmin.update | fixed |
| CVX-8 | low | pagesAdmin.get exposes a staff member's e-mail to managers and editors | fixed |
| CVX-9 | low | leads.createValuation stores unchecked public numeric input (totalFloors, yearBuilt, numeric floor) | fixed |
| EDU-3 | low | Journal grids with two posts leave an empty third column on desktop | fixed |
| EDU-4 | low | Journal card meta line wraps on one card only, so titles in a 2-column row sit on different baselines | fixed |
| EDU-7 | low | Post page: the tags, author and share hairlines run wider than the article measure | refuted (not a defect) |
| EDU-9 | low | Compare: 'POGLEDAJTE NEKRETNINU ↗' buttons wrap to two cramped lines on phone and tablet | fixed |
| EDU-10 | low | Article H1 leaves the preposition 'za' at a line end ('vodič za / strane kupce') | fixed |
| EDU-12 | low | Article share links wrap 3 + 1 in the desktop sidebar ('E-pošta' orphaned) | fixed |
| EDU-13 | low | Article H2s are glued to their paragraphs (about 88px above, about 11px below) | refuted (not a defect) |
| EDU-14 | low | Terms 'Provizija ukratko' callout and cookies section-03 lede break the legal column measure | fixed |
| EDU-15 | low | Compare marks the largest area, more rooms, more bathrooms and the newest build as 'Najbolja vrednost' | fixed |
| EDU-16 | low | Breadcrumb links on phones have about 13px tall hit areas | fixed |
| EDU-17 | low | Property card title leaves '2023.' as a one-word last line on favorites | fixed |
| EDU-18 | low | Compare page rhythm: short bottom padding and a reference line detached from its title | fixed |
| EDU-19 | low | Compare (390): wrapped 'DODAJTE NEKRETNINU' ghost button is indented off the left grid line | refuted (not a defect) |
| FUN-3 | low | The same FAQ block renders at two heading sizes (valuation vs sell/contact) | fixed |
| FUN-4 | low | 'Posetite nas' office block is built two different ways on contact and about (sizes inverted, different map column) | fixed |
| FUN-6 | low | Right-hand column drifts between grid lines within one page (contact, valuation) | fixed |
| FUN-7 | low | Sell (mobile): 'Započnite procenu' underline stretches across the whole column | fixed |
| FUN-8 | low | About: 'Standardi rada' heading is downsized compared with every sibling section, and barely above its own h3s on phones | fixed |
| FUN-9 | low | Uppercase turns 'Ceo tim' into 'CEO TIM', which reads as the English 'CEO' | fixed |
| FUN-10 | low | Map street labels lose diacritics in en/de, right next to the 'Njegoševa 1' heading | fixed |
| FUN-11 | low | About team at 768: four 340×425 solid-ink monogram slabs dominate the page | refuted (not a defect) |
| FUN-12 | low | Both 7-item lists on /sell end with a full-width straggler row that breaks the two-column rhythm | refuted (not a defect) |
| FUN-13 | low | Valuation onsite eyebrow repeats its own heading | fixed |
| FUN-14 | low | Placeholder e-mail 'office@mihajlo-estate.local' is the largest live contact item in the contact hero, with no demo note | refuted (not a defect) |
| FUN-15 | low | About values section: bottom padding is heavier than the top, and titles break early | fixed |
| LND-2 | low | Tablet: 3D-tours headline leaves the single word "dođete." alone on line 2 | fixed |
| LND-3 | low | Neighborhoods: the same Sava / Kula Beograd photo is used for both the section band and the Beograd na vodi card | fixed |
| LND-4 | low | Property-card badges silently drop in sr/ru but show in de (the 'price reduced' signal is lost in Serbian) | fixed |
| LND-5 | low | Favorite heart sits ~9px below the badge row, and the saved (bronze-filled) heart nearly disappears on light photos | fixed |
| LND-6 | low | Featured listings and Numbers are the only sections without an eyebrow, which breaks the eyebrow → title rhythm used everywhere else | fixed |
| LND-7 | low | German desktop hero headline breaks as "Ein Zuhause, das / man nicht / vergisst." (long-short-short rag, stranded relative pronoun) | fixed |
| LND-8 | low | Russian display headings leave two-letter prepositions at line ends ("Прогуляйтесь по / комнатам ещё / до визита.") | fixed |
| LND-10 | low | ru: pinned featured rail ends past the right content margin | refuted (not a defect) |
| LND-11 | low | Footer columns sit on a different column grid (48px gaps) from the contact block directly above (24px gaps) | fixed |
| LND-12 | low | Tablet journal teaser stacks all three posts at full width, so the section runs ~2000px | fixed |
| PLC-4 | low | Some dark card badges render as empty bars with no text in the phone captures | fixed |
| PLC-5 | low | Agent profile: monogram panel is stranded below the contact buttons on tablet and phone | fixed |
| PLC-6 | low | Dash starts a new line in Russian headings and ledes | fixed |
| PLC-7 | low | Listing titles are cut with an ellipsis after a comma or mid-word on phones | fixed |
| PLC-8 | low | Coordinate plate: the crosshair line strikes through the coordinate label | fixed |
| PLC-9 | low | Dorćol uses exactly the same 21:9 hero photo as the Beograd city page | fixed |
| PLC-10 | low | 'U blizini' section holds a single row in a half-width column | fixed |
| PLC-11 | low | Agent reply-time note leaves 'sata.' alone on the second line | fixed |
| PLC-12 | low | Locations index: the largest block (9 municipality cards) has only a 12px eyebrow as its header | refuted (not a defect) |
| PLC-13 | low | Beograd feature block: the photo's top edge lines up with nothing | refuted (not a defect) |
| PLC-14 | low | Team page reads as four black placeholder slabs; the hero's right half is empty | accepted |
| PLC-15 | low | Map attribution opens expanded and covers the bottom of the map on phones | fixed |
| PLC-16 | low | Neighbourhood rows with no listings show a bare '0', unlike the 'Trenutno bez ponude' wording elsewhere | fixed |
| PUB-5 | low | Listing detail page has no favorite heart, although the favorites page tells visitors to tap it there | fixed |
| PUB-7 | low | Staff-only 'NACRT — proveriti sa pravnikom' notice is served by the public pages.get query | fixed |
| SEC-3 | low | Admin CSP is never sent: the public policy (with third-party frame-src) overrides it on every /admin route | fixed |
| SEC-5 | low | leads.createValuation does not range-check floor, totalFloors and yearBuilt on the server | fixed |
| SEC-6 | low | X-Powered-By: Next.js header disclosed on every response | fixed |
| SRL-3 | low | Search card titles are cut off with ellipses at 1440, sometimes mid-word | fixed |
| SRL-6 | low | Listing H1 leaves 'na' at the end of a line (cards don't), and the DE H1 breaks at a hyphen leaving 'Blick' alone | fixed |
| SRL-8 | low | Listing content grids don't share column lines (4-col facts vs 3-col details, gap-6 vs gap-8) | fixed |
| SRL-9 | low | Tab strip hairlines stick out 4-6 px past the content column | fixed |
| SRL-10 | low | At 768 the room-filter chips wrap to two rows of boxed buttons under the mosaic | fixed |
| SRL-11 | low | 'SVE FOTOGRAFIJE (9)' wraps, leaving '(9)' alone on its own line at 768 | fixed |
| SRL-12 | low | On phones the map attribution opens expanded and covers the bottom fifth of the listing map | fixed |
| SRL-13 | low | The search results map shows a blank horizontal band (missing tile row) in every locale | refuted (not a defect) |
| SRL-14 | low | An em dash starts a line in the description lede at 390 | fixed |
| SRL-15 | low | Multi-value facts are joined with capitals in the middle ('Toplotna pumpa, Podno, Klima uređaj') | fixed |
| SRL-16 | low | RU share row wraps, leaving 'Эл. почта' alone on a second line | fixed |
| SRL-17 | low | DE cards: the reference line wraps to two lines and breaks the shared card baseline | fixed |
| SRL-18 | low | The native textarea resize grip shows on the inquiry form | fixed |
| SRL-19 | low | DE place names are capitalised differently on the same page and card | fixed |
