# 02: Architecture

Versions were checked on npm on 2026-09-27. Install exactly these majors, and pin exact versions for 0.x packages.

## 1. Packages
| Purpose | Package(s) | Notes |
|---|---|---|
| Framework | next 16.3.6, react 19.2.8, react-dom 19.2.8 | Already installed. **Do not bump React to 19.3.** |
| Styling | tailwindcss 4.3.x, @tailwindcss/postcss | CSS-first `@theme` |
| Backend | convex 1.46, @convex-dev/auth (0.0.9x, v1 line; NOT the 2.0 alpha), @auth/core (the version @convex-dev/auth's peer range asks for) | Password provider |
| Convex components | @convex-dev/rate-limiter 0.4.x, (optional) @convex-dev/aggregate 0.3.x | Register in `convex/convex.config.ts` |
| i18n | next-intl 4.14.x | Localized pathnames; `next/root-params` |
| Motion | gsap 3.15.x, @gsap/react 2.1.x, lenis 1.3.x | All GSAP plugins are free. Import from `gsap/ScrollTrigger`, `gsap/SplitText`, … |
| UI (admin) | shadcn CLI (`npx shadcn@latest init -b radix -p nova -y`, then `add …`), @tanstack/react-table **8.21.x** (v8 API, matches shadcn examples), react-hook-form 7.x, @hookform/resolvers 5.x, zod 4.x, sonner 2.x, lucide-react, @dnd-kit/core 6.3.x + @dnd-kit/sortable 10.x, date-fns 4 | |
| Content | @tiptap/react + @tiptap/pm + @tiptap/starter-kit 3.x (`immediatelyRender:false`), isomorphic-dompurify (or sanitize-html) | Sanitize on render |
| Gallery | embla-carousel-react 8.6.x, yet-another-react-lightbox 3.x (+ Zoom, Thumbnails plugins; import its CSS) | |
| Maps | maplibre-gl **6.11.x** (≥ 6.4.1 for a security fix), @vis.gl/react-maplibre 8.1.x | See §8 for the worker gotcha |
| 360° | @photo-sphere-viewer/core + virtual-tour-plugin + markers-plugin + gallery-plugin (+ map-plugin optional), all 5.15.x | Shares three.js |
| 3D splats | three 0.18x (match PSV/Spark peer ranges), @sparkjsdev/spark 2.x | Turbopack is the default in Next 16 (good for Spark's WASM) |
| Media tooling | sharp (images), ffmpeg-static (video; devDependency) | Used only in `scripts/optimize-media.mjs` |
| Tests | @playwright/test, @axe-core/playwright | `npx playwright install chromium` |

## 2. Folder layout
```
app/
  [locale]/                 # PUBLIC root layout (html/body, fonts, providers, Lenis, header/footer)
    layout.tsx  page.tsx  not-found.tsx  error.tsx
    (site)/…                # route files use ENGLISH canonical segment names (see §4)
    opengraph-image.tsx
  admin/                    # ADMIN root layout (html/body, ConvexAuthProvider, shadcn, no Lenis/GSAP)
    layout.tsx  login/page.tsx  (panel)/…
  api/…                     # only if needed
  sitemap.ts  robots.ts
components/
  site/  admin/  ui/  motion/  map/  tours/  forms/  seo/
convex/
  schema.ts  auth.ts  auth.config.ts  http.ts  convex.config.ts
  lib/{auth.ts,validators.ts,slug.ts,search.ts,money.ts}
  listings.ts  listingsAdmin.ts  media.ts  leads.ts  viewings.ts  agents.ts  users.ts
  locations.ts  posts.ts  pages.ts  settings.ts  stats.ts  activity.ts  tours.ts
  seed/…  crons.ts
i18n/  routing.ts  request.ts  navigation.ts
messages/  sr-Latn.json  en.json  ru.json  de.json
lib/  format.ts  seo.ts  jsonld.ts  cn.ts  mortgage.ts  costs.ts  consent.ts
scripts/  shots.mjs  i18n-check.mjs  optimize-media.mjs  copy-maplibre-worker.mjs
tests/e2e/…  playwright.config.ts
media-src/                  # raw hero media dropped in by the owner (gitignored); optimized into public/media
public/media/…  public/maplibre/…
proxy.ts                    # Next 16 proxy (was middleware): next-intl only, excludes /admin, /api, files
```
There is **no** `app/layout.tsx`: two root layouts (`app/[locale]/layout.tsx` and `app/admin/layout.tsx`). Moving between them is a full page load, which is fine.

## 3. Providers
- **Public:** a `ConvexClientProvider` (a plain `ConvexReactClient`, no auth) wraps interactive islands. Server components read data with `fetchQuery`/`preloadQuery` from `convex/nextjs`. Note that these force `no-store`; don't wrap them in `'use cache'`.
- **Admin:** `ConvexAuthProvider` from `@convex-dev/auth/react`, client-side only, token in localStorage.
  - The admin section is a client-rendered app. Its layout gates on `useConvexAuth()` and redirects unauthenticated users to `/admin/login`.
  - The real security boundary is `requireRole()` inside every Convex admin function. No Next middleware/proxy auth is needed.
- **Motion:** `components/motion/SmoothScroll.tsx` mounts Lenis only on the public layout and only without reduced motion.

```tsx
'use client'
<ReactLenis root ref={ref} options={{ autoRaf: false, anchors: true, stopInertiaOnNavigate: true }} />
// in useEffect: gsap.ticker.add(t => ref.current?.lenis?.raf(t*1000)); gsap.ticker.lagSmoothing(0)
// useLenis(ScrollTrigger.update)
```
- Import `lenis/dist/lenis.css`.
- Remove `scroll-behavior:smooth`.
- On modal open, call `lenis.stop()` and `start()` on close.
- Use `overflow-x: clip` instead of `overflow:hidden` on ancestors of sticky elements.

## 4. Routing and i18n
- `i18n/routing.ts`: `defineRouting({ locales: ['sr-Latn','en','ru','de'], defaultLocale: 'sr-Latn', localePrefix: { mode: 'always', prefixes: { 'sr-Latn': '/sr' } }, pathnames: {...} })`.
- `proxy.ts`: `createMiddleware(routing)` with matcher `'/((?!api|admin|_next|_vercel|.*\\..*).*)'`. `/` redirects to `/sr` (or to the Accept-Language locale).
- `i18n/request.ts`: read the locale from `next/root-params` (Next 16.3). `setRequestLocale` is legacy. Add `generateStaticParams` returning the locales in `app/[locale]/layout.tsx`.
- `<html lang>` is `sr-Latn` / `en` / `ru` / `de`. hreflang uses the same codes plus `x-default` → `/sr`.
- Serbian plurals: `one|few|other`, e.g. `{count, plural, one {# stan} few {# stana} other {# stanova}}`.

Localized pathnames (the internal segment is in English):

| Internal | sr-Latn | en | ru | de |
|---|---|---|---|---|
| /properties | /nekretnine | /properties | /nedvizhimost | /immobilien |
| /properties/[slug] | /nekretnine/[slug] | /properties/[slug] | /nedvizhimost/[slug] | /immobilien/[slug] |
| /locations(/[slug]) | /lokacije | /locations | /lokacii | /lagen |
| /valuation | /procena | /valuation | /ocenka | /bewertung |
| /sell | /prodajte | /sell | /prodat | /verkaufen |
| /agents(/[slug]) | /agenti | /agents | /agenty | /makler |
| /about | /o-nama | /about | /o-nas | /ueber-uns |
| /contact | /kontakt | /contact | /kontakty | /kontakt |
| /journal(/[slug]) | /magazin | /journal | /zhurnal | /magazin |
| /favorites | /omiljeno | /favorites | /izbrannoe | /favoriten |
| /compare | /uporedi | /compare | /sravnit | /vergleich |
| /privacy | /privatnost | /privacy | /konfidencialnost | /datenschutz |
| /terms | /uslovi | /terms | /usloviya | /agb |
| /cookies | /kolacici | /cookies | /cookies | /cookies |
| /styleguide (noindex) | same | same | same | same |

- Listing slugs are ASCII, generated from the sr-Latn title plus the ref, and identical across locales, e.g. `trosoban-stan-vracar-ME-1042`. Diacritics are folded (č→c, ć→c, š→s, ž→z, đ→dj).
- Keep a `slugHistory` array for 301s.

## 5. Convex data model (`convex/schema.ts`)
Use `authTables` from `@convex-dev/auth/server`, and extend `users` with `role`, `status`, `agentId`. Types below are shorthand.

```
L10n = { "sr-Latn": string, en?: string, ru?: string, de?: string }   // v.object with optional fields
Image = { kind: "storage", storageId: Id<_storage> } | { kind: "url", url: string }
MediaItem = { id: string, image: Image, w?: number, h?: number, blurDataURL?: string, alt: L10n, room?: RoomTag, isCover?: boolean, order: number, author?: string, sourcePage?: string }

listings: {
  ref: string                       // "ME-1042", unique (index by_ref)
  slug: string, slugHistory: string[]                     // index by_slug
  status: "draft"|"review"|"published"|"reserved"|"sold"|"rented"|"withdrawn"|"archived"
  visibility: "public"|"unlisted"|"private"
  transaction: "sale"|"rent"
  propertyType: "apartment"|"house"|"commercial"|"office"|"land"|"garage"|"cottage"
  subtype?: "studio"|"duplex"|"penthouse"|"loft"|"villa"|"townhouse"|…
  isExclusive, isFeatured, isDemo: boolean
  agentId: Id<agents>, ownerContactId?: Id<contacts>
  mandate?: { number, type: "exclusive"|"open", start: number, end: number }   // brokerage contract, REQUIRED to publish
  title: L10n, description: L10n, highlights: { "sr-Latn": string[], en?: string[], ru?: string[], de?: string[] }
  price: number (EUR), pricePerM2: number (derived), priceHistory: {date:number, price:number}[], priceOnRequest?: false
  vatIncluded?, vatRefundEligible?, mortgageEligible?, developerInstallments?, urgent?
  commissionText?: L10n, costs?: { infostan?, maintenance?, utilitiesIncluded? }
  rent?: { monthly, deposit?, minLeaseMonths?, petsAllowed?, utilitiesIncluded? }
  location: { cityId, municipalityId?, neighborhoodId?, street?, streetNo?, postalCode?, lat, lng,
              addressVisibility: "exact"|"street"|"area" }
  areaM2, registeredAreaM2?, plotAreaM2?, rooms (0.5 steps), bedrooms?, bathrooms?
  floor: "SUT"|"PSUT"|"PR"|"VPR"|number, floorNum (sortable), totalFloors?, isDuplex?, isPenthouse?
  constructionType: "new"|"old"|"under_construction", yearBuilt?, completionDate?, renovatedYear?
  condition: "original"|"renovated"|"lux"|"needs_renovation"
  heating: ("CG"|"EG"|"TA"|"gas"|"floor"|"heat_pump"|"AC"|"pellet"|"other")[]
  features: { elevator, terrace, loggia, balcony, frenchBalcony, garden, basement, storage, ac, intercom, videoSurveillance, alarm, pool?, fireplace? }
  outdoorAreaM2?, orientation?: ("N"|"E"|"S"|"W")[], view?: string[]
  parking: ("garage"|"garage_spot"|"parking_spot"|"street_zone")[]
  furnishing: "furnished"|"semi"|"unfurnished"
  energyClass?: "A+"|"A"|"B"|"C"|"D"|"E"|"F"|"G"
  legal: { registration: "registered"|"in_progress"|"not_registered", legalization: "legal"|"legalized"|"in_progress",
           occupancyPermit?: boolean, encumbrance?: string, ownershipShare?: string, docsVerifiedAt?: number, docsVerifiedBy?: Id<users> }
  availableFrom?, swapPossible?
  media: MediaItem[], floorPlans: MediaItem[], videoUrl?, 
  tour360?: { provider: "self"|"matterport"|"kuula", externalId?: string, url?: string, published: boolean }
  walk3d?: { desktop?: Asset, mobile?: Asset, collision?: Asset, poster?: Image, spawn?: {x,y,z,yaw}, eyeHeight?: number,
             floorPolygon?: number[][], credits?: string, aiGenerated?: boolean, published: boolean }
  poi?: { kind: "school"|"kindergarten"|"transit"|"park"|"shop"|"health", name: string, distanceM: number }[]
  seo?: { metaTitle?: L10n, metaDescription?: L10n, ogImage?: Image }
  searchText: string (normalized sr+en title + neighborhood + city + ref)
  publishedAt?, updatedAt, createdBy
  indexes: by_status_publishedAt, by_status_price, by_status_area, by_status_city, by_status_type, by_slug, by_ref, by_agent, by_featured
  searchIndex("search_text", { searchField: "searchText", filterFields: ["status","transaction","propertyType","cityId"] })
}
Asset = { kind: "storage", storageId } | { kind: "url", url }, plus bytes?, format ("spz"|"sog"|"ply"|"splat"|"ksplat"|"glb"), splats?
tourScenes: { listingId, order, title: L10n, pano: Image, panoMobile?: Image, thumb?: Image, initialView?: {yaw,pitch},
              links: { toSceneId: Id<tourScenes>, yaw?: number, pitch?: number }[], planXY?: [number,number] }   index by_listing
listingStats: { listingId, views, favorites, leads, viewings, lastViewedAt }        index by_listing
priceChanges: { listingId, from, to, at, by }
cities / municipalities / neighborhoods (or one `locations` table with kind + parentId):
  { kind: "city"|"municipality"|"neighborhood", parentId?, slug, name: L10n, intro?: L10n, cover?: Image,
    avgPricePerM2Sale?, avgPricePerM2Rent?, lat, lng, featured, order, isDemo }
agents: { userId?, slug, name, role: L10n, bio?: L10n, photo?: Image, languages: string[], phone?, viber?, whatsapp?, email?,
          areas: Id<locations>[], licenseId?, isPublic, order, availability: { weekday: 0-6, from: "09:00", to: "17:00" }[], isDemo }
users (authTables ext): { email, name?, role: "admin"|"manager"|"agent"|"editor", status: "invited"|"active"|"disabled", agentId? }
invites: { email, role, tokenHash, expiresAt, createdBy, acceptedAt? }
leads: { type: "inquiry"|"viewing"|"valuation"|"seller"|"general", status: "new"|"contacted"|"qualified"|"viewing"|"offer"|"won"|"lost",
         lossReason?, listingId?, agentId?, contactId, message?, payload?: any (form answers), source: "web"|"phone"|"email"|"portal"|"walk_in",
         locale, utm?, consent: { privacy: true, marketing: boolean, textVersion, at }, firstResponseAt?, nextActionAt?, isDemo }
         indexes: by_status_created, by_agent_status, by_listing
leadNotes: { leadId, authorId, body, at }
contacts: { name, email?, phone?, locale?, tags: string[], consents: {...}[], anonymizedAt? }   indexes by_email, by_phone
viewings: { listingId, leadId, agentId, start: number, end: number, mode: "in_person"|"video", status: "requested"|"confirmed"|"done"|"cancelled"|"no_show", feedback? }
posts: { slug, title: L10n, excerpt: L10n, body: L10n (sanitized HTML), cover: Image, category, tags, authorAgentId?, publishedAt?, status, featured, seo?, isDemo }
pages: { key: "home"|"about"|"sell"|"valuation"|"privacy"|"terms"|"cookies"|…, blocks: any (typed per key, localized) }   // editable site content
testimonials: { quote: L10n, author, context?: L10n, verified: boolean, order, isDemo }
settings: singleton { companyName, legalName, address, pib, mb, registryNo, insurance?, phones[], email, viber?, whatsapp?, socials{},
          commissionText: L10n, termsPdf?: storageId, mortgage: { rate, years, downPct }, eurRsd?: number, stats: {…}, seo: {…}, analytics: {…} }
activity: { entity: "listing"|"lead"|"settings"|…, entityId, action, diff?: any, by?, at }   index by_entity, by_at
savedSearches (prepared, V2): { email, locale, query: any, frequency, lastSentAt, active }
```

**Security helpers:**
- `convex/lib/auth.ts`: `getViewer(ctx)`, `requireUser(ctx)`, `requireRole(ctx, roles[])`, `assertCanEditListing(ctx, listing)` (agents only their own).
- Public queries never return `mandate`, `ownerContactId`, `legal.encumbrance` details, exact coordinates (when `addressVisibility != "exact"`, return jittered/centroid coordinates) or anything `private`.

**Seeding (`convex/seed/*.ts`, internal):**
- `seed:all` is idempotent (skips if data exists; `force` arg wipes `isDemo` only).
- It creates settings, locations (Belgrade municipalities + neighborhoods with realistic avg €/m²; plus Novi Sad, Niš, Kragujevac, Zlatibor, Kopaonik), 4 demo agents (monogram avatars), ~30 listings (mix of sale/rent, types, prices realistic for 2026: Vračar 3,500–5,500 €/m², Belgrade Waterfront 5,000–8,000, Novi Beograd 2,800–4,500, Dedinje villas 1–4M €, Novi Sad 2,000–3,200…) with 4-locale texts, testimonials (verified:false), 3 posts, pages, leads/viewings samples.
- Images come from `docs/assets/demo-media.json` (verify URLs with a HEAD request in a Node script before writing them).

**Admin bootstrap:** the internal action `seed:createAdmin({email,password,name})` uses `createAccount` from `@convex-dev/auth/server` with the password provider. Credentials are in `night-run/state/admin.json` (gitignored).

## 6. Auth (Convex Auth, Password)
- `convex/auth.ts`:
  - `convexAuth({ providers: [Password({ profile(params){ return { email, name } } })] , callbacks: { async createOrUpdateUser(ctx, args) { … } } })`.
  - `createOrUpdateUser` allows a new account ONLY if a pending invite exists for the email (or `seed:createAdmin` is bootstrapping). Otherwise throw.
- `convex/auth.config.ts` must exist (provider domain = `process.env.CONVEX_SITE_URL`, applicationID "convex"). Without it the app is silently always signed out.
- `convex/http.ts`: `auth.addHttpRoutes(http)`.
- Env vars on the dev deployment (**already set by the night-run preflight; don't regenerate**): `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL=http://localhost:3000`. Check with `npx convex env list`.
- The admin login uses `useAuthActions().signIn("password", { email, password, flow: "signIn" })`. The invite acceptance page sets the password with `flow: "signUp"`, and only succeeds when the invite exists.

## 7. Media
- **Listing photos:** Convex storage (admin uploads) or remote URLs (demo).
  - `next.config.ts` images: `remotePatterns` for `*.convex.cloud` `/api/storage/**`, `images.unsplash.com`, `dl.polyhaven.org`; `qualities: [60, 75, 85, 90]`.
  - Unsplash URL params: `?w=…&q=80&auto=format&fit=crop`.
- **Hero media:**
  - If `media-src/` contains the owner's AI renders (hero video/images), `scripts/optimize-media.mjs` converts them. It uses ffmpeg-static for H.264 MP4 1080p ~3–6 MB + WebM VP9 + a 720p mobile version + a poster JPG/AVIF, and sharp for AVIF/WebP at 640/1280/1920/2560 widths. Output goes to `public/media/…`.
  - Otherwise use a verified Unsplash hero from demo-media.json.
- Upload validation: images (jpeg/png/webp/avif, ≤ 20 MB), panoramas (≤ 40 MB), splats (≤ 200 MB, via upload URL; note the 2-minute POST timeout; recommend Cloudflare R2 for production, documented in 06).

## 8. Maps
- `maplibre-gl@6` + `@vis.gl/react-maplibre`.
- **Worker gotcha:** with v6 + Turbopack, copy BOTH `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` from `node_modules/maplibre-gl/dist/` to `public/maplibre/` via `scripts/copy-maplibre-worker.mjs`. Run it in `predev` and `prebuild`, then `setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')`.
- Style: OpenFreeMap `https://tiles.openfreemap.org/styles/positron`, customized at runtime for ivory land, desaturated water and hidden POI clutter. The dark variant is `…/styles/dark`. Keep OSM attribution.
- Clustering: a GeoJSON source with `cluster: true` for > 150 points, with HTML price pins only for unclustered visible points. Load via `next/dynamic({ ssr:false })`.
- Wrap in `data-lenis-prevent`.

## 9. SEO
- `generateMetadata` per page with `alternates.canonical` + `alternates.languages`.
- `app/sitemap.ts`: static pages × locales + listings + locations + posts, with alternates, images and lastmod. Add `generateSitemaps` if listings exceed 10k.
- `app/robots.ts`: disallow `/admin`, `/api`, `/*/styleguide`.
- JSON-LD helpers in `lib/jsonld.ts`: `RealEstateAgent` (sitewide, with `identifier` = registry number), `RealEstateListing` + `Offer` + `Accommodation` subtype, `BreadcrumbList`, `Article` for posts, `Person` for agents.
- OG images via `opengraph-image.tsx` (`next/og`). Load a TTF/OTF font with Latin-Extended + Cyrillic; WOFF2 is not supported by Satori.

## 10. Security headers (next.config `headers()`)
- CSP:
  - `default-src 'self'`
  - `img-src 'self' data: blob: https://images.unsplash.com https://*.convex.cloud https://dl.polyhaven.org https://tiles.openfreemap.org`
  - `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://tiles.openfreemap.org` (+ splat hosts from demo-media)
  - `frame-src https://my.matterport.com https://kuula.co`
  - `worker-src 'self' blob:`
  - `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` (tighten later)
  - `style-src 'self' 'unsafe-inline'`
  - `font-src 'self'`
- Plus `Referrer-Policy strict-origin-when-cross-origin`, `X-Content-Type-Options nosniff`, `Permissions-Policy` (camera=(), microphone=(), geolocation=(self)).
- Keep the CSP in one place (`lib/csp.ts`) and verify no console CSP violations in e2e.

## 11. Scripts (package.json)
`dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `typegen` (`next typegen`), `convex:once` (`convex dev --once`), `verify` (`npm run convex:once && npm run typegen && npm run typecheck && npm run lint && npm run build`), `test:e2e`, `i18n:check`, `shots`, `media:optimize`, `predev`/`prebuild` (copy the maplibre worker).

## 12. Known gotchas (from research)
- Next 16:
  - `middleware.ts` → `proxy.ts`; params/searchParams/cookies/headers are async.
  - `next/image` uses `preload` instead of `priority`; `qualities` must list what you use.
  - `revalidateTag(tag, 'max')`.
  - Parallel routes need `default.tsx`.
- Convex search:
  - One search field; max 16 filter fields; equality filters only; relevance order only; scans ≤ 1024 docs.
  - Price/area ranges → regular indexes + pagination.
  - For combined filters, query by the most selective index and post-filter in the function over a bounded page. Document the limits in DECISIONS.md.
- SplitText:
  - With `autoSplit: true`, create the animation inside `onSplit` and return it.
  - Use `mask: "lines"`.
  - Wait for fonts.
  - Use `aria: "auto"`.
- Lenis doesn't work over iframes (Matterport/Kuula): use a click-to-activate overlay.
- MapLibre v6 is ESM-only and requires WebGL2; see the worker copy above.
- Russian needs Cyrillic font subsets. The OG image font needs Cyrillic too.
