# Step 11: 360° tours and 3D splat walkthrough (beta)

**Read:** docs/06-3D-TOURS.md (all), docs/02-ARCHITECTURE.md §5 (tour360, walk3d, tourScenes), §10 (CSP), docs/assets/demo-media.json (panoramas, splats + licenses).
**Skills:** `performance`, `core-web-vitals`, `accessibility`. Read the `node_modules` types/README of `@photo-sphere-viewer/*` and `@sparkjsdev/spark` before coding; the APIs changed in recent majors.

## Tasks
1. **Demo assets.** Write `scripts/fetch-demo-tours.mjs`:
   - Download the Poly Haven CC0 panoramas from demo-media.json (21–40 MB each).
   - Resize with sharp to 4096×2048 (desktop) + 2048×1024 (mobile) + a 512 thumbnail, then save to `public/media/tours/demo/`.
   - Keep the originals out of git (gitignore); commit only the optimized files, and keep the total size reasonable (< 25 MB). If that is too big, keep 3 scenes.
   - Seed one demo listing with a 3–4-scene self-hosted tour (scene links + yaw) via an internal Convex mutation. Credit CC0 in the admin notes.
2. **360° viewer** (`components/tours/Tour360.tsx`, dynamic ssr:false, fullscreen modal/route, `data-lenis-prevent`):
   - PSV core + virtual-tour (arrows between scenes), markers (hotspots), gallery (scene thumbnails).
   - Mobile uses the mobile panoramas; loading progress; keyboard + touch; dispose on close; reduced-motion: no autorotate.
3. **External tours:** a Matterport/Kuula click-to-load facade (poster + button) → iframe (allowed in the CSP). Admin fields: provider + ID/URL.
4. **3D walk viewer** (`components/tours/Walk3D.tsx`, dynamic ssr:false, fullscreen):
   - Spark 2 `SplatMesh` + three.js renderer.
   - Controls: WASD/arrows + mouse-drag look, a touch joystick on mobile, click-to-walk on the floor (raycast to the floor plane), room hotspots (teleport).
   - Eye height 1.6 m, speed 1.2 m/s, clamped inside `floorPolygon` with wall sliding; spawn from the listing data.
   - Device tiering before download (WebGL2 check, `navigator.deviceMemory`, iOS detection, save-data), plus a runtime FPS guard (lower DPR → splat budget → suggest the 360° tour).
   - Show the file size on the start button; dispose + force context loss on close; handle `webglcontextlost`.
   - An on-screen help overlay (keys/gestures) in 4 languages.
   - Demo: wire one listing to a CC-BY SuperSplat interior from demo-media.json (SOG `meta.json`; set the correct Spark fileType per its API). Show the attribution in the viewer UI ("3D scan: <author> (CC BY 4.0)").
   - If loading SOG from that host fails (CORS/format), try the next CC-BY scene. Record which one works in DECISIONS.md.
5. **Admin (listing editor tab "360° / 3D"):**
   - scenes editor: upload panoramas to Convex storage (size validation), order (dnd), set title per locale, links between scenes (select target + yaw/pitch fields + "set from current view" using a mini PSV preview), initial view;
   - splat assets: URL or upload (warn about size + recommend R2), mobile asset, poster, spawn/eye height, floor polygon editor (click points on a top-down placeholder or paste JSON), credits, `aiGenerated` flag, publish toggles.
6. **Listing detail integration:** the "360° tura" / "3D šetnja" tabs open the viewers; a badge on cards ("3D tura"); a filter "sa 3D/360 turom" in search (if not already there).
7. **Performance:** viewers must not affect other pages' bundles (verify chunks with the build output); nothing loads until the user clicks.
8. **Tests:** e2e opens the 360° tour on the demo listing (canvas present, scene switch works) and opens the 3D viewer (canvas present or the graceful fallback message when WebGL2 is missing in headless). Unit test for the polygon clamp.

## Definition of done
- [ ] The demo listing has a working 3–4-scene 360° tour (screenshot evidence) and a working 3D walk (screenshot or documented fallback in headless + the manual test note).
- [ ] The Matterport/Kuula facade works with a sample URL.
- [ ] The admin can create/edit scenes and splat settings.
- [ ] Bundle isolation is verified.
- [ ] Licenses/attribution are shown.
- [ ] `npm run verify` exits 0; tests pass.
- [ ] PROGRESS.md, done file and commit made per the protocol.
