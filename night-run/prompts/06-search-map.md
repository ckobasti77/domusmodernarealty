# Step 06: Search, filters, map

**Read:** docs/01-PRD.md A3–A4, docs/02-ARCHITECTURE.md §4, §5 (listings indexes), §8 (maps), §12; the search strategy in DECISIONS.md; docs/03-DESIGN-SYSTEM.md §4.
**Skills:** `vercel-react-best-practices`, `core-web-vitals`, `accessibility`, `convex` (search/pagination).

## Tasks
1. **Route and state.**
   - Localized route `/[locale]/properties` (`/sr/nekretnine` …).
   - A `lib/search-params.ts` schema (zod) parses/serializes every filter from PRD A3. It is the single source of truth, shared by the UI, server fetch and Convex args.
2. **Server-render.** The first page of results + total estimate comes from `fetchQuery(api.listings.search)`. Client islands handle filters (instant URL updates with `router.replace`, debounced for sliders) and "Load more" (Convex cursor).
3. **Filters UI.**
   - Desktop: a top bar with the main filters (transaction toggle, location multi-select with city → municipality → neighborhood tree + search, type, price range, area range, rooms chips) and a "Svi filteri" drawer with the rest (floor, heating, construction, the feature toggles, recency).
   - Mobile: a bottom-sheet with all filters, sticky "Prikaži N rezultata".
   - Active filter chips with remove. "Obriši sve".
   - Sort select.
4. **Results.**
   - PropertyCard grid (3:2 images, carousel, favorite, badges, monthly rate estimate from settings).
   - Skeletons while loading; empty state per PRD with a "Pošaljite nam šta tražite" CTA → contact form prefilled.
5. **Map** (`components/map/*`, dynamic ssr:false, `data-lenis-prevent`):
   - MapLibre + OpenFreeMap positron, restyled to the ivory palette (runtime style tweaks), worker via `setWorkerUrl` (see ARCHITECTURE §8).
   - Price pins (HTML markers for ≤ 150 unclustered points; a clustered GeoJSON source otherwise), cluster click zooms in.
   - Hovering a card highlights its pin and vice versa. Clicking a pin opens a mini card popup.
   - "Pretraga pri pomeranju mape" toggle: bounds filter via `listings.mapPoints` + bbox args (extend Convex if needed).
   - Split view on desktop (list 55% / map 45%, sticky map); on mobile a List/Mapa toggle.
6. **SEO.**
   - `generateMetadata` reflects filters (e.g. "Stanovi na prodaju — Vračar | Mihajlo Estate").
   - Canonical is the clean path for curated combos (city/type/transaction) and noindex for deep filter combos.
   - Breadcrumb JSON-LD.
7. **Favorites + compare state:** a shared store (localStorage + `useSyncExternalStore`). A compare tray appears when ≥ 2 are selected (max 4) → `/uporedi` (page built in step 10; link it now).
8. **Tests (Playwright):**
   - ≥ 6 filters change the result count correctly vs Convex truth
   - URL round-trip and back button
   - map renders pins
   - load more
   - mobile sheet
   - no console errors

## Definition of done
- [ ] Every PRD A3 filter works, sort works, the URL is shareable, and the back button works.
- [ ] Map pins/clusters are in sync with the list; hover highlight works; the move-to-search toggle works.
- [ ] Mobile layout is verified in screenshots (390): sheet, list/map toggle.
- [ ] e2e tests pass.
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
