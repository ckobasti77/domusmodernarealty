# 06: Immersive tours (360° + 3D walkthrough)

## What the owner asked for
Clients can optionally get two immersive views of their property:
1. **"Google Street View" style:** 360° panoramas you jump between.
2. **"Like a video game":** walk through the scanned apartment with arrow keys/WASD. It is made by scanning the apartment and processing the scan in **MipMap**.

"MIP Map" is most likely **MipMap Desktop**. It is photogrammetry + Gaussian-splatting software that imports 360° camera video natively (Insta360 X-series, DJI Osmo 360) and exports splats (PLY/SOG) and meshes. It has a free tier (500 images/task). Paid tiers exist but prices aren't published. It only produces files; our site hosts the viewer. See https://na.mipmap3d.com/.

## Options compared
| | Matterport | DIY 360° (self-hosted) | Gaussian-splat walk | Textured-mesh walk |
|---|---|---|---|---|
| Experience | Jump between points, dollhouse, floor plan, measurements; very polished | Street-View arrows, minimap, hotspots | Photoreal free walking; the biggest "wow" | Game-like walking; looks CG / blurry |
| Capture | Matterport app + phone/360 camera, or a Pro3 camera (~$6k) | 360 camera on a tripod, 15–25 points | 5–10 min of 360 video (or phone video) | LiDAR phone / photogrammetry |
| Recurring cost | Per active space (Starter ~$10–14/mo, Pro from $69/mo) | ~€0 | ~€0–35 per listing (processing) | ~€0 |
| Lock-in | High: the tour goes dark if you stop paying | None | None (keep the master PLY) | None |
| Runs on | Everything | **Everything, 60 fps** | Desktop GPU: 2–5M splats. Integrated-GPU laptop: ~1–1.5M. iPhone 13–15 Pro: 1–2M. Mid/low Android: ≤ 1M | Almost everything |
| Weak spots | Pay forever, jump-only | We maintain the editor | Blur/floaters away from the capture path; mirrors create "phantom rooms"; mobile memory limits; collision must be authored | Glass/mirrors/thin objects fail |

**Recommendation:**
- Offer **360° (self-hosted) as the standard premium service**: cheap, works everywhere, and no lock-in.
- Offer the **splat walkthrough as the "wow" upsell** for top listings.
- Keep a **Matterport/Kuula embed** option for clients who already have one.

## Will it run on normal computers?
- **360° tours:** yes, everywhere.
  - Serve a 4096×2048 panorama to phones (~32 MB of GPU memory decoded) and 8K to desktops, or use equirectangular tiles.
  - Files: 8K JPEG 3–8 MB, 4K 1–2 MB.
- **Splats:** yes on most laptops/desktops, with care on phones. For a 60–100 m² apartment trained to 1.5–3M splats:

| Format | Size | Use |
|---|---|---|
| PLY | 370–740 MB | Archive only |
| SPZ | ~40–75 MB | |
| SOG | ~20–50 MB | Desktop delivery |
| Mobile SOG (≤ 1M splats, SH 0–1) | ~8–15 MB | Phone delivery |

  - Phones: iOS Safari kills heavy tabs without any error. Cap mobile at ≤ 1M splats and ≤ 15–20 MB, DPR ≤ 1.5, antialiasing off, and never autoload on mobile data.

## Architecture on our site
- **Data:** see `listings.tour360`, `listings.walk3d` and the `tourScenes` table in 02-ARCHITECTURE §5.
- **360° viewer:**
  - `@photo-sphere-viewer/core` 5.15 + `virtual-tour-plugin` (scene links with arrows; `positionMode:'gps'` can place arrows from floor-plan coordinates), `markers-plugin`, `gallery-plugin`, optional `map-plugin` (floor-plan minimap).
  - Fullscreen route/modal, loaded with `next/dynamic(ssr:false)` on click.
  - Admin editor: upload panoramas, order scenes, pick links + yaw/pitch.
