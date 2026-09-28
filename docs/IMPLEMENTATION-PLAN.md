<!-- Written by night-run step 01 (plan mode, opus, effort max) on 2026-09-28T02:28:52 -->

The plan is complete. Below is the full implementation plan (this message is what the runner saves as `docs/IMPLEMENTATION-PLAN.md`).

---

# Mihajlo Estate — Implementation plan

Written by night-run step 01 (plan mode, read-only). Precedence: PRD > ARCHITECTURE > DESIGN-SYSTEM > this file.
Every fact below was verified against `node_modules/next/dist/docs/` (Next **16.3.6**), `node_modules/convex/dist/esm-types/` (**1.46.0**), `convex/_generated/ai/guidelines.md`, and the current repo. Where a library is not installed yet, the plan says "verify after install" instead of guessing.

## Context

The repo is still an unmodified create-next-app: `app/{layout,page}.tsx`, default `globals.css`, `next.config.ts` empty, `convex/` containing only `_generated/` (so `Doc = any`, `DataModel = AnyDataModel`). Steps 02→15 build the whole product on top. Two facts change the plan versus what the docs assumed:

- **`media-src/` is already filled** with the owner's AI renders (delivered 2026-09-28): `hero-desktop.png` 1672×941, `hero-mobile.png` 941×1672, `hero.mp4` 1920×1080/8s (generated *from* `hero-desktop.png` as its start frame → identical first frame), `city.mp4`, `walkthrough.mp4`, `tours3d.png` + `tours3d-alt.png`, `sell.png`, `valuation.png`, `about.png`. The "media-src empty" branch is therefore a fallback, not the main path.
- **`sharp@0.35.5` and `zod@4.6.5` exist only as transitive/optional deps** (sharp via `next`, zod via `eslint-plugin-react-hooks`, both `dev`/`optional` in the lockfile). They must be declared explicitly or scripts and forms break on a clean install.

---

## 1. Architecture decisions the docs left open

### 1.1 Two root layouts, `not-found`, `error` (Next 16.3)

- **No `app/layout.tsx`.** `layout.md`: "Any layout without a `layout.js` above it is a root layout" — route groups are one option, omitting the top-level layout is the other. `app/[locale]/layout.tsx` and `app/admin/layout.tsx` each render their own `<html>`/`<body>`. Cross-root navigation is a full page load (documented, acceptable).
- **`/` has no owner.** `route-groups.md` warns that without a top-level layout the home route must live under one of the roots. With a locale prefix there is no such slot, so `proxy.ts` redirects `/` → `/sr` (or the `Accept-Language` match). There is deliberately no `app/page.tsx`.
- **404s:** `app/global-not-found.tsx` + `experimental: { globalNotFound: true }`. The Next docs name our exact two situations ("multiple root layouts", "root layout defined using top-level dynamic segments") as the reason this file exists. It must return a full HTML document and import its own fonts/global CSS; it takes no props; Next injects `noindex` automatically. `app/[locale]/not-found.tsx` handles every `notFound()` call inside a locale route (unpublished listing, unknown slug) and is the one users normally see, because next-intl's proxy rewrites `/foo` → `/sr/foo` first. `app/admin/not-found.tsx` covers the admin tree.
- **Errors:** one `app/global-error.tsx` at the app root — the docs state explicitly that this works "even when leveraging internationalization". It is a Client Component, self-contains `<html>/<body>`/styles, cannot export `metadata` (use React `<title>`), and its signature in 16.3 is `{ error, retry }` (`retry` became stable in 16.3.0). Plus localized `app/[locale]/error.tsx` and `app/admin/error.tsx`.
- **`next/root-params`:** `i18n/request.ts` uses `import { locale } from 'next/root-params'`. Because `app/admin` has no `[locale]`, the getter is typed **`string | undefined`** — narrow with a `?? 'sr-Latn'` fallback and a `hasLocale()` guard. It cannot be used in Client Components or Route Handlers, so `app/sitemap.ts`, `app/robots.ts` and any `app/api/*` iterate `routing.locales` explicitly.
- **Typing:** `PageProps<'/[locale]/properties/[slug]'>` / `LayoutProps<'/[locale]'>` globals from `next typegen`; `params` and `searchParams` are always `Promise` in 16 (synchronous access is fully removed). `verify` already runs `next typegen` before `tsc`.
- **No parallel routes anywhere** — 16 fails the build without `default.js` for every slot, and we gain nothing.

### 1.2 Rendering and caching model

**Decision: do not enable `cacheComponents`.** It is the unified PPR/`use cache`/`dynamicIO` flag in 16, but it removes the `dynamic`/`revalidate`/`fetchCache` segment configs, requires `generateStaticParams` to return ≥1 value, and surfaces build errors for any uncached data not wrapped in `<Suspense>`. `fetchQuery` from `convex/nextjs` forces `no-store` anyway (ARCHITECTURE §3), so public pages are dynamic either way. Legacy model + explicit `<Suspense>` boundaries is the safe unattended choice. Also **no `typedRoutes`** — next-intl's `Pathnames` typing already gives type-safe internal hrefs and `typedRoutes` would fight it. Both go in DECISIONS.md.

### 1.3 Where Convex queries run, per page

| Page | Data source | Why |
|---|---|---|
| `/[locale]` landing | `fetchQuery` (featured, locations+counts, settings, pages.home, posts, testimonials) in the Server Component; 6 parallel calls in one `Promise.all` | SEO + LCP; content changes rarely, no live subscription needed |
| `/properties` search | Server: `fetchQuery(api.listings.search, {…, paginationOpts:{numItems:24,cursor:null}})` for SSR HTML. Client island: `usePaginatedQuery(api.listings.search, args, {initialNumItems:24})` keyed by the URL | first paint is server HTML for SEO/LCP; filter changes and Load-more are reactive |
| `/properties/[slug]` | `fetchQuery(api.listings.bySlug)`, wrapped in React `cache()` so `generateMetadata`, `opengraph-image` and the page share one call | avoids 3× round trips |
| Similar listings, POIs, agent card | separate Server Components inside `<Suspense>` | main content streams first |
| `/favorites`, `/compare` | client `useQuery(api.listings.byIds, ids.length ? {ids} : "skip")`; if `?ids=` is in the URL, server-render with `fetchQuery` first | ids live in localStorage |
| `/locations`, `/agents`, `/journal`, legal | `fetchQuery` | static-ish content |
| `/admin/**` | 100% client hooks (`useQuery`/`useMutation`/`usePaginatedQuery`) under `ConvexAuthProvider` | token is in localStorage; the security boundary is `requireRole()` server-side |

