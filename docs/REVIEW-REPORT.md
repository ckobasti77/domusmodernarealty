# Review report — night-run step 14 (independent code review)

Date: 2026-10-02. Scope: everything built since `night-run/baseline` (792 files, ~144k lines), reviewed by a session with no context from the build.

## How it ran

1. **Six independent reviewers**, each with one lens and a read-only brief:
   - security (Convex auth, tokens, uploads, data exposure, public forms);
   - Convex correctness and performance (time zones, money, search, counters, state machines, N+1, unbounded reads);
   - the public site's server side (XSS, redirects, CSP, SEO, i18n routing, formatting, server data flow);
   - the public client components (React correctness, forms, booking widget, motion rules, a11y, bundle);
   - the admin app (auth UX, editor autosave, forms vs server rules, CSV, dates);
   - architecture and maintainability (docs adherence, dead code, duplication, types, config, tests, README).
2. **Every finding was reproduced before it counted.** The reviewers wrote scratch proofs (convex-test, vitest, jsdom and Playwright probes under `.shots/review14/`, gitignored). The lead re-ran them and read the code for each high and critical finding before any fix.
3. **Fixes** were made by six fix agents with disjoint file ownership plus the lead. Each bug fix carries a regression test that fails on the old code; most agents proved that by running their tests against a pre-fix copy of their files.
4. **Re-verification:** `npm run verify`, the full vitest suite and the full Playwright suite after the last change (results at the end).

Severity: **critical** = auth bypass by anonymous users, private-data leak, stored XSS, data loss, Art. 18 legal-gate bypass; **high** = abuse by a low-privilege account, wrong public data, a core flow broken for plausible input, a crash on plausible input; **medium** = edge-case bug with a visible effect, missing server-side validation, a performance problem at realistic scale, an a11y/SEO defect, a maintainability problem likely to cause bugs; **low** = cosmetic or hardening.

## Summary

| Severity | Found | Fixed | Deferred |
|---|---|---|---|
| Critical | 1 | 1 | 0 |
| High | 11 | 11 | 0 |
| Medium | 29 | 29 | 0 |
| Low | 34 | 26 (3 of them partly) | 8 |

Duplicates reported by more than one reviewer are merged and listed once (for example "price on request" was found by three).

## Critical and high

