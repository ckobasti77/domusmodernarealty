@AGENTS.md

# Mihajlo Estate: project memory

Premium real-estate **agency** website plus a full admin panel for "Mihajlo Estate" (working name, editable in admin). The market is all of Serbia, with Belgrade as the primary focus.

- The public site is in 4 languages: `sr-Latn` (default, URL prefix `/sr`), `en`, `ru`, `de`.
- The admin panel is in Serbian (Latin script), at `/admin`.
- Only the agency team publishes listings. Visitors search, save favorites, send inquiries, book viewings, request valuations and submit their property for sale.

## Source of truth (read what's relevant before you change anything)
| File | What it holds |
|---|---|
| `docs/00-BRIEF.md` | Decisions already made with the owner, scope, priorities |
| `docs/01-PRD.md` | Every feature with acceptance criteria (public site + admin) |
| `docs/02-ARCHITECTURE.md` | Stack + pinned versions, folder layout, routes, Convex data model, auth, i18n, maps, media, SEO |
| `docs/03-DESIGN-SYSTEM.md` | "Editorial luxury" visual language, tokens, typography, motion choreography |
| `docs/04-CONTENT.md` | Brand voice, Serbian copy, glossary sr/en/ru/de, legal/compliance texts |
| `docs/05-RESEARCH.md` | Competitor research and best practices (why things are the way they are) |
| `docs/06-3D-TOURS.md` | 360° tour + Gaussian-splat walkthrough plan |
| `docs/assets/demo-media.json` | VERIFIED demo photo/panorama/splat URLs. Never invent image URLs. |
| `docs/IMPLEMENTATION-PLAN.md` | Refined plan written by night-run step 01 |
| `docs/PROGRESS.md` | Append-only log of what each step did |
| `docs/DECISIONS.md` | Append-only log of non-obvious decisions (date, decision, why) |

If docs conflict: PRD > ARCHITECTURE > DESIGN-SYSTEM > IMPLEMENTATION-PLAN > anything else.

## Stack (pinned; do not swap libraries)
- **App:** Next.js 16.3 App Router, React 19.2, TypeScript strict. Read `node_modules/next/dist/docs/` for any Next API you are unsure of (see AGENTS.md).
- **Styling:** Tailwind CSS v4 (CSS-first `@theme` tokens in `app/globals.css`). No other CSS framework.
- **Backend:** Convex 1.46 (database, functions, file storage, scheduler, crons). Auth is `@convex-dev/auth` with the Password provider, invite-only.
- **i18n:** next-intl 4 with localized pathnames. Locales `sr-Latn`, `en`, `ru`, `de`.
- **Motion (public site only):** GSAP 3.15 (all plugins are free: ScrollTrigger, SplitText, Flip, CustomEase…), `@gsap/react` `useGSAP`, Lenis 1.3.
- **Admin UI:** shadcn/ui (Radix base), TanStack Table v8, react-hook-form + zod 4, sonner, dnd-kit.
- **Maps:** MapLibre GL JS 6 + `@vis.gl/react-maplibre` + OpenFreeMap vector tiles (no API key).
- **Immersive:** Photo Sphere Viewer 5 (360° tours), Spark 2 (`@sparkjsdev/spark`) + three.js (splat walkthrough).
- **Tests:** Playwright (e2e + screenshots), convex-test / vitest where useful.

## Commands
- `npm run verify` runs Convex push, `next typegen`, `tsc`, eslint and `next build`. **It must exit 0 before you finish any task.**
- `npx convex dev --once` pushes schema/functions to the DEV deployment and regenerates `convex/_generated`.
- `npx convex run <file>:<fn> '<json>'` runs a function (seeding, admin bootstrap).
- `npm run dev` starts dev on :3000. Start it in the background only when you need it, and **stop it before you finish**.
- `npm run test:e2e` runs Playwright. `node scripts/shots.mjs` saves screenshots to `.shots/` (read them with the Read tool to review visuals).
- Windows machine: the Bash tool is Git Bash, so use forward slashes. Quote JSON args to `convex run` with single quotes.