`lib/convex-server.ts` exports a single `serverQuery()` wrapper (adds `NEXT_PUBLIC_CONVEX_URL`, typed error mapping) so no page calls `fetchQuery` directly.

### 1.4 Search and filter strategy inside Convex limits

Convex constraints that drive this: search indexes allow one search field, ≤16 equality-only filter fields, relevance order only, ≤1024 docs scanned; regular indexes allow a range on the **last** field only; **there is no count operator** and `.collect().length` is banned; **`Date.now()` must not be used in a query** (stale + kills cache reuse).

1. **Denormalized driver key.** `listings.scope: string = "{status}:{transaction}"` (e.g. `"published:sale"`), recomputed by `lib/derive.ts::applyDerived()` on every write together with `pricePerM2`, `floorNum`, `searchText`, `hasTour`.
2. **Driver indexes** (names follow the mandated `by_a_and_b` convention): `by_scope_and_publishedAt`, `by_scope_and_price`, `by_scope_and_pricePerM2`, `by_scope_and_areaM2`, `by_scope_and_cityId_and_price`, `by_scope_and_neighborhoodId_and_publishedAt`. Convex appends `_creationTime` to every index, giving a free stable tiebreak.
3. **Driver selection** (`lib/search.ts::pickDriver`): a price or area range wins over the sort (a range must be the last indexed field); otherwise the sort picks the index; a single-city filter prefers `by_scope_and_cityId_and_price`; a single neighborhood prefers its index. When the range index ≠ the requested sort, results are sorted in memory within the bounded window and the response is flagged `orderedInWindow: true`.
4. **`listings.search` is a real paginated query.** `args: { filters, sort, paginationOpts: paginationOptsValidator }`, returns `paginationResultValidator(listingCardV)` plus `scanned`/`approximate`. `args.paginationOpts` is forwarded **verbatim** to the first `paginate()` (the guidelines forbid rebuilding it field by field); internal continuation batches use `{ cursor: continueCursor, numItems: 100 }`, at most `MAX_BATCHES = 8` (≤800 docs), stopping early once `numItems+1` post-filtered matches exist. Short pages are legal — `usePaginatedQuery` handles them.
5. **Post-filters** (rooms, floor bands, heating, features, parking, construction, condition, furnishing, energy, multi-select locations, tour flags, VAT/credit toggles) run in JS over each batch via one pure `matches(doc, filters)` function shared with the convex-test fixtures.
6. **Recency without a clock.** `lib/search-params.ts` converts `addedWithin=7d` into an absolute `publishedAfter` epoch **rounded down to the hour** before the query is called. Keeps the query pure and cache-friendly.
7. **Counts.** `listings.count(filters)` runs the same pipeline with `COUNT_BATCHES = 15` and returns `{ count, exact }`; the UI renders "128 rezultata" or "300+ rezultata". Neighborhood/city counts are **denormalized** in a `locationCounts` table (`{locationId, sale, rent}`) bumped by `bumpLocationCounts(ctx, listing, ±1)` in the same mutation as every status/location write — never counted at read time.
8. **Text search.** `searchIndex("search_text", { searchField: "searchText", filterFields: ["scope","propertyType","cityId","hasTour"] })`. `withSearchIndex` returns an `OrderedQuery`, so `.order()` is impossible — relevance only. When `q` is present we `.take(200)`, post-filter, then sort in memory unless `sort === "relevance"`. `normalizeText()` (č/ć→c, š→s, ž→z, đ→dj, lowercase, collapse spaces) is the **single** function used both to build `searchText` and to normalize the user's query.
9. **Map.** `listings.mapPoints(filters, bbox?)` reuses the pipeline on `by_scope_and_publishedAt`, applies the bbox as a post-filter (Convex has no geo index), caps at `MAX_POINTS = 1000`, and returns `{_id, slug, lat, lng, price, transaction, propertyType, coverUrl}` only. Coordinates are already public-safe (see 1.6).

Documented in DECISIONS.md with the numbers above.

### 1.5 Favorites and compare

`lib/store/favorites.ts` — one tiny module, no library. `localStorage` keys `me:fav` (≤200 ids) and `me:cmp` (≤4 ids). Exposed through `useSyncExternalStore` with a **memoized snapshot** (the same frozen array reference until a write happens — otherwise React re-renders forever), `getServerSnapshot → EMPTY`, and a `subscribe` that listens to both a custom `me:store` event (same tab) and `storage` (cross-tab). The header counter, card hearts and the compare tray all read the same store. Compare is shareable via `/uporedi?ids=a,b,c`, which the server renders with `fetchQuery(api.listings.byIds)`. No server-side favorites — public accounts are an explicit non-goal.

### 1.6 Public data safety

`convex/lib/dto.ts` is the only place that converts a `Doc<"listings">` into a public DTO. It strips `mandate`, `ownerContactId`, `legal.encumbrance` detail, `previewToken`, `createdBy` and SEO internals, and applies `publicCoords()`: `addressVisibility === "exact"` → real lat/lng; `"street"` → rounded to ~4 decimals; `"area"` → the neighborhood centroid plus a deterministic ±250 m jitter derived from the listing id (stable across reloads so the pin never jumps). Street and number are only included for `"exact"`. Return validators (`listingCardV`, `listingDetailV`, built with `v.object().pick()/.omit()`) make a leak a type error.

### 1.7 Media pipeline (media-src filled **and** empty)

`scripts/optimize-media.mjs` (sharp + ffmpeg-static, idempotent via mtime, `--force`):

- Images → `public/media/<name>/<name>-{640,1280,1920,2560}.avif` + `.webp` + a `-fallback.jpg`, plus a 24 px blur data URL.
- Videos → `public/media/<name>/<name>.mp4` (H.264 high, 1080p, CRF 24, `+faststart`, target 3–6 MB), `.webm` (VP9 CRF 34), `-720.mp4` for mobile. **`hero.mp4`'s poster is the optimized `hero-desktop`** — the first video frame is identical, so the poster→video handoff is seamless and the poster stays the LCP element.
- Writes **`lib/media-manifest.json`** (committed, typed by `lib/media.ts`); binaries go to `public/media/` (also committed — total target ≤ 30 MB; drop the 2560 tier for video posters if it overshoots).
- `lib/media.ts::getMedia(key)` returns `Media | null`. **Every consumer handles `null`** by falling back to a curated Unsplash entry from `lib/demo-media.ts` (generated from `docs/assets/demo-media.json`) with a GSAP Ken Burns (scale 1.12→1 over 12 s). So the same component code works whether `media-src/` is full or empty, and step 15 can re-run `media:optimize` for new files with no code change.

