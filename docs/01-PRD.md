# 01: Product requirements

Each item lists its acceptance criteria (AC). "Localized" means the item works in all 4 locales with translated UI strings and a content fallback to sr-Latn.

## A. Public site

### A1 Global shell
- **Header:**
  - Transparent over dark heroes; becomes a solid ivory bar after 80px of scroll (the header height shrinks).
  - Logo wordmark "MIHAJLO ESTATE".
  - Nav: Nekretnine, Lokacije, Procena, Prodajte, O nama, Kontakt.
  - Language switcher (SR/EN/RU/DE), favorites counter, phone CTA.
  - Mobile: full-screen menu with staggered GSAP reveal.
- **Footer:**
  - Company legal data from settings: name, address, PIB, MB, **Registar posrednika br.**, phones, email, Viber/WhatsApp.
  - Nav, social links, language switcher.
  - Links to Privatnost, Uslovi poslovanja (general terms), Kolačići, plus the copyright year.
- **Cookie consent:** opt-in banner (necessary / analytics / marketing). Analytics scripts load only after consent. Localized.
- **Error pages:** styled 404 and error pages, localized.
- **AC:** the shell renders in 4 locales; the language switcher keeps the current page (localized pathname + same listing slug); keyboard navigable; no layout shift when the header changes.

### A2 Landing page (`/{locale}`)
The section list and choreography live in `03-DESIGN-SYSTEM.md` §6.

- **AC:**
  - Preloader shows only on the first visit per session (≤ 1.8 s) and is skippable.
  - The hero video (or image fallback) plays muted inline. The poster is the LCP element with `fetchPriority="high"`.
  - The search bar routes to `/nekretnine?…` with the chosen filters.
  - Featured listings, neighborhoods, stats and journal posts come from Convex.
  - Every section is localized.
  - Reduced motion: no pinning, no smooth scroll, simple fades.
  - Mobile (≤ 768px) has its own tuned choreography, not the desktop animation squeezed down.
  - No console errors.

### A3 Search (`/nekretnine`, en `/properties`, ru `/nedvizhimost`, de `/immobilien`)
- **Filters:**
  - transaction (prodaja/izdavanje)
  - property type (stan, kuća, lokal, kancelarija, plac, garaža, vikendica)
  - city → municipality → neighborhood (multi-select)
  - price min/max, area min/max
  - rooms (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5+)
  - floor (SUT/PSUT/PR/VPR/1…30, "not ground floor", "not top floor")
  - heating (CG, EG, TA, gas, podno, toplotna pumpa)
  - construction (novogradnja/starogradnja/u izgradnji)
  - toggles: lift, terasa/lođa/balkon, parking/garaža, uknjiženo, useljivo, namešteno, povraćaj PDV-a, može na kredit, ekskluzivno, 3D/360 tura
  - "added in last 24h/3d/7d/14d"
- **Sort:** newest, price ↑↓, €/m² ↑↓, area ↓.
- **Everything lives in URL searchParams**, so a search is shareable and the back button works.
- **Layout:**
  - Desktop: split view with a list of cards next to a map (price pins, clustering; hovering a card highlights its pin and vice versa), plus a "search as I move the map" toggle.
  - Mobile: list/map toggle, filters in a bottom sheet, sticky result count.
- **Results:** count, "load more" pagination (Convex cursor), empty state with suggestions and a "clear filters" button.
- **AC:** every filter changes the results correctly (e2e test covers ≥ 6 filters); the map shows the same result set; URL round-trips; LCP < 2.5s on desktop build.

### A4 Listing card
- Photo carousel (swipe/arrows, lazy).
- Badges: Ekskluzivno, Novo, Snižena cena, Uknjiženo, Novogradnja, Može na kredit, 3D tura.
- Price with €/m² and monthly-rate estimate ("Rata od ~X €/mes.", 20% down, 25y, rate from settings).
- m², room structure, floor/total, neighborhood.
- Favorite heart (localStorage, synced counter).
- **AC:** keyboard accessible; image `sizes` correct; no CLS.

### A5 Listing detail (`/nekretnine/[slug]`)
- **Gallery:** editorial hero (1 large + 4 grid) → fullscreen lightbox with zoom, thumbnails, room tags, keyboard.
- **Tabs:** Fotografije / Tlocrt / Video / 360° tura / 3D šetnja (only the tabs that have data).
- **Title block:** type + structure + neighborhood; price, €/m², price-drop indicator and price history; ref code; "Verifikovana dokumentacija" badge when `docsVerifiedAt` is set.
- **Key facts grid:** m², structure, rooms/bedrooms/bathrooms, floor/total, year, heating, condition, furnishing, parking, lift, outdoor area, orientation, energy class, bills.
- **Description:** localized rich text + highlights bullets. Feature chips grouped (Interior / Building / Outdoor / Legal).
- **Legal block:** uknjiženost, legalizacija, upotrebna dozvola, teret; "provizija" text from settings/listing.
- **Location:** map (exact pin or an approximate circle depending on `addressVisibility`) + nearby POIs from data (schools, parks, transit).
- **Calculators:**
  - Mortgage: price, down payment %, years, rate. Presets 20%, 10%; note about the state program for young buyers. Monthly payment output + EKS disclaimer.
  - Total purchase cost: 2.5% transfer tax for resale with the first-home exemption note, OR VAT for new builds; agency fee; notary/cadastre estimate.
