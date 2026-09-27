# Decisions log (append-only)

Format: `- YYYY-MM-DD [step] Decision. Why.`

- 2026-09-27 [prep] Agency site (staff-only publishing), locales sr-Latn(/sr)/en/ru/de, Editorial luxury design, brand "Mihajlo Estate", market Serbia with Belgrade focus, 3D tours as beta now. Agreed with owner.
- 2026-09-27 [prep] Auth = @convex-dev/auth Password, invite-only, client-side ConvexAuthProvider in /admin; server-side requireRole() in every admin function. Why: project's official convex-auth skill documents it; no third-party dashboard setup needed overnight; admin needs no SSR.
- 2026-09-27 [prep] Maps = MapLibre 6 + OpenFreeMap (no API key). Why: works unattended, free, commercial OK.
- 2026-09-27 [prep] Demo images = remote Unsplash URLs (verified list), admin uploads = Convex storage. Why: zero egress for demo, real photos.
- 2026-09-27 [prep] Heavy 3D assets: accept URL or upload now; recommend Cloudflare R2 for production. Why: Convex upload POST 2-min timeout + egress cost.
- 2026-09-27 [prep] Two root layouts (app/[locale] public, app/admin) instead of one app/layout. Why: different html lang, providers, no Lenis/GSAP in admin.
