# Mihajlo Estate: handoff

This document hands over the overnight scripted build of the Mihajlo Estate public website and admin panel (night-run steps 01 to 15). It covers four things:

- what was built, checked against the PRD;
- what is still open;
- what to build next;
- how to put the site into production (written down only, never run).

| | |
|---|---|
| Date | 2026-10-02 |
| Branch | `night-run` (main branch: `main`) |
| Tag | `night-run/complete`, created by the lead after the final gate |
| Setup guide | `README.md` (Serbian, with an English summary at the end) |
| Owner summary | `docs/CLIENT-PITCH.md` (one page, Serbian) |
| Code review | `docs/REVIEW-REPORT.md` (step 14: 75 findings; every critical, high and medium one fixed) |
| Reports | `docs/reports/qa-report.md` (QA sweep, PRD AC → spec map), `docs/reports/perf.md` (Lighthouse), `docs/reports/seo-audit.md` |
| History | `docs/DECISIONS.md` (why), `docs/PROGRESS.md` (what), `night-run/state/steps/*.done.md` (per step) |

Read `CLAUDE.md` before changing anything. Its hard rules cover the Art. 18 brokerage-law fields, no fabricated content, dev deployment only, and the motion rules. The lead appends the step-15 gate results at the end of this file.

## 1. Feature checklist vs the PRD

**Status:**
- **Done:** the code implements the item, including its acceptance criteria.
- **Partial:** something the item describes is missing; the Notes say what.
- **Not done:** out of scope for the night run.

**Evidence** names a route folder, a key file or a Playwright spec in `tests/e2e/`. Every public route exists in sr-Latn, en, ru and de.

### A. Public site

| PRD ID | Feature | Status | Evidence | Notes |
|---|---|---|---|---|
| A1 | Global shell: header, footer, cookie consent, error pages | Partial | `components/site/{Header,Footer,CookieConsent,LocaleSwitcher}.tsx`, `app/[locale]/{not-found,error}.tsx`, `app/[locale]/[...rest]/page.tsx`; shell, public-flows, security-crawl | **Missing:** a phone CTA in the header (phone numbers are in the footer, the contact page and the agent card). After 80 px the bar turns solid **ink** (not ivory) and keeps its height. **Done:** footer legal data, Viber/WhatsApp, the language switcher (keeps the page and the listing slug), and opt-in consent (necessary / analytics / marketing). The 404 server HTML is a known issue (§2). |
| A2 | Landing page | Done | `app/[locale]/page.tsx`, `components/site/home/*`, `components/motion/Preloader.tsx`; landing, public-flows, a11y-motion | The owner's hero film was withdrawn (DECISIONS [05]). The image fallback, a still with a Ken Burns move, is the LCP with `fetchpriority=high`. The preloader shows once per session, ≤ 1.8 s, and can be skipped. |
| A3 | Search with map | Done | `app/[locale]/properties/(results)/page.tsx`, `components/site/search/*`, `components/map/SearchMap*.tsx`, `lib/search-params.ts`, `convex/listings.ts`; search, review14-search | 9 filters and one combined filter are checked against Convex data. Rooms has an extra 4.5 chip. Desktop LCP is 1.1 s. Scale ceiling: about 500 listings per transaction (§2). |
| A4 | Listing card | Done | `components/site/PropertyCard.tsx`, `lib/search-cards.ts`; public-flows | At most two badges, by priority. "3D tura" sits on the reference line (DECISIONS [06]). Only search cards have the photo carousel; the other rails show the cover. |
| A5 | Listing detail | Done | `app/[locale]/properties/[slug]/page.tsx`, `components/site/listing/*`, `components/forms/{InquiryForm,ViewingForm}.tsx`, `components/tours/*`; listing-detail, tours | The floor-plan and video tabs work, but no demo listing has a plan or a video. ME-1049 has a 4-scene 360° tour and the only 3D walk; four other demo listings have 360° tours. |
| A6 | Valuation funnel `/procena` | Done | `app/[locale]/valuation`, `components/site/valuation/*`, `convex/leads.ts` (`createValuation`, `requestOnsiteValuation`); pages-flows | The range is the area's average €/m², adjusted for condition, floor and lift. The on-site CTA is a callback request on the same lead. |
| A7 | Sell with us `/prodajte` | Done | `app/[locale]/sell/page.tsx`, `components/site/sell/*`, `leads.createSeller`; pages-flows | |
| A8 | Locations `/lokacije` | Done | `app/[locale]/locations/**`, `components/site/locations/*`; pages-routes, public-flows | "Key facts" is a free per-locale list (`locations.facts`, Admin → Lokacije). No seeded place has one yet. |
| A9 | Agents `/agenti` | Done | `app/[locale]/agents/**`, `components/site/agents/*`; public-flows | Demo agents have monogram avatars, never stock faces. |
| A10 | About, contact | Done | `app/[locale]/{about,contact}`, `components/site/{about,contact}/*`; pages-flows | The figures come from the `pages.home` numbers block. The office-photo slot shows the owner's facade render (`artImage("about")` in `lib/media.ts`). A real photo goes in through `media-src/` + `npm run media:optimize`, not the admin. |
| A11 | Journal `/magazin` | Done | `app/[locale]/journal/**`, `components/site/journal/*`; pages-flows, public-flows | 3 demo posts × 4 locales. |
| A12 | Favorites and compare | Done | `components/site/{favorites,compare}/*`, `lib/stores/*`; public-flows, pages-flows | |
| A13 | Legal pages | Done | `app/[locale]/{privacy,terms,cookies}`, `components/site/legal/LegalDocument.tsx`; public-flows | The seeded texts are drafts. Their "NACRT — proveriti sa pravnikom pre objave" block shows only in the admin. |

### B. Admin panel