- **Agent card:**
  - Desktop: sticky card with photo or monogram, name, languages, call/Viber/WhatsApp/email.
  - Mobile: bottom action bar (Pozovi · Viber · Zakaži razgledanje).
- **Forms:**
  - Inquiry form: name, email, phone, message, GDPR consent checkbox (required) + separate marketing opt-in. Honeypot. Rate-limited.
  - Viewing booking: date picker with the next 14 days + time slots from agent availability, in-person/video. Creates a `viewings` doc (status requested) + a lead.
- **Also:** similar listings (same municipality/type, ±25% price); share (copy link, WhatsApp, Viber, email).
- **SEO:** JSON-LD `RealEstateListing` + `Offer` + `Apartment|House|…` + `BreadcrumbList`; per-listing OG image (photo + price + m² + neighborhood + logo); canonical + hreflang.
- **Compliance line** (Art. 18): agency name + registry number shown near the price.
- **View tracking:** increment `listingStats.views` once per session per listing.
- **Removed listings:** unpublished → 404; sold/rented → still visible with a "Prodato/Izdato" ribbon and similar listings (no inquiry form).
- **AC:** inquiry and viewing create Convex docs visible in admin (e2e); all tabs work; the lightbox is keyboard accessible; the page works without JS for the core content (server-rendered).

### A6 Valuation funnel (`/procena`)
- 3 steps:
  1. address/neighborhood, type, m², rooms, floor, condition, year
  2. contact + consent
  3. result: an indicative price range from the neighborhood average €/m² (`locations.avgPricePerM2` in admin) adjusted by condition/floor, plus a CTA to book a free on-site valuation.
- Creates a lead of type `valuation`.
- **AC:** the range is computed; the lead appears in admin with all answers.

### A7 Sell with us (`/prodajte`)
- Benefits for sellers, a 5-step process timeline, and a form (property basics, contact, consent) → lead type `seller`.
- **AC:** the lead is created.

### A8 Locations (`/lokacije`, `/lokacije/[slug]`)
- Index of cities → neighborhoods (cards with image + listing count).
- Neighborhood page: editorial intro (localized), key facts (avg €/m², vibe, transport, schools), listings in the area, map, other neighborhoods.
- **AC:** SEO metadata per page; the listing count is correct.

### A9 Agents (`/agenti`, `/agenti/[slug]`)
- Team grid (photo or monogram, role, languages, areas).
- Profile: bio, contact, the agent's active listings, sold examples, license ID ("ID kartica posrednika") if set.

### A10 About (`/o-nama`), Contact (`/kontakt`)
- **About:** story, values, numbers (from settings, `isDemo` flagged), team teaser, office photo.
- **Contact:** office map, hours, phones (tel: links), Viber/WhatsApp deep links, email, general contact form → lead type `general`.

### A11 Journal (`/magazin`, `/magazin/[slug]`)
- Posts list (featured + grid, category filter) and article page (rich text, reading time, share, related listings/posts). Content is managed in admin; seed 3 demo posts × 4 locales.

### A12 Favorites (`/omiljeno`) + Compare (`/uporedi`)
- Favorites from localStorage (ids) → fetched from Convex.
- Compare 2–4 listings side by side (price, €/m², m², structure, floor, year, heating, parking, bills…), highlighting the best value per row.

### A13 Legal pages
Privatnost (ZZPL-aligned template), Uslovi poslovanja (general terms incl. commission), Kolačići (cookie policy).
- Content is editable in admin (`pages` table). The seed templates are marked "Nacrt – proveriti sa pravnikom".

## B. Admin panel (`/admin`, Serbian)

### B1 Auth & roles
- Login page in the Editorial style (email + password). No public sign-up; invite-only.
  - An admin creates a user (email, name, role) → the invited person sets a password on first sign-in (invite token or temporary password).
- **Roles:**
  - `admin`: everything
  - `manager`: everything except users/settings
  - `agent`: own listings, own leads/viewings, read-only others
  - `editor`: journal/pages/locations/translations only
- Session persists; logout. The admin shell has a sidebar (collapsible), top bar (search, "Pogledaj sajt", user menu) and breadcrumbs.
- **AC:** every admin Convex function checks the role server-side (an e2e test hits a mutation as an unauthorized user → error).

### B2 Dashboard
- KPI cards: active listings, new leads (7d), viewings today, avg response time.
- Charts: views & leads over 30 days.
- To-do lists:
  - leads not contacted > 1h
  - listings missing floor plan, with < 8 photos, or without translations
  - brokerage contracts expiring in 14 days
- Recent activity.

