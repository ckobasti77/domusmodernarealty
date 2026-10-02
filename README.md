# Mihajlo Estate

Website and admin panel for a real-estate agency in Serbia (Belgrade first).

- **Public site** in four languages: Serbian Latin (`/sr`, default), English (`/en`), Russian (`/ru`) and German (`/de`). It covers search with a map, listing pages (gallery, floor plans, 360° tour, 3D walkthrough, calculators, viewing booking), valuation and "sell with us" funnels, locations, agents, journal, favorites, compare and the legal pages.
- **Admin panel** in Serbian at `/admin`, invite-only. It covers listings with media, translations, legal and brokerage-contract fields and a publish checklist. It also has the leads inbox and pipeline, viewings, contacts and consent, the team and roles, locations, the journal, site content, settings, analytics, the activity log and demo-data removal.

The product requirements are in `docs/01-PRD.md` and the architecture is in `docs/02-ARCHITECTURE.md`. Read `CLAUDE.md` before changing anything: it lists the hard rules, for example the Art. 18 brokerage-law fields, no fabricated testimonials and the motion rules.

## Stack

Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript (strict) · Tailwind CSS 4 · Convex 1.46 (database, functions, file storage, crons) with `@convex-dev/auth` (password, invite-only) and `@convex-dev/rate-limiter` · next-intl 4 (localized pathnames) · GSAP 3.15 + Lenis (public site only) · shadcn/ui + TanStack Table + react-hook-form/zod (admin) · MapLibre GL 6 + OpenFreeMap tiles · Photo Sphere Viewer 5 · three.js + Spark 2 (Gaussian splats) · Playwright + Vitest/convex-test.

## Setup

Requirements: Node 22 and npm.

```bash
npm install
npx playwright install chromium   # only for e2e tests and screenshots
```

`.env.local` (never committed; start from `.env.example`) holds the Convex connection:

| Variable | Purpose |
|---|---|
| `CONVEX_DEPLOYMENT` | Deployment used by `npx convex dev` (written by it) |
| `NEXT_PUBLIC_CONVEX_URL` | Convex client URL (public site and admin; written by `npx convex dev`) |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions URL. `npx convex dev` writes it; the app does not read it |
| `NEXT_PUBLIC_SITE_URL` | Absolute site origin for canonical URLs, sitemap and share images. Defaults to `http://localhost:3000`; a Vercel production build falls back to `VERCEL_PROJECT_PRODUCTION_URL` and fails without either |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Optional: an admin on the dev deployment for the admin e2e specs (otherwise they read `night-run/state/admin.json`) |

The server secrets are Convex environment variables (`npx convex env list`): `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`.

- **New deployment:** run `npx @convex-dev/auth` (add `--prod` for production). It generates the key pair and sets all three; then set `SITE_URL` to the public origin with `npx convex env set SITE_URL https://…`.
- **Existing deployment:** do not regenerate the keys on a deployment that has users, or every session is signed out.

### Data

```bash
npx convex dev --once                          # push schema + functions, regenerate convex/_generated
npx convex run seed:all '{}'                   # idempotent demo data (~30 listings, 4 locales)
npx convex run seed:all '{"force":true}'       # rebuild demo data; removes ONLY isDemo records
```

Every demo record carries `isDemo: true`. **Admin → Demo sadržaj** deletes all of them in one step.

### First admin

There is no public sign-up. Create the first admin with an internal action. Keep the password out of the shell history by putting the arguments in a file outside the repository:

```bash
# ~/me-admin.json: {"email":"you@example.com","password":"<12+ characters>","name":"Ime Prezime"}
node -e "process.stdout.write(require('fs').readFileSync(require('os').homedir()+'/me-admin.json','utf8'))" \
  | xargs -0 npx convex run seed:createAdmin
```

