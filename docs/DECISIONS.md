# Decisions log (append-only)

Format: `- YYYY-MM-DD [step] Decision. Why.`

- 2026-09-27 [prep] Agency site (staff-only publishing), locales sr-Latn(/sr)/en/ru/de, Editorial luxury design, brand "Mihajlo Estate", market Serbia with Belgrade focus, 3D tours as beta now. Agreed with owner.
- 2026-09-27 [prep] Auth = @convex-dev/auth Password, invite-only, client-side ConvexAuthProvider in /admin; server-side requireRole() in every admin function. Why: project's official convex-auth skill documents it; no third-party dashboard setup needed overnight; admin needs no SSR.
- 2026-09-27 [prep] Maps = MapLibre 6 + OpenFreeMap (no API key). Why: works unattended, free, commercial OK.
- 2026-09-27 [prep] Demo images = remote Unsplash URLs (verified list), admin uploads = Convex storage. Why: zero egress for demo, real photos.
- 2026-09-27 [prep] Heavy 3D assets: accept URL or upload now; recommend Cloudflare R2 for production. Why: Convex upload POST 2-min timeout + egress cost.
- 2026-09-27 [prep] Two root layouts (app/[locale] public, app/admin) instead of one app/layout. Why: different html lang, providers, no Lenis/GSAP in admin.
- 2026-09-28 [02] `cn` lives in `lib/utils.ts` (re-export of the `cn` package that shadcn's radix-nova style installs); no separate `lib/cn.ts`. Why: shadcn's `@/lib/utils` alias is hard-coded in every generated component, and two files for one helper is dead weight.
- 2026-09-28 [02] next/font CSS variables are named `--font-display-family` / `--font-sans-family` / `--font-mono-family`, and the Tailwind `@theme` keys `--font-display` / `--font-sans` / `--font-mono` wrap them with fallbacks. Why: identical names would make the theme variable reference itself.
- 2026-09-28 [02] shadcn semantic variables (`:root` / `.dark`) were re-themed to the brand palette instead of keeping neutral defaults, and the admin `<body>` carries `class="admin"`. Why: DESIGN 7 asks for a paper/ivory/ink admin with a bronze primary; `--primary` uses `--color-bronze-deep` #8C6D3F (4.67:1 on paper) rather than `--color-bronze` #B08D57, which fails AA.
- 2026-09-28 [02] The `form` component does not exist in the shadcn radix-nova registry (the registry item ships no files). `components/ui/form.tsx` was taken from the canonical `new-york-v4` style with its label import repointed at `@/components/ui/label`. Why: react-hook-form + zod forms are required from step 07 on.
- 2026-09-28 [02] `hooks/use-mobile.ts` (shadcn-generated) and `hooks/useReducedMotion.ts` read their media queries through `useSyncExternalStore`. Why: the project's eslint config enables `react-hooks/set-state-in-effect`, which rejects shadcn's shipped implementation, and the store version is also correct on the first client render.
- 2026-09-28 [02] `next-intl/proxy` does not exist in next-intl 4.14.7 (checked `node_modules/next-intl/package.json` exports), so `proxy.ts` uses `createMiddleware` from `next-intl/middleware`.
- 2026-09-28 [02] `public/media/**` is 35 MB after `media:optimize`, above the plan's 30 MB soft target. Why accepted: three owner-delivered 8 s 1080p videos each ship mp4 + webm + 720p + poster; H.264 CRF 26 lands every mp4 at 4.0-5.3 MB (inside the 3-6 MB band) and VP9 CRF 40 makes each webm smaller than its mp4. Cutting further would visibly hurt the hero, which is the LCP element.
- 2026-09-28 [02] `card.rooms`, `compare.limitReached` and `listing.viewGallery` were rewritten as ICU plurals in all four locales. Why: the Serbian source hard-coded the `few` form, so "1 sobe" / "5 sobe" would have rendered. Flagged independently by all three translator agents.
- 2026-09-28 [02] `/public/maplibre/` is gitignored. Why: `predev`/`prebuild` regenerate it from `node_modules/maplibre-gl/dist`, so committing it would only create churn.
