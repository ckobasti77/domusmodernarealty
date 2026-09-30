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
