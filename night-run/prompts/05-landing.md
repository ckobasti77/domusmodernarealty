# Step 05: Animated landing page (the showpiece)

**Read:** docs/03-DESIGN-SYSTEM.md §6 (section-by-section choreography; follow it), §4–5; docs/04-CONTENT.md (landing copy); docs/01-PRD.md A2; docs/05-RESEARCH.md (craft references).
**Skills:** `gsap-scrolltrigger`, `gsap-plugins` (SplitText), `gsap-timeline`, `gsap-react`, `gsap-performance`, `frontend-design`, `design-taste-frontend`/`high-end-visual-design`, `review-animations`, `core-web-vitals`. If present, also `scroll-world`, `3d-scrollytelling`, `motion-design`, `impeccable` for ideas.

## Media first
1. Check `media-src/`. If the owner's AI renders are there (hero video / hero images / 3D-tours visual / sell / valuation / about images):
   - run `npm run media:optimize`;
   - wire the optimized files: hero MP4 + WebM + mobile version + poster; responsive AVIF/WebP images.
   - Name mapping: guess by filename/aspect ratio/content, and look at them with Read to confirm. Record the mapping in DECISIONS.md.
2. If `media-src/` is empty or incomplete, use the best-matching verified Unsplash photos from `docs/assets/demo-media.json` (hero: a dusk/blue-hour living room or Belgrade skyline).
   - Hero motion fallback: a slow GSAP Ken Burns effect (scale 1.12 → 1 over 12s, subtle drift).
   - Design the component so a video can be dropped in later without code changes (`public/media/hero/hero.mp4` if it exists → video, else image).

## Build the landing (`app/[locale]/page.tsx` + `components/site/home/*`)
- Implement all 13 sections from DESIGN §6 with real Convex data: featured listings, neighborhoods with counts, stats from settings, journal posts. Server-render the data and animate on the client.
- Use exactly the choreography described there. Desktop pins only at ≥ 1024px and with no reduced motion. The mobile branch has its own simpler, tuned animations. The reduced branch is static.
- The search bar (hero) routes to the localized search path with query params (next-intl `useRouter`).
- The valuation mini-form routes to `/procena` prefilled.
- Performance:
  - The poster image is the LCP with `preload`/`fetchPriority="high"`; the video loads after first paint with `preload="metadata"`.
  - GSAP/SplitText are only in client islands. No layout shift from the preloader or from font loading (`next/font` + fallback metrics).
  - Pause offscreen videos. Kill ScrollTriggers on unmount.
- Localize all copy (4 locales, native quality). The Serbian text is the source.

## Critique loop (mandatory)
1. Build (`npm run build && npm run start` in the background).
2. Take screenshots: `node scripts/shots.mjs --routes /sr --widths 390,768,1440 --scroll-steps 8` (captures multiple scroll positions after animations settle).
3. Send the screenshots to the `design-critic` agent, together with DESIGN §6 and the reference list. Implement every high/medium item.
4. Repeat steps 2–3 at least twice.
5. Check `/ru` and `/de` at 1440 (text lengths!).
6. Playwright: no console errors, and the page is fully usable with `reducedMotion: 'reduce'`.

## Definition of done
- [ ] All 13 sections are implemented and localized; the data comes from Convex.
- [ ] The hero uses owner media if present (mapping logged), else the verified Unsplash fallback with Ken Burns.
- [ ] Desktop / mobile / reduced-motion branches exist and have been checked in screenshots (evidence: list of files you viewed).
- [ ] Two critique iterations are done; the final critique has no high-severity issues.
- [ ] Lighthouse-style sanity: LCP element is the hero poster; no CLS from the preloader/fonts (explain how you verified).
- [ ] `npm run verify` exits 0; e2e smoke still passes.
- [ ] PROGRESS.md, done file and commit made per the protocol.