| ID | Sev | Where | Finding and why it matters | Fix | Status / test |
|---|---|---|---|---|---|
| SEC-2 (= CVX-1, WEB-4) | critical | `convex/lib/checklist.ts:79`, `listingsAdmin.ts:82`, `dto.ts`, `PriceTab.tsx` | **"Cena na upit" passed the Art. 18 publish gate.** Any agent could switch it on and publish: the ad, card, map pin and share image said "Cena na upit" while the public API, the og:image `?v=<price>` and price filters still exposed the exact price. CLAUDE.md and Art. 18 require the price on every ad; ARCHITECTURE types the field `priceOnRequest?: false`. | Feature removed: schema field (no document used it), patch validator, DTOs, map/card/price/compare/OG/JSON-LD branches, the admin switch and the `listing.priceOnRequest` message key. | fixed — `review14Lead.test.ts` ("the editor can no longer mark a price as 'on request'") + tsc |
| SEC-1 | high | `convex/auth.ts` (library `createAccountFromCredentials.js:23-36`) | **Unthrottled password guessing against staff accounts.** `flow: "signUp"` with an existing e-mail ran a password check that logged the caller in and was never counted, so the 10-failures lockout of `signIn` could be bypassed (a locked admin still got a session), and the error told staff addresses apart from unknown ones. | Explicit `ConvexCredentials` provider: `signIn` keeps the rate-limited `retrieveAccount`; `signUp` first asks `invites.canSignUp` (open invite for the address and no existing account) and never compares a password on that path; one identical refusal for every case; the server enforces 10–128 characters; other flows are refused. Same Scrypt hashes, so existing accounts keep working. | fixed — `authSignUp.test.ts` (8 tests: right password via signUp refused, locked account stays locked, same answer for staff/unknown, invite flow and sign-in still work) |
| SEC-3 (= CVX-2) | high | `listingsAdmin.ts` `duplicate`, `demo.ts`, bulk `deleteDemo` | **Copies of demo listings stayed demo, so "Obriši demo" deleted real listings and their uploads.** A duplicated seeded listing kept `isDemo: true` and nothing could clear it. | `duplicate` writes `isDemo: false`; attaching a real owner adopts a seeded listing; the purge and bulk delete keep demo listings that hold uploads or real leads/viewings (re-checked when the scheduled delete runs). | fixed — `review14ListingDemo.test.ts` (8 tests) |
| CVX-3 (= SEC-4) | high | `listingsAdmin.ts:717-722, 795-801`, `media.ts` `remove`, `derive.ts:49` | **A live listing could be edited below the publish checklist**: price/area/rooms 0, empty title, under 5 photos, a blank or lapsed contract, NaN/Infinity; area 0 published €/m² = price. | Every edit of a public listing must still pass the checklist (`assertStaysPublishable`, PUBLISH_BLOCKED with reasons, nothing stored); NaN/Infinity and negatives refused in every status; `media.remove` keeps the photo minimum and a cover; €/m² is 0 without an area. | fixed — `review14ListingEdits.test.ts` (19 tests) |
| CVX-4 | high | `convex/lib/search.ts:47-52`, `slug.ts` | **Cyrillic queries were dropped, so search returned everything** (`q:"Дорћол"` → all listings, count exact). NFD-composed Latin was broken too. | The fold transliterates Serbian and Russian Cyrillic and strips marks after NFD; a non-blank query that folds to nothing matches nothing (search, count and map agree); `searchMigrations:rebuildListingSearchText` re-derived `searchText` on dev. | fixed — `convex/lib/search.test.ts`, `review14Search.test.ts` |
| WEB-1 | high | `lib/search-params.ts:248` | **A long `q` ending in an emoji crashed the search page**: the 80-unit cut split a surrogate pair, Convex rejected the argument and `encodeURIComponent` threw. | Cut by code points, strip lone surrogates, encoders made well-formed. | fixed — `lib/search-params.test.ts` (5 new cases) |
| UI-1 | high | `ListingLightbox.tsx:316-320` | **Back with the gallery open left Lenis stopped**, so the previous page (usually search) could not scroll until a reload. | Counted Lenis holds (`components/motion/lenis-lock.ts`, `useLenisLock`) released on unmount; the lightbox, preloader and filter dialog use them; SmoothScroll restarts Lenis on navigation when no hold is counted. | fixed — `review14-public.spec.ts` ("scrolls again after Back…") |
| UI-2 | high | `lib/stores/consent.ts:67-73` | **With site storage blocked the whole public site showed the global error page** (unguarded `localStorage` read in a root-layout store). | Guarded read; the decision lives in memory for the page view. | fixed — `review14-public.spec.ts` ("…cookie banner closes for the visit") |
| ADM-1 | high | `FeaturesTab.tsx:81-90`, `fields.tsx:282-346` | **"1,5" rooms was saved as 15** (and "0,5" as 5): a native number input drops the comma, on an Art. 18 field. | Every editor number field is a locale-aware text field (`fromNumberInput`). | fixed — `lib/admin/format.test.ts` ("number inputs"), `review14-admin.spec.ts` |
| ADM-2 (= ARC-6) | high | `posts|settings/LeaveGuard.tsx`, `CommandPalette.tsx`, `PageEditor.tsx`, `LocationForm.tsx` | **Unsaved admin work was lost silently** on browser Back, ⌘K and (in some editors) sidebar links; the guard existed in three diverging copies. | One `LeaveGuardProvider` in the shell guards links, ⌘K, sign-out and Back (history copy + capture-phase `popstate`); every editor registers (listing, post, settings, page content, location, agent, availability); the listing editor saves first and only asks about what stays unsaved. | fixed — `review14-admin.spec.ts` ("Back with an unsaved post title asks first…") |
| ADM-3 | high | `autosave-engine.ts:224-254`, `listing-form.ts:95, 432` | **One field the server refused blocked every other autosaved edit**, with the reason only in a tooltip; the client accepted video/poster/tour values the server refuses. | The form imports the server's rules (`parseVideoUrl`, image hosts, `LISTING_TEXT_LIMITS`, tour text limit; hidden agents disabled for a live listing); a refused batch is split so the rest saves, refused fields carry the server's message, and a visible banner lists them. | fixed — `listing-form.test.ts` ("autosave engine: refusals", 8 tests), `lib/admin/video-url.test.ts` (6) |
| ARC-1 | high | `lib/cn-tables.ts` | **Stale `cn()` tables dropped classes in production** (map pin pointer, a dropzone border, a focus ring, a calendar status border); nothing checked freshness. | Regenerated; `scripts/check-cn-tables.mjs` runs in `npm run verify` (`npm run check`). | fixed — the check itself |

