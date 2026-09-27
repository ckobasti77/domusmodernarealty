# Step 15: Final polish and handoff

**Read:** all done files, docs/reports/*, docs/REVIEW-REPORT.md, docs/03-DESIGN-SYSTEM.md.
**Skills:** `design-taste-frontend`/`high-end-visual-design`, `review-animations`, `frontend-design`. Use `impeccable` if present.

## Tasks
1. **Final visual pass** on the 6 money pages (landing, search, listing detail, valuation, about, admin dashboard) at 390 and 1440:
   - screenshots → the `design-critic` agent → implement the top improvements;
   - make sure the first 5 seconds of the landing are flawless (preloader → hero → first scroll).
2. **Media check.** If new files appeared in `media-src/` since step 05, run `npm run media:optimize` and wire them (hero video, section visuals). Verify with screenshots.
3. **README.md** (replace the create-next-app one), in Serbian with an English summary:
   - what it is
   - stack
   - how to run locally (`npm install`, `npx convex dev`, `npm run dev`)
   - admin login (credentials are in `night-run/state/admin.json`, change the password after the first login)
   - how to invite team members
   - how to replace demo content (demo panel)
   - how to add a listing with photos, a 360° tour and a 3D walk (link to docs/06-3D-TOURS.md)
   - where to set the company legal data
   - scripts
   - tests
4. **docs/HANDOFF.md:**
   - feature checklist vs the PRD (done / partial / not done)
   - known issues
   - next steps (Resend e-mail alerts, owner portal, R2 for 3D assets, Viber alerts, AI search)
   - a production deploy guide: Vercel project + `npx convex deploy` + env vars (NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY on Vercel, SITE_URL/JWT keys on the prod deployment) + domain + analytics consent. Document the steps; do not run them.
5. **docs/CLIENT-PITCH.md:** a 1-page Serbian summary the developer can show Mihajlo:
   - what the site does
   - differentiators vs CityExpert/4zida
   - premium 3D tour service tiers
   - what's needed from him: real photos, company data, registry number, agent info, legal review
6. **Final gate:** `npm run verify`, `npm run test:e2e`, `npm run i18n:check`, all green.
7. **Tag:** `git tag night-run/complete`.

## Definition of done
- [ ] The final design-critic pass has no high-severity issues on the 6 money pages.
- [ ] README.md, docs/HANDOFF.md and docs/CLIENT-PITCH.md are written.
- [ ] verify + e2e + i18n are all green (show the summaries).
- [ ] Tag `night-run/complete` is created.
- [ ] PROGRESS.md, done file and commit made per the protocol.
