# QA report — night-run step 13 (2026-10-02)

Full QA sweep of the public site, the admin and the Convex backend, run as orchestrated workflows:

1. **Matrix crawl** (`scripts/qa-matrix.mjs`): 21 public routes × 4 locales × 3 widths = 252 cells against the production build.
2. **Audit workflow** (12 agents): convex-auditor, security, content/i18n, and three qa-engineers writing missing Playwright tests (accessibility, public flows, admin flows). An independent verifier then tried to refute every finding of each dimension.
3. **Visual workflow** (10 agents): five design-critics, one per route group, read the matrix screenshots against `docs/03-DESIGN-SYSTEM.md`, and five verifiers re-checked every finding against the pixels.
4. **Fix workflow** (6 agents, disjoint file ownership) plus direct fixes for security, Convex, accessibility and the cross-cutting items.
5. **Re-verification**: rebuild, matrix crawl again, full Playwright suite, screenshots of the changed pages.

<!-- SECTIONS BELOW ARE FILLED IN BY THE STEP -->
