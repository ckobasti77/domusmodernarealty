# 03: Design system, "Editorial luxury"

The owner picked this direction: a dark cinematic hero, ivory and charcoal with a bronze accent, a large serif display face, and slow, confident motion. References: Sotheby's International Realty, The Agency, Aman, plus Awwwards real-estate winners (ERA Residence, Belgrade Arbor by Square43, Silver Pinewood, Luxury Places, Carlin Residence Club; see 05-RESEARCH.md).

**Quiet luxury means restraint.** One accent colour, generous whitespace, photography does the talking, motion feels like a camera move and never like a slot machine. Avoid the generic-AI look: no gradients-on-everything, no glassmorphism cards, no emoji, no pill soup, no random drop shadows, no bouncy easing.

## 1. Colour tokens (define in `app/globals.css` with Tailwind v4 `@theme`)
| Token | Value | Use |
|---|---|---|
| `--color-ink` | #0E0D0B | Dark sections, primary text on ivory |
| `--color-ink-2` | #171512 | Raised dark surface |
| `--color-ink-3` | #24211C | Borders/lines on dark (or ivory at 12% alpha) |
| `--color-ivory` | #F4EFE6 | Main light background |
| `--color-ivory-2` | #EAE3D6 | Light raised surface, cards |
| `--color-paper` | #FBF9F5 | Inputs, lightest surface |
| `--color-stone` | #8A8275 | Muted text on ivory (check AA: use ≥ 16px or darken to #6F685C for small text) |
| `--color-mist` | #B9B0A2 | Muted text on ink |
| `--color-bronze` | #B08D57 | The accent: links, active states, hairlines, key numbers. Never a large fill. |
| `--color-bronze-deep` | #8C6D3F | Accent hover / accent text on ivory (AA) |
| `--color-success` / `--color-danger` / `--color-warning` | #4F7A5A / #A4473A / #B7852F | Admin + form states only |

- Lines are 1px hairlines (`ivory/12%` on ink, `ink/12%` on ivory).
- Radius: 0–2px on public UI (architectural, sharp); admin uses 6px (shadcn default reduced).
- No box shadows on the public site. Depth comes from photography, overlap and scale.

## 2. Typography
- **Display serif:** EB Garamond via `next/font/google` (replaced Cormorant Garamond, whose latin-ext subset misplaces the caron on lowercase č/š/ž; DECISIONS [04]).
  - Weights 300, 400, 500 + italic; subsets `latin`, `latin-ext`, `cyrillic`.
  - Headlines, big statements, numbers in editorial blocks.
  - Tracking −1% to −2% at large sizes, `font-feature-settings: "liga","dlig"` sparingly.
- **Sans:** Manrope (variable 200–800; subsets `latin`, `latin-ext`, `cyrillic`).
  - UI, body, prices (`font-variant-numeric: tabular-nums lining-nums`).
- **Mono accents (optional):** JetBrains Mono 400 (`cyrillic`, `latin-ext`) for tiny labels such as coordinates, ref codes and step numbers. 11–12px uppercase, +8% tracking.
- **Fluid scale** (use `clamp`):

| Token | Size / leading |
|---|---|
| display-xl | clamp(3.5rem, 9vw, 9.5rem) / 0.92 |
| display-l | clamp(2.75rem, 6vw, 6rem) / 0.95 |
| display-m | clamp(2.25rem, 4.2vw, 4rem) / 1.0 |
| h2 | clamp(1.75rem, 2.6vw, 2.5rem) |
| h3 | 1.5rem |
| body-l | 1.125rem / 1.6 |
| body | 1rem / 1.6 |
| small | 0.875rem |
| eyebrow | 0.75rem uppercase, tracking 0.18em, Manrope 500 |

- Serbian Latin diacritics (č ć š ž đ), Cyrillic and German umlauts must render in both families. Test the styleguide in `ru`.