| PRD ID | Feature | Status | Evidence | Notes |
|---|---|---|---|---|
| B1 | Auth and roles | Done | `convex/auth.ts`, `convex/invites.ts`, `convex/lib/auth.ts`, `app/admin/{login,pozivnica}`, `components/admin/shell/*`; admin, admin-crm, admin-modules (47 admin functions refuse anonymous callers) | Invite links are copied by hand (no e-mail). In the admin, agents see only their own listings; they see the others on the public site. Staff change their own password from the user menu (step 15). There is no "forgotten password" reset (§2). |
| B2 | Dashboard | Done | `components/admin/dashboard/*`, `convex/analytics.ts`; admin-modules | Chart days are UTC days (CVX-12). |
| B3 | Listings: table, 9-tab editor, checklist, workflow | Done | `components/admin/listings/**`, `convex/listingsAdmin.ts`, `convex/lib/checklist.ts`, `convex/media.ts`; admin, admin-modules, admin-tours | The publish checklist runs again on every edit of a live listing. Not tested end to end: map-pin drag, price-history UI, slug change → 308, bulk publish/assign. |
| B4 | Leads and pipeline | Partial | `app/admin/(panel)/upiti`, `components/admin/leads/*`, `convex/leadsAdmin.ts`; admin-crm, admin-modules | **Missing:** logged e-mails in the lead timeline (there is no e-mail integration). The timeline holds activity, notes and viewings. There is also no text search and no manual "new lead" (§2). |
| B5 | Viewings | Done | `app/admin/(panel)/razgledanja`, `components/admin/viewings/*`, `convex/viewingsAdmin.ts`, `agentsAdmin.setAvailability`; admin-modules | Status changes are enforced on the server. The week calendar is not tested end to end. |
| B6 | Contacts and consent | Partial | `app/admin/(panel)/kontakti`, `convex/contacts.ts`; admin-crm (CSV), admin-modules (anonymize) | **Missing:** an IP hash on consent records. They hold text version, time and channel; Convex mutations never see the client IP. Web forms match contacts by e-mail only (a security choice, DECISIONS [09]); duplicates by phone are merged by hand (`contacts.merge`). |
| B7 | Team | Done | `app/admin/(panel)/tim`, `components/admin/team/*`, `convex/{users,invites,agentsAdmin}.ts`; admin, admin-modules | Agent profile fields are not tested end to end. |
| B8 | Locations | Done | `app/admin/(panel)/lokacije`, `convex/locationsAdmin.ts`; admin-modules | A changed slug is not redirected (§2). |
| B9 | Journal | Done | `app/admin/(panel)/magazin`, `components/admin/posts/*`, `convex/postsAdmin.ts`, `lib/content/sanitize.ts`; admin-crm | Scheduled posts use the Convex scheduler. |
| B10 | Site content | Done | `app/admin/(panel)/sadrzaj`, `components/admin/content/*`, `convex/{pagesAdmin,testimonialsAdmin}.ts`; admin-crm | Testimonials render only once verified, and none is verified yet. |
| B11 | Settings | Done | `app/admin/(panel)/podesavanja`, `components/admin/settings/*`, `convex/settingsAdmin.ts`; admin-modules | Analytics IDs load only after consent (§4.9). PDF and share-image uploads are not tested end to end. |
| B12 | Analytics | Done | `app/admin/(panel)/analitika`, `convex/analytics.ts`; admin-modules | `stats.trackFavorite` feeds the favorites stage (step 14). |
| B13 | Activity log | Done | `app/admin/(panel)/aktivnost`, `convex/activity.ts`; admin-modules | |
| B14 | Demo content | Done | `app/admin/(panel)/demo`, `convex/demo.ts`; admin, admin-modules | Never pressed on dev. Read §4.10 before you use it. |

### C. Cross-cutting

