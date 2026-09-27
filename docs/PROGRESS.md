# Progress log (append-only)

Each night-run step appends a section:

```
## Step NN - Title (YYYY-MM-DD HH:MM)
- Done: ...
- Files: ...
- Decisions: ... (details in DECISIONS.md)
- Known issues / follow-ups: ...
- Verify: npm run verify -> OK/FAIL
```

## Step 00 - Preparation (2026-09-28, by Claude in the planning chat)
- Research done (docs/05-RESEARCH.md, docs/06-3D-TOURS.md), decisions agreed with the owner (docs/00-BRIEF.md).
- Docs written: CLAUDE.md, docs/00-06, verified demo media list (docs/assets/demo-media.json: 90 Unsplash photos, 6 CC0 panoramas, 9 splats).
- Project skills added to .claude/skills (GSAP official, frontend-design, Vercel React best practices, web-design-guidelines, accessibility, seo, core-web-vitals, performance, shadcn, high-end-visual-design, Emil Kowalski animation skills). Custom subagents in .claude/agents.
- Night-run runner + prompts in night-run/.
