# Step 04: Design system, UI kit, shell

**Read:** docs/03-DESIGN-SYSTEM.md (all), docs/04-CONTENT.md (voice), docs/05-RESEARCH.md (craft references).
**Skills (invoke in this order):**
1. `design-dna`: build a Design DNA from the references in DESIGN §0 and save it to `docs/design-dna.json`. Reconcile it with our tokens: our tokens win, and any additions go to DECISIONS.md.
2. `ui-ux-pro-max`: palette/typography/UX validation for "luxury real estate".
3. `frontend-design` + `design-taste-frontend` (or `high-end-visual-design`): anti-generic checklist.
4. `gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-performance` for motion primitives.
5. `emil-design-eng` + `animation-vocabulary` for micro-interactions.
6. `accessibility`.

## Tasks
1. **Tokens.** Finalize the tokens in `app/globals.css` (DESIGN §1–3). Check contrast AA for every text/background pair and fix values if needed (log it).
2. **Logo.** `components/site/Logo.tsx`: an SVG wordmark "MIHAJLO ESTATE" plus an "ME" monogram. Also the favicon/app icons (`app/icon.svg`, `apple-icon`), with the monogram on ink.
3. **Components** (DESIGN §4), in `components/site/*` and `components/motion/*`:
   - Button variants, TextLink, Eyebrow, SectionHeading (SplitText reveal), Container/Grid, Divider (hairline draw), Price (locale EUR + €/m²), Badge, PropertyCard (carousel, favorite), inputs/selects/checkbox/radio (underline style), Accordion, Tabs, Counter, Marquee, ImageReveal, ParallaxImage, CursorFollowerImage, MagneticButton, ScrollProgress.
   - All motion components use `useGSAP`, `gsap.matchMedia()` (desktop / mobile / reduced) and cleanup.
4. **Shell.**
   - Header (transparent → solid on scroll, mobile full-screen menu with staggered reveal, language switcher keeping the current route via next-intl navigation, favorites counter via a localStorage store with `useSyncExternalStore`).
   - Footer (legal data from `settings.public`, registry number, links, socials), cookie-consent banner (store, categories, opt-in; exposes `useConsent()`).
   - Page transition (ink wipe) that is reduced-motion aware.
   - Preloader (first visit per session) per DESIGN §6.1.
5. **Styleguide.** `/[locale]/styleguide` (noindex) showcasing every component and state: tokens, type scale in sr/ru/de sample text, buttons, forms with errors, cards (with real seed data), badges, motion demos.
6. **Screenshots + critique.**
   - Take screenshots of the styleguide and the placeholder home at 390/768/1440.
   - Run the `design-critic` agent on them. Fix everything rated high/medium, then repeat once.

## Definition of done
- [ ] `/sr/styleguide` and `/ru/styleguide` render all components; Cyrillic and diacritics are fine in both font families (screenshot evidence).
- [ ] The header/footer/mobile menu/language switcher/cookie banner work (a Playwright test covers the language switch keeping the route, and the cookie consent persisting).
- [ ] Reduced motion: motion components render final states instantly (test with Playwright `reducedMotion: 'reduce'`).
- [ ] The design-critic's second pass has no high-severity issues.
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