| PRD ID | Feature | Status | Evidence | Notes |
|---|---|---|---|---|
| C | Performance | Partial | `docs/reports/perf.md`, `scripts/check-bundle-isolation.mjs` | **Desktop:** Lighthouse 96 / 96 / 97, CLS ≤ 0.03. **Mobile** (Lighthouse's default slow-4G simulation, localhost): 75 home, 74 search, 74 listing; LCP 5.6–5.9 s. **Missing:** an INP measurement. Maps, 360°, 3D, lightbox, Tiptap and charts are lazy-loaded. |
| C | Accessibility | Done | a11y, a11y-focus, a11y-keyboard, a11y-motion; `scripts/qa-matrix.mjs` | axe found no serious or critical violation on any public route (desktop and phone). The matrix crawl (21 routes × 4 locales × 390/768/1440) was clean in every cell, and its own axe pass found nothing of any impact. |
| C | SEO | Done | `lib/{seo,jsonld,og}.ts(x)`, `app/{sitemap,robots}.ts`, `docs/reports/seo-audit.md` | All 344 audited pages pass; JSON-LD is valid on all 336 sitemap pages. Open: the 404 server HTML (§2). |
| C | Security | Done | `convex/lib/{auth,rateLimit,storage}.ts`, `lib/csp.ts`, `next.config.ts`; security-crawl, `scripts/audit-convex.mjs` | Every admin function checks the role on the server. Public forms have rate limits and a honeypot, uploads are checked, rich text is sanitized. The CSP still uses `*.convex.cloud` wildcards: pin them at deploy (WEB-12, §4.8). |
| C | Tests | Done | 22 Playwright specs in `tests/e2e/`, `convex/tests/*`, `lib/**/*.test.ts` | Screenshots at 390 / 768 / 1440 come from `scripts/qa-matrix.mjs` and `scripts/shots.mjs`. |

### Out of scope (00-BRIEF non-goals)

| ID | Item | Status | Notes |
|---|---|---|---|
| NG-1 | Public user accounts | Not done | Favorites and compare live in the visitor's browser. |
| NG-2 | Online payments | Not done | |
| NG-3 | Portal XML feeds | Not done | There is no feed code and no portal-specific field. See §3 item 8 for what the data model already has. |
| NG-4 | Saved-search e-mail alerts | Not done | Only the `savedSearches` table exists. Sending needs a Resend key (§3 item 1). |
| NG-5 | Production deploy | Not done | Guide in §4, never run. |

**Count: 28 done, 4 partial, 5 not done** (32 PRD items + 5 BRIEF non-goals).

## 2. Known issues

These are de-duplicated. Nothing critical or high is open, and severity uses the scale in `docs/REVIEW-REPORT.md`. Code-level items were re-checked in the code on 2026-10-02. Measured items (Lighthouse, 3D timings) come from the reports and done files named. Source codes:
- `05b`–`14`: the step done files;
- `15`: DECISIONS [15];
- `REVIEW`: the step-14 review;
- `BRIEF`, `PRD`, `ARCH`: docs 00, 01, 02.

### Public site

| Sev | Issue | Where | Suggested fix | Source |
|---|---|---|---|---|
| medium | The public forms have no server-verified bot challenge. They rely on a honeypot plus per-session, per-e-mail and global rate limits. A script with many throwaway addresses can fill the global breakers (1000 leads/h, 600 viewing requests/h) and lock real visitors out. | `convex/lib/rateLimit.ts`, `convex/{leads,viewings}.ts`, `components/forms/*` | Cloudflare Turnstile: widget on the five forms, token checked in a Convex action, secret in a Convex env var, CSP hosts for `challenges.cloudflare.com`. | 07, 13, 14 |
| low | `notFound()` pages are served as Next's error shell: the server HTML has no `lang` and no h1. Status 404, `noindex` and the localized title are correct, and the page paints on the client. | `app/[locale]/not-found.tsx`, `next.config.ts` (`experimental.globalNotFound`), the two root layouts | Investigated twice (DECISIONS [13]): a Suspense wrapper would turn every 404 into a streamed 200. Revisit after a Next upgrade or with a single root layout. | 10, 12, 13 |
| low | The header has no phone CTA, and its solid state keeps the full 86 px height (PRD A1). | `components/site/Header.tsx` | A `tel:` link from `settings.phones[0]`. A slimmer solid state or hide-on-scroll-down (05b reviewer). | 05b |
| low | Crossing 1024 px in width (e.g. rotating an iPad) loses the reading position, because ScrollTrigger's refresh scrolls to 0. | `components/motion/gsap.ts` | Record an anchor on `matchMediaInit`, then restore it with `lenis.scrollTo(…, { immediate: true })` after the refresh. | 05b |
| low | UI-7: the reading-progress hairline goes stale after client navigation. | `components/motion/ScrollProgress.tsx` | Refresh it on pathname change. | REVIEW |
| low | Withdrawing analytics consent takes effect from the next page load. A tracker that already loaded stays for the current page view. | `components/site/Analytics.tsx` | Reload on withdrawal, or call the providers' opt-out APIs. | 13 |
| low | Services rows 3–6 animate before they are on screen: one reveal covers the whole list. | `components/site/home/Services.tsx` | `ScrollTrigger.batch` per row. | 05b |
| low | The 3D walk is slow to start and only lightly tested. Details: Spark's LoD build takes ~8.5 s for the 3.85 M-splat demo, and the first frame comes after 16–23 s including the 43 MB download. The demo has no mobile model. The FPS guard never triggered in tests. Collision uses only the 2D floor polygon, so the camera can clip low objects; the viewer ignores the admin's `collision` model slot. | `components/tours/walk/WalkEngine.ts`, `lib/tours/*` | Export scans at ≤ 2–3 M splats plus a mobile SOG. Use a pre-built LoD. Add `collision.glb` with three-mesh-bvh. Test on real phones and on an integrated-GPU laptop. | 11, 13 |
| low | OpenFreeMap has no SLA. A map that has not loaded after 12 s shows a notice instead. | `components/map/useLoadDeadline.ts` | Self-host the tiles (OpenFreeMap planet or Protomaps on R2) if outages hurt. | 07 |
| low | PLC-14 (accepted): the team and agent pages show ink monogram tiles until real photos are uploaded. | Admin → Tim | Upload real photos; stock faces are not allowed. | 13 |

### Admin

| Sev | Issue | Where | Suggested fix | Source |
|---|---|---|---|---|
| medium | Nobody is notified of a new lead: no e-mail, no Viber, no push. Staff see leads only in the admin, where the dashboard lists those not contacted for over 1 h. | `convex/leads.ts`, `convex/leadsAdmin.ts` (`awaitingResponse`) | Resend notifications (§3 item 1), then Viber (item 4). | BRIEF |
| medium | Upiti has no manual lead entry and no text search, so phone, e-mail, walk-in and portal leads cannot be recorded. `leads.source` already accepts those values. | `convex/leadsAdmin.ts` (no `create`), `components/admin/leads/*` | A role-checked `leadsAdmin.create` (contact upsert, consent record, activity row) plus a "Novi upit" sheet. Search over a folded `searchText`, as in contacts. | 09 |
| medium | There is no reset for a forgotten password, and invites are not e-mailed: the admin copies the one-time link. Changing one's own password works (step 15). | `convex/auth.ts`, `convex/users.ts` | An e-mail reset flow once Resend is in (DECISIONS [15]). | 15 |
| low | Publish is refused while an editor field holds a value the server rejected. Other status changes are refused when the pending save fails. The banner names the field. | `components/admin/listings/editor/PublishPanel.tsx` | Let staff discard the rejected value from the banner. | 14 |
| low | A photo's room tag cannot be cleared once set. | `convex/media.ts` (`updateMeta`) | Accept an explicit unset. | 08 |
| low | After a reload, an uploaded 3D-walk poster shows only "Otpremljena slika", with no preview. | `convex/listingsAdmin.ts` (`get`), `components/admin/listings/editor/tours/AssetField.tsx` | Return the poster's storage URL from `get`. | 11 |
| low | The admin labels address visibility "street" as "Samo ulica, približan pin", but the public DTO hides the street for it too; only "exact" shows it. | `lib/admin/labels.ts`, `convex/lib/dto.ts` | The owner decides; then change either the label or the DTO. | 08 |
| low | Translating is click-heavy: every localized field has its own SR/EN/RU/DE switch, and page-editor blocks cannot be collapsed. | `components/admin/common/L10nInput.tsx`, `components/admin/content/*` | A page-level locale switch and collapsible blocks. | 09 |
| low | ADM-16 (partly fixed): seven Serbian plural helpers, and some large files. | `components/admin/**`, `lib/admin/**` | One plural helper; optional splits. | REVIEW |

### Backend / Convex

| Sev | Issue | Where | Suggested fix | Source |
|---|---|---|---|---|
| low | Search reads bounded windows. `count` reads ≤ 600 documents (shown as "600+"), the map gets ≤ 500 points, and a narrow range with a different sort scans more. This is fine up to about 500 listings per transaction. | `convex/lib/search.ts` (`COUNT_SCAN`, `MAX_POINTS`, `SEARCH_SCAN`) | A slim `listingSearch` projection table, kept in sync in the listing mutations. | 06 |
| low | CVX-12: the daily stats roll up by UTC day, with silent caps. | `convex/stats.ts` (`dayKey`, `rollupDaily`) | Belgrade day keys from `convex/lib/belgradeTime.ts`. | REVIEW |
| low | Deleting a listing reads bounded child sets: 60 price changes, 100 slug redirects, 500 view rows, 100 viewings, 200 leads. Rows beyond those caps are orphaned. | `convex/lib/listingCascade.ts` | A self-rescheduling batched cascade. | 08 |
| low | Uploads are never garbage-collected (abandoned forms, a failed `media.attach`). Blob ownership rests on the 6-hour link window, not on a ledger. | `convex/uploads.ts`, `convex/lib/storage.ts` | An upload ledger plus a cleanup cron. | 08, 09, 11 |
| low | More bounded reads: the agency-wide viewings calendar reads ≤ 500 rows per range and the locations tree ≤ 500 per kind. The analytics charts show `capped` when they hit a limit. | `convex/viewingsAdmin.ts`, `convex/locations.ts`, `convex/analytics.ts` | Paginate when the agency grows. | 09 |

### Security and compliance

| Sev | Issue | Where | Suggested fix | Source |
|---|---|---|---|---|
| low | WEB-12: the CSP and `images.remotePatterns` allow any `*.convex.cloud` / `*.convex.site` host, and `connect-src` allows any `storage.googleapis.com` bucket. | `lib/csp.ts`, `next.config.ts`, `convex/lib/tours.ts` | Pin to the production host at deploy (§4.8). | REVIEW |
| low | Consent records carry no IP hash (PRD B6). | `consentV` in `convex/lib/validators.ts`, `convex/leads.ts` | Pass a salted hash from a Next route handler or a Convex HTTP action. | PRD B6 |

### Performance

| Sev | Issue | Where | Suggested fix | Source |
|---|---|---|---|---|
| medium | Mobile Lighthouse scores 74 on search and listing and 75 on home, with LCP at 5.6–5.9 s under the default slow-4G simulation. This was measured on localhost only. | `docs/reports/perf.md` | Mount `ConvexClientProvider` only where live data is used, and inline the shell icons. Then re-measure on the hosted build with PageSpeed Insights and CrUX. | 12, 13 |
| low | Cards outside search still send full 4-locale props: `ListingGrid`, `SimilarRail`, `ArticleRelated`, `FeaturedListings`. | `components/site/{locations,listing,journal,home}/…` | Project them with `toSearchCard` from `lib/search-cards.ts`. | 14 |
| low | Every page ships all client message namespaces (~55 KB raw, ~12 KB gzip). | `app/[locale]/layout.tsx` (`getMessages`) | A per-namespace provider. It carries risk (DECISIONS [12]). | 12 |
| low | Public pages render per request, because Convex `fetchQuery` is no-store. Each page view costs a server render plus Convex reads. | `app/[locale]/**` | Fine at agency scale. Revisit caching if traffic grows. | ARCH §3 |

### SEO

| Sev | Issue | Where | Suggested fix | Source |
|---|---|---|---|---|
| low | A changed location slug is not redirected: old `/lokacije/<slug>` links return 404. | `convex/locationsAdmin.ts` | A redirect table like the listings' `slugRedirects`. | 09 |
| low | Lighthouse reported "no meta description" on `/sr/nekretnine` in 3 of 6 runs, although the tag is in `<head>`. That was measured before step 14 cut the page from ~680 KB to 428 KB, and it has not been re-measured since. | `docs/reports/perf.md` | Re-run Lighthouse on the hosted build. | 12 |
| low | The 404 server HTML (see Public site). The SEO audit's 34 warnings are titles and descriptions over the soft limits. | `docs/reports/seo-audit.md` | Content work. | 12 |

### Tooling / tests

| Sev | Issue | Where | Suggested fix | Source |
|---|---|---|---|---|
| low | Some flows are not tested end to end; convex-test covers their server logic. They are: editor map-pin drag, price-history UI, slug change → 308 from the editor, bulk publish/assign, the viewings week calendar, agent profile fields, PDF/OG uploads in settings. | `tests/e2e/*` | Add Playwright cases. | 13 |
| low | e2e runs leave data on the dev deployment. Each `admin-modules` run leaves one anonymized contact with its general lead (there is no contact-delete mutation). Activity rows are append-only. `qa:purgeByEmail` does not roll back `listingStats`. | `tests/e2e/admin-modules.spec.ts`, `convex/qa.ts` | Dev only. Never point the suite at production (§4.10). | 07, 13 |
| low | Deferred refactors without behaviour change: ARC-11 (seven locale → Intl maps, two `languageList` copies), ARC-12 (`getPublicSettings` lives in `components/site/Footer.tsx`, no `safeQuery`), ARC-13 (files over 400 lines, e.g. `convex/listingsAdmin.ts`, `lib/admin/listing-form.ts`, `components/map/SearchMap.tsx`), ARC-16 (vitest picks up only `convex/**` and `lib/**` tests; `convex/tests/fixtures.ts` is pushed as a Convex module), ARC-9b (kit components used only by `/styleguide`). | as named | See REVIEW-REPORT "Low". | REVIEW |
| low | ARC-15 (partly fixed): `@types/react` resolves to 19.3.0 while React is 19.2.8, and some 0.x packages use caret pins. ARC-17 (partly fixed): the deprecated `next/image` `priority` prop in `app/[locale]/{agents,journal}/[slug]/page.tsx` and the `ImageReveal`/`ParallaxImage` kit, plus 3 unexplained eslint-disables in the share-image routes. | `package.json`, as named | Pin the types and exact 0.x versions; use `preload`/`fetchPriority`. | REVIEW |
| low | On Windows a Playwright run can die with worker exit `3221225794` when the session ends. | — | Re-run; it is not a test failure. | 14 |

### Final design pass (step 15): suggestions not taken

The step-15 design critics' high and most medium findings were fixed (DECISIONS [15]). These were left, with the reason:

| Sev | Suggestion | Why not now |
|---|---|---|
| medium | Card titles are the long SEO titles (three lines at most on 3:2 cards, two on the landing rail, where some end in an ellipsis); a short per-locale card title ("Penthaus, Beograd na vodi") would read less like a portal. | Needs a new admin field and a translation pass; content work. |
| medium | The dashboard's "Pregledi i upiti" chart reads the daily rollup (`dailyStats`), which nothing corrects when leads are deleted (QA purges, re-seeds, the demo purge): after the step-15 dev clean-up its "Upiti" total is above the 7-day KPI, and after the pre-launch demo purge it would keep showing demo traffic for up to 30 days. | Count chart leads live from `leads` by creation time, or recompute the affected `dailyStats` rows in the delete and demo-purge paths. |
| low | After the first-visit consent decision the hero keeps the banner's reserved band for the rest of that page view (so nothing moves), leaving extra dark floor under the search on phones. | Release the hold once the hero has scrolled out of view. |
| low | Cards show the floor as a bare fraction ("3 / 5", "PK / 4"), unclear to foreign buyers; seeded contact e-mails end in `.local` and are set large in the closing call to action. | A word with the fraction ("sprat 3/5", "Floor 3/5"); enter the real contacts (go-live checklist). |
| low | Managed rich text (About sections, legal pages, journal bodies) is rendered without the site's typography pass, so lines can end on one-letter words ("i", "o", "u"). | Run `fixTypography` over the text nodes in `components/site/page/RichText.tsx` after sanitizing. |
| low | ME-1049's gallery still holds demo photos that read as other homes (a period dining room, an attic bedroom); the location row of non-Belgrade cards shows the district without the city ("Centar", "Grbavica"). | Real photography; append the city when it is not Belgrade. |
| low | Landing details: the vertical "SKROLUJTE" cue stays after the first scroll; footer links are 36 px tall on phones (44 px is the house rule); "prvi stan" can split across lines in a journal title; Novi Sad has no region line in the neighbourhood index; the journal lead's caption plate covers the photo's warm bottom on phones. | Fade the cue with the hero copy; `min-h-11` below `lg`; a no-break space; a "Vojvodina" line; no negative margin on phones. |
| medium | Search cards: one badge instead of two, location as an eyebrow, the reference row folded into the meta row. | Two badges by priority is a logged decision (DECISIONS [06]); the card structure is shared by five pages and their specs. |
| medium | The landing mixes warm owner renders with cooler Unsplash editorial photos; a warmer `photo-grade` or golden-hour picks would unify them. | A grading change touches every editorial photo; real photography replaces the demo pool anyway. |
| low | Phone "Poznajemo svaku ulicu." band crops to an overcast sky. | The photo is already upscaled there; a different photo is the fix. |
| low | The featured section's title rides out with the pinned track; the 3D section repeats its CTA; the journal lead plate's notch; the phone headline sits at the clamp floor; the search filter bar mixes three control styles. | Cosmetic; logged for the next design iteration. |
| low | The seeded journal posts store links as `href='…'` (single quotes), which the server's HTML allowlist would refuse on an API save. | The admin editor re-serializes with double quotes, so staff saves work; re-seeding would fix the source strings. |

**Owner decisions (not defects):**
- The wordmark is drawn as sans-serif paths (`components/site/Logo.tsx`), while DESIGN §4 says serif.
- `hero.mp4` and `city.mp4` are withdrawn by hash in `scripts/optimize-media.mjs`; a corrected re-render (from a Belgrade reference) is picked up automatically.
- The about value "Odgovor istog radnog dana…" runs to 2–3 lines (owner wording).
- Renaming the brand needs code too: the wordmark SVG, `lib/og.tsx` and the title template in `messages/*.json`.

## 3. Next steps (roadmap)

This is roughly in order of value:
- items 1–5 are follow-ups already planned in `docs/00-BRIEF.md`, `docs/05-RESEARCH.md` and `docs/06-3D-TOURS.md`;
- items 6 and up come from this review.

Scope is rough: **S** ≤ 1 day, **M** 2–5 days, **L** 1–3 weeks.

1. **E-mail with Resend: lead notifications and saved-search alerts.** Scope **M**.
   - **Why:** today a lead waits until someone opens the admin, and alerts bring buyers back.
   - **Already prepared:**
     - the `savedSearches` table in `convex/schema.ts`: `email`, `locale`, `query` (a `lib/search-params.ts` query string), `frequency` (`daily` or `weekly`), `lastSentAt`, `active`, index `by_email`. No function or UI uses it yet;
     - for notifications: `leads.agentId`, `type`, `listingId`, `locale`, `firstResponseAt`, `nextActionAt`, the recipients' `agents.email` and `users.email`, and `leadsAdmin.awaitingResponse` for "still unanswered" reminders;
     - consent: `leads.consent` and `contacts.consents` (`marketing` flag); `CONSENT_TEXT_VERSION` is in `convex/leads.ts`.
   - **Work:**
     - a Resend account with a verified sending domain (SPF/DKIM records) and the API key as a Convex env var;
     - a sending action (the Resend API, or Convex's e-mail component; not installed);
     - a notification scheduled from the public lead mutations;
     - a daily/weekly cron that runs `listings.search` with each saved query since `lastSentAt`;
     - a "save this search" form with double opt-in and an unsubscribe link;
     - invite e-mails and the password-reset flow on the same integration.
2. **Owner portal (sellers follow their listing).** Scope **L** (needs item 1 for sign-in).
   - **Why:** sellers see views, inquiries and viewings themselves. That differentiates the agency (`docs/05-RESEARCH.md`: My Knight Frank, MySavills) and cuts "how is it going" calls.
   - **Data that exists:** `listings.ownerContactId` → `contacts` (tag `vlasnik`); `listingStats` (`views`, `favorites`, `leads`, `viewings`, `lastViewedAt`); `leads` by `by_listingId`; `viewings` by `by_listingId_and_start` with `feedback`; `priceChanges`.
   - **Missing:** a per-listing daily series (`dailyStats` is agency-wide) and any owner sign-in, since public accounts are a non-goal.
   - **Work:** magic-link sign-in, a read-only owner view that shows no buyer personal data, and a privacy review.
3. **Cloudflare R2 for 3D assets.** Scope **S–M**.
   - **Why** (`docs/06-3D-TOURS.md`): Convex storage has a 2-minute upload timeout and bills egress, and a scan is 20–75 MB per listing. R2 has free egress and 5 GB single PUTs.
   - **Today:** each admin slot takes an upload (≤ 200 MB, with a warning above 50 MB) or a URL. The allowed hosts live in `SPLAT_HOSTS` (`convex/lib/tours.ts`); both the server check and the CSP read them.
   - **Work:** a bucket behind a custom domain, with versioned immutable keys, `Cache-Control: max-age=31536000, immutable` and CORS for GET/HEAD/Range. Add the domain to `SPLAT_HOSTS`. Optionally, presigned uploads from a Convex action.
4. **Viber alerts for agents.** Scope **M**.
   - **Why:** Viber is a channel Serbian clients already use (DECISIONS [07] names WhatsApp and Viber as the channels Serbian buyers share listings on). An alert there reaches an agent who is away from the admin.
   - **Data:** `agents.viber`, plus the same trigger as item 1.
   - **Work:** a Viber bot (each agent subscribes once) or Viber Business Messages through a provider; message templates; opt-out. Only `docs/05-RESEARCH.md` (V2 list) covers this; the API was not evaluated.
5. **AI search (natural language → filters).** Scope **M**.
   - **Why:** nekretnine.rs already offers "AI pretraga" (`docs/05-RESEARCH.md`), so its absence is a visible gap against that portal.
   - **How:** a Convex action maps the text onto the existing URL contract (`parseSearchParams` / `toQueryString` in `lib/search-params.ts`), then the normal search runs. The visitor sees the resulting chips.
   - **Needs:** an LLM API key (Convex env var), rate limits (`@convex-dev/rate-limiter` is already installed) and prompts for 4 locales.
6. **Turnstile on the public forms.** Scope **S**. It closes the only medium security gap (§2). Needs Cloudflare site and secret keys.
7. **Manual leads and lead search in Upiti.** Scope **S–M**. Without it, phone and walk-in clients never reach the CRM (§2).
8. **Portal XML feeds (4zida, Halo oglasi, nekretnine.rs).** Scope **M** per portal, once each portal's import spec is in hand.
   - **Why:** today listings are re-typed into each portal by hand. 4zida imports agency XML feeds (`docs/05-RESEARCH.md`).
   - **Prepared:** nothing portal-specific. The listing model already has the structured fields a feed needs:
     - identity and price: `ref`, `transaction`, `propertyType`/`subtype`, `price`;
     - the property: `areaM2`, `rooms`, `floor`/`totalFloors`, `heating`, `constructionType`, `condition`, `furnishing`, `features`, `parking`, `legal.registration`;
     - place: `cityId`/`municipalityId`/`neighborhoodId`, `location.lat`/`lng` and `addressVisibility`;
     - content: ordered `media` with a cover and per-locale `alt`, and per-locale `title`/`description`.

     `leads.source` already accepts `portal`.
   - **Work:** one route handler per portal, modelled on `app/sitemap.ts`, covering only listed listings and respecting `addressVisibility`. Add per-portal IDs and export flags where a portal needs them.
9. **Real photography and agent profiles.** Content work; it blocks launch (§4.10). Needed:
   - listing photos: ≥ 5 per listing, 8+ recommended by the dashboard;
   - floor plans and videos (no demo listing has them);
   - agent photos, bios and licence numbers;
   - an office photo;
   - location covers and "key facts";
   - a Belgrade hero film, if one is wanted.
10. **Mobile performance pass.** Scope **M**. Re-measure on the hosted build first (§2 Performance).
11. **The deferred review items** (§2: CVX-12, UI-7, WEB-12, ARC-*, ADM-16). Each is **S**; WEB-12 is part of the deploy (§4.8).

## 4. Production deploy guide

> **NOT RUN.** Nothing in this section has been executed. The night run never deployed and never touched a production deployment (a hard rule in `CLAUDE.md`).
>
> - Convex CLI flags and behaviour were checked against the installed `convex` 1.46.0 and `@convex-dev/auth` 0.0.95.
> - Environment variables were checked against the code.
> - Dashboard click paths (Convex, Vercel) follow those products' UIs and **could not be verified from the repository**.
>
> Commands are for bash (Git Bash on Windows), run from the repository root.

```bash
# Used by the commands below. Edit once.
export SITE_ORIGIN="https://www.example.rs"   # the canonical public origin, no trailing slash
```

### 4.0 Before you start

1. You need a Convex account with access to the project whose dev deployment is in `.env.local` (`CONVEX_DEPLOYMENT=dev:…`), and a logged-in CLI: `npx convex login`.
2. You need a Vercel account, the domain, and access to its DNS.
3. Merge `night-run` into `main` and push it to the Git host Vercel will build from. The night run never pushed.
4. Use Node 22 (`README.md`; `next` 16.3.6 needs ≥ 20.9).

### 4.1 Convex production deployment

1. In the Convex dashboard, open the project and switch to its **Production** deployment. Provision it if the dashboard asks.
2. In that deployment's **Settings**, generate a **Production deploy key**.
   - Keep it in a password manager. It goes only into Vercel (§4.5); never into a file in the repository.
3. Push the functions once from your machine:

   ```bash
   npx convex deploy
   ```

   - With `CONVEX_DEPLOYMENT` in `.env.local`, this targets the project's **production** deployment.
   - It asks before pushing and shows the production URL in that prompt (`NEXT_PUBLIC_CONVEX_URL=https://<prod>.<region>.convex.cloud`). Note it for §4.8.
   - It then typechecks, regenerates `convex/_generated` and pushes the schema, functions, indexes and the three crons.

### 4.2 Auth keys and `SITE_URL` on the production deployment

```bash
npx @convex-dev/auth --prod --web-server-url "$SITE_ORIGIN"
npx convex env list --prod --names-only      # expect JWKS, JWT_PRIVATE_KEY, SITE_URL
```

- **What it sets:** `SITE_URL` (from `--web-server-url`), then a fresh `JWT_PRIVATE_KEY` and `JWKS`. It calls `npx convex env set --prod …` for you.
- **"Ready to continue?" twice:** it compares `convex/auth.config.ts` and `convex/auth.ts` with its templates. Both differ on purpose: the typed `env.CONVEX_SITE_URL`, and the invite-only `ConvexCredentials` provider. It prints its template and asks "Ready to continue?". It never overwrites an existing file.
  - Answer yes.
  - Do not "fix" `convex/auth.ts` back to the library's `Password` provider (DECISIONS [14]).
- **Warning:** never regenerate the keys on a deployment that has users, because every session is signed out. If the CLI asks to overwrite an existing `JWT_PRIVATE_KEY`/`JWKS`, answer **No**.
- **No domain yet?** Set `SITE_ORIGIN` to the Vercel production URL for now, and set `SITE_URL` again once the domain is live (§4.7).
- **No other server env vars:** these three are all the deployment needs. Beyond them, the Convex code reads only the platform-provided `CONVEX_SITE_URL` (`convex/auth.config.ts`). `SITE_URL` also goes into the Nominatim User-Agent (`convex/geocode.ts`).

### 4.3 First admin on production

This is the same pattern as `README.md` and `convex/seed.ts`. The password is never typed into the shell, so it stays out of shell history.

```bash
# 1. Create a file OUTSIDE the repository, e.g. ~/me-admin-prod.json, containing:
#    {"email":"owner@example.rs","password":"<at least 12 characters>","name":"Ime Prezime"}
# 2. Feed it to the internal action:
node -e "process.stdout.write(require('fs').readFileSync(require('os').homedir()+'/me-admin-prod.json','utf8'))" \
  | xargs -0 npx convex run --prod seed:createAdmin
# 3. Delete ~/me-admin-prod.json.
```

- `seed:createAdmin` writes a 10-minute bootstrap invite and then creates the account. The role is `admin` by default.
- It refuses passwords under 12 characters.
- For an address that already exists it answers "user … already exists" and changes nothing.
- Invite further staff from Admin → Tim.

### 4.4 Base data on production

There is **no dedicated production seed**. The supported path is `seed:all`, followed by a cleanup before launch.

**Option A (supported):**

```bash
npx convex run --prod seed:all '{}'
```

It is idempotent: it skips when demo listings already exist. Every row it writes is `isDemo: true`:
- settings with placeholder legal data (PIB `000000000`, MB `00000000`, registry `000`, e-mail `office@mihajlo-estate.local`, phone `+381 11 000 0010`);
- 40 locations (7 cities, 9 municipalities, 24 neighborhoods) with average €/m²;
- 4 demo agents with monograms;
- 30 listings with Unsplash photos and demo tours, including the 3D walk on ME-1049;
- 8 pages: home, about, sell, valuation, contact, privacy, terms, cookies. The three legal pages carry the staff-only "NACRT" block;
- 3 journal posts;
- 3 unverified testimonials, which are never shown;
- 6 demo leads with their contacts, and a few viewings.

Remove the demo part before launch with Admin → Demo sadržaj, **in the order given in §4.10**.

**Option B (possible, untested on its own):** run only the first stages of `seed:all`. These internal mutations exist in `convex/seedStages.ts` and only insert what is missing:

```bash
npx convex run --prod seedStages:seedSettings '{}'
npx convex run --prod seedStages:seedLocations '{}'
npx convex run --prod seedStages:seedContent '{}'   # pages + 3 demo posts + 3 hidden testimonials
```

This leaves out listings, agents and CRM samples. The rows are still `isDemo: true`, so the §4.10 rules apply. The night run only ever ran these stages inside `seed:all`, never on their own.

### 4.5 Vercel project

1. Import the repository into Vercel. Settings:
   - framework preset Next.js;
   - root directory: the repository root;
   - Node.js version 22.x.
2. Override the **build command**:

   ```bash
   npx convex deploy --cmd 'npm run build'
   ```

   - **Order:** `npx convex deploy` runs the command first and pushes the Convex functions only after it succeeds. A failed build or push fails the Vercel deployment.
   - **Convex URLs:** because `package.json` has `next`, the CLI sets `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` for the command (`suggestedEnvVarNames` and `runCommand` in the Convex CLI). `--cmd-url-env-var-name` is therefore not needed.
   - **Inlining:** Next inlines `NEXT_PUBLIC_*` values into the server and client code at build time (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`).
   - **MapLibre worker:** `npm run build` runs `prebuild`, which copies the worker into `public/maplibre/`.
3. Set the **environment variables** on Vercel:

   | Variable | Scope | Value / why |
   |---|---|---|
   | `CONVEX_DEPLOY_KEY` | **Production only** | The production deploy key from §4.1 |
   | `NEXT_PUBLIC_SITE_URL` | Production | `$SITE_ORIGIN`. Canonical, hreflang, sitemap and share-image URLs use it (`lib/seo.ts`), and so does the admin's SEO preview (`SeoTab.tsx`). Without it the code falls back to `https://$VERCEL_PROJECT_PRODUCTION_URL`. |
   | `NEXT_PUBLIC_CONVEX_URL` | not needed | The build command injects it (see above). |

   The code also reads Vercel's system variables:
   - `VERCEL_ENV` turns on HSTS (`lib/csp.ts`) and the fail-loud origin check;
   - `VERCEL_PROJECT_PRODUCTION_URL` is the fallback origin.

   Keep Vercel's "automatically expose System Environment Variables" switched on. Do **not** set `NODE_ENV`: npm would then skip `devDependencies` (tailwindcss, typescript), which the build needs.
4. **Recommended:** set the Vercel function region close to the Convex production region. Every page view reads from Convex on the server. The dev deployment is in `eu-west-1`; if production is too, Vercel's Dublin region (`dub1`) is the nearest.

### 4.6 Preview deployments

Do not put the production key in the Preview scope. In a non-production Vercel build (`VERCEL_ENV` ≠ `production`), the CLI refuses a production key with "Detected a non-production build environment and "CONVEX_DEPLOY_KEY" for a production Convex deployment" (`isNonProdBuildEnvironment` in the Convex CLI). Previews then fail. Choose one of these:

- **Own backend per branch:**
  1. Generate a **Preview** deploy key in Convex and set it as `CONVEX_DEPLOY_KEY` in Vercel's Preview scope. Each branch then gets a throwaway preview deployment named after the Git branch, starting empty.
  2. Give previews their auth variables as project defaults: `npx convex env default set --type preview -- NAME "value"` for `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`, or the same in the Convex dashboard. The `--` matters because the private key starts with `-`; the auth CLI uses the same form.
  3. Optionally append `--preview-run seed:all` to the build command. It runs once when a preview deployment is created and is ignored in production.
- **Or switch preview builds off** for the project.

### 4.7 Domain and HTTPS

1. Vercel → project → Domains: add the apex and `www`.
   - Pick one as canonical; Vercel redirects the other.
   - Create the DNS records Vercel shows (typically an A record for the apex and a CNAME for `www`). Vercel issues the certificate once DNS resolves.
2. Set both origin variables to the real origin, then **redeploy**:
   - on Vercel, set `NEXT_PUBLIC_SITE_URL` to it (Production);
   - on Convex, run `npx convex env set --prod SITE_URL "$SITE_ORIGIN"`.

   The redeploy is required because `NEXT_PUBLIC_*` values are inlined at build time.
3. Check the result:

   ```bash
   curl -sI "$SITE_ORIGIN/sr" | grep -iE "strict-transport-security|content-security-policy|x-frame-options"
   curl -s "$SITE_ORIGIN/robots.txt"          # must end with "Sitemap: $SITE_ORIGIN/sitemap.xml"
   ```

### 4.8 Pin the Convex host in the CSP and image config (WEB-12)

Make this code change before launch. Commit it, then deploy.

| File | What to change |
|---|---|
| `lib/csp.ts` | `const CONVEX = ["https://*.convex.cloud", "wss://*.convex.cloud", "https://*.convex.site"];`: use the production host (`https://<prod>.<region>.convex.cloud`, `wss://` of the same host, and its `.convex.site` twin). |
| `lib/csp.ts` | `"https://*.convex.cloud"` in `img-src` of both `publicCsp` and `adminCsp`. |
| `next.config.ts` | `images.remotePatterns`: `{ protocol: "https", hostname: "*.convex.cloud", pathname: "/api/storage/**" }` → the production hostname. |
| `convex/lib/tours.ts` | `SPLAT_HOSTS` includes `storage.googleapis.com` (any bucket). Only the unlicensed Spark test samples in `convex/seed/media.generated.ts` use it; the live demo walk uses `d28zzqy0iyovbz.cloudfront.net`. Drop it, and add the agency's R2 domain later. The list feeds both `connect-src` and the server's splat-URL check. |

- **Suggested implementation:** derive the hosts from `process.env.NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`. The deploy command injects both at build time, so local builds keep the dev host and production builds get the production one. `lib/content/sanitize.ts` already does this for rich-text images.
- **Check:** `tests/e2e/security-crawl.spec.ts` locally (zero CSP violations), then the `curl -sI` check above.

### 4.9 Analytics and consent

- **Where:** Admin → Podešavanja → "Analitika i oglašavanje". There are three fields:
  - "Plausible domen" (Plausible Cloud);
  - "Google Analytics 4 ID" (`G-XXXXXXX`);
  - "Meta Pixel ID" (digits).

  The server validates the formats. An empty field switches the service off.
- **Loader:** `components/site/Analytics.tsx`, rendered by `AnalyticsFromSettings` in `app/[locale]/layout.tsx`, and only when an ID is set. The admin layout never loads it.
- **Consent:**
  - Plausible and GA4 load only after the visitor accepts the **analytics** category in the cookie banner; GA4 runs with `anonymize_ip`.
  - The Meta Pixel loads only after **marketing**.
  - Nothing loads before a decision or after "necessary only".
  - A withdrawal applies from the next page load (§2).
- **Hosts the CSP already allows** (`ANALYTICS` in `lib/csp.ts`):
  - script: `plausible.io`, `www.googletagmanager.com`, `connect.facebook.net`;
  - connect: `plausible.io`, `www.google-analytics.com`, `*.google-analytics.com`, `*.analytics.google.com`, `www.googletagmanager.com`, `www.facebook.com`;
  - img: `www.google-analytics.com`, `www.googletagmanager.com`, `www.facebook.com`.

  Any other provider (self-hosted Plausible, Google Ads…) needs a code change in `Analytics.tsx` plus CSP hosts.
- **Cookie policy:** update Admin → Sadržaj sajta → "Kolačići" to name the services you switch on.

### 4.10 Go-live checklist

- [ ] **Legal data.** Admin → Podešavanja → "Pravni podaci agencije": "Naziv agencije (brend)", "Poslovno ime", "Adresa sedišta", "PIB", "Matični broj", "Broj upisa u Registar posrednika", and optionally "Osiguranje od profesionalne odgovornosti". Then save.
  - A value of only zeros counts as a placeholder.
  - While `settings.isDemo` is true:
    - the footer and the about page's compliance block show a demo notice;
    - admins and managers see the banner "Podaci agencije su još probni.";
    - a placeholder registry number is only a **warning** in the publish checklist.
  - Saving real PIB, MB and registry number sets `isDemo` to false. From then on, a placeholder registry number **blocks** publishing (Art. 18).
- [ ] **Rest of Podešavanja:** "Kontakt", "Radno vreme", "Društvene mreže", "Provizija i opšti uslovi" ("Tekst o proviziji", "Opšti uslovi poslovanja (PDF)"), "Kalkulator kredita i kurs" (seeded 5.4 % / 25 years / 20 %, EUR→RSD 117.2) and "Podrazumevani SEO". The seeded contact values are placeholders.
- [ ] **Bootstrap password.** Top bar → user menu (round button with initials, top right) → "Promenite lozinku". The dialog "Promena lozinke" asks for the current password, a new one of 10–128 characters, and the repeat. The account's other sessions are signed out. Backend: `users.changeOwnPassword` in `convex/users.ts`.
- [ ] **Team.** Admin → Tim:
  - invite the staff; each one-time link is valid for 7 days and is copied to the person by hand;
  - create real agent profiles: "Fotografija", "Biografija" per locale, languages, "Telefon", Viber, WhatsApp, "Oblasti rada", "Broj licence posrednika";
  - use real photos only; without a photo the site shows a monogram.
- [ ] **Legal texts reviewed by a lawyer.** Admin → Sadržaj sajta → "Politika privatnosti", "Uslovi korišćenja" (shown on the site as "Uslovi poslovanja") and "Kolačići". Then remove the admin-only block "Napomena: nacrt" and save.
- [ ] **Keep what you want before purging demo data:**
  - save every page you keep in Sadržaj sajta ("Početna", "O nama", "Prodajte", "Procena", "Kontakt"); saving makes a page non-demo;
  - open and save every location you keep in Admin → Lokacije, and check "Prosečna cena prodaje (€/m²)" (the valuation funnel uses it).

  A page that is still demo gets deleted and loses its managed blocks (the landing falls back to its built-in texts; other pages drop those sections). The three legal pages ("Politika privatnosti", "Uslovi korišćenja", "Kolačići") are the exception: the purge always keeps them, because the forms and the cookie banner link to them (DECISIONS [15]). They stay marked as drafts until saved after the lawyer's review.
- [ ] **Real listings.** Each needs a brokerage contract, ≥ 5 photos with a cover, and a Serbian title and description; add translations.
- [ ] **Remove demo data.** Admin → Demo sadržaj, type `OBRIŠI DEMO`. In order, it deletes every `isDemo` row of:
  - listings, except those holding uploads or real leads/viewings;
  - viewings, leads, contacts, posts and testimonials (edited demo posts and testimonials stay demo and are deleted too);
  - pages not yet saved, except the three legal pages;
  - agents, unless one is used by a listing, a user, an open invite, or real leads/viewings;
  - locations, unless one has listings or children, or a listing references it.

  Settings are never deleted.
- [ ] **Crons.** These run on the production deployment after the first deploy (`convex/crons.ts`, UTC times). Check them in the Convex dashboard:
  - 03:00 "expire brokerage mandates": published or reserved listings whose contract has ended become withdrawn and private;
  - 03:05 "roll up daily stats": the dashboard charts;
  - 03:20 "prune listing view dedupe rows": view and favorite dedupe rows older than 30 days.

  There are also self-scheduled jobs: preview-link expiry (14 days), scheduled journal posts, demo purge batches and contact anonymization batches.
- [ ] **Search Console.** Verify the domain property and submit `$SITE_ORIGIN/sitemap.xml`; `robots.txt` already points to it. The sitemap covers static pages, listed listings, posts, public agents, and locations with an intro or listings, with its data cached hourly. Optionally add Bing Webmaster Tools: Next renders full `<head>` metadata for Bing and Yandex (DECISIONS [12]).
- [ ] **Smoke tests on production.** Do them by hand, with your own e-mail. Do **not** run the Playwright suite against production: its specs create leads and listings and clean up only on the dev deployment (`convex run` without `--prod` in `tests/e2e/helpers/admin.ts`). Check:
  - **Forms:** inquiry, viewing booking (pick a slot), valuation plus the on-site request, sell, contact. Each must appear in Admin → Upiti, and the booking in Razgledanja too. Afterwards, anonymize the test contacts in Admin → Kontakti.
  - **Maps:** the search map and a listing map.
  - **Tours:** a 360° tour and the 3D walk on a listing that has them.
  - **Share image:** `/sr/nekretnine/<slug>/opengraph-image` returns a JPEG.
  - **Language switcher.**
  - **Cookie banner:** "necessary only" must leave zero analytics requests.
  - **Admin:** login, then invite acceptance in a private window.
  - **Publishing:** the checklist works with the real registry number.
  - **Read-only audits:** `node scripts/seo-audit.mjs --base "$SITE_ORIGIN" --out .shots/seo-audit-prod.md` and `node scripts/validate-jsonld.mjs --base "$SITE_ORIGIN"`. Use PageSpeed Insights for performance.
- [ ] **HSTS.** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` is sent only when `VERCEL_ENV=production` (`lib/csp.ts`). It is never sent on previews, `next start` or localhost.
  - `includeSubDomains` means every subdomain of the domain must serve HTTPS.
  - Submit to hstspreload.org only once you are sure; leaving the list is slow.
- [ ] **Backups.** Export before launch and on a schedule, to a path outside the repository:

  ```bash
  npx convex export --prod --include-file-storage --path "$HOME/mihajlo-backups/$(date +%F).zip"
  ```

  The Convex dashboard may also offer scheduled backups, depending on the plan (not verified here).

### 4.11 Rollback

- **Frontend:** Vercel's instant rollback re-points production to an earlier deployment. It does **not** re-run `npx convex deploy`, so Convex keeps the newest functions and schema.
- **Convex rolls forward, not back.** To undo a backend change, deploy the previous good commit: revert on `main` and let Vercel build, or check it out locally and run `npx convex deploy`. Then make sure the frontend matches.
  - A push validates every stored document against the schema. If newer code wrote fields or tables the older schema doesn't allow, the old push fails; fix forward instead (e.g. make the field optional).
- **Keep Convex changes backward compatible for one release.** The functions are pushed before Vercel switches traffic, so for a moment the old frontend talks to the new backend.
- **Data:** `npx convex import --prod --replace-all <snapshot.zip>` restores an export. It is destructive (it replaces every table), so use it only as a last resort and rehearse it on the dev deployment first.
- **Env vars:** a change on Vercel needs a redeploy (`NEXT_PUBLIC_*` values are inlined at build). Never regenerate the Convex auth keys to "fix" sign-in on a deployment with users.