### B3 Listings
- **Table:** TanStack; columns ref, cover, title, type, price, status, agent, views, leads, updated. Filters, search, status tabs (Nacrt / Na pregledu / Objavljeno / Rezervisano / Prodato / Izdato / Povučeno / Arhivirano). Bulk: publish, unpublish, archive, assign agent, delete demo.
- **Editor tabs** (autosave draft, dirty-state guard):
  1. Osnovno: transaction, type, subtype, ref (auto), agent, exclusive, visibility, featured
  2. Lokacija: city/municipality/neighborhood selects, street/no, `addressVisibility`, map picker (click/drag pin), POIs
  3. Karakteristike: every field from the data model, grouped
  4. Cena: price, VAT flags, mortgage-eligible, commission, bills, price history (auto log)
  5. Opis: per-locale title/description/highlights; completeness badges; "copy from Serbian" helper
  6. Mediji:
     - multi-upload with progress to Convex storage
     - drag-reorder (dnd-kit), set cover, room tag, alt per locale, delete
     - floor plans section
     - video URL
  7. 360° / 3D: tour provider (self/Matterport/Kuula/none), scenes editor (upload panoramas, order, links), splat assets (desktop/mobile/collision/poster, URL or upload), publish toggles
  8. Pravno: registration, legalization, occupancy permit, encumbrance, ownership share, documents verified by/at, **brokerage contract** (number, type, start, end), owner (private contact)
  9. SEO: slug (auto from sr title, editable, 301-safe), meta title/description per locale, OG override
- **Publish checklist:** blocks publishing and shows reasons if any of these fail: contract valid, Art. 18 fields (price, location, m², structure), ≥ 5 photos, sr-Latn title + description, cover set.
- **Status workflow** buttons with confirmation. Duplicate listing. Preview link (unpublished preview for staff).
- **AC:** e2e: create → upload 3 images → fill required → publish → visible on `/sr/nekretnine`; unpublish → 404 publicly.

### B4 Leads (Upiti) & pipeline
- Inbox list with filters (type, status, agent, source, date) + a kanban pipeline: Novi → Kontaktiran → Kvalifikovan → Razgledanje → Ponuda → Dobijen / Izgubljen (with loss reason).
- Lead detail: timeline (created, status changes, notes, emails logged), linked listing, assign agent, notes, next action date, and a response timer since creation.
- **AC:** status changes are logged in `activity`; an agent sees only their own leads.

### B5 Viewings (Razgledanja)
- Week/day calendar and a list; statuses requested / confirmed / done / cancelled / no-show; post-viewing feedback field. Agent availability settings (weekly slots) feed the public booking widget.

### B6 Contacts & consent
- Contacts derived from leads (dedupe by email/phone), consent records (text version, timestamp, channel, IP hash), export CSV, delete-on-request (anonymize).

### B7 Team (Tim)
- Users list, invite, change role, deactivate. Agent profile fields: photo, bio per locale, languages, phone, Viber/WhatsApp, areas, license ID, public profile toggle, sort order.

### B8 Locations (Lokacije)
- CRUD city → municipality → neighborhood with slug, localized name/intro, cover image, avg €/m² (sale/rent), centroid lat/lng, featured flag, order.

### B9 Journal (Magazin)
- Posts: Tiptap editor per locale, cover, category, tags, author, publish date, SEO, featured. HTML is sanitized on render.

### B10 Site content (Sadržaj sajta)
- Per-locale editable blocks: hero headline/subline, intro statement, services texts, process steps, stats (value + label + `isDemo`), CTA texts, testimonials (with `verified`), FAQ, legal pages.

### B11 Settings (Podešavanja)
- Company legal data (name, address, PIB, MB, registry no., insurance), contact channels, social links, commission text, general terms PDF upload, mortgage defaults (rate, years, down %), EUR→RSD rate, default SEO, OG image, analytics IDs (consent-gated).

### B12 Analytics
- Per-listing views / favorites / leads / viewings funnel, top listings, leads by source/type, agent response times. Simple charts (Recharts or custom SVG).

### B13 Activity log
- Field-level change log for listings/leads/settings (who, when, what). Filterable.

### B14 Demo content management
- A "Demo sadržaj" panel: count of `isDemo` records per table + a button that deletes all demo data (typed confirmation).

## C. Cross-cutting
- **Performance:**
  - LCP < 2.5s, CLS < 0.1, INP < 200ms on the production build (desktop, fast 4G mobile emulation for key pages).
  - Maps, 3D, lightbox, Tiptap and charts are lazy-loaded; GSAP is only on the pages that use it.
- **Accessibility:** WCAG 2.1 AA (axe clean on key pages), full keyboard support, reduced motion.
- **SEO:**
  - Localized metadata, hreflang (sr-Latn/en/ru/de + x-default), canonical.
  - Sitemaps (static + listings + locations + posts), robots, JSON-LD, OG images.
- **Security:**
  - Auth checks in every admin function; rate limits on public mutations.
  - File type/size validation on upload; sanitized rich text; no secrets client-side.
  - Security headers (CSP allowing OpenFreeMap, Unsplash, Convex, Matterport/Kuula frames, `wasm-unsafe-eval` + `worker-src blob:` for Spark).
- **Tests:** Playwright e2e for the critical flows (search, detail inquiry, viewing, valuation, admin login, create/publish listing, lead status change), screenshots of key pages at 390 / 768 / 1440 widths.
