# Step 02: Foundation

**Read:** docs/02-ARCHITECTURE.md (all), docs/03-DESIGN-SYSTEM.md §1–3, docs/IMPLEMENTATION-PLAN.md (step 02).
**Skills:** `shadcn`, `vercel-react-best-practices`, `gsap-react`, `gsap-frameworks`, `convex` (read before use).

## Tasks
1. **Dependencies.** Install everything in ARCHITECTURE §1 (runtime + dev) with npm. Pin exact versions for 0.x packages. Run `npx playwright install chromium`. Don't bump next/react.
2. **shadcn/ui.**
   - `npx shadcn@latest init -b radix -p nova -y`, then add: button input label textarea select checkbox switch radio-group dialog sheet dropdown-menu tabs table badge card separator skeleton tooltip popover command calendar avatar scroll-area alert-dialog breadcrumb sidebar sonner form toggle-group progress.
   - Make sure shadcn's CSS lives in harmony with our tokens (admin theme per DESIGN §7).
3. **Root layouts.**
   - Delete the create-next-app boilerplate (app/page.tsx, app/layout.tsx, public/*.svg).
   - Create `app/[locale]/layout.tsx` (public root: html lang per locale, fonts, providers, `generateStaticParams` for locales) and `app/admin/layout.tsx` (admin root, Serbian, `noindex`).
   - Handle not-found for both. Read the Next docs on multiple root layouts and `global-not-found`.
4. **i18n.**
   - `i18n/routing.ts` with the full localized `pathnames` table from ARCHITECTURE §4, plus `i18n/request.ts` (`next/root-params`) and `i18n/navigation.ts` (`createNavigation`).
   - `proxy.ts` (excludes /admin, /api, files).
   - `messages/{sr-Latn,en,ru,de}.json` with namespaces (common, nav, footer, home, search, listing, forms, legal, admin is NOT here).
   - `scripts/i18n-check.mjs` (exits 1 when key sets differ) + npm script `i18n:check`.
5. **Fonts.** Cormorant Garamond, Manrope, JetBrains Mono via `next/font/google` with subsets `latin`, `latin-ext`, `cyrillic`, exposed as CSS variables.
6. **Tailwind tokens.** Put all DESIGN §1–2 tokens in `app/globals.css` (`@theme`: colors, fonts, fluid type scale utilities, spacing rhythm, ease variables). Admin theme variables go under an `.admin` scope.
7. **Providers.**
   - `components/providers/ConvexClientProvider.tsx` (public).
   - Admin providers placeholder, ready for ConvexAuthProvider in step 03.
   - `components/motion/gsap.ts`: register ScrollTrigger, SplitText, Flip, CustomEase once; create CustomEase "estate".
   - `components/motion/SmoothScroll.tsx` (Lenis per ARCHITECTURE §3, reduced-motion aware, public only).
   - `hooks/useReducedMotion.ts`.
8. **next.config.ts.** images (remotePatterns + qualities), security headers with CSP from `lib/csp.ts` (ARCHITECTURE §10), `experimental` flags only if the docs require them.
9. **Scripts.**
   - `scripts/copy-maplibre-worker.mjs` + `predev`/`prebuild` hooks.
   - `scripts/optimize-media.mjs`: if `media-src/` has files, produce optimized outputs in `public/media/` (ARCHITECTURE §7) using sharp + ffmpeg-static. Idempotent, skips up-to-date outputs. npm script `media:optimize`.
   - Run it now: it is a no-op if `media-src/` is empty.
   - Keep the existing `scripts/shots.mjs` (already provided) working. Add npm script `shots`.
10. **Testing.** `playwright.config.ts` (webServer: `npm run start` on :3000 after build, or reuse an existing server), `tests/e2e/smoke.spec.ts`:
    - `/` redirects to `/sr`
    - each locale home returns 200 with the correct `<html lang>`
    - `/admin/login` renders
    - no console errors
11. **Placeholder pages.** Minimal but on-brand `app/[locale]/page.tsx` (hero headline in the display font, locale switcher), so the fonts and Cyrillic can be checked in screenshots for `/ru`.
12. **.gitignore.** Make sure it has: `.shots/`, `test-results/`, `playwright-report/`, `media-src/*` (keep `media-src/.gitkeep`), `night-run/logs/`, `night-run/state/*.json`, `.auth-keys.json`.

## Definition of done
- [ ] `npm run verify` exits 0.
- [ ] `npm run i18n:check` passes.
- [ ] `npm run test:e2e` smoke passes.
- [ ] Screenshots of `/sr` and `/ru` at 390 and 1440 show the correct fonts (Latin-ext and Cyrillic glyphs render in both families).
- [ ] `/admin/login` renders inside the admin root layout (no Lenis, no public header).
- [ ] No boilerplate left.
- [ ] PROGRESS.md, done file and commit made per the protocol.
