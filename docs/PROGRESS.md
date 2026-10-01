# Progress log (append-only)

Each night-run step appends a section:

```
## Step NN - Title (YYYY-MM-DD HH:MM)
- Done: ...
- Files: ...
- Decisions: ... (details in DECISIONS.md)
- Known issues / follow-ups: ...
- Verify: npm run verify -> OK/FAIL
```

## Step 00 - Preparation (2026-09-28, by Claude in the planning chat)
- Research done (docs/05-RESEARCH.md, docs/06-3D-TOURS.md), decisions agreed with the owner (docs/00-BRIEF.md).
- Docs written: CLAUDE.md, docs/00-06, verified demo media list (docs/assets/demo-media.json: 90 Unsplash photos, 6 CC0 panoramas, 9 splats).
- Project skills added to .claude/skills (GSAP official, frontend-design, Vercel React best practices, web-design-guidelines, accessibility, seo, core-web-vitals, performance, shadcn, high-end-visual-design, Emil Kowalski animation skills). Custom subagents in .claude/agents.
- Night-run runner + prompts in night-run/.

## Step 02 - Foundation (2026-09-28 03:30)
- Done: installed the whole ARCHITECTURE 1 stack (runtime + dev, 0.x pinned exactly) and Playwright chromium; shadcn radix-nova init + 28 components (+ a hand-ported `form`); deleted every create-next-app artifact; built the two root layouts (`app/[locale]`, `app/admin`) plus `global-not-found`, `global-error` and per-root `not-found`/`error`; wired next-intl 4 (full localized pathnames table, `next/root-params` request config, `createNavigation`, `proxy.ts`); wrote all four `messages/*.json` (297 keys each) via three parallel i18n-translator agents; loaded Cormorant Garamond / Manrope / JetBrains Mono with latin + latin-ext + cyrillic; put every DESIGN 1-3 token into `app/globals.css` with the admin theme under `:root`/`.admin`; added `ConvexClientProvider`, `AdminProviders`, `components/motion/gsap.ts`, `SmoothScroll` (Lenis on the GSAP ticker) and `useReducedMotion`; `next.config.ts` with `globalNotFound`, image remotePatterns/qualities and the CSP from `lib/csp.ts`; four scripts (`i18n-check`, `copy-maplibre-worker`, `optimize-media`, existing `shots`) with npm scripts; Playwright config + a 10-case smoke spec; an on-brand placeholder landing page with a locale switcher and a glyph specimen.
- Files: `app/{fonts.ts,globals.css,icon.svg,global-error.tsx,global-not-found.tsx}`, `app/[locale]/{layout,page,not-found,error}.tsx`, `app/admin/{layout,not-found,error}.tsx`, `app/admin/login/page.tsx`, `i18n/{routing,request,navigation}.ts`, `proxy.ts`, `next.config.ts`, `lib/{csp.ts,utils.ts,media-manifest.json}`, `messages/*.json`, `components/{providers,motion,site,admin,ui}/*`, `hooks/{useReducedMotion.ts,use-mobile.ts}`, `scripts/{i18n-check,copy-maplibre-worker,optimize-media}.mjs`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `public/media/**`.
- Decisions: font variable naming, admin theming of the shadcn semantic vars, the missing radix-nova `form` item, `useSyncExternalStore` for media queries, `next-intl/middleware` (no `/proxy` export in 4.14.7), 35 MB of optimized media, ICU plural fixes in all four locales. Details in DECISIONS.md.
- Known issues / follow-ups: see night-run/state/steps/02.done.md.
- Verify: npm run verify -> OK (exit 0). i18n:check -> OK (297 keys x 4). test:e2e -> 20/20 passed.

