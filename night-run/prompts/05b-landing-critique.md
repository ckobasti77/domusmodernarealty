# Step 05b: Landing critique and polish (continues the step-05 session)

You built the landing in this same session, so you know every decision. Now look at it like an Awwwards jury, then fix it.

**Skills:** `review-animations`, `improve-animations`, `emil-design-eng`, `design-taste-frontend`/`high-end-visual-design`, `accessibility`, `core-web-vitals`. Use `impeccable` / `apple-design` if present.

## Tasks
1. Take fresh screenshots of `/sr` and `/en` at 390, 768, 1280 and 1920 widths, with `--scroll-steps 10`. Also take screenshots of the hero at 3 moments of the intro (the shots script supports `--delays 300,1200,2500` for the first viewport).
2. Run an independent critique in parallel:
   - `design-critic` agent: composition, typography rhythm, whitespace, image choices, consistency with DESIGN §1–6.
   - A general-purpose agent with the `review-animations` skill: timing, easing, stagger, choreography, jank, mobile motion.
   - A general-purpose agent with the `accessibility` skill: focus order, contrast, reduced motion, headings, alt text.
3. Merge the findings into a ranked list and implement the top ~15 improvements. Typical wins:
   - better hero crop/art direction on mobile
   - tighter SplitText timing
   - stronger section transitions
   - hover states on the neighborhood list
   - counters that land on round numbers
   - consistent eyebrow/heading spacing
   - image quality/`sizes`
   - fewer competing motions at once
4. **First-visit consent banner (owner review of the step 04 screenshots).** On a first visit the cookie banner covers about 35% of the 390px viewport and about 240px of the 1440px one, so it competes with the hero during the most important seconds. Make it compact without weakening consent:
   - Desktop: one bar of about 96-120px (text on the left, actions in one row on the right).
   - Mobile: at most about 30% of the viewport height; "Prihvatam sve" and "Samo neophodni" side by side with EQUAL visual weight (refusing must be as easy as accepting); "Podešavanja" as a text link.
   - It may enter after the hero intro settles (about 2-2.5 s) instead of competing with the preloader, as long as the page stays fully usable and nothing non-essential loads before a choice.
   - Keep the existing tests passing (consent persists, footer re-opens it, focus behaviour) and update them if the markup changes. Compare before/after screenshots at 390 and 1440 with the banner visible.
5. Re-take the screenshots, compare before and after, and keep the improvements.

## Definition of done
- [ ] Critique reports from 3 reviewers are summarized in the done file (top findings + what was fixed).
- [ ] ≥ 12 concrete improvements are implemented and visible in the before/after screenshots (list them).
- [ ] The first-visit consent banner is compact (task 4), with equal-weight accept/refuse, verified at 390 and 1440.
- [ ] No high-severity a11y issues (axe run on `/sr` via `@axe-core/playwright` is clean for serious/critical).
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
