# Step 07: Listing detail page

**Read:** docs/01-PRD.md A5 (every bullet), docs/02-ARCHITECTURE.md §5, §9; docs/03-DESIGN-SYSTEM.md; docs/04-CONTENT.md (compliance, microcopy); docs/05-RESEARCH.md (differentiators).
**Skills:** `seo`, `accessibility`, `core-web-vitals`, `vercel-react-best-practices`, `gsap-react` (light, tasteful motion only).

## Tasks
1. **Route** `/[locale]/properties/[slug]`.
   - Server-render the main content with `fetchQuery(api.listings.bySlug)`.
   - `notFound()` for unpublished listings; a 301 redirect via `slugHistory`.
   - sold/rented → ribbon, no forms, similar listings.
2. **Gallery:** editorial hero grid (1 large + 4) → yet-another-react-lightbox (Zoom, Thumbnails, Captions with room tags), keyboard + swipe. Room filter chips. The first image is `preload`.
3. **Tabs** (only those with data): Fotografije, Tlocrt (floor plans in the lightbox), Video (privacy-friendly embed facade), 360° tura / 3D šetnja. Those two are placeholders that call the components built in step 11: render a poster + "Uskoro" state if the component isn't there yet, and keep the prop contract documented.
4. **Content sections:** title block, price block (price, €/m², price-drop badge + price history popover, RSD toggle from settings rate), key facts grid, description + highlights, grouped feature chips, legal block with the "Verifikovana dokumentacija" badge rule, commission text, location map (exact or approximate circle) + POIs list, neighborhood teaser linking to `/lokacije/[slug]`.
5. **Calculators** (`lib/mortgage.ts`, `lib/costs.ts`, unit-tested with vitest):
   - Mortgage: annuity formula; defaults from settings; presets 20% / 10%; young-buyers note; EKS disclaimer.
   - Total cost: transfer tax 2.5% on resale with the first-home exemption info (40 m² + 15 m² per family member, explained, not computed legally); VAT note for new builds; agency fee; notary/cadastre estimate.
6. **Agent card:** sticky on desktop; a bottom action bar on mobile (Pozovi / Viber `viber://chat?number=` / WhatsApp `https://wa.me/` / Zakaži).
7. **Forms** (react-hook-form + zod, localized errors, honeypot, consent checkbox + separate marketing opt-in, success states):
   - Inquiry → `leads.createInquiry`.
   - Viewing booking: date strip for the next 14 days + slots computed from agent availability minus existing viewings, mode in_person/video → `viewings.request`.
   - Show a friendly rate-limit error.
8. **Similar listings** carousel. **Share:** copy link, WhatsApp, Viber, email.
9. **Compliance line** near the price: "{companyName} · Registar posrednika br. {registryNo}".
10. **SEO:**
    - `generateMetadata` (title pattern: "{structure} {type}, {neighborhood} — {price} | Mihajlo Estate"), canonical + hreflang.
    - JSON-LD: `RealEstateListing` + `Offer` + `Apartment|House|…` (floorSize MTK, rooms, address, geo when exact) + `BreadcrumbList`.
    - `opengraph-image.tsx`: photo + price + m² + neighborhood + logo, with a TTF font that has Latin-Ext + Cyrillic.
11. **View tracking:** call `stats.trackView` once per session.
12. **Tests:**
    - e2e: inquiry creates a lead (verify via an admin query using the admin credentials, or a test-only internal query run with `npx convex run`)
    - e2e: viewing booking creates a viewing
    - lightbox keyboard navigation
    - sold listing shows the ribbon and no form
    - unit tests for the calculators

## Definition of done
- [ ] Every PRD A5 bullet is implemented, or explicitly deferred with a reason in the done file (only the 360/3D internals may be deferred to step 11).
- [ ] Inquiry + viewing flows are proven end-to-end.
- [ ] JSON-LD is valid (show the rendered JSON for one listing); the OG image renders (screenshot of `/sr/nekretnine/<slug>/opengraph-image`).
- [ ] Screenshots at 390/1440 are reviewed; the mobile action bar works.
- [ ] `npm run verify` exits 0; all tests pass.
- [ ] PROGRESS.md, done file and commit made per the protocol.