## 3. Layout
- 12-column grid, max width 1440px content (1600px for full-bleed media).
- Gutters: 24px mobile, 32px tablet, 48px desktop. Section vertical rhythm: 96px mobile, 160px desktop (large, deliberate).
- Asymmetric editorial compositions: offset image/text, overlapping captions, oversized numbers.
- Breakpoints: 390 (base), 768, 1024, 1280, 1440+.

## 4. Components (build in `components/site/*` and show every one on `/[locale]/styleguide`)
- **Buttons:**
  - Primary: ink on ivory / ivory on ink, sharp, 52px tall.
  - Hover: bronze hairline underline grows from left, text shifts 2px.
  - Secondary: outline hairline. Text link with animated underline.
  - "Magnetic" CTA only on desktop pointer devices.
- **Eyebrow + SectionHeading** (eyebrow, serif title with SplitText reveal, optional lede).
- **PropertyCard:**
  - 4:5 image on the landing, 3:2 in search.
  - Image scale 1.04 → 1 on hover over 700 ms.
  - Price in sans, tabular; €/m² muted; meta row with hairline dividers; badges as small uppercase text with hairline border (no filled pills); favorite icon.
- **ImageReveal** (clip-path inset reveal on scroll), **ParallaxImage** (yPercent ±8), **Marquee** (slow, pauses on hover), **Counter** (from 0, tabular numbers), **SplitReveal** (lines/words), **HairlineDraw** (SVG line draws on scroll), **CursorFollowerImage** (desktop hover reveal in lists).
- **Forms:** underline-style inputs on ivory, floating labels, clear error text, 44px min touch targets.
- **Price** component: EUR per locale + optional RSD conversion.
- **Logo:** wordmark "MIHAJLO ESTATE".
  - Cormorant Garamond 500 letterforms drawn as SVG paths (uppercase only, so the caron issue in DECISIONS [04] does not apply), letter-spacing 0.24em, uppercase, with a thin bronze rule or small "ME" monogram.
  - Deliver it as an inline SVG component + favicon/app icons (monogram).

## 5. Imagery
- Use `docs/assets/demo-media.json` only (verified URLs). Warm, natural light, architecture-forward, no people's faces.
- Dark sections: images get a subtle ink gradient (bottom 40%) for legibility. Never use text over busy photo areas without a scrim.
- Aspect ratios: hero 16:9 (mobile 9:16 or 4:5), cards 4:5 / 3:2, editorial pairs 3:4 + 4:3.

## 6. Landing page: sections and choreography
Desktop choreography is described first; **Mobile** gives the phone version.

1. **Preloader** (first visit per session only):
   - Ink screen, the wordmark letters rise with a mask (stagger 0.04), and a bronze hairline progress runs under it.
   - Then a curtain (the ink panel) slides up (`expo.inOut`, 1.1s), revealing the hero already in motion.
   - Max 1.8s total; skip on reduced motion or repeat visit.
2. **Hero** (100svh, ink):
   - Full-bleed video (poster first), 1.08 → 1 scale settle.
   - Eyebrow "Beograd · Srbija"; headline "Dom koji se pamti." as SplitText lines (`yPercent 110 → 0`, stagger 0.08, `expo.out` 1.2s).
   - Lede fades up; the search bar slides up with hairline borders.
   - Scroll cue (thin line animating down).
   - On scroll: the hero content drifts up slower (parallax) and the video darkens (overlay opacity 0.25 → 0.6).
   - **Mobile:** 9:16 poster/video, headline 3 lines, the search collapses into a single "Pretraži nekretnine" button opening a sheet.
3. **Intro statement** (ivory): one large serif paragraph revealing word by word (opacity 0.15 → 1 scrubbed), plus a small signature line.
   - **Mobile:** line-by-line fade, no scrub.
4. **Featured listings** (ivory):
   - Section heading + "Sve nekretnine →". Horizontal pinned scroll of 6 PropertyCards (desktop ≥ 1024). The track moves while the section is pinned; the cards' images parallax inside.
   - Progress hairline + counter "01 / 06".
   - **Mobile:** native horizontal snap carousel, no pin.