- **Matterport/Kuula:** a click-to-load facade (poster + "Pokreni 3D turu") → iframe `https://my.matterport.com/show/?m=ID&play=1` / Kuula share URL. Allow the frames in the CSP.
- **3D walk viewer (beta):**
  - `@sparkjsdev/spark` 2.x + three.js.
    - `SplatMesh` loads SPZ/PLY/SOG. SuperSplat SOG `meta.json` loads with the right `fileType` (verify against the Spark API).
    - `SparkControls` (or custom controls) gives WASD/arrows + mouse-drag look + a touch joystick on mobile + "teleport to room" hotspots.
  - Eye height 1.6 m, speed ~1.2 m/s.
  - **Collision:** clamp the camera inside `floorPolygon` (2D point-in-polygon + wall sliding). Later, capsule vs `collision.glb` with three-mesh-bvh (`@playcanvas/splat-transform` can generate `.collision.glb`).
  - **Device tiering before download:**
    - No WebGL2 → offer the 360° tour/photos.
    - iOS / `deviceMemory ≤ 4` / save-data → mobile asset.
    - Otherwise → desktop asset.
    - Runtime: if the median frame time is > 33 ms for 2 s, lower DPR, then the splat budget, then suggest the 360° tour.
  - On close, dispose the renderer and force context loss. Handle `webglcontextlost`.
  - Show the file size on the button ("3D šetnja · 18 MB").
  - Fallback chain: splat → 360° → video → photos.
- **Demo assets** (in `docs/assets/demo-media.json`):
  - Poly Haven CC0 interior panoramas (8K JPG, 21–40 MB each). Download once, resize to 4096×2048 + 2048×1024 with sharp, and save to `public/media/tours/demo/`.
  - SuperSplat CC-BY-4.0 interior scenes (SOG `meta.json`; credit the author with a link). Two Spark samples have no license, so use them for internal testing only.
  - All demo tours are flagged `isDemo`.
- **Hosting in production:** Cloudflare R2 behind a custom domain (free egress, 5 GB single PUT), not Convex storage (2-minute upload timeout, egress billing). Use versioned immutable keys, `Cache-Control: max-age=31536000, immutable`, and CORS GET/HEAD/Range. This is not implemented tonight; the admin accepts either an upload (small files) or a URL.

## Capture workflow for the agency (per 60–100 m² apartment)
**One-time equipment:**
- Insta360 X5 (~€550–610) or X6 (~€700) + invisible selfie stick + tripod (~€80).
- Optional: a Windows PC with an NVIDIA RTX GPU for local processing (Postshot needs RTX 2060+).

**Per apartment:**
1. **Prep (15 min):** declutter, lights on, remove personal photos/documents, get owner/tenant consent.
2. **360° photos (30–45 min):** 15–25 tripod points at ~1.5 m, HDR, photographer hidden.
3. **Same visit (+15–20 min):** 8K 360° video walking slowly at varying heights, fast shutter (1/500), ≥ 30 cm from surfaces.
4. **Office, 360° tour (~1 h):** stitch, strip EXIF GPS, export 8K/4K/thumbnails, upload, link scenes.
5. **Office, splat (2–4 h):**
   - Process in MipMap (free tier), Scaniverse Pro, Postshot Indie (€17/mo) or Epic RealityScan (free < $1M revenue).
   - Clean up in SuperSplat.
   - Run `splat-transform` to produce desktop SOG + mobile SOG + collision.
   - QA on an old iPhone, a mid-range Android and an integrated-GPU laptop.
- **Cost:** 360° tour ≈ €0 cash; splat ≈ €0–35 cash; hosting ≈ $1/month per 100 listings on R2.

## Risks
- Mirrors and glass create phantom rooms, so collide against the floor polygon, not the scan.
- Privacy: faces, family photos, documents, EXIF GPS; burglary risk from floor plans plus valuables. Get consent and blur.
- Licensing: the reference INRIA 3DGS code is non-commercial. Use commercial-OK tools (Postshot Indie+, Brush/gsplat, Scaniverse Pro, MipMap per its terms).
- AI "world model" tools (World Labs Marble/Atlas) invent unseen areas. Use them only for clearly labelled staging, never as the real apartment.
- Usability: many buyers don't use WASD, so always provide click-to-walk, room hotspots and a joystick; keep motion slow; respect reduced motion.