Name mapping (to be confirmed by Reading the PNGs in step 05 and logged in DECISIONS.md): `hero-desktop`→hero poster desktop, `hero-mobile`→hero poster mobile, `hero`→hero video, `city`→Neighborhoods section, `walkthrough`→3D-tours teaser video, `tours3d`→3D-tours poster (`tours3d-alt` spare), `sell`→`/prodajte`, `valuation`→valuation CTA + `/procena`, `about`→`/o-nama`. All AI-generated → brand/mood only, never captioned as a real listing.

### 1.8 Auth, invites, preview tokens

Per ARCHITECTURE §6: `@convex-dev/auth` Password, `createOrUpdateUser` accepts a new account only when a matching non-expired `invites` row exists (or `seed:createAdmin` is bootstrapping). `convex/auth.config.ts` is mandatory (without it `ctx.auth.getUserIdentity()` is always `null`). **Do not declare `CONVEX_SITE_URL`/`CONVEX_CLOUD_URL` in `defineApp({ env })`** — they are already on `env` and redeclaring them fails the deploy. JWT_PRIVATE_KEY/JWKS/SITE_URL are already set by the runner; verify with `npx convex env list` (names only) and never regenerate.

Invite tokens: 32 random bytes → base64url; only `tokenHash` (SHA-256) is stored; 7-day expiry; single use (`acceptedAt`). Preview tokens: a per-listing random `previewToken` + `previewExpiresAt` stored on the doc, validated by equality in `listings.previewBySlug` — no HMAC secret, so nothing extra to configure.

---

## 2. Folder / file map

```
app/
  global-not-found.tsx            full HTML 404 for unmatched routes (experimental.globalNotFound)
  global-error.tsx                client, own html/body, {error, retry}
  sitemap.ts  robots.ts           iterate routing.locales explicitly (no root-params here)
  icon.svg  apple-icon.tsx        ME monogram on ink
  [locale]/
    layout.tsx                    PUBLIC root: html lang, fonts, NextIntlClientProvider,
                                  ConvexClientProvider, SmoothScroll, Header/Footer, CookieConsent
    page.tsx                      landing, 13 sections (DESIGN §6)
    not-found.tsx  error.tsx  loading.tsx  opengraph-image.tsx
    properties/page.tsx           search (localized: /nekretnine, /properties, …)
    properties/[slug]/{page,opengraph-image,loading}.tsx
    locations/page.tsx  locations/[slug]/page.tsx
    valuation/page.tsx  sell/page.tsx  agents/{page,[slug]/page}.tsx
    about/page.tsx  contact/page.tsx
    journal/{page,[slug]/page}.tsx
    favorites/page.tsx  compare/page.tsx
    privacy|terms|cookies/page.tsx   rendered from the `pages` table
    styleguide/page.tsx           noindex
  admin/
    layout.tsx                    ADMIN root: html lang="sr-Latn", noindex, body.admin,
                                  ConvexAuthProvider, Toaster. No Lenis, no GSAP.
    login/page.tsx  pozivnica/[token]/page.tsx  not-found.tsx  error.tsx
    (panel)/layout.tsx            AuthGate + Sidebar + Topbar + Breadcrumbs
    (panel)/page.tsx              dashboard
    (panel)/nekretnine/{page,nova/page,[id]/page}.tsx
    (panel)/{upiti,razgledanja,kontakti,lokacije,magazin,sadrzaj,tim,analitika,aktivnost,podesavanja,demo}/page.tsx
components/
  site/       Header Footer MobileMenu LangSwitcher CookieConsent Preloader PageTransition
              Logo Button TextLink Eyebrow SectionHeading Container Grid Divider Price Badge
              PropertyCard PropertyCardCarousel FavoriteButton CompareTray Skeleton* EmptyState
              ShareMenu ComplianceLine Breadcrumbs
  site/home/  Hero IntroStatement FeaturedRail Neighborhoods Services Tours3dTeaser Process
              Numbers ValuationCta JournalTeaser Testimonials FinalCta
  site/search/ FilterBar FilterDrawer FilterSheet ActiveChips SortSelect ResultsGrid LoadMore
               LocationTree RangeSlider RoomChips
  site/listing/ GalleryHero Lightbox Tabs KeyFacts FeatureChips LegalBlock PriceBlock
                PriceHistory AgentCard MobileActionBar SimilarRail PoiList
  site/forms/ InquiryForm ViewingForm ValuationWizard SellForm ContactForm ConsentFields Honeypot
  admin/      AppSidebar Topbar CommandPalette DataTable(+columns) StatusTabs BulkBar
              ListingEditor (9 tab components) MediaManager DndMediaGrid LocalePicker
              PublishChecklist LeadKanban LeadSheet ViewingCalendar AvailabilityEditor
              TiptapEditor SettingsForm LocationTree ActivityTable DemoPanel Charts
  motion/     gsap.ts SmoothScroll.tsx SplitReveal ImageReveal ParallaxImage Counter Marquee
              HairlineDraw CursorFollowerImage MagneticButton ScrollProgress
  map/        MapProvider.tsx SearchMap.tsx PricePin.tsx ClusterLayer.tsx PinPicker.tsx
  tours/      Tour360.tsx Walk3D.tsx ExternalTourFacade.tsx TourLauncher.tsx
  ui/         shadcn output
  providers/  ConvexClientProvider.tsx AdminProviders.tsx
convex/
  schema.ts convex.config.ts auth.ts auth.config.ts http.ts crons.ts
  lib/ auth.ts validators.ts dto.ts slug.ts search.ts derive.ts money.ts activity.ts
       rateLimit.ts checklist.ts errors.ts
  listings.ts listingsAdmin.ts media.ts tours.ts toursAdmin.ts leads.ts leadsAdmin.ts
  viewings.ts viewingsAdmin.ts contacts.ts agents.ts agentsAdmin.ts users.ts invites.ts
  locations.ts locationsAdmin.ts posts.ts postsAdmin.ts pages.ts pagesAdmin.ts
  testimonials.ts settings.ts stats.ts analytics.ts activity.ts demo.ts
  seed/ index.ts settings.ts locations.ts agents.ts listings.ts posts.ts pages.ts leads.ts tours.ts
  tests/ search.test.ts auth.test.ts leads.test.ts checklist.test.ts
i18n/ routing.ts request.ts navigation.ts
messages/ sr-Latn.json en.json ru.json de.json
lib/ format.ts seo.ts jsonld.ts cn.ts mortgage.ts costs.ts consent.ts csp.ts media.ts
     demo-media.ts media-manifest.json search-params.ts convex-server.ts errors.ts
     store/favorites.ts store/consent.ts
hooks/ useReducedMotion.ts useMediaQuery.ts useLenisControl.ts useSessionKey.ts
scripts/ shots.mjs i18n-check.mjs optimize-media.mjs copy-maplibre-worker.mjs
         fetch-demo-tours.mjs verify-demo-media.mjs seo-audit.mjs jsonld-validate.mjs
tests/ e2e/*.spec.ts fixtures/ playwright.config.ts
proxy.ts  next.config.ts  components.json  vitest.config.ts
public/ media/** maplibre/** fonts/<display>.ttf (OG images, Cyrillic)
```