Further staff members are invited from **Admin → Tim**. The invite link expires and works once.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000. Copies the MapLibre worker first. |
| `npm run verify` | **The gate:** Convex push → `next typegen` → `tsc` → eslint → `npm run check` → `next build`. Must exit 0. |
| `npm run check` | The repo checks: `i18n:check`, `scripts/audit-convex.mjs`, `scripts/check-cn-tables.mjs` and the unit suite |
| `npm run test:unit` | Vitest: pure modules in `lib/` plus Convex functions through convex-test in `convex/tests/` (seconds) |
| `npm run test:e2e` | Playwright on desktop 1440 and Pixel 7 against `npm run start` (see below) |
| `npm run i18n:check` | The four `messages/*.json` files must have identical key sets |
| `npm run cn:tables` | Regenerates `lib/cn-tables.ts`, the conflict tables `cn()` uses. Re-run it after adding a theme token or a new kind of utility class; `check-cn-tables` fails while it is stale, and stale tables silently drop classes |
| `npm run typecheck`, `npm run lint`, `npm run typegen`, `npm run convex:once` | The individual steps of `verify` |
| `npm run media:optimize` | Converts the owner's renders in `media-src/` into `public/media/` |
| `node scripts/audit-convex.mjs` | Static gate over every Convex function: validators, `requireRole`, rate limits, no `Date.now()` in queries, no `.collect()` |
| `node scripts/shots.mjs --routes /sr,/sr/nekretnine --widths 390,1440` | Screenshots into `.shots/` (`scripts/admin-shots.mjs` for admin screens). In Git Bash prefix the command with `MSYS_NO_PATHCONV=1`. |
| `node scripts/seo-audit.mjs`, `node scripts/validate-jsonld.mjs`, `node scripts/qa-matrix.mjs --axe`, `node scripts/lighthouse.mjs`, `node scripts/vitals.mjs` | SEO, structured-data, route × locale × viewport, Lighthouse and Web Vitals audits. They need a production server on :3000. |
| `node scripts/check-bundle-isolation.mjs` | After a build: fails if a route's entry chunks contain Photo Sphere Viewer, three.js or Spark |
| `node scripts/fetch-demo-tours.mjs`, `node scripts/verify-demo-media.mjs` | Rebuild the demo panoramas; HEAD-check every demo photo URL |

### End-to-end tests

1. `npm run build`. The suite tests the production build, and `tests/e2e/global-setup.ts` refuses to start when `.next` is missing or older than the sources. `E2E_ALLOW_STALE_BUILD=1` skips that check.
2. Stop any old server on :3000. Playwright starts `npm run start`, but it reuses whatever is already listening.
3. The dev deployment must hold the demo data (`seed:all`). Specs use the showcase listings ME-1042, ME-1048 and ME-1049.
4. Admin specs need an admin account: `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`, or `night-run/state/admin.json`.

Test data uses the `[E2E]` title prefix and `e2e+…@mihajlo-estate.local` addresses and is purged by the specs.

## Layout

```
app/[locale]/…        public site (root layout #1; route folders use English names, URLs are localized)
app/admin/…           admin (root layout #2; client-rendered, gated by Convex Auth)
components/site|motion|map|tours|forms   public UI
components/admin|ui   admin UI (shadcn in components/ui)
convex/               schema, public queries/forms, *Admin.ts staff functions, lib/ helpers, seed/, tests/
i18n/                 next-intl routing (localized pathnames) and request config
lib/                  formatting, SEO/JSON-LD, CSP, search params, calculators, stores
messages/             UI strings: sr-Latn, en, ru, de
tests/e2e/            Playwright specs
scripts/              build helpers and audit tools
docs/                 brief, PRD, architecture, design system, content, decisions, progress, reports
```

There is deliberately no `app/layout.tsx` and no `app/page.tsx`. The proxy (`proxy.ts`) redirects `/` to the visitor's locale and rewrites `/sr` to the `sr-Latn` segment.

## Security model

- Every staff Convex function calls `requireRole()` from `convex/lib/auth.ts`. Agents can edit only their own listings, leads and viewings. The admin UI is a convenience, not the boundary.
- Public queries return only published, public data through the DTOs in `convex/lib/dto.ts`. The brokerage contract, the owner contact, preview tokens and exact coordinates (unless the listing's address visibility is "exact") never leave the server.
- Public forms (inquiry, viewing, valuation, sell, contact) require privacy consent and pass a honeypot check. They are rate-limited per session, per e-mail address and globally.
- The CSP and the other security headers are defined in `lib/csp.ts`.

## Known constraints

- **Search scale:** search, counts and map points read bounded index windows (`convex/lib/search.ts`): when a count's 600-document window runs out it is shown as "N+", and the map shows at most 500 points. Past roughly 500 listings per transaction a slimmer search projection table is the next step (see `docs/DECISIONS.md`).
- **Bot protection:** public forms are rate-limited and carry a honeypot. Turnstile (or another challenge) is not wired because it needs keys.
- **Maps:** tiles come from OpenFreeMap with no key and no SLA. Every map has an "unavailable" fallback.
- **HSTS** is sent only when `VERCEL_ENV=production`.
- **`/styleguide`** is public but `noindex` and disallowed in `robots.txt`.
- **404 pages:** `notFound()` pages are server-rendered as Next's error shell (status 404, `noindex` and the localized title are correct; the UI paints on the client). See DECISIONS [13].
- **Legal data:** the broker-registry number, PIB and MB in **Podešavanja** are demo placeholders until the owner enters the real ones. They are required before go-live (Art. 18).

## Deployment

Production is not set up yet. It is planned as Vercel plus a Convex production deployment. Set `NEXT_PUBLIC_SITE_URL`, create the production deployment's auth keys and `SITE_URL`, create the first admin with `seed:createAdmin`, and enter the real company data (PIB, MB, broker-registry number) in **Podešavanja**. Until those are entered, the settings count as demo data. Large 3D scans belong on external storage such as Cloudflare R2 (see `docs/06-3D-TOURS.md`).
