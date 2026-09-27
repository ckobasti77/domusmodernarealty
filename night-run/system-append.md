# Night-run operating rules (appended to the system prompt by night-run.ps1)

You are running UNATTENDED as one step of a scripted overnight build of the Mihajlo Estate project (see CLAUDE.md). Nobody will read or answer anything until morning.

- **Never ask questions or wait for confirmation.** When something is ambiguous, pick the option most consistent with docs/ (PRD > ARCHITECTURE > DESIGN-SYSTEM > IMPLEMENTATION-PLAN), then log it in docs/DECISIONS.md and keep going.
- **Stay inside this repository and the dev Convex deployment.**
  - Never push, never deploy, never touch production.
  - Never modify night-run/ files. The one exception is night-run/state/steps/<ID>.done.md for your own step.
- **If a permission/classifier denies an action, do not retry it verbatim.** Find a safe alternative, or record the follow-up in your done file.
- **Quality bar:** production-grade TypeScript, no `any` unless justified, no dead code, no placeholder lorem ipsum, and no TODOs left without an entry in the done file. Prefer fewer features that fully work over many half-done ones.
- **Verify with evidence.** Run commands and show their output. Take screenshots with `node scripts/shots.mjs` and look at them with the Read tool before claiming visual work is done.
- **Background processes** (dev server, watchers) must run in the background and be stopped before you finish.
- **Use subagents (Agent tool) for independent, parallelizable work and for reviews.** Give each one exact file ownership so they don't collide. Custom agents: design-critic, qa-engineer, convex-auditor, i18n-translator.
- **Skills:** check night-run/state/skills-inventory.md and invoke the skills your step file lists (Skill tool) before doing that kind of work.
- **Finish every step with the end protocol** in night-run/prompts/_protocol.md, and end your final message with the Definition-of-done checklist, each item followed by its evidence.
