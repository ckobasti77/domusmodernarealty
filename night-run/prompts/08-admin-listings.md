# Step 08: Admin shell, dashboard, listings management

**Read:** docs/01-PRD.md B1–B3, B14; docs/02-ARCHITECTURE.md §3, §5, §6; docs/03-DESIGN-SYSTEM.md §7.
**Skills:** `shadcn`, `vercel-react-best-practices`, `accessibility`, `convex`, `convex-authz`, `emil-design-eng` (micro-interactions only).

## Tasks
1. **Auth UI.**
   - `/admin/login`: Editorial-styled card (Cormorant title "Mihajlo Estate · Admin"), email/password, errors, loading; ConvexAuthProvider in the admin layout.
   - `/admin/pozivnica/[token]`: invite acceptance, sets the password, flow signUp.
   - Sign out.
   - Gate: an unauthenticated visit to any `/admin/*` redirects to login; the role comes from `users.getMe`.
2. **Shell.**
   - shadcn Sidebar: Kontrolna tabla, Nekretnine, Upiti, Razgledanja, Kontakti, Lokacije, Magazin, Sadržaj sajta, Tim, Analitika, Aktivnost, Podešavanja, Demo sadržaj.
   - Items hidden per role. Top bar with command palette (⌘K: jump to listing by ref/title, create listing), "Pogledaj sajt", user menu. Breadcrumbs. Light theme default + dark toggle. Toasts (sonner).
3. **Dashboard:** KPI cards, 30-day views/leads chart (lightweight SVG or Recharts, lazy), to-do lists (uncontacted leads > 1h, listings missing floor plan / < 8 photos / missing translations, mandates expiring in 14 days), recent activity.
4. **Listings table** (`/admin/nekretnine`): TanStack Table v8 (shadcn data-table pattern). Columns, filters, search, status tabs, pagination, row actions and bulk actions per PRD B3.
5. **Listing editor** (`/admin/nekretnine/nova`, `/admin/nekretnine/[id]`) with the 9 tabs from PRD B3:
   - react-hook-form + zod (one schema shared with the Convex validators where possible), autosave drafts (debounced), a dirty-state guard, keyboard save (Ctrl+S).
   - **Lokacija:** cascading location selects + a MapLibre pin picker (click/drag; reuse the map components); optional Nominatim address search (≤ 1 req/s, custom User-Agent, attribution) behind a small button.
   - **Mediji:**
     - multi-file upload to Convex storage (`generateUploadUrl`), per-file progress, client-side dimension read, type/size validation;
     - dnd-kit sortable grid; cover star; room tag select; alt text per locale; delete with confirm;
     - floor plans section; video URL.
   - **Opis:** 4-locale tabs with completeness indicators + a "Kopiraj iz srpskog" helper; character counts for SEO.
   - **360° / 3D:** fields only for now (provider, URL/ID, publish toggles). The scene editor comes in step 11.
   - **Pravno:** mandate fields. Show the publish checklist panel live (green/red items).
   - **Objava:** status workflow buttons with confirmation dialogs, duplicate, a preview link (`/sr/nekretnine/<slug>?preview=<token>`; the public route honors a signed preview token for staff), and the price change log.
6. **Demo content panel** (PRD B14) with typed confirmation.
7. **Tests (Playwright, admin creds from `night-run/state/admin.json`):**
   - login
   - create a listing
   - upload 3 images (fixtures in `tests/fixtures/`, generated with sharp)
   - fill the required fields
   - publish → visible publicly
   - unpublish → public 404
   - an agent-role user can't edit another agent's listing (create the second user through invite functions in the test setup)

## Definition of done
- [ ] Admin login/logout, invite acceptance and role gating work (tests).
- [ ] Listings table + editor (all 9 tabs) work; media upload/reorder/cover/alt work; the publish checklist enforces the rules server-side too.
- [ ] The create → publish → public → unpublish flow is proven e2e.
- [ ] Screenshots of the dashboard, table and editor (1440) are reviewed.
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