## Step 03 - Convex backend, auth, seed (2026-09-28 04:25)
- Done: full `convex/schema.ts` (24 tables incl. authTables + extended users, every index from ARCHITECTURE 5 plus locationCounts / slugRedirects / listingViews / dailyStats / splatAssets, and the `search_text` search index); shared validators, the public DTO boundary, diacritic folding, search/driver selection, derived fields, the publish checklist, rate limiting, the activity log and location counters in `convex/lib/*`; invite-only Convex Auth (Password) with `auth.config.ts` + `http.ts`; 23 public functions and 18 admin modules with `requireRole` + `logActivity` everywhere; two crons (mandate expiry 03:00, daily rollup 03:05); an idempotent seed (`seed:all`, `force` wipes `isDemo` only) that created 40 locations, 4 monogram agents, 30 listings with 4-locale copy, 18 tour scenes, 3 journal posts, 8 site pages, 3 unverified testimonials, 6 leads and 3 viewings; `scripts/verify-demo-media.mjs` (105/105 URLs verified, 0 dropped) and `scripts/check-auth.mjs` (real sign-in round-trip); 41 convex-test / vitest cases.
- Files: `convex/{schema,auth,auth.config,http,convex.config,crons}.ts`, `convex/lib/{validators,dto,auth,search,slug,derive,money,counts,checklist,rateLimit,activity,errors}.ts`, `convex/{listings,locations,agents,posts,pages,settings,testimonials,tours,leads,viewings,stats}.ts`, `convex/{listingsAdmin,listingsInternal,media,toursAdmin,leadsAdmin,viewingsAdmin,contacts,users,invites,agentsAdmin,locationsAdmin,postsAdmin,pagesAdmin,testimonialsAdmin,settingsAdmin,analytics,activity,demo,demoInternal}.ts`, `convex/{seed,seedStages}.ts`, `convex/seed/**`, `convex/tests/*.test.ts`, `tests/unit/convex-harness.ts`, `vitest.config.mts`, `scripts/{verify-demo-media,check-auth}.mjs`, `messages/*.json` (introSignature).
- Decisions: `sr` as the L10n storage key (no hyphens in Convex identifiers or module paths); one scope bucket per query, so `transaction` is a required filter; the full search/driver strategy with its numeric bounds; top-level location ids; the invite flow; encumbrance stays public per PRD; denormalized previousPrice; the convex-test harness outside `convex/`. Details in DECISIONS.md.
- Known issues / follow-ups: see night-run/state/steps/03.done.md.
- Audit: the convex-auditor agent returned 47 findings; 35 were fixed in this step (including a CRITICAL invite-token bypass and three HIGH data-exposure issues) and 6 scale items were documented instead. `scripts/audit-convex.mjs` was added as a static gate over all 139 functions.
- Verify: npm run verify -> OK (exit 0). vitest -> 43/43. scripts/audit-convex.mjs -> no problems. scripts/check-auth.mjs -> ALL CHECKS PASSED (7 sections). seed -> 30 listings / 40 locations / 4 agents / 3 posts.