## Medium

| ID | Where | Finding | Fix | Status / test |
|---|---|---|---|---|
| CVX-5 | `listingsAdmin.ts:818-857` | "Snižena cena" badge from price corrections made while still a draft | Badge only from changes while public; first publication clears it | fixed — `review14ListingEdits.test.ts` |
| CVX-6 | `convex/lib/dto.ts:524-528` | Public price history read the 20 oldest rows, so recent changes vanished | Range from `publishedAt`, newest 20 | fixed — `review14SearchDto.test.ts` |
| CVX-7 | `lib/search-params.ts:41` | A 4.5-room listing matched no rooms filter | 4.5 chip added (logged in DECISIONS) | fixed — `lib/search-params.test.ts`, `review14Search.test.ts` |
| CVX-8 | `convex/listings.ts:235-246` | Post-filtered search pages returned up to 120 cards (5×), ~360 location reads | Exact paging (≤ numItems per page), per-call location cache | fixed — `review14Paging.test.ts` (6 tests) |
| CVX-9 | `convex/agents.ts:45-48` | Agent profile read the 120 oldest listings, hiding new active ones | Per-status newest-first reads | fixed — `review14SearchDto.test.ts` |
| CVX-10 | `listingsAdmin.ts:1478-1547` | "Contracts expiring in 14 days" missed listings outside the 300 most recently updated | `by_status_and_mandateEnd` range | fixed — `review14ListingEdits.test.ts` |
| CVX-11 | `convex/lib/listingCascade.ts:54-61` | Deleting a listing rewrote held viewings to "cancelled" | Only open viewings are called off | fixed — `review14ListingEdits.test.ts` |
| UI-3 | `ViewingForm.tsx:40-67`, `viewings.ts:68-70` | Booking widget froze "now" at mount, offered slots the server refused with a misleading "check your details" | Ticking clock, re-check before submit, server answers SLOT_TAKEN ("no longer available") | fixed — `lib/viewing-slots.test.ts` (6) |
| UI-4 | `ContactForms.tsx:175-191` | Switching Upit / Razgledanje wiped what the visitor typed | Panels kept mounted (`keepMounted`) | fixed — `review14-public.spec.ts` |
| UI-5 | `InquiryForm`, `ViewingForm`, `OnsiteRequest` | Focus fell to `<body>` when the success panel replaced the form (also video/tour facades, 3D → 360 swap) | `useSuccessFocus`; facades focus the iframe; dialog returns focus | fixed — `review14-public.spec.ts` |
| WEB-2 | `i18n/routing.ts` | next-intl's hreflang `Link` headers contradicted the page tags (x-default without `/sr`, request host) | `alternateLinks: false` | fixed — `review14-seo.spec.ts` |
| WEB-3 | `properties/[slug]/page.tsx:135-137` | Meta descriptions lost a trailing "s" (`[.s]` regex) and gave land a floor | Builder moved to `lib/listing-meta.ts`, fixed | fixed — `lib/listing-meta.test.ts` (8) |
| WEB-5 | `app/[locale]/layout.tsx`, `page.tsx` | Admin "Podrazumevani SEO" settings were never used | page SEO → settings → messages | fixed — `lib/seo.test.ts` |
| WEB-6 | `PropertyCard.tsx`, results page | ~680 KB search document: 120 hidden carousel `<img>` srcsets and 4-locale card props | Frame 0 only on the server, locale-projected cards (`lib/search-cards.ts`) — est. ~400 KB | fixed — `lib/search-cards.test.ts`, `review14-search.spec.ts` |
| WEB-7 | `components/site/home/data.ts:53` | Home page fetched its content twice per request | One cached accessor | fixed (code) |
| WEB-8 | `locations/[slug]`, `locations`, `journal/[slug]` pages | Independent Convex reads awaited in sequence; the index built 9 cards to read one intro | Parallel loads; new `locations.intro` query (replaces the dead `locations.featured`) | fixed — `review14Lead.test.ts` (intro) |
| ADM-4 | `listing-form.ts:986-991` | Emptying a stored brokerage contract said "Sačuvano" but kept it | The field is held with "Ugovor o posredovanju se ne briše…" until restored | fixed — `listing-form.test.ts` ("a stored brokerage contract", 3 tests) |
| ADM-5 | `LeadSheet.tsx:427-444`, `lib/admin/format.ts:96` | "Sledeći korak" date could not be typed (saved per keystroke, year 0002 → 1902) | Saves on blur/Enter or a pause after a complete date; never disabled; `fromDateInput` rejects years < 1000 and impossible dates | fixed — `lib/admin/format.test.ts` (4) |
| ADM-6 | `BodyEditor.tsx:49-68`, `convex/lib/html.ts` | Pasted rich text kept attributes the server refuses, so the save failed | A paste cleaner drops attributes outside the server allowlist in both editors; posts accept `ol type` (and the public sanitizer renders it) | fixed — `lib/admin/rich-text.test.ts` (jsdom, 7 tests) |
| ADM-7 | `SeoTab.tsx`, share-image route, DTO | The listing's OG image override did nothing | DTO `seo.ogImageUrl`; the share image draws it; `?v=` hashes what the card draws; server validates new values; removing the photo clears it | fixed — `review14SearchDto.test.ts`, `review14ListingEdits.test.ts`, `lib/listing-meta.test.ts` |
| ARC-2 | `package.json` verify | The gate ran none of the repo's own checks (i18n, Convex audit, cn freshness, the 496 unit tests) | `npm run check` (all four, ~10 s) chained into verify | fixed |
| ARC-3 | `README.md` | create-next-app boilerplate (told devs to edit a forbidden `app/page.tsx`) | Rewritten: setup, env (+ `.env.example`), first admin, commands, e2e prerequisites, layout, security model, known constraints | fixed |
| ARC-4 | ARCHITECTURE §2/§5/§9, DESIGN §2, 5 comments | Docs and comments contradicted logged decisions (`sr` key, scope indexes, route-handler OG images, EB Garamond) | Docs amended; comments corrected | fixed |
| ARC-5 | listing text limits, video URL rules, floor mapping, image comparison | Validation duplicated client/server and already diverged: listing text lengths only enforced in the browser; three video-URL rules (the public player embedded fewer hosts than the server accepted); two floor mappings; six private `sameImage` copies (one key-order sensitive) | `LISTING_TEXT_LIMITS` enforced on the server and imported by the form; one `parseVideoUrl` for form, server and player; one floor mapping; one tour text limit; one `sameImage` (`convex/lib/images.ts`) | fixed — `review14ListingEdits.test.ts`, `video-url.test.ts`, `lib/search-params.test.ts` |
| ARC-7 | `listingStats.favorites` | The PRD B12 funnel's "favorites" stage was dead data (always 0) | Increment-only `stats.trackFavorite` (per-session dedupe, rate limits, nightly prune) called by the heart | fixed — `review14Lead.test.ts` (4 tests) |
| ARC-8 | `tests/e2e/helpers/admin.ts` | Admin e2e only ran on the night-run machine; a stale build silently served old code | Credentials from `E2E_ADMIN_*` env with file fallback; `global-setup.ts` refuses a missing/stale build | fixed |
| ARC-9 | various | ~850 lines of dead code and unused deps/indexes/keys | Removed: `components/ui/{calendar,form,scroll-area}`, `pickLocale`, `monthlyPayment`, `TRANSACTIONS`, `locations.featured`, the never-written `splatAssets` table, 3 unused indexes, 20 dead message keys, unused dependencies | fixed (styleguide-only kit components kept, see Low) |
| ARC-10 | `lib/seo.ts:9` | A production build without `NEXT_PUBLIC_SITE_URL` silently shipped localhost URLs | Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, fails on Vercel production without either | fixed — `lib/seo.test.ts` |
| LEAD-2 | `app/sitemap.ts` | (found while verifying WEB-11) the sitemap fix prerendered at build, making `next build` depend on Convex | Request-time route (`connection()`), data cached hourly | fixed |

