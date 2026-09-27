# Step 12: SEO, i18n quality, performance, security headers

**Read:** docs/02-ARCHITECTURE.md §4, §9, §10; docs/05-RESEARCH.md (SEO notes); docs/04-CONTENT.md (voice, glossary).
**Skills:** `seo`, `core-web-vitals`, `performance`, `web-design-guidelines`, `vercel-react-best-practices`, `accessibility`.

## Tasks
1. **Metadata:**
   - Every public route has `generateMetadata` with a localized title/description, canonical, `alternates.languages` (sr-Latn/en/ru/de + x-default) and OpenGraph/Twitter.
   - Audit all routes with a script that fetches each page (all 4 locales) from `npm run start` and checks title length, description, canonical, hreflang reciprocity, a single h1 and `html lang`. Save the report to `docs/reports/seo-audit.md`.
2. **Sitemaps and robots:**
   - `app/sitemap.ts` includes static pages, published listings, locations and posts, with alternates, images and lastmod.
   - `robots.ts` disallows `/admin`, `/api` and `/*/styleguide`.
   - Validate the XML.
3. **Structured data:** a sitewide `RealEstateAgent` (identifier = registry number, legalName, taxID, address, areaServed). Verify listing/post/place/breadcrumb JSON-LD across pages. Write a small validator script (required fields present, valid JSON).
4. **OG images:** default site OG + listing OG + post OG; fonts with Cyrillic tested on `/ru`.
5. **i18n quality pass** (use the `i18n-translator` agent in parallel per locale):
   - review every string in messages/en|ru|de.json and every seeded content translation for native quality and correct real-estate terminology (glossary);
   - fix truncation/overflow issues seen in ru/de screenshots;
   - Serbian plural forms everywhere counts appear;
   - date/number/currency formatting per locale.
   - `npm run i18n:check` must pass.
6. **Performance:**
   - Production build analysis (first-load JS per route; list the heaviest chunks).
   - Remove unneeded client JS (move to server components), lazy-load heavy modules, set correct `sizes`, use AVIF/WebP, preconnect to tiles/unsplash as needed, fonts `display: swap` with adjusted fallbacks.
   - Run Lighthouse (use `npx lighthouse` with `CHROME_PATH` pointing to Playwright's chromium, or Playwright + web-vitals) for `/sr`, `/sr/nekretnine` and one listing, on desktop + mobile emulation.
   - Targets: Performance ≥ 90 on desktop and ≥ 75 on mobile; CLS < 0.1; no render-blocking surprises.
   - Save to `docs/reports/perf.md` (before/after).
7. **Security headers:**
   - Finalize the CSP (`lib/csp.ts`).
   - Crawl all routes with Playwright and assert zero CSP violations and zero console errors.
   - Headers: HSTS for production only (documented), Referrer-Policy, Permissions-Policy, X-Content-Type-Options, frame-ancestors 'none' (except where needed).
8. **Accessibility:** axe on 10 key pages (serious/critical = 0); keyboard pass on the header, search filters, gallery and forms.

## Definition of done
- [ ] The SEO audit report shows every page passing (or issues listed as justified).
- [ ] Sitemaps and robots are valid.
- [ ] JSON-LD is validated.
- [ ] `i18n:check` passes, and the translator agents' fixes are applied (summary in the done file).
- [ ] The performance report meets targets (or lists the concrete remaining causes).
- [ ] No CSP violations or console errors across the crawl.
- [ ] axe is clean for serious/critical issues.
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
