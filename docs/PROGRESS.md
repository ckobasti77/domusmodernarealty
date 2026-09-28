# Progress log (append-only)

Each night-run step appends a section:

```
## Step NN - Title (YYYY-MM-DD HH:MM)
- Done: ...
- Files: ...
- Decisions: ... (details in DECISIONS.md)
- Known issues / follow-ups: ...
- Verify: npm run verify -> OK/FAIL
```

## Step 00 - Preparation (2026-09-28, by Claude in the planning chat)
- Research done (docs/05-RESEARCH.md, docs/06-3D-TOURS.md), decisions agreed with the owner (docs/00-BRIEF.md).
- Docs written: CLAUDE.md, docs/00-06, verified demo media list (docs/assets/demo-media.json: 90 Unsplash photos, 6 CC0 panoramas, 9 splats).
- Project skills added to .claude/skills (GSAP official, frontend-design, Vercel React best practices, web-design-guidelines, accessibility, seo, core-web-vitals, performance, shadcn, high-end-visual-design, Emil Kowalski animation skills). Custom subagents in .claude/agents.
- Night-run runner + prompts in night-run/.

## Step 02 - Foundation (2026-09-28 03:30)
- Done: installed the whole ARCHITECTURE 1 stack (runtime + dev, 0.x pinned exactly) and Playwright chromium; shadcn radix-nova init + 28 components (+ a hand-ported `form`); deleted every create-next-app artifact; built the two root layouts (`app/[locale]`, `app/admin`) plus `global-not-found`, `global-error` and per-root `not-found`/`error`; wired next-intl 4 (full localized pathnames table, `next/root-params` request config, `createNavigation`, `proxy.ts`); wrote all four `messages/*.json` (297 keys each) via three parallel i18n-translator agents; loaded Cormorant Garamond / Manrope / JetBrains Mono with latin + latin-ext + cyrillic; put every DESIGN 1-3 token into `app/globals.css` with the admin theme under `:root`/`.admin`; added `ConvexClientProvider`, `AdminProviders`, `components/motion/gsap.ts`, `SmoothScroll` (Lenis on the GSAP ticker) and `useReducedMotion`; `next.config.ts` with `globalNotFound`, image remotePatterns/qualities and the CSP from `lib/csp.ts`; four scripts (`i18n-check`, `copy-maplibre-worker`, `optimize-media`, existing `shots`) with npm scripts; Playwright config + a 10-case smoke spec; an on-brand placeholder landing page with a locale switcher and a glyph specimen.
- Files: `app/{fonts.ts,globals.css,icon.svg,global-error.tsx,global-not-found.tsx}`, `app/[locale]/{layout,page,not-found,error}.tsx`, `app/admin/{layout,not-found,error}.tsx`, `app/admin/login/page.tsx`, `i18n/{routing,request,navigation}.ts`, `proxy.ts`, `next.config.ts`, `lib/{csp.ts,utils.ts,media-manifest.json}`, `messages/*.json`, `components/{providers,motion,site,admin,ui}/*`, `hooks/{useReducedMotion.ts,use-mobile.ts}`, `scripts/{i18n-check,copy-maplibre-worker,optimize-media}.mjs`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `public/media/**`.
- Decisions: font variable naming, admin theming of the shadcn semantic vars, the missing radix-nova `form` item, `useSyncExternalStore` for media queries, `next-intl/middleware` (no `/proxy` export in 4.14.7), 35 MB of optimized media, ICU plural fixes in all four locales. Details in DECISIONS.md.
- Known issues / follow-ups: see night-run/state/steps/02.done.md.
- Verify: npm run verify -> OK (exit 0). i18n:check -> OK (297 keys x 4). test:e2e -> 20/20 passed.