## Step 04 - Design system, UI kit, shell (2026-09-28 06:40)
- Done: ran the step's skills in order (`design-dna` -> `docs/design-dna.json`, `ui-ux-pro-max`, `frontend-design`, the `gsap-*` set, `emil-design-eng`, `accessibility`); finalized the DESIGN 1-3 tokens with a computed WCAG pass that added `--color-bronze-text` / `--color-warning-text` / `--color-success-text`, darkened `--color-stone-text` and introduced a named z-index scale, a `pointer-fine` hover variant and a global focus ring; drew the wordmark + monogram as SVG (`components/site/Logo.tsx`) and generated `app/apple-icon.png`; built the whole DESIGN 4 component set in `components/site/*` (Button, TextLink, Eyebrow, SectionHeading, Container/Grid/Section, Divider, Price, Badge, PropertyCard with an embla carousel + favorite, underline form fields, Accordion, Tabs, SkipLink, FavoriteButton) and `components/motion/*` (Reveal, SplitReveal, ImageReveal, ParallaxImage, Counter, Marquee, CursorFollowerImage, MagneticButton, ScrollProgress, PageTransition, Preloader), every motion component on `useGSAP` + a three-branch `gsap.matchMedia()` with cleanup; wired the shell into `app/[locale]/layout.tsx` (preloader, skip link, header, ink-wipe page transition, footer, consent banner); wrote the localStorage stores (`lib/stores/favorites.ts`, `lib/stores/consent.ts` exposing `useConsent()`), the locale formatters (`lib/format.ts`) and the client-side L10n reader (`lib/l10n.ts`); built `/[locale]/styleguide` (noindex) showing every component, state, the type scale in sr/ru/de and the full contrast table; added 21 Playwright cases (`tests/e2e/shell.spec.ts` + smoke updates).
- Files: `app/globals.css`, `app/fonts.ts`, `app/apple-icon.png`, `app/[locale]/{layout,page}.tsx`, `app/[locale]/styleguide/page.tsx`, `components/site/*` (18 files), `components/motion/*` (11 files), `lib/{format,l10n,utils,cn-tables}.ts`, `lib/stores/*`, `hooks/useHydrated.ts`, `docs/design-dna.json`, `messages/*.json` (+42 keys), `next.config.ts`, `eslint.config.mjs`, `package.json`, `scripts/shots.mjs`, `tests/e2e/{shell,smoke}.spec.ts`.
- Decisions: three AA-only text tokens; project-fitted `cn` merge tables (the stock build silently dropped `text-ink` next to `text-small`); object-form `remotePatterns` (a `URL` instance pins `search: ""` and 400s every demo photo); `prefetch={false}` on links to routes steps 06-10 will create; EB Garamond instead of Cormorant Garamond (no precomposed lowercase Serbian carons on Google's latin-ext subset); the mobile menu animates `opacity`, never `autoAlpha`; the switcher moves into the overlay menu below 1024px. Details in DECISIONS.md.
- Critique: the `design-critic` agent reviewed 30+ of 72 screenshots and returned 30 findings (6 high, 13 medium). All high and medium items were fixed, plus 6 of the low ones; the second pass returned no high-severity issues.
- Known issues / follow-ups: see night-run/state/steps/04.done.md.
- Verify: npm run verify -> OK (exit 0). i18n:check -> OK (339 keys x 4). test:e2e -> 45 passed / 1 skipped. axe (wcag2a/aa + 2.1 + 2.2) -> 0 violations on /sr, /de, /sr/styleguide and /ru/styleguide at 390 and 1440.


## Step 05 - Animated landing page (2026-09-29 04:30)
- Done: fixed the baseline lint failure (`any` in the listing e2e spec); built all 13 DESIGN §6 sections on Convex data (one parallel server round, `unstable_rethrow` so Next's prerender bail-out is never swallowed) — hero with the owner's still under a Ken Burns move + search (the owner's hero film was withdrawn after critique pass 4), intro statement, pinned featured rail, neighborhood index with a scroll-synced sticky photograph over a verified Belgrade band, services with CLS-free hover reveals, pinned 3D-tours zoom (scan backdrop, walkthrough window, 1px frame at a constant gutter, end-beat CTA), process rail, numbers from Settings with the demo note, valuation mini-form (→ `/procena?location&area`), journal (1 + 2, plate overlap), verified-only testimonials, final CTA with phone/Viber/WhatsApp/e-mail; per-letter preloader; desktop / mobile / reduced-motion branches everywhere; en/ru/de home copy re-checked against the Serbian source (i18n-translator); hero poster made the measured LCP (full-viewport heuristic) and CLS brought to 0 (cookie-banner reservation from the first paint, compact banner that waits for the intro); demo photos fetched pre-cropped to their frame; `listings.featured` dedupes covers; seed: DESIGN §6.5's eight places, covers in one light, "Novi Beograd" untranslated (dev re-seeded with force); listing page `PriceBlock` tone fix found by e2e.
- Files: `app/[locale]/page.tsx`, `components/site/home/*` (23 files), `components/site/{Picture,CookieConsent,PropertyCard,SectionHeading,TextLink,Footer}.tsx`, `components/motion/{ClipReveal,Preloader,intro,AmbientVideo,SplitReveal,ImageReveal}.tsx`, `lib/{format,listing-text,image-loaders,media}.ts` (+ tests), `convex/listings.ts`, `convex/seed/{locations,agents}.ts`, `app/globals.css`, `scripts/{vitals,shots,optimize-media}.mjs`, `tests/e2e/landing.spec.ts` (+ shell/smoke/listing-detail), `messages/*.json`, `vitest.config.mts`, `docs/{DECISIONS,04-CONTENT}.md`.
- Decisions: owner media mapping; phones keep stills; LCP clip on the hero media layer; consent reservation instead of measured padding; imgix crop loader; editorial-only photo grade; Belgrade photo instead of the owner's Budapest-looking film; the owner's hero film withdrawn by source hash (invented tower, hard-cut loop); tours stage clears the banner on a first visit, the featured rail deliberately does not; featured cover dedupe; card title clipping; services hover without layout shift. Details in DECISIONS.md.
- Critique: design-critic pass 1 → 4 High / 10 Medium / 6 Low; pass 2 → 2 High / 7 Medium; pass 3 → 1 High / 3 Medium; pass 4 → 1 High / 3 Medium / 5 Low; final pass 5 → **0 High** (7.5/10). Every High was fixed and re-verified. Every Medium of passes 1–3 was fixed. Of pass 4's Mediums, the only one left is the banner overlaying the featured rail on a first visit; it is deliberate and documented. Pass 5's Mediums (card floor codes, hero resolution on 2× screens, demo cover/title fit) are follow-ups listed in the done file.
- Known issues / follow-ups: see night-run/state/steps/05.done.md.
- Verify: npm run verify -> OK (exit 0). e2e 101 passed / 29 skipped / 0 failed. vitest 76/76. i18n 679 keys x 4. axe WCAG 2.2 AA 0 violations (/sr 390+1440, /ru 1440, /de 768, first visit with banner). vitals on the final build: LCP = hero poster (308–528 ms) and CLS 0.0000 in sr/ru/de at 390/768/1440.

## Step 05b - Landing critique and polish (2026-09-30 15:26)
- Done:
  - Before: 112 screenshots of /sr and /en (390/768/1280/1920, 10 scroll steps, hero at 300/1200/2500 ms), plus the first-visit banner at 390/1440.
  - Three independent reviews (design-critic, motion, accessibility), merged and ranked.
  - About 35 improvements implemented, 14 of them visible in the before/after pairs (list in the done file).
  - First-visit cookie bar compacted on desktop: 85-104 px, was 125-146. It slides in after the hero settles; phone layout unchanged at 19-27% of the viewport, with equal-weight choices.
  - WCAG fixes:
    - the banner no longer hides focus;
    - visible logo and button rings;
    - the intro-word contrast was the only axe violation;
    - moving content ends or pauses;
    - label-in-name, landmark names, banner focus.
  - Motion fixes:
    - the hero rises in view in three beats after the curtain;
    - no repeat-visit zoom pop, no Ken Burns edge;
    - the card parallax no longer fights CSS;
    - counters land together;
    - intro words read word by word;
    - no crossfade dip;
    - reduced-motion start states in CSS.
  - Localized card floors (Russian +1).
  - A durable axe test in `tests/e2e/landing.spec.ts`.
- Files: `components/site/{CookieConsent,Header,LocaleSwitcher,FavoriteButton,Button,PropertyCard,Logo}.tsx`, `components/site/home/{Hero,HeroStage,IntroStatement,IntroWords,FeaturedListings,FeaturedRail,Neighborhoods,NeighborhoodIndex,Services,ToursStage,Numbers}.tsx`, `components/motion/{Preloader,AmbientVideo,Counter,ImageReveal,SplitReveal,PageTransition,ScrollProgress}.tsx`, `app/globals.css`, `app/[locale]/layout.tsx`, `messages/*.json` (+5 keys), `tests/e2e/{landing,shell}.spec.ts`.
- Decisions: compact banner timing and focus handling; WCAG 2.2.2 treatment of the Ken Burns, cue and film; intro-word opacity floor; card floor wording; reviewer suggestions deliberately not taken. Details in DECISIONS.md.
- Critique: design 6.5/10 → its 3 Highs fixed; motion 5 Highs → 4 fixed (the scroll position lost when crossing 1024px is a known issue); accessibility 3 serious → all fixed. axe serious/critical: 23 (sr) / 36 (en) at 1440 before → 0 after.
- Known issues / follow-ups: see night-run/state/steps/05b.done.md.
- Verify: npm run verify -> OK (exit 0). e2e 103 passed / 29 skipped / 0 failed. vitest 76/76. i18n 684 keys x 4. vitals: LCP = hero poster (364-384 ms), CLS 0.0000 (/sr, /en at 390/1440).

## Step 06 - Search, filters, map (2026-09-30 17:55)
- Done:
  - Task 0: 94 verified demo photos merged (184 in the pool; verifier 199/199) and dev re-seeded. Covers are now distinct (30/30, was 24/30) and the most any photo is reused dropped from 4 to 2.
  - `/[locale]/properties` (`/sr/nekretnine`…) built on one URL contract, `lib/search-params.ts` (zod).
  - SSR first page + count, then a client island on `usePaginatedQuery`. Filters update the URL through the History API: push for choices (Back undoes), replace for map moves.
  - Every PRD A3 filter:
    - desktop sticky bar with popovers;
    - "Svi filteri" drawer;
    - phone bottom sheet (draft + live "Prikaži N rezultata");
    - active chips + "Obriši sve";
    - sort.
  - 3:2 cards: carousel, at most two badges, monthly rate from settings, 3D-tour marker, compare toggle.
  - Skeletons; an empty state with per-filter suggestions and a prefilled contact CTA.
  - MapLibre results map:
    - clustered source, HTML price pins, GL fallback over 150;
    - mini-card popup and hover sync both ways;
    - search-as-move via `bbox`;
    - Belgrade-first framing;
    - locale map labels.
  - SEO: filter-aware titles; curated canonical vs `noindex` deep combinations; BreadcrumbList.
  - Shared favorites/compare store; compare tray → `/uporedi`.
  - Convex:
    - OR-ed location multi-select, `outdoor` and `bbox` filters;
    - one `.paginate()` per call (fixes a step-03 crash on selective filters);
    - index order = sort;
    - map/list/count agree, including text search.
- Files: `app/[locale]/properties/(results)/*`, `components/site/search/*` (15 files), `components/map/{SearchMap,SearchMapLoader,maplibre,style}.ts(x)`, `components/site/{PropertyCard,Header,LocaleSwitcher}.tsx`, `lib/{search-params,search-locations,search-text,search-data}.ts`, `lib/stores/{id-list,favorites,compare}.ts`, `convex/{listings.ts,lib/search.ts,lib/validators.ts,lib/dto.ts,lib/geo.ts}`, `messages/*.json` (+97 keys), `tests/e2e/search.spec.ts`, `docs/assets/*`.
- Decisions: photo pool; OR-ed locations; `outdoor`/`bbox`; single paginate + exact pages; index order = sort; the History API instead of `router.replace`; the URL contract; SEO rules; card badges; Belgrade-first map; whole titles on 3:2 cards; compact header on the split; one ink "on" state; short page ≠ empty search. Details in DECISIONS.md.
- Critique:
  - design-critic 6/10 → 7/10. All pass-1 Highs fixed; pass-2 Highs (phone bar overlap, next-photo sliver) fixed and re-shot.
  - convex-auditor: 3 High / 3 Medium fixed, each High reproduced by a new test. No data exposure found.
- Known issues / follow-ups: see night-run/state/steps/06.done.md (scale ceiling ~500 listings per scope → slim projection table; `/uporedi` and `/kontakt?message=` are step 10).
- Verify: npm run verify -> OK (exit 0). e2e 121 passed / 39 skipped / 0 failed. vitest 98/98. i18n 781 keys x 4. audit-convex 144 functions, no problems. vitals /sr/nekretnine + /ru/nedvizhimost at 390/1440: LCP = first card image (584-616 ms), CLS 0.0000.

## Step 07 - Listing detail page (2026-09-30 21:55)
- Done:
  - An earlier interrupted run had built the page (commits `3837a8c`…`7b4a00a`) without a done file. This run audited it against every PRD A5 bullet and the step brief, then closed the gaps below.
  - `/[locale]/properties/[slug]` (`/sr/nekretnine/<slug>`…):
    - server-rendered from `listings.bySlug`, with `notFound()` for anything not public and a permanent redirect from `slugRedirects`;
    - sold/rented listings: ribbon, demoted price, no forms, similar listings.
  - Gallery and media:
    - 1 + 4 editorial gallery with room chips, opening yet-another-react-lightbox (Zoom, Thumbnails, Captions with room tags; keyboard and swipe);
    - media tabs only when they have data: photos, plans, video facade, and 360°/3D slots (poster + "Uskoro"; prop contract in `components/tours/TourSlot.tsx`).
  - Page content:
    - price block with €/m², price-drop badge + history disclosure, RSD toggle and the Art. 18 line;
    - key facts, description + highlights, grouped features, legal block with the verified-docs rule, commission;
    - location map (exact pin or approximate circle) + POIs + neighbourhood teaser;
    - mortgage and total-cost calculators (`lib/mortgage.ts`, `lib/costs.ts`).
  - Contact and sharing:
    - sticky agent card; phone action bar (Pozovi / Viber / WhatsApp / Zakaži);
    - inquiry and viewing forms (zod, honeypot, consent + separate marketing opt-in, friendly rate-limit message);
    - similar-listings rail; share row.
  - SEO and tracking:
    - `generateMetadata` with canonical + hreflang;
    - JSON-LD `RealEstateListing` + `Offer` + `Apartment|House…` + `BreadcrumbList`;
    - a JPEG share image at the localized public URL;
    - one tracked view per session.
  - This run:
    - convex-auditor pass on the page's backend: 0 Critical, 2 High, 7 Medium; both Highs and the in-scope Mediums/Lows fixed:
      - server-side Belgrade time;
      - slot-grid enforcement and one open request per address;
      - per-address limits;
      - off-market and hidden-agent guards;
      - POI rounding;
      - published-only price history;
      - `hasTour`;
      - self-rescheduling view-log prune.
    - A 12 s map load deadline with an "unavailable" notice.
    - Fixed the invisible "Zakaži" label on the phone bar.
    - Fixed a hydration race in the view-count e2e.
- Files: `convex/lib/belgradeTime.ts` (new), `convex/{viewings,agents,leads,stats}.ts`, `convex/lib/{dto,rateLimit,derive,search,errors,validators}.ts`, `convex/tests/listingDetail.test.ts` (new, 14 cases), `components/forms/ViewingForm.tsx`, `components/map/{useLoadDeadline.ts,ListingMap,ListingMapLoader,SearchMap,SearchMapLoader}.tsx`, `components/site/listing/MobileActionBar.tsx`, `lib/errors.ts`, `messages/*.json` (+3 keys), `tests/e2e/{listing-detail,search}.spec.ts`, `lib/belgrade-time.test.ts`.
- Decisions: see `[07]` entries dated 2026-09-30 in DECISIONS.md:
  - server-side Belgrade time;
  - web viewing = one grid step;
  - per-address limits over global windows;
  - off-market guards;
  - agency card for hidden agents;
  - POI rounding;
  - `hasTour`;
  - map load deadline;
  - no two `text-*` utilities.
- Known issues / follow-ups:
  - OpenFreeMap was unreachable from this machine all evening: 2 desktop map e2e cases skipped with that reason.
  - Turnstile is not wired (it needs keys).
  - Preview-token expiry is trusted from the client (step 08).
  - The broker-registry number is still the demo placeholder "000".
  - See `night-run/state/steps/07.done.md`.
- Verify: npm run verify -> OK; vitest 112/112; e2e 131 passed / 41 skipped / 0 failed (listing spec 37/37 after the last fix)

## Step 08 - Admin shell, dashboard, listings management (2026-09-30 23:55)
- Done: invite-only sign-in (`/admin/login`), invite acceptance (`/admin/pozivnica/[token]`, Convex Auth `signUp` with the invite token), sign-out, an auth gate on every `/admin/*` screen with the role from `users.getMe`; the shell (shadcn Sidebar with role-filtered sections, top bar, ⌘K palette with listing jump + "Nova nekretnina", breadcrumbs, light/dark theme, sonner, a demo-data banner for managers); the dashboard (KPIs, lazy SVG 30-day views/leads chart, three to-do lists, recent activity); the TanStack listings table (status tabs with counts, URL-synced filters, search through the search index, sorting, row actions, bulk publish/unpublish/archive/assign/delete-demo, a phone list view); the new-listing form; the 9-tab editor (autosave, dirty guard, Ctrl+S, live publish checklist, status workflow with confirmations, duplicate, 14-day preview link, price log; MapLibre pin picker + staff-only Nominatim search; media manager with per-file progress, dimension read, dnd-kit order, cover, room tags, per-locale alt, floor plans); the demo panel with typed confirmation. Backend: agent-scoped indexes, `quickFind`, `setOwner`, checklist context (public agent; registry number), preview-token expiry job, blob-safe duplicates, per-listing demo deletes, `update({ unset })` + place-chain check, `geocode.search` action, e2e cleanup helpers. The public listing page renders `?preview=<token>` for staff (noindex, no forms, no tracking).
- Files: `app/admin/{layout.tsx,login,pozivnica,(panel)/**}`, `components/admin/{shell,common,auth,dashboard,demo,listings/{table,editor,media,location}}/*`, `components/providers/AdminProviders.tsx`, `lib/admin/*`, `convex/{listingsAdmin,listingsInternal,geocode,users,qa,leads,analytics,schema}.ts`, `convex/lib/{checklist,auth,listingCascade,rateLimit}.ts`, `app/[locale]/properties/[slug]/page.tsx`, `lib/listing-data.ts`, `lib/csp.ts`, `app/globals.css`, `components/ui/{button,input,select}.tsx`, `eslint.config.mjs`, `scripts/{admin-shots,make-fixtures}.mjs`, `tests/e2e/{admin.spec.ts,helpers/admin.ts,smoke.spec.ts}`, `tests/fixtures/*`, `convex/tests/adminListings.test.ts`, `lib/admin/listing-form.test.ts`.
- Decisions: 17 `[08]` entries in DECISIONS.md (checklist context and registry rule, server-side preview expiry, the preview route, blob-safe duplicates, agent-scoped table, server-side geocoding, attested document verification, private owner contact, "uskoro" sidebar items, Serbian server errors in the admin, clearable fields, the autosave engine, table layout, accessibility tokens, lint rule).
- Known issues / follow-ups: see night-run/state/steps/08.done.md.
- Verify: npm run verify -> OK (exit 0). vitest 168/168. Playwright: admin suite 13/13; full suite 144 passed, 0 failed, 54 skipped.

## Step 09 - Admin CRM and content modules (2026-10-01 05:55)
- Done: all PRD B4–B13 admin modules, role-gated on the server, built by 7 parallel module agents on shared patterns (`DetailSheet` + `?id=` URLs, `FormSection`/`FieldShell`/sticky `SaveBar`, `L10nInput`, `ImageField` + `uploads.generateUploadUrl`, `ListToolbar`, `DotBadge`, `useMutationAction`): Upiti (index-driven filters, dnd-kit pipeline with "Premesti u…", loss-reason dialog, detail sheet with timeline/notes/consent/response timer/next action/assignment), Razgledanja (week/day calendar, list, server-checked transitions, feedback, office booking, weekly availability editor feeding the public booking), Kontakti (folded search index, merge, complete batched anonymization, CSV export as a logged mutation), Tim (users, roles, deactivation that ends sessions, copyable one-time invite links, agent profiles), Lokacije (tree editor, centroid map picker), Magazin (Tiptap 3 editor, scheduling via the Convex scheduler, server HTML allowlist + `sanitizePostHtml`/`sanitizePageHtml`), Sadržaj sajta (typed block editor per page/locale, testimonials with reviewed-text verification), Podešavanja, Analitika (lazy SVG charts, exact status counters), Aktivnost (filters + diff viewer). The landing reads `pages.home` (with `messages` fallback) and renders identically. Four convex-auditor passes: every High/Medium fixed. Design-critic pass (6.5/10): all 5 Highs and the main Mediums fixed.
- Files: `app/admin/(panel)/{upiti,razgledanja,kontakti,tim,lokacije,magazin,sadrzaj,podesavanja,analitika,aktivnost}/**`, `components/admin/{common,leads,contacts,viewings,team,locations,posts,content,settings,analytics,activity}/*`, `components/admin/{shell,dashboard,listings/table}/*` (integration), `components/ui/{button,toggle}.tsx`, `components/site/home/*` + `app/[locale]/page.tsx`, `lib/content/{pages,sanitize}.ts`, `lib/admin/labels.ts`, `convex/{leadsAdmin,contacts,viewingsAdmin,users,invites,agentsAdmin,locationsAdmin,postsAdmin,posts,pagesAdmin,pages,testimonialsAdmin,testimonials,settingsAdmin,analytics,activity,uploads,contentMigrations,countsMigrations,qa,leads,viewings,media,demo,auth,schema}.ts`, `convex/lib/{storage,html,contactSearch,counts,activity,dto,rateLimit}.ts`, `convex/seed/content/pages.ts`, `convex/tests/*` (9 new suites), `tests/e2e/admin-crm.spec.ts`.
- Decisions: 18 `[09]` entries in DECISIONS.md (shared patterns, upload link window, full-value diffs, lead pipeline, forms never edit contacts, anonymization, CSV, viewings, locations, invites without e-mail, demo-profile adoption, journal scheduling, managed landing content, page templates, settings, one activity vocabulary, no "uskoro", shadcn registry offline).
- Known issues / follow-ups: see night-run/state/steps/09.done.md.
- Verify: npm run verify -> OK (exit 0). vitest 304/304. e2e: admin-crm 7/7; full suite 151 passed, 61 skipped, 0 failed. Landing before/after: text identical in 4 locales, 78/78 screenshots pixel-identical.

## Step 10 - Remaining public pages (2026-10-01 21:30)
- Done: all PRD A6–A13 pages live in 4 locales with localized pathnames. Valuation funnel (3 steps, server-computed indicative range with range bar, on-site callback request on the same lead, `?location=&area=` prefill), Sell with us `/prodajte` (NEW this session: managed opening/benefits/steps/FAQ with message fallbacks, the landing's process hairline, documents list, seller form → `seller` lead with a place from the tree or a typed street), Locations index + neighborhood (Place + breadcrumb JSON-LD), Agents grid + profile (monogram fallback, license ID, active + sold listings), About, Contact (`general` lead), Journal list + article (Article JSON-LD, reading time, share, related), Favorites, Compare (2–4, best value per row, share link), Legal pages from `pages` (draft notice admin-only), localized 404/error + a `[locale]/[...rest]` catch-all so unknown paths get the localized 404. Fixed: favorites/compare crashed on every visit (`useQueries` request keyed on an `anyApi` proxy → render loop); the search price filter lost a typed maximum when the minimum's commit landed late (`RangeField` re-seed); a baseline type error on the contact page. Removed the step-04 `prefetch={false}` workaround (kept on `PropertyCard`). Design-critic pass (7/10): 3 of 4 Highs fixed in code (the 4th was the render loop), plus 9 Mediums/Lows.
- Files: `app/[locale]/{sell,[...rest]}/page.tsx`, `components/site/sell/{content.ts,SellForm.tsx}`, `components/site/compare/{useListingsById.ts,CompareTable.tsx}`, `components/site/search/RangeField.tsx`, `components/site/{page/Breadcrumbs,agents/AgentContacts,contact/FaqSection,errors/ErrorScreen,favorites/FavoritesView}.tsx`, `app/[locale]/{contact,locations,journal,agents/[slug]}/page.tsx`, `app/globals.css`, `lib/format.ts`, `messages/*.json`, `scripts/i18n-check.mjs`, ~35 files for the prefetch cleanup, `tests/e2e/{pages-flows,pages-routes,landing}.spec.ts`, `lib/format.test.ts`. (The page set itself — valuation, locations, agents, about, contact, journal, favorites, compare, legal, errors — came from the earlier step-10 attempt, commits bc71d58 + b2f4ac4.)
- Decisions: `[10]` entries in DECISIONS.md (seller location rule, sell page composition, prefetch, `useListingsById` keying, 404 catch-all, design-critic fixes and non-fixes, RangeField re-seed, landing axe settle).
- Known issues / follow-ups: see night-run/state/steps/10.done.md.
- Verify: npm run verify -> OK (exit 0). vitest 309/309. e2e: pages-flows 8/8, pages-routes 67/67 (15 routes × 4 locales + 4 localized 404s + 3 unknown slugs); full suite 220 passed / 2 failed under `--workers=2` (cross-spec interference, both pass serially: admin.spec 13/13, landing 28/28, search 12/12).