---

## 3. Convex function inventory

All args validated; all admin functions call `requireRole`. Indexes use the mandated `by_a_and_b` naming. `ctx.db.get("table", id)` table-first form everywhere.

**Public queries** (no auth; published/public data only, via `lib/dto.ts`)

| Function | Args | Index |
|---|---|---|
| `listings.search` | `filters, sort, paginationOpts` | driver per §1.4 |
| `listings.count` | `filters` | same |
| `listings.mapPoints` | `filters, bbox?` | `by_scope_and_publishedAt` |
| `listings.bySlug` | `slug` | `by_slug`, then `slugRedirects.by_from` for 301s |
| `listings.featured` | `limit` | `by_isFeatured_and_scope` |
| `listings.similar` | `id, limit` | `by_scope_and_municipalityId_and_price` |
| `listings.byIds` | `ids` (≤50) | `db.get` |
| `listings.previewBySlug` | `slug, token` | `by_slug` + token equality |
| `locations.tree` / `locations.bySlug` | – / `slug` | `by_kind_and_order` / `by_slug` (+ `locationCounts.by_locationId`) |
| `agents.list` / `agents.bySlug` / `agents.slots` | – / `slug` / `agentId, fromDay, days` | `by_isPublic_and_order`, `by_slug`, `viewings.by_agentId_and_start` |
| `posts.list` / `posts.bySlug` | `category?, paginationOpts` / `slug` | `by_status_and_publishedAt`, `by_slug` |
| `pages.get` | `key` | `by_key` |
| `settings.public` | – | `by_key` singleton |
| `testimonials.verified` | – | `by_verified_and_order` |
| `tours.scenes` | `listingId` | `by_listingId_and_order` |

**Public mutations** — all go through `lib/rateLimit.ts` (`@convex-dev/rate-limiter`, token bucket keyed by a client-supplied session key plus a fixed-window global cap), a `hp` honeypot field that must be empty, and max-length checks: `leads.createInquiry`, `leads.createValuation` (computes the range server-side from `locations.avgPricePerM2` × condition/floor factors), `leads.createSeller`, `leads.createGeneral`, `viewings.request` (rechecks the slot against agent availability and existing viewings), `stats.trackView` (`sessionKey` dedupe, 1/listing/session).

**Admin** (each `requireRole([...])`, each write calls `logActivity`)

| Module | Functions | Roles |
|---|---|---|
| `listingsAdmin` | `list` (paginated, status tabs, search), `get`, `create`, `update`, `publish` (server checklist), `unpublish`, `setStatus`, `duplicate`, `remove`, `bulk`, `regenerateSlug`, `rotatePreviewToken`, `todos` | admin/manager/agent(own) |
| `media` | `generateUploadUrl`, `attach` (validates contentType/size via `ctx.db.system.get("_storage", id)`), `reorder`, `updateMeta`, `setCover`, `remove` (+ `ctx.storage.delete`), `attachFloorPlan` | same |
| `toursAdmin` | `upsertScene`, `reorderScenes`, `setLinks`, `removeScene`, `setTour360`, `setWalk3d` | admin/manager/agent(own) |
| `leadsAdmin` | `list`, `kanban`, `get`, `setStatus`, `assign`, `addNote`, `setNextAction`, `markResponded` | admin/manager/agent(own) |
| `viewingsAdmin` | `list`, `range`, `setStatus`, `setFeedback`, `create` | admin/manager/agent(own) |
| `contacts` | `list`, `get`, `merge`, `exportCsv`, `anonymize` | admin/manager |
| `users` / `invites` | `getMe`, `list`, `createInvite`, `revokeInvite`, `setRole`, `setStatus` | admin |
| `agentsAdmin` | `list`, `upsert`, `setAvailability`, `remove`, `reorder` | admin/manager |
| `locationsAdmin` | `tree`, `upsert`, `remove`, `reorder`, `setAvg` | admin/manager/editor |
| `postsAdmin` | `list`, `get`, `upsert`, `publish`, `remove` | admin/manager/editor |
| `pagesAdmin` | `get`, `upsert` | admin/manager/editor |
| `testimonials` | `listAll`, `upsert`, `setVerified`, `remove` | admin/manager |
| `settings` | `get`, `update` | admin |
| `analytics` | `dashboard`, `listingFunnel`, `leadsBySource`, `agentResponse` | admin/manager |
| `activity` | `list` (filters, paginated) | admin/manager |
| `demo` | `counts`, `purge` | admin |

**Internal:** `seed.all` / `seed.createAdmin` / `seed.listingsBatch` (scheduler-chained, checks `ctx.meta.getTransactionMetrics().bytesRead.remaining`), `listingsInternal.expireMandates`, `stats.rollupDaily`, `tours.seedDemoTour`.
**Crons** (only `crons.interval`/`crons.cron` per guidelines): daily `cron("0 3 * * *", internal.listingsInternal.expireMandates)`, daily `cron("5 3 * * *", internal.stats.rollupDaily)`.
**HTTP:** `convex/http.ts` → `auth.addHttpRoutes(http)` only.