5. **Neighborhoods** (ink):
   - Big serif list (Vračar, Dorćol, Senjak, Dedinje, Novi Beograd, Beograd na vodi, Zemun, Novi Sad…) with the listing count in mono. Hovering a row reveals a cursor-following image (desktop).
   - Rows reveal with a hairline draw.
   - **Mobile:** stacked image cards.
6. **Services** (ivory): numbered editorial list (01 Kupovina, 02 Prodaja, 03 Zakup, 04 Procena, 05 3D ture, 06 Relokacija i dijaspora). Each row expands on hover/tap to show 2 lines + a link.
7. **3D tours teaser** (ink):
   - The 3D-tours visual/video from `public/media` (or a demo panorama), with a hairline frame that scales up as you scroll (pinned zoom).
   - Headline "Prošetajte pre nego što dođete."; CTA to a listing that has a demo tour.
8. **Process** "Kako prodajemo" (ivory): 5 steps along a vertical hairline that draws with scroll; step numbers in mono.
9. **Numbers** (ivory-2): 4 counters from settings (years, sold, clients, avg days to sell). Values are `isDemo` until edited.
10. **Valuation CTA** (ink, split layout): "Koliko vredi vaš stan?" plus a mini form (neighborhood + m²) → `/procena` with query params prefilled.
11. **Journal teaser** (ivory): 3 posts, editorial layout (1 large + 2).
12. **Testimonials:** hidden unless `verified` testimonials exist.
13. **Final CTA + footer** (ink): big serif "Razgovarajmo." with phone/Viber/WhatsApp/email, then the footer.

**Motion rules:**
- Eases: `expo.out` (reveals), `power3.out` (UI), `expo.inOut` (curtains). Define `CustomEase "estate"` ≈ `cubic-bezier(0.22, 1, 0.36, 1)`.
- Durations: reveals 0.9–1.4s, UI 0.2–0.3s, stagger 0.04–0.1.
- ScrollTrigger `start: "top 80%"` for reveals (once), scrub only for parallax/pins.
- Use `gsap.matchMedia()` with `(min-width:1024px) and (prefers-reduced-motion:no-preference)` for pins; the mobile branch uses simpler tweens; the reduced branch shows static content instantly.
- Never animate layout properties (only transform/opacity/clip-path). `will-change` only during the animation.
- Page transitions: an ink panel wipe (0.6s) on route change between public pages. Skip on reduced motion.

## 7. Admin look
- shadcn "nova" preset, re-themed: light mode default (paper/ivory surfaces, ink text, bronze primary), dark mode optional.
- Manrope for UI; EB Garamond only for the admin login title and dashboard greeting.
- Dense, efficient, keyboard-friendly tables. No Lenis, no GSAP; CSS transitions only (≤ 200 ms).

## 8. How to use the design skills (installed; use them, but these rules win on conflict)
| Skill | Use it for |
|---|---|
| `design-dna` | Before building the design system, generate a Design DNA JSON from the references above. Save it to `docs/design-dna.json` and reconcile it with these tokens. |
| `ui-ux-pro-max` | Validate palette contrast, typography pairing and UX patterns for real estate; run its search for "luxury real estate" (Python script; if Python is missing, read its data files directly). |
| `design-taste-frontend` / `high-end-visual-design` | Critique passes for premium feel. **Do not** blanket-animate everything, don't ban Lucide in admin, and keep reduced motion. |
| `frontend-design` | Anti-generic checklist during component work. |
| `gsap-*` | Every GSAP implementation (useGSAP, ScrollTrigger, SplitText, performance, frameworks). |
| `emil-design-eng`, `review-animations`, `improve-animations`, `animation-vocabulary` | Micro-interactions and motion QA. |
| `impeccable`, `motion-design`, `apple-design`, `scroll-world`, `3d-scrollytelling` | If present in the user's global skills: polish passes and scroll storytelling ideas. |
| `accessibility`, `core-web-vitals`, `performance`, `seo`, `web-design-guidelines`, `vercel-react-best-practices`, `shadcn` | QA, performance and admin UI. |
