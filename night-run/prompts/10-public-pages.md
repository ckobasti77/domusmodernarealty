# Step 10: Remaining public pages

**Read:** docs/01-PRD.md A6–A13 and A1 (cookie/error pages); docs/03-DESIGN-SYSTEM.md; docs/04-CONTENT.md.
**Skills:** `frontend-design`, `gsap-react`, `seo`, `accessibility`.

Parallelize with subagents where pages are independent (each subagent owns its route folder + its messages namespace; you merge the message files and run `npm run i18n:check`).

## Pages
1. **Valuation** `/procena`: 3-step funnel (progress indicator, back/next, validation), a server-computed indicative range, a result screen with a range visualization and a CTA to book an on-site valuation (viewing-like slot picker or a callback request). Prefill from query params (landing mini-form). Creates a `valuation` lead.
2. **Sell with us** `/prodajte`: benefits, 5-step process (hairline timeline), what we need from you (documents list), FAQ accordion, form → `seller` lead.
3. **Locations** `/lokacije` + `/lokacije/[slug]`: city/neighborhood index with images and counts; neighborhood page with an editorial intro, key facts (avg €/m² sale/rent from admin), listings in the area (reuse cards), map, and other neighborhoods. Add JSON-LD `Place` + breadcrumb.
4. **Agents** `/agenti` + `/agenti/[slug]`: grid + profile (monogram avatar fallback, languages, areas, contact buttons, active listings, license ID).
5. **About** `/o-nama`: story, values, numbers (settings), team teaser, office section with map.
6. **Contact** `/kontakt`: map, hours, tel/Viber/WhatsApp/email, form → `general` lead.
7. **Journal** `/magazin` + `/magazin/[slug]`: featured + grid + category filter; article page with rich text typography, reading time, share, related posts and listings; JSON-LD `Article`.
8. **Favorites** `/omiljeno` and **Compare** `/uporedi` (2–4 listings, a best-value highlight per row, remove, share link with ids).
9. **Legal** `/privatnost`, `/uslovi`, `/kolacici`: rendered from `pages` (drafts from seed, visibly marked "Nacrt" in the admin only). The cookie page lists the categories used by the consent banner.
10. **Error pages:** styled `not-found` and `error` per locale (search box + popular links). Also the global not-found for unknown locales.
11. Subtle GSAP reveals consistent with the landing (reduced-motion aware). **No pinning** on these pages.
12. **Tests:**
    - valuation funnel end-to-end (range shown, lead created)
    - sell form
    - contact form
    - compare with 3 listings
    - every page returns 200 in all 4 locales (a parameterized test over all routes)

## Definition of done
- [ ] All pages A6–A13 are live in 4 locales with localized pathnames (a route test covers them).
- [ ] Forms create the right lead types (e2e).
- [ ] Screenshots of each page at 390/1440 are reviewed; no broken layouts in ru/de.
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
