# Step 13: Full QA sweep (ultracode: orchestrate it as a workflow)

This session runs with ultracode effort. Plan and run a dynamic workflow. Independent agents audit in parallel; findings are adversarially verified before fixing; fixes are applied in isolated batches by file ownership. Then re-verify.

**Read:** docs/01-PRD.md (all ACs), docs/03-DESIGN-SYSTEM.md, all previous done files (Known issues!), docs/reports/*.
**Skills:** `accessibility`, `core-web-vitals`, `web-design-guidelines`, `review-animations`, `convex-reviewer`, `seo`.

## Audit matrix (fan out)
1. **Routes × locales × viewports.** Every public route (including 3 listing slugs, 2 locations, 1 agent, 1 post) × sr/en/ru/de × 390/768/1440:
   - screenshot (after animations settle)
   - console errors
   - failed network requests
   - broken images
   - text overflow/clipping
   - a meaningful h1
2. **Visual review.** Design-critic agents review the screenshots per route group against DESIGN-SYSTEM: alignment, spacing rhythm, typography, image crops, dark/ivory section transitions, mobile tap targets.
3. **Functional flows.** qa-engineer agents write or extend Playwright tests until every PRD AC with a user flow has a test:
   - search filters, map, favorites/compare
   - inquiry, viewing, valuation, sell, contact
   - admin login/roles
   - listing CRUD/media/publish
   - leads pipeline, invites, content editing
   - tours
4. **Security/backend.**
   - The convex-auditor agent checks every Convex function: auth/role checks, validators, public data exposure (no mandate/owner/exact coordinates leaks), rate limits, indexes vs filters, pagination bounds, file upload validation, activity logging.
   - Plus: rich text sanitization, preview-token security, and secrets never reaching the client bundle (grep the `.next` output).
5. **Accessibility:** axe on all routes (1 locale × 2 viewports); keyboard traps; focus management in modals/sheets/lightbox; reduced motion.
6. **Content:** no lorem ipsum, no untranslated keys, no "undefined"/"NaN" in the UI, and prices/areas formatted per locale.

## Fix
- Dedupe and rank the findings (critical → low). Fix every critical/high/medium. Also fix low findings that are cheap.
- Re-run the failing audits until they are clean or 2 rounds make no progress.
- Write `docs/reports/qa-report.md`: matrix summary, issues found/fixed/remaining, and test inventory with pass counts.

## Definition of done
- [ ] The QA report exists with the full matrix. No open critical/high issues.
- [ ] The Playwright suite covers every PRD user-flow AC and is green (`npm run test:e2e`: show the summary).
- [ ] The Convex audit is clean (no unauthenticated admin paths, no data leaks).
- [ ] `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