## Low

| ID | Finding | Status |
|---|---|---|
| SEC-5 | `viewings.request` told anyone whether an e-mail had an open request | fixed — repeat answered like a success, no ids to public callers (`listingDetail.test.ts`) |
| CVX-12 | Daily rollup keyed by UTC day, silent caps | deferred — affects only the 30-day chart's day boundary; documented |
| CVX-13 | "Viewings today" counted cancelled; "active" excluded reserved | fixed — `review14SearchDto.test.ts` |
| CVX-14 | Mandate ignored its start date; ended at 10:00 UTC on the end day | fixed — Belgrade calendar days (`review14ListingEdits.test.ts`) |
| CVX-15 | Slug-redirect edge cases (oldest row wins, purge by `from`, no-op self-redirect) | fixed — `review14Paging.test.ts`, `review14ListingDemo.test.ts`, `review14ListingEdits.test.ts` |
| CVX-16 | Attic/penthouse passed "not top floor" | fixed — `review14Search.test.ts` |
| UI-6 | `/kontakt?message=` ignored | fixed |
| UI-7 | Reading-progress bar stale after client navigation | deferred — cosmetic hairline |
| UI-8 | Mortgage inputs clamped silently | fixed — `lib/mortgage.test.ts` |
| UI-9 | Overlays kept their locks past their breakpoint | fixed |
| UI-10 | Gallery thumbnails `sizes` too small for 2-column frames | fixed |
| WEB-9 | `?added=constructor` passed the window check | fixed — `lib/search-params.test.ts` |
| WEB-10 | JSON-LD: reserved listings `InStock`; demo registry no. as identifier | fixed (lead) |
| WEB-11 | Sitemap `revalidate` was ineffective | fixed (data cached hourly) |
| WEB-12 | `*.convex.cloud` image/CSP wildcards; any GCS bucket in connect-src | deferred — tighten to the production deployment host at deploy time (HANDOFF) |
| WEB-13 | `parseLocaleNumber`: en "5,4" → 54, ru "430.000" → 430 | fixed — `lib/format.test.ts` |
| LEAD-1 | `/sr-Latn/…` redirected to a 404 (`/sr/sr-Latn/…`) | fixed — 308 to `/sr/…` (`review14-seo.spec.ts`) |
| ARC-11 | Seven locale→Intl tag maps, two `languageList` copies | deferred — cosmetic list-format differences |
| ARC-12 | `getPublicSettings` lives in `Footer.tsx`; no `safeQuery` helper | deferred — refactor without behaviour change |
| ARC-13 | Files over 400 lines (`listingsAdmin.ts`, `listing-form.ts`, `SearchMap.tsx`…) | deferred — splits listed in the architecture review; no defect |
| ARC-14 | Public error map not typed to server codes | fixed — `Set<ErrorCode>`, dead codes removed |
| ARC-15 | `sharp` a devDependency used at runtime; `@types/react` 19.3; caret 0.x pins | partly fixed — `sharp` moved, `lucia` pinned; types/pins deferred |
| ARC-16 | vitest config ignores `components/**`; `fixtures.ts` pushed as a module | deferred |
| ARC-17 | Deprecated `next/image` `priority` in 3 places; 5 unexplained eslint-disables | partly fixed — reasons added to the 2 admin disables; `priority` and the 3 share-image disables deferred |
| ARC-9b | Styleguide-only kit components (`CursorFollowerImage`, `Marquee`, `ParallaxImage`, `Divider`) | deferred — DESIGN §4 kit, demonstrated on `/styleguide` |
| ADM-8 | Invite page flashed "invalid invite" after a successful sign-up | fixed |
| ADM-9 | Login redirect dropped the query string; sign-out raced the gate | fixed |
| ADM-10 | `safe-next.test.ts` backslash case tested no backslash | fixed (real `\\` and `%5C` cases) |
| ADM-11 | A revert typed during a multi-step save was overwritten | fixed — `listing-form.test.ts` ("a save in flight") |
| ADM-12 | Contract "expires in N days" off by one before noon | fixed — Belgrade calendar days (test incl. the October clock change) |
| ADM-13 | Bulk actions forgot the unprocessed rows after a mid-batch failure | fixed — they stay selected |
| ADM-14 | "Pogledaj na sajtu" ignored visibility | fixed — `isOnSite(row)` |
| ADM-15 | CSV export prefixed every "+381…" phone with a visible apostrophe | fixed — `contacts.test.ts` |
| ADM-16 | Admin code health: seven `useNow` copies, seven `PHONE_QUERY` copies, three dead shadcn files, unexplained eslint-disables, title limit 120 vs 140; seven plural helpers; large files | partly fixed — one `useNow`, one `PHONE_QUERY`, dead files and their deps removed, reasons added, limits aligned; plural helpers and splits deferred (no defect) |

