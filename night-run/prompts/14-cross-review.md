# Step 14: Independent cross-model code review (Opus)

You did not write this code. A different model built it overnight. You are a principal engineer doing an independent review before the client sees it. Be skeptical and concrete.

**Read:** CLAUDE.md, docs/01-PRD.md, docs/02-ARCHITECTURE.md, all done files, docs/reports/*. Diff: `git diff night-run/baseline..HEAD --stat` first, then the files themselves.
**Skills:** `convex-reviewer`, `vercel-react-best-practices`, `accessibility`, `seo`.

## Review for
1. **Correctness:** logic bugs, race conditions, broken edge cases (empty data, missing translations, sold listings, 0.5 rooms, floor "PR", very long titles, zero results), timezone issues in viewings (Europe/Belgrade), currency rounding.
2. **Security:**
   - auth/role checks on every admin Convex function
   - public queries leaking private fields
   - invite/preview tokens (entropy, expiry, hashing)
   - upload validation
   - XSS via rich text/JSON-LD (escape `</script>`)
   - open redirects
   - rate limits
   - CSP holes
3. **Architecture:**
   - adherence to docs (two root layouts, next-intl localized pathnames, server/client split, no Lenis/GSAP in admin)
   - duplication
   - dead code
   - overgrown components (split > 400-line components where it clarifies)
4. **Performance:** needless client components, waterfalls, N+1 Convex queries, missing indexes, unbounded `.collect()`.
5. **Maintainability:** naming, types (no stray `any`), comments where non-obvious, consistent patterns, the README accuracy.

## Process
- Write findings to `docs/REVIEW-REPORT.md`: severity, file:line, why it matters, fix.
- Fix all critical/high/medium findings (tests for each bug fix where feasible). Leave low ones listed.
- Re-run `npm run test:e2e` and `npm run verify`.

## Definition of done
- [ ] REVIEW-REPORT.md lists findings with a status (fixed / deferred with reason).
- [ ] All critical/high/medium findings are fixed, with tests added for the bug fixes.
- [ ] `npm run test:e2e` is green; `npm run verify` exits 0.
- [ ] PROGRESS.md, done file and commit made per the protocol.
