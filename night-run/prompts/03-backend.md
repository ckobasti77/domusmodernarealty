# Step 03: Convex backend, auth, seed data

**Read:** docs/02-ARCHITECTURE.md §5–7, docs/01-PRD.md (B1, and the data each page needs), docs/04-CONTENT.md (demo rules, glossary), docs/assets/demo-media.json, `convex/_generated/ai/guidelines.md`.
**Skills:** `convex`, `convex-auth`, `convex-authz`, `convex-design`, `convex-seed`, `convex-test`, `convex-reviewer`, `convex-verify`.

## Tasks
1. **Schema.**
   - Write `convex/schema.ts` with every table from ARCHITECTURE §5 (authTables + extended users), all indexes, and the `search_text` search index.
   - Put shared validators in `convex/lib/validators.ts` (L10n, Image, MediaItem, enums).
   - `convex/lib/slug.ts` handles diacritic folding + slugify; `convex/lib/search.ts` builds `searchText`.
2. **Auth.** `@convex-dev/auth` Password provider, invite-only, per ARCHITECTURE §6.
   - The env vars JWT_PRIVATE_KEY / JWKS / SITE_URL are ALREADY set on the dev deployment by the runner. Verify with `npx convex env list` (show names only) and do NOT regenerate them.
   - Write `convex/auth.ts`, `convex/auth.config.ts` and `convex/http.ts`.
   - `convex/lib/auth.ts`: `getViewer`, `requireUser`, `requireRole`, `assertCanEditListing`.
   - Invites: an admin creates an invite; the acceptance page (built in step 08) uses flow `signUp` with the invite token; `createOrUpdateUser` validates the invite.
   - Internal action `seed:createAdmin`. Run it with the credentials in `night-run/state/admin.json`:
     `npx convex run seed:createAdmin '{"email":"…","password":"…","name":"…"}'`
     Build the JSON from the file with a small node one-liner so the password never appears in committed files.
3. **Functions** (`convex/*.ts`), with validators and auth everywhere:
   - **Public queries:**
     - `listings.search` (filters from PRD A3, sort, cursor pagination, returns card DTOs)
     - `listings.mapPoints` (same filters → lightweight points)
     - `listings.bySlug` (detail DTO, public fields only, approximate coords when needed)
     - `listings.featured`, `listings.similar`, `listings.byIds` (favorites/compare)
     - `locations.tree`, `locations.bySlug` (+ counts)
     - `agents.list/bySlug`, `posts.list/bySlug`, `pages.get`, `settings.public`, `testimonials.verified`
   - **Public mutations** (rate-limited with `@convex-dev/rate-limiter` + honeypot + zod-like validation): `leads.createInquiry`, `leads.createValuation` (computes the indicative range server-side), `leads.createSeller`, `leads.createGeneral`, `viewings.request` (checks the slot is free), `stats.trackView` (dedupe by a client-generated session key, max 1 per listing per session).
   - **Admin:** full CRUD + workflow for listings (create/update/publish with the server-side checklist from PRD B3/unpublish/status/duplicate/delete), media (generateUploadUrl, attach, reorder, update meta, remove + storage delete), tour scenes, leads (list/filter/kanban move/assign/notes), viewings, contacts (dedupe, export, anonymize), users/invites/roles, agents, locations, posts, pages, testimonials, settings, stats/analytics aggregates, activity log (write via helper `logActivity(ctx, …)` on every admin mutation), demo purge.
   - Cron (`convex/crons.ts`): daily unpublish of listings whose mandate expired (log activity); hourly recompute of lightweight dashboard counters if needed.
4. **Search implementation.**
   - Respect the Convex limits (see ARCHITECTURE §12). Use the best index for the primary filter (status + city/type/price), post-filter the rest inside a bounded loop, and paginate with cursors.
   - Write the strategy + limits into DECISIONS.md.
   - Add convex-test unit tests for filter correctness on a small fixture.
5. **Seed** (`convex/seed/*`, internal, idempotent; `force` wipes `isDemo` only). It creates:
   - settings: company placeholders clearly marked, e.g. PIB "000000000", Registar posrednika "000" → editable
   - locations:
     - Belgrade municipalities and neighborhoods with realistic 2026 avg €/m² for sale/rent: Vračar, Stari grad/Dorćol, Savski venac/Senjak/Dedinje/Beograd na vodi, Novi Beograd (blokovi), Zemun, Voždovac, Zvezdara, Palilula, Čukarica/Banovo brdo
     - Novi Sad, Niš, Kragujevac, Subotica, Zlatibor, Kopaonik
   - 4 demo agents (monogram avatars, fictional contacts per 04-CONTENT)
   - **30 listings**:
     - a realistic mix: apartments of every structure, 3 penthouses, 4 houses/villas, 2 commercial, 1 land, 4 rentals, 3 new builds with VAT refund
     - 2 sold/rented, 2 reserved, the rest published; 6 featured
     - full 4-locale titles/descriptions/highlights written natively; realistic streets/areas
     - 6–10 photos each from `demo-media.json` by category (verify every URL with a HEAD request in a node script first; drop failures)
     - price history for some; mandate set; legal fields; POIs
   - 3 journal posts × 4 locales (buying guide for foreigners, neighborhoods guide Vračar vs Dorćol, the VAT-refund explainer for first-time buyers)
   - pages/site content from 04-CONTENT (4 locales)
   - 3 testimonials `verified:false`
   - a few leads/viewings for the admin demo
6. **Verification.**
   - `npx convex run seed:all`
   - `npx convex run listings:search '{…}'` (show counts for 3 filter combos)
   - a Node script or Playwright test that signs in with the admin credentials through the real auth flow (the minimal login page from step 02 or a temporary test page) and calls an admin query successfully
   - an anonymous call to an admin mutation fails with an auth error
   - Use the `convex-auditor` agent to review auth/validators/indexes; fix its findings.

## Definition of done
- [ ] Schema + all functions are pushed with `npx convex dev --once` without errors.
- [ ] Seed run: ≥ 30 listings, ≥ 15 neighborhoods, 4 agents, 3 posts; every image URL is verified.
- [ ] The admin sign-in round-trip works (evidence shown); an unauthorized admin call is rejected (evidence).
- [ ] The rate limiter is active on public mutations (a test shows the limit).
- [ ] convex-test tests for search filters and auth pass.
- [ ] `npm run verify` exits 0.
- [ ] DECISIONS.md is updated (search strategy, invite flow).
- [ ] PROGRESS.md, done file and commit made per the protocol.
