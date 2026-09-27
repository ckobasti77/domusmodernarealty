# Step protocol (applies to every night-run step)

## Start
1. Read CLAUDE.md, docs/00-BRIEF.md, and the doc sections your step file lists.
   - Also read docs/IMPLEMENTATION-PLAN.md (your step's section), the last 3 sections of docs/PROGRESS.md, and docs/DECISIONS.md.
2. Read the done files of earlier steps in `night-run/state/steps/`, especially their "Known issues" and "Next steps should know" sections.
3. Run `git status --short`. If an interrupted earlier attempt left uncommitted changes:
   - inspect them;
   - keep what is correct;
   - commit as `chore(night): recover leftovers before step <ID>`.
4. Run `npm run verify` once to learn the baseline. **If it fails, fixing it is your first job.**
5. Look at `night-run/state/skills-inventory.md`. Invoke the skills your step lists (Skill tool) before doing that kind of work.

## During
- Work in small, verified increments. Commit after each coherent chunk (conventional commits).
- Parallelize independent work with subagents (Agent tool); give each an exact list of files it owns.
  - Custom agents: `design-critic`, `qa-engineer`, `convex-auditor`, `i18n-translator`.
  - Built-in general-purpose agents are fine too.
- Unsure about a library API? Read its types/docs in `node_modules/` (for Next: `node_modules/next/dist/docs/`). Do not guess.
- Convex changes: run `npx convex dev --once` after schema/function edits; fix every error it reports.
- Need the app running:
  - Start `npm run dev` in the background.
  - Poll http://localhost:3000 until it responds.
  - Do your checks.
  - Kill the process before you finish.
- UI work:
  - Take screenshots with `node scripts/shots.mjs --routes /sr,/sr/nekretnine --widths 390,1440` (see the script header for options).
  - Look at the PNGs with the Read tool, then fix what looks wrong.
- Decide autonomously. Log non-obvious decisions in docs/DECISIONS.md.

## End (all required, in this order)
1. `npm run verify` exits 0 (fix until it does). Show the last ~15 lines of its output.
2. If your step changed UI: take fresh screenshots of the affected routes at 390 and 1440 widths, and Read at least 2 of them.
3. Append your section to docs/PROGRESS.md (format at the top of that file).
4. Write `night-run/state/steps/<ID>.done.md` with these sections:
   - Summary
   - Files changed (key ones)
   - Decisions
   - Known issues
   - Next steps should know
5. `git add -A` then `git commit -m "<type>(<scope>): step <ID> <title>"`. Show `git log -1 --oneline` and `git status --short` (must be empty).
6. Make sure no dev server or other background process is still running.
7. Final message: print the step's Definition-of-done checklist, with the evidence for each item.
