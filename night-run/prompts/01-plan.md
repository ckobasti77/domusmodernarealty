# Step 01: Implementation plan (plan mode, read-only)

You are the lead engineer for Mihajlo Estate, preparing the build plan that the next 14 unattended steps will execute. You cannot edit files in this mode. **Your final answer is saved by the runner as `docs/IMPLEMENTATION-PLAN.md`**, so output the complete plan as Markdown in your final message. If you finish by calling ExitPlanMode, put the full plan in it.

## Read first
- CLAUDE.md
- AGENTS.md
- docs/00-BRIEF.md … docs/06-3D-TOURS.md
- docs/assets/DEMO-MEDIA.md
- night-run/steps.psd1 (step list)
- every file in night-run/prompts/
- the current code (app/, convex/, package.json)
- `node_modules/next/dist/docs/` index: skim the App Router pages for proxy, layouts, metadata, images, fonts, route handlers, not-found (multiple root layouts), typegen
- `convex/_generated/ai/guidelines.md`
- the `convex`, `convex-auth`, `convex-seed` skills in .claude/skills

## What the plan must contain
1. **Architecture decisions** that the docs leave open.
   - For each: the choice + a one-line why. Examples:
     - how the two root layouts and `not-found` work in Next 16.3 with next-intl localized pathnames
     - where Convex queries run (server `fetchQuery` vs client hooks) per page
     - the exact search/filter strategy within Convex limits (index choice per filter combination, post-filtering bounds, pagination)
     - how favorites/compare work
     - how media optimization works when `media-src/` is empty vs filled
2. **Final folder/file map** (tree) with one line per important file.
3. **Convex function inventory:** every query/mutation/action with args, auth requirement and indexes used.
4. **Per step (02 → 15):**
   - ordered task list refined to file level
   - risks + mitigations
   - exact install commands with versions
   - the tests/screenshots that prove the step is done
   - Keep each step's scope as defined in its prompt file. Do not move work between steps unless a hard dependency forces it, and say so if you do.
5. **Cross-cutting:**
   - i18n key namespaces
   - naming conventions
   - the error handling pattern
   - the loading/skeleton pattern
   - the analytics/consent pattern
   - the CSP list
6. **Top 10 things most likely to break overnight** (Windows paths, Turbopack + MapLibre worker, Convex Auth config, SplitText + fonts, Lenis + sticky, next-intl + two root layouts, …), each with a concrete prevention.

## Style
Be concrete and terse: file paths, function names, commands. No generic advice. Target 3,000–6,000 words.

## Definition of done
- [ ] The final message contains the complete Markdown plan with all 6 sections above.