## Checked and clean

- Every admin Convex function calls `requireRole`/`requireRoleAction`/`loadEditable` first; agents are pinned to their own data in index ranges and per document; disabled users are refused even with a valid token and their sessions are deleted; the last admin is protected; managers cannot invite or promote.
- Invites: 244-bit CSPRNG tokens stored as SHA-256, checked against server time, single-use; preview tokens CSPRNG with server-side expiry.
- Uploads: type and size from the storage system table, 6-hour freshness window, URL images https on the allowlisted host.
- Public DTOs never return the mandate, owner contact, preview token, `createdBy` or storage ids; coordinates snapped unless the address is "exact".
- Public forms: honeypot, server-side consent, length limits, per-session + per-e-mail + global buckets; existing contacts are never modified by public submissions.
- XSS: JSON-LD escapes `<`; rich text passes a write-side allowlist and DOMPurify on render; no bypass found.
- Viewing slots and the booking widget are correct across both DST switches (server arithmetic vs `Intl`: 96,408 instants, 0 mismatches) and in any visitor time zone.
- No GSAP or Lenis in the admin (source import walk of 276 modules and 118 built admin chunks).
- 0 `any`, `v.any()`, `@ts-ignore`; no TODO/FIXME; no secrets tracked.

## Verification

Run after the last code change (2026-10-02):

- `npm run verify` (Convex push → typegen → tsc → eslint → `npm run check` → `next build`): exit 0.
- `npm run check`: i18n 1221 keys × 4 locales; `audit-convex` 187 functions, no problems; `cn-tables` up to date; vitest 43 files, 496/496 passed.
- `npm run test:e2e`: 479 passed, 0 failed, 261 skipped (project-scoped: desktop-only or phone-only cases), 6.4 min, on the production build. A first run was killed with its session (Windows `0xC0000142` worker exits) and was discarded.
- Dev data: `searchMigrations:rebuildListingSearchText` (30 listings) and `contacts:backfillSearchText` (1 contact) run on the dev deployment.
- `/sr/nekretnine` HTML measured at 428 KB with 25 results (was ~680 KB); screenshots at 390 and 1440 of search and ME-1042 in `.shots/step14/` show no console errors.
