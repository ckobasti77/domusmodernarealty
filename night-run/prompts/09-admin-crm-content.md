# Step 09: Admin CRM and content modules

**Read:** docs/01-PRD.md B4–B13; docs/02-ARCHITECTURE.md §5; docs/04-CONTENT.md (consent, legal).
**Skills:** `shadcn`, `convex`, `convex-authz`, `accessibility`, `vercel-react-best-practices`.

Parallelize: after you define the shared admin patterns (list page, detail sheet, form layout), use subagents for independent modules. Give each one exclusive folders, e.g. agent A owns `app/admin/(panel)/upiti` + `convex/leads.ts`, and agent B owns `magazin` + `convex/posts.ts`. You integrate and review.

## Tasks
1. **Leads (Upiti):**
   - list with filters + a kanban pipeline (dnd-kit), loss-reason dialog
   - lead detail sheet: timeline, notes, assign agent, next action date, linked listing, contact info, consent record, response timer
   - agents see only their own leads
2. **Viewings (Razgledanja):** week/day calendar (custom grid or a light library), list view, status changes, feedback, agent availability editor (weekly slots) used by the public booking.
3. **Contacts:** deduped list, detail with leads history + consent records, CSV export, anonymize action (logs activity).
4. **Team (Tim):** users + invites (create invite → copyable link `/admin/pozivnica/<token>`), role change, deactivate. Agent profile editor (photo upload, bio per locale, languages, phones, Viber/WhatsApp, areas, license ID, public toggle, order).
5. **Locations (Lokacije):** tree editor city → municipality → neighborhood; localized names/intro; cover image; avg €/m² sale/rent; centroid via the map picker; featured/order.
6. **Journal (Magazin):** posts list + editor (Tiptap with headings, lists, links, images from storage, quotes; per-locale tabs; cover; category/tags; author; schedule/publish; SEO). Sanitize on render.
7. **Site content (Sadržaj sajta):** editors for `pages` blocks per locale (home hero texts, intro, services, process, stats + isDemo flag, CTAs, FAQ, legal pages), plus testimonials (verified toggle).
8. **Settings (Podešavanja):** company legal data, contacts, socials, commission text per locale, general terms PDF upload, mortgage defaults, EUR/RSD rate, default SEO + OG image, analytics IDs (consent-gated).
9. **Analytics:** per-listing funnel, top listings, leads by source/type over time, agent response times, with lazy-loaded charts.
10. **Activity log:** filterable table (entity, user, date) with a diff viewer.
11. **Public site uses the managed content:** landing texts, stats, testimonials (verified only), legal pages and settings now come from `pages`/`settings`. Verify the landing still renders identically with the seed content.
12. **Tests:**
    - move a lead through the pipeline (activity logged)
    - create a post → visible on `/sr/magazin`
    - edit the hero text → visible on the landing
    - invite → accept → the new agent logs in with limited menu items
    - CSV export downloads

## Definition of done
- [ ] Modules B4–B13 are implemented and role-gated server-side.
- [ ] The public site reads the managed content (hero/stats/legal/settings) with no regressions (landing screenshots before/after).
- [ ] e2e tests for the flows above pass.
- [ ] The `convex-auditor` agent reviewed all new functions; high/medium findings are fixed.
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