## Hard rules
- Never `git push`, never deploy (`convex deploy`, `vercel`), never touch a production deployment. Dev deployment only.
- Never commit secrets. `.env.local` stays uncommitted. Server secrets live in Convex env vars (`npx convex env set`).
- Never modify `night-run/` (runner, steps, prompts). The only exception is writing your own `night-run/state/steps/<ID>.done.md`.
- Never fabricate: no fake testimonials, reviews, awards, sales statistics or agent identities presented as real.
  - Demo records carry `isDemo: true` and are removable from admin in one click.
  - Public testimonials render only when `verified: true`.
  - Agents without a real photo get a monogram avatar, never a stock face.
- Every public listing must satisfy Serbian brokerage law, Art. 18:
  - Show the agency name and its broker-registry number ("Registar posrednika").
  - Show price, location, area and room structure.
  - Admin blocks publishing unless a brokerage contract ("ugovor o posredovanju") is recorded.
- Lenis and heavy GSAP never run in `/admin`. Maps, 360° and 3D viewers get `data-lenis-prevent`.
- Respect `prefers-reduced-motion` everywhere (use `gsap.matchMedia()`; don't mount Lenis when reduced).
- Do not use `text-wrap: balance` / Tailwind `text-balance` on elements split by SplitText.
- Motion house rule: GSAP owns scroll choreography and hero/section reveals on public pages. UI micro-interactions (hover, menus, toasts, admin) use CSS transitions ≤ 300 ms (Emil Kowalski's guidance).

## Conventions
- Server Components by default; `"use client"` only at interactive leaves. Keep client bundles small, and load maps / 3D / lightbox with `next/dynamic` + `ssr:false` inside client components.
- Folders:
  - `app/[locale]/…` is the public site (root layout #1).
  - `app/admin/…` is the admin (root layout #2, no locale).
  - `components/site/*`, `components/admin/*`, `components/ui/*` (shadcn), `components/motion/*`, `components/map/*`, `components/tours/*`.
  - `lib/*` (formatters, seo, utils), `i18n/*` (routing, request), `messages/{sr-Latn,en,ru,de}.json`, `convex/*`.
- Formatting:
  - Money is EUR, formatted per locale with `Intl.NumberFormat` (sr-Latn: `125.000 €`).
  - Area is `m²`. Always show €/m² next to the price.
- Accessibility: semantic HTML, visible focus, WCAG AA contrast, alt text everywhere (alt is per-locale for listing photos).
- Commits: conventional commits (`feat(site): …`, `fix(admin): …`). Commit after each coherent chunk.

## Convex rules (also read `convex/_generated/ai/guidelines.md` and the `convex*` skills)
- Every function has arg validators. Public queries return only published, non-private data.
- **Every admin query/mutation calls `requireRole(ctx, [...])` from `convex/lib/auth.ts`.**
- Use indexes (`withIndex`) instead of `.filter` on tables that grow. Paginate lists.
- Text search uses the `search_text` search index over a normalized `searchText` field (diacritics folded: č→c, ć→c, š→s, ž→z, đ→dj). Price/area ranges use regular indexes.
- Public forms (inquiry, viewing, valuation, sell) go through mutations with rate limiting (`@convex-dev/rate-limiter`) and a honeypot field.
- Images:
  - Admin uploads go to Convex file storage (`generateUploadUrl`).
  - Demo images are remote Unsplash URLs from `docs/assets/demo-media.json`.
  - The `images` array stores `{ kind: "storage", storageId } | { kind: "url", url }` plus metadata.

## i18n rules
- All UI strings live in `messages/*.json`, and the key sets must be identical across the 4 files (`npm run i18n:check`).
- Listing and CMS content is stored per locale: `{ "sr-Latn": string, en?: string, ru?: string, de?: string }`. Fall back to `sr-Latn` when a translation is missing, and mark it with `lang` for SEO.
- Russian needs Cyrillic glyphs, so fonts must load the `cyrillic` + `latin-ext` subsets.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