**Publish checklist** (`lib/checklist.ts`, enforced in `listingsAdmin.publish`, mirrored read-only in the UI): valid mandate with `end > now`, `price > 0`, city + lat/lng, `areaM2 > 0`, `rooms` set, ≥5 media items, a cover, non-empty `title["sr-Latn"]` and `description["sr-Latn"]`, slug set. Failure throws `ConvexError({ code: "PUBLISH_BLOCKED", reasons: [...] })`.

---

## 4. Per step

### Step 02 — Foundation (gate: verify)
1. `npm i` runtime: `next-intl@4.14.7 gsap@3.15.0 @gsap/react@2.1.2 lenis@1.3.26 maplibre-gl@6.11.2 @vis.gl/react-maplibre@8.1.3 zod@^4 react-hook-form@^7 @hookform/resolvers@^5 sonner@^2 lucide-react @tanstack/react-table@8.21.3 @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/modifiers @dnd-kit/utilities date-fns@^4 embla-carousel-react@8.6.0 yet-another-react-lightbox@^3 isomorphic-dompurify @convex-dev/auth @auth/core @convex-dev/rate-limiter@^0.4`. Dev: `@playwright/test @axe-core/playwright sharp ffmpeg-static vitest @edge-runtime/vm convex-test`. **`sharp` and `zod` must be explicit** (today they are only transitive). `npx playwright install chromium`. Do not touch next/react versions.
2. `npx shadcn@latest init -b radix -p nova -y` **first**, then add the 27 components listed in the step file. shadcn rewrites `app/globals.css`, so our `@theme` tokens go in *after*. Keep shadcn's `:root`/`.dark` semantic vars; override them under `.admin` (applied to the admin `<body>`). Public components never use shadcn semantic names.
3. Delete `app/layout.tsx`, `app/page.tsx`, `public/*.svg`. Delete the `body { font-family: Arial… }` rule from globals.css (it currently overrides the font variables).
4. `app/fonts.ts` exports `cormorant` (Cormorant Garamond 300/400/500 + italic), `manrope` (variable 200–800), `jetbrains` — each `subsets: ['latin','latin-ext','cyrillic']`, `display:'swap'`, `variable:'--font-…'`. Both root layouts import from it (the docs' "font definitions file" pattern).
5. `i18n/routing.ts` with the full `pathnames` table (ARCHITECTURE §4) + `localePrefix:{mode:'always',prefixes:{'sr-Latn':'/sr'}}`; `i18n/request.ts` via `next/root-params` with a `string | undefined` guard; `i18n/navigation.ts` = `createNavigation(routing)`. **Check `node_modules/next-intl/package.json` exports** — if 4.14 ships a `next-intl/proxy` entry, use it; otherwise `createMiddleware` from `next-intl/middleware` inside `proxy.ts`.
6. `proxy.ts`: default export, **no `runtime` export** (throws in 16). Matcher `'/((?!api|admin|_next|_vercel|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest|.*\\..*).*)'`.
7. `next.config.ts`: `experimental:{globalNotFound:true}`, `images:{remotePatterns:[new URL('https://*.convex.cloud/api/storage/**'), …unsplash, …polyhaven], qualities:[60,75,85,90], minimumCacheTTL:14400}`, `async headers()` from `lib/csp.ts`. Use `preload`, not the deprecated `priority`, on `<Image>`.
8. Tokens in `globals.css` (`@theme`): all DESIGN §1 colours, three font vars, the fluid clamp scale, spacing rhythm, `--ease-estate`.
9. Providers: `ConvexClientProvider`, `AdminProviders` stub, `components/motion/gsap.ts` (register ScrollTrigger/SplitText/Flip/CustomEase once + `CustomEase.create('estate','0.22,1,0.36,1')`), `SmoothScroll.tsx` (Lenis `autoRaf:false` driven by `gsap.ticker`, `lagSmoothing(0)`, `useLenis(ScrollTrigger.update)`, not mounted under reduced motion), `hooks/useReducedMotion.ts`.
10. Scripts: `copy-maplibre-worker.mjs` (copies **both** `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs`) wired to `predev`/`prebuild`; `optimize-media.mjs` + `media:optimize` (run it now — media-src is full, so this produces `public/media/**` and `lib/media-manifest.json`); `i18n-check.mjs` + `i18n:check`; `test:e2e`; `shots`.
11. `playwright.config.ts` (`webServer: npm run start`, `reuseExistingServer`), `tests/e2e/smoke.spec.ts` per the step file.
12. On-brand placeholder `app/[locale]/page.tsx` so `/ru` proves Cyrillic in both families.

**Risks:** shadcn init clobbering globals.css → run it before writing tokens and `git diff` afterwards. next-intl's Next-16 export path → read node_modules, don't guess. An unavailable `subsets:['cyrillic']` → the build fails loudly, swap the family and log it.
**Proof:** `npm run verify` 0; `i18n:check` pass; `test:e2e` pass; shots `/sr,/ru` @390/1440 Read; `/admin/login` renders without the public header.

### Step 03 — Convex backend, auth, seed (gate: verify)
Order: `convex/lib/validators.ts` → `schema.ts` → `npx convex dev --once` → auth → `lib/auth.ts` → public queries → public mutations → admin → seed → verification.
- Schema: every table from ARCHITECTURE §5 plus `locationCounts`, `slugRedirects`, `listingStats`, and the derived `scope`/`pricePerM2`/`floorNum`/`hasTour`/`searchText`. Search index exactly as §1.4.8. **Keep every new field optional or backfill in the same push** — a tightened field against existing seeded docs fails schema validation and therefore `npm run verify`.
- `convex.config.ts`: `defineApp()` + the rateLimiter component. **Do not declare `CONVEX_SITE_URL`/`CONVEX_CLOUD_URL` in `env`** (redeclaring fails the deploy).
- Auth: `auth.ts` (Password + invite-gated `createOrUpdateUser`), `auth.config.ts`, `http.ts`. Verify env names with `npx convex env list`; never regenerate keys. Bootstrap admin: build the JSON from `night-run/state/admin.json` with `node -e` and pipe it into `npx convex run seed:createAdmin` so the password never lands in a file or a committed log.
- Seed: batched through the scheduler (`seed.listingsBatch`) with a `ctx.meta.getTransactionMetrics()` byte check — 30 listings × ~10 media items will otherwise hit transaction limits. Run `scripts/verify-demo-media.mjs` (HEAD every Unsplash URL) **before** seeding and drop failures.
- Tests: `convex-test` + `vitest` (`environment:'edge-runtime'`, the `import.meta.glob` module map is **required**, `/// <reference types="vite/client" />` only in those test files, and no `compilerOptions.types` additions — that causes TS2688).

**Proof:** push clean; counts from 3 filter combos; a real sign-in round trip; an anonymous admin mutation rejected; a rate-limit hit; convex-auditor findings fixed; DECISIONS.md updated with the search strategy + invite flow.

### Step 04 — Design system, UI kit, shell (gate: verify)
Skills in the order the step file lists (`design-dna` → `docs/design-dna.json`, then `ui-ux-pro-max`, `frontend-design`/`design-taste-frontend`, the `gsap-*` set, `emil-design-eng`, `accessibility`). Finalize tokens with a contrast check (`--color-stone` #8A8275 fails AA under 16 px → use #6F685C for small text). Build Logo + icons, then the §4 component set, then Header/Footer/MobileMenu/LangSwitcher/CookieConsent/PageTransition/Preloader, then `/[locale]/styleguide`. Every motion component uses `useGSAP` + `gsap.matchMedia()` with three branches (`(min-width:1024px) and (prefers-reduced-motion:no-preference)`, mobile, reduced).
**Risks:** SplitText before fonts load → `await document.fonts.ready`, `autoSplit:true` with the tween created inside `onSplit`, `mask:'lines'`, `aria:'auto'`, and never `text-balance` on split elements. Lenis + sticky → `overflow-x: clip` on ancestors, `data-lenis-prevent` on overlays.
**Proof:** `/sr/styleguide` + `/ru/styleguide` screenshots Read; Playwright for the language switch keeping the route and consent persisting; a `reducedMotion:'reduce'` test asserting final states; design-critic second pass with no high severity.

### Step 05 + 05b — Landing (gate: verify)
Wire the optimized owner media first (§1.7), log the mapping, then all 13 sections from DESIGN §6 with real Convex data via one server `Promise.all`. Pins only at ≥1024 px without reduced motion. Poster is the LCP (`preload` + `fetchPriority="high"`), video `preload="metadata"` after first paint, offscreen videos paused, ScrollTriggers killed on unmount. Critique loop: build → `node scripts/shots.mjs --routes /sr --widths 390,768,1440 --scroll-steps 8` → design-critic → fix, ≥2 iterations; then `/ru` and `/de` at 1440. 05b adds `--delays 300,1200,2500`, three parallel reviewers (design-critic, review-animations, accessibility), a merged ranked list, ≥12 implemented improvements, and a clean axe run.
**Risk:** `shots.mjs`'s `arg()` returns `true` when a valued flag is followed by another `--flag` → always give valued flags a value.

### Step 06 — Search, filters, map (gate: verify)
`lib/search-params.ts` (zod) is the single source of truth for URL ⇄ filters ⇄ Convex args, including the `addedWithin` → `publishedAfter` hour-rounding. Server-render page 1, client island for filters (`router.replace`, debounced sliders) and Load-more (`usePaginatedQuery`). Map: `setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')` before the first mount, `next/dynamic({ssr:false})`, `data-lenis-prevent`, HTML price pins ≤150 points otherwise a clustered GeoJSON source, hover sync both ways, bbox toggle via `listings.mapPoints`. SEO: curated canonical for city×type×transaction, `noindex` for deep combos, breadcrumb JSON-LD.
**Risk:** MapLibre 6 is ESM-only and needs WebGL2; headless Chromium may not provide it → the map component renders a documented fallback and the e2e test accepts either a canvas or the fallback.

### Step 07 — Listing detail (gate: verify)
`fetchQuery(api.listings.bySlug)` wrapped in `cache()` and shared with `generateMetadata` + `opengraph-image`. `notFound()` for unpublished; 301 via `slugRedirects`. Gallery → `yet-another-react-lightbox` (Zoom/Thumbnails/Captions, import its CSS). Tabs render only where data exists; the 360/3D tabs render a poster + "Uskoro" with a documented prop contract until step 11. Calculators in `lib/mortgage.ts` / `lib/costs.ts` with vitest unit tests. Forms: react-hook-form + zod, localized errors, honeypot, required privacy consent + separate unticked marketing opt-in, friendly rate-limit message. `opengraph-image.tsx` uses `ImageResponse` from `next/og` with a **TTF/OTF** font containing Latin-Ext + Cyrillic (Satori rejects WOFF2), ≤500 KB, flexbox-only layout; in 16 its `params` is a Promise.
**Proof:** inquiry + viewing prove end-to-end; rendered JSON-LD shown; OG image screenshot; 390/1440 shots Read.

### Step 08 — Admin shell, dashboard, listings (gate: verify)
Login, invite acceptance, sign-out, `AuthGate` on `(panel)` that redirects to `/admin/login`; role comes from `users.getMe`. shadcn Sidebar with role-filtered items, ⌘K palette, breadcrumbs, sonner. Dashboard KPIs + a lazy SVG chart + the three to-do lists + recent activity. TanStack v8 data table with status tabs, filters, bulk actions. The 9-tab editor with autosave, dirty guard, Ctrl+S; MapLibre pin picker reusing `components/map`; media manager (`generateUploadUrl`, per-file progress, client-side dimension read, dnd-kit sort, cover, per-locale alt, room tag); live publish-checklist panel mirroring the server check; status workflow, duplicate, preview link, price log. Demo panel with typed confirmation.
**Risk:** Convex uploads have a 2-minute POST timeout → validate size client-side and show a clear error above ~20 MB.

### Step 09 — Admin CRM and content (gate: verify)
Define the shared admin patterns first (list page, detail sheet, form layout), then fan out subagents with exclusive ownership: A = `upiti` + `convex/leadsAdmin.ts`, B = `magazin` + `postsAdmin.ts`, C = `lokacije` + `locationsAdmin.ts`, D = `tim` + `users`/`invites`/`agentsAdmin`, E = `sadrzaj` + `pagesAdmin`/`testimonials`, F = `podesavanja` + `settings`. Integrate, then have convex-auditor review. Tiptap 3.x with `immediatelyRender:false`; sanitize HTML on render with `isomorphic-dompurify`. Finally repoint the landing/legal/settings reads at the managed content and re-shoot the landing before/after.

### Step 10 — Remaining public pages (gate: verify)
Parallelize by route folder, each subagent owning its own messages namespace; merge and run `i18n:check`. Valuation 3-step wizard with the server-computed range; sell; locations index + neighborhood pages (`Place` + breadcrumb JSON-LD); agents; about; contact; journal (`Article` JSON-LD); favorites; compare with best-value highlighting; legal pages from `pages`; localized `not-found`/`error` plus `global-not-found`. Subtle reveals only, **no pinning**. A parameterized test asserts every route × 4 locales returns 200.

### Step 11 — 360° tours and 3D walkthrough (gate: verify)
`scripts/fetch-demo-tours.mjs` downloads 3 Poly Haven CC0 panoramas (originals gitignored) → sharp → 4096×2048 + 2048×1024 + 512 thumb into `public/media/tours/demo/`, committed total < 25 MB. `Tour360.tsx` = PSV core + virtual-tour + markers + gallery, `next/dynamic({ssr:false})`, `data-lenis-prevent`, mobile panoramas on small screens, disposed on close, no autorotate under reduced motion. `Walk3D.tsx` = Spark 2 `SplatMesh` + three, WASD/arrows + drag-look + touch joystick + click-to-walk + room hotspots, eye height 1.6 m, 1.2 m/s, clamped to `floorPolygon` with wall sliding, device tiering before download, runtime FPS guard, size on the button, context-loss handling, 4-language help overlay, visible CC-BY attribution. Demo splat: start with "Living Room and Kitchen" (43.1 MB, the smallest CC-BY real capture) via `fileType: SplatFileType.PCSOGS` for the unzipped `meta.json`; fall through the other CC-BY scenes on CORS/format failure and record the winner in DECISIONS.md. **Read the installed `@photo-sphere-viewer/*` and `@sparkjsdev/spark` types before coding.** Verify bundle isolation in the build output.

### Step 12 — SEO, i18n, performance, security (gate: verify)
`generateMetadata` everywhere with `alternates.canonical` + `alternates.languages` (4 locales + `x-default` → `/sr`); `metadataBase` in each root layout (return it as a string if a cached function ever produces it). `app/sitemap.ts` with `alternates.languages`, images and lastmod; `robots.ts` disallowing `/admin`, `/api`, `/*/styleguide`. Sitewide `RealEstateAgent` with `identifier` = registry number. `scripts/seo-audit.mjs` fetches every route × 4 locales from `npm run start` and checks title length, description, canonical, hreflang reciprocity, single h1, `html lang` → `docs/reports/seo-audit.md`. i18n pass with 3 parallel `i18n-translator` agents (one per target locale, each owning only its own `messages/*.json` plus its seeded content). Perf: chunk analysis (note that `next build` no longer prints First Load JS — read the Turbopack output / `.next` stats), Lighthouse via `npx lighthouse` with `CHROME_PATH` set to Playwright's chromium → `docs/reports/perf.md`. CSP finalized in `lib/csp.ts`; crawl all routes asserting zero violations. axe on 10 pages.

### Step 13 — QA sweep (ultracode workflow, gate: verify)
Fan out the audit matrix (routes × locales × viewports; visual review; functional flows via qa-engineer agents owning only `tests/`; convex-auditor plus a `.next` grep for leaked secrets; axe; content checks for lorem/`undefined`/`NaN`/untranslated keys). Adversarially verify findings before fixing; apply fixes in batches partitioned by file ownership; re-verify. Output `docs/reports/qa-report.md`.

### Step 14 — Independent code review (gate: verify)
`git diff` first, then the files. Focus the edge cases the PRD implies: empty data, missing translations, sold listings, 0.5 rooms, floor `"PR"`/`"VPR"`/`"SUT"`, very long ru/de titles, zero results, `Europe/Belgrade` DST in viewing slots, EUR rounding, `</script>` escaping in JSON-LD, invite/preview token entropy and expiry, unbounded `.collect()`, N+1 Convex reads. Findings → `docs/REVIEW-REPORT.md` with status; fix critical/high/medium with a test each.

### Step 15 — Final polish and handoff (gate: verify)
design-critic pass on the 6 money pages at 390/1440 with special attention to the first 5 seconds of the landing; re-run `media:optimize` if new files appeared; write `README.md` (Serbian + English summary), `docs/HANDOFF.md` (PRD checklist, known issues, next steps, a documented — not executed — Vercel/Convex deploy guide), `docs/CLIENT-PITCH.md`; final `verify` + `test:e2e` + `i18n:check`; `git tag night-run/complete`.

---

## 5. Cross-cutting conventions

**i18n namespaces** (identical key sets in all four files, enforced by `i18n:check`): `common, nav, footer, home, search, filters, listing, card, forms, consent, valuation, sell, locations, agents, about, contact, journal, favorites, compare, legal, tours, errors, seo, units`. Admin strings are **not** in `messages/*` — the admin is Serbian-only and uses literals. Counts always use Serbian `{count, plural, one{} few{} other{}}`.

**Naming:** components `PascalCase.tsx`; hooks `useX.ts`; Convex files `camelCase.ts`, admin modules suffixed `Admin`; Convex functions `verbNoun` (`createInquiry`, `setStatus`); validators suffixed `V` (`listingCardV`); i18n keys `namespace.section.item`; indexes `by_a_and_b`; CSS custom props `--color-*`, `--font-*`, `--ease-*`; test files `*.spec.ts` (e2e) and `*.test.ts` (unit).

**Errors:** Convex throws `ConvexError({ code, ...detail })` with stable codes (`RATE_LIMITED`, `FORBIDDEN`, `NOT_FOUND`, `SLOT_TAKEN`, `PUBLISH_BLOCKED`, `INVITE_INVALID`, `UPLOAD_REJECTED`). `lib/errors.ts` maps code → `errors.*` i18n key; raw Convex messages never reach the UI. Public pages let `fetchQuery` failures hit `error.tsx` (localized, retry button); missing docs call `notFound()`. Admin surfaces `sonner` toasts plus field-level errors.

**Loading:** `loading.tsx` per data-driven segment rendering the same layout in `Skeleton` blocks (CSS shimmer, disabled under reduced motion — never GSAP). Below-the-fold server components sit in `<Suspense>` so the main content streams first. Client islands treat Convex's `undefined` as loading and use `useTransition` for filter changes. Admin uses shadcn `Skeleton` and keeps the previous table page while loading.

**Analytics / consent:** cookie `me_consent` (v1, 180 days, `SameSite=Lax`, `Secure` in prod) holding `{necessary:true, analytics, marketing, version, ts}`, read server-side with `cookies()` in the public root layout so the banner never flashes. `lib/store/consent.ts` + `useConsent()`. `components/site/Analytics.tsx` mounts GA4/Plausible from `settings.analytics` **only** when `analytics === true`, via `next/script` `afterInteractive`; with no IDs seeded it renders nothing. `stats.trackView` is first-party, stores no personal data (a random per-tab `sessionStorage` key), and runs without consent — stated on the cookie page.

**CSP** (`lib/csp.ts`, one source of truth, applied through `next.config.ts` `headers()`; public and `/admin` get different policies):

```
default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none';
img-src 'self' data: blob: https://images.unsplash.com https://*.convex.cloud https://dl.polyhaven.org
        https://tiles.openfreemap.org https://d28zzqy0iyovbz.cloudfront.net;
media-src 'self' blob:;
connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site
        https://tiles.openfreemap.org https://d28zzqy0iyovbz.cloudfront.net
        https://storage.googleapis.com https://nominatim.openstreetmap.org;
frame-src https://my.matterport.com https://kuula.co https://www.youtube-nocookie.com https://player.vimeo.com;
worker-src 'self' blob:;
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; font-src 'self' data:; manifest-src 'self';
```

Plus `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`, and HSTS documented for production only. `'unsafe-eval'` is added in development for React Refresh. **A nonce-based CSP is deliberately not attempted** — the Next docs state nonces force every page dynamic and break PPR, and `next/script` plus Satori make it fragile unattended; it is recorded as a HANDOFF follow-up.

---

## 6. Top things most likely to break overnight

1. **Windows / Git Bash paths.** Use forward slashes everywhere, `path.join` in scripts, `pathToFileURL()` for dynamic imports, and single-quoted JSON for `npx convex run '{"a":1}'`. Never assume `NUL` or `%VAR%`.
2. **Turbopack + MapLibre worker.** Turbopack is the default for dev *and* build in 16, and MapLibre 6 is ESM-only. Copy **both** `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` in `predev`/`prebuild`, call `setWorkerUrl()` once before the first map mounts, and load every map through `next/dynamic({ssr:false})`. Never add a custom `webpack` config — `next build` fails outright if one exists.
3. **Convex Auth silently signed out.** `convex/auth.config.ts` must exist. Do **not** declare `CONVEX_SITE_URL`/`CONVEX_CLOUD_URL` in `defineApp({ env })` — they are already on `env` and redeclaring fails the deploy. Verify env *names* with `npx convex env list`; never regenerate JWT_PRIVATE_KEY/JWKS.
4. **SplitText before fonts.** `await document.fonts.ready`, `autoSplit:true` with the tween created and returned inside `onSplit`, `mask:'lines'`, `aria:'auto'`, and no `text-wrap: balance` on split elements — otherwise lines re-measure and the reveal breaks on `/ru` and `/de` first.
5. **Lenis vs sticky / pins / overlays.** `overflow-x: clip` (not `hidden`) on ancestors of sticky elements; `data-lenis-prevent` on maps, 360°, 3D and the lightbox; `lenis.stop()`/`start()` around modals; one raf source (`autoRaf:false` + `gsap.ticker`, `lagSmoothing(0)`); do not set `scroll-behavior: smooth` (16 no longer overrides it).
6. **next-intl + two root layouts.** No `app/layout.tsx`; `/` only exists via the proxy redirect; `experimental.globalNotFound` + a self-contained `app/global-not-found.tsx`; the proxy matcher must exclude `/admin`, `/api`, `_next`, `_vercel`, metadata files and anything with a dot; `locale()` from `next/root-params` is `string | undefined` and cannot be used in Route Handlers.
7. **Convex search and count limits.** 1024-doc scan on search indexes, equality-only filters, no `.order()` after `withSearchIndex`, and **no count operator at all**. Keep the bounded-scan numbers from §1.4, use `locationCounts` for neighborhood counts, and never write `.collect().length`.
8. **`npm run verify` starts with a Convex push.** A tightened schema field against already-seeded documents fails validation and therefore the gate. Add fields as optional, backfill in the same push, and re-seed rather than hand-patching.
9. **Tailwind v4 + shadcn init.** There is no `tailwind.config.js`; tokens live in `@theme` inside `globals.css` — which `shadcn init` overwrites. Run the init first, `git diff` it, then layer our tokens and scope admin overrides under `.admin`.
10. **Missing / transitive dependencies.** `sharp` (an optional dep of next) and `zod` (dev-transitive) must be declared explicitly, and `@playwright/test` must be installed before `scripts/shots.mjs` can run at all. Install once in step 02 and confirm with `npm ls`.
11. **OG images.** `ImageResponse` from `next/og` needs a **TTF/OTF** with Latin-Ext + Cyrillic (WOFF2 is rejected), stays under 500 KB, supports flexbox only, and in 16 receives `params` as a Promise.
12. **GSAP e2e flakiness.** Have motion components set `data-anim="done"` on completion and have Playwright wait for that attribute instead of sleeping; run the reduced-motion variants with `reducedMotion:'reduce'`.

---

## Verification (applies to every step)

`npm run verify` → 0 (push + typegen + tsc + eslint + build), `npm run i18n:check`, `npm run test:e2e`, `node scripts/shots.mjs --routes … --widths 390,1440` with the PNGs actually Read, `npx convex run <fn> '<json>'` for backend claims, and the axe / Lighthouse / SEO report scripts from step 12 once they exist. Append to `docs/PROGRESS.md`, write `night-run/state/steps/<ID>.done.md`, commit, and leave no background process running.

---

## Step 01 definition of done

- [x] **The final message contains the complete Markdown plan with all 6 sections above.** Evidence: §1 Architecture decisions (1.1 two root layouts / `global-not-found` / `global-error` / root-params, 1.2 no `cacheComponents`, 1.3 per-page query placement table, 1.4 search strategy with named indexes and scan bounds, 1.5 favorites/compare, 1.6 public data safety, 1.7 media pipeline for both media-src states, 1.8 auth/invite/preview tokens); §2 folder/file map tree; §3 Convex function inventory with args, roles and indexes; §4 per-step tasks/risks/install commands/proof for 02→15; §5 cross-cutting (i18n namespaces, naming, errors, loading, consent, CSP); §6 twelve overnight failure modes with concrete preventions. ~5,600 words. No file was written outside the plan scratchpad (plan mode honoured; step 01 gate is `none`).