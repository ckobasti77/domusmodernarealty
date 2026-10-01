import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { deleteBlobIfPresent } from "../lib/storage";
import { sceneBlobIds } from "../lib/tourBlobs";
import type { L10n, Walk3d } from "../lib/validators";
import { DEMO_TOUR_PANORAMAS, type DemoPanorama } from "./tours.generated";

/**
 * Demo tours (docs/06-3D-TOURS.md, IMPLEMENTATION-PLAN step 11).
 *
 * 360°: the Poly Haven CC0 panoramas optimized by scripts/fetch-demo-tours.mjs
 * and served from public/. The showcase listing gets a 4-scene tour; other
 * demo listings with `hasTourScenes` get a 3-scene chain. Link yaws point at a
 * doorway in each panorama (yaw = (x / width − 0.5) · 2π).
 *
 * 3D: "Living Room and Kitchen" by ethan3111 (SuperSplat, CC BY 4.0), the
 * smallest CC-BY real capture in docs/assets/demo-media.json. Spawn, eye
 * height, floor polygon and hotspots were measured from the decoded splat
 * positions: the scan is y-down with the floor at y = 0 and about 1.73 model
 * units per metre (dining table, kitchen counter and ceiling agree), so the
 * 1.6 m eye height is 2.75 units. Coordinates are the viewer's world frame
 * (the scan rotated 180° about X: x stays, z flips).
 */

/** The showcase listing: both the 4-scene tour and the 3D walk. */
export const SHOWCASE_TOUR_REF = "ME-1049";

type PanoId =
  | "glasshouse_interior"
  | "brown_photostudio_04"
  | "brown_photostudio_02"
  | "relax_inn_seaview_suite"
  | "modern_bathroom"
  | "photo_studio_loft_hall";

/** Scene titles describe what each panorama actually shows. */
const PANO_TITLE: Record<PanoId, L10n> = {
  brown_photostudio_04: { sr: "Soba sa kuhinjom", en: "Room with kitchenette", ru: "Комната с кухней", de: "Zimmer mit Küchenzeile" },
  relax_inn_seaview_suite: { sr: "Spavaća soba", en: "Bedroom", ru: "Спальня", de: "Schlafzimmer" },
  modern_bathroom: { sr: "Kupatilo", en: "Bathroom", ru: "Ванная", de: "Badezimmer" },
  photo_studio_loft_hall: { sr: "Radna soba", en: "Study", ru: "Кабинет", de: "Arbeitszimmer" },
  glasshouse_interior: { sr: "Zimska bašta", en: "Winter garden", ru: "Зимний сад", de: "Wintergarten" },
  brown_photostudio_02: { sr: "Loft", en: "Loft", ru: "Лофт", de: "Loft" },
};

/** Where a scene first looks (radians). */
const INITIAL_YAW: Record<PanoId, number> = {
  brown_photostudio_04: -0.31,
  relax_inn_seaview_suite: 1.26,
  modern_bathroom: -0.31,
  photo_studio_loft_hall: -1.26,
  glasshouse_interior: 0.63,
  brown_photostudio_02: 0.31,
};

type SceneSpec = { pano: PanoId; links: { to: number; yaw: number }[] };

/** Room with kitchenette ↔ bedroom ↔ bathroom, room with kitchenette ↔ study. */
const SHOWCASE: SceneSpec[] = [
  { pano: "brown_photostudio_04", links: [{ to: 1, yaw: -0.82 }, { to: 3, yaw: -2.83 }] },
  { pano: "relax_inn_seaview_suite", links: [{ to: 0, yaw: 3.02 }, { to: 2, yaw: -2.33 }] },
  { pano: "modern_bathroom", links: [{ to: 1, yaw: 2.01 }] },
  { pano: "photo_studio_loft_hall", links: [{ to: 0, yaw: 2.51 }] },
];

const CHAINS: SceneSpec[][] = [
  [
    { pano: "brown_photostudio_04", links: [{ to: 1, yaw: -0.82 }] },
    { pano: "relax_inn_seaview_suite", links: [{ to: 0, yaw: 3.02 }, { to: 2, yaw: -2.33 }] },
    { pano: "modern_bathroom", links: [{ to: 1, yaw: 2.01 }] },
  ],
  [
    { pano: "glasshouse_interior", links: [{ to: 1, yaw: -3.02 }] },
    { pano: "brown_photostudio_02", links: [{ to: 0, yaw: -0.82 }, { to: 2, yaw: -2.39 }] },
    { pano: "photo_studio_loft_hall", links: [{ to: 1, yaw: 2.51 }] },
  ],
];

function panorama(id: PanoId): DemoPanorama {
  const found = DEMO_TOUR_PANORAMAS.find((item) => item.id === id);
  if (found === undefined) throw new Error(`Demo panorama ${id} is missing: run scripts/fetch-demo-tours.mjs`);
  return found;
}

function creditFor(pano: DemoPanorama): string {
  return `Poly Haven (CC0), ${pano.page}`;
}

/** Replaces a listing's scenes with a demo set. Returns the number of scenes written. */
export async function writeDemoScenes(
  ctx: MutationCtx,
  listingId: Id<"listings">,
  variant: "showcase" | number,
): Promise<number> {
  const existing = await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listingId))
    .take(60);
  for (const scene of existing) {
    for (const id of sceneBlobIds(scene)) await deleteBlobIfPresent(ctx, id);
    await ctx.db.delete("tourScenes", scene._id);
  }

  const specs = variant === "showcase" ? SHOWCASE : CHAINS[variant % CHAINS.length];
  const ids: Id<"tourScenes">[] = [];
  for (const [order, spec] of specs.entries()) {
    const pano = panorama(spec.pano);
    ids.push(
      await ctx.db.insert("tourScenes", {
        listingId,
        order,
        title: PANO_TITLE[spec.pano],
        pano: { kind: "url", url: pano.desktop.url },
        panoMobile: { kind: "url", url: pano.mobile.url },
        thumb: { kind: "url", url: pano.thumb.url },
        initialView: { yaw: INITIAL_YAW[spec.pano], pitch: 0 },
        links: [],
        credit: creditFor(pano),
      }),
    );
  }
  for (const [index, spec] of specs.entries()) {
    await ctx.db.patch("tourScenes", ids[index], {
      links: spec.links.map((link) => ({ toSceneId: ids[link.to], yaw: link.yaw, pitch: -0.1 })),
    });
  }
  return ids.length;
}

const LIVING_ROOM_SOG = "https://d28zzqy0iyovbz.cloudfront.net/9917211a/v1/meta.json";

/** The demo splat walkthrough. `bytes` is meta.json plus its five WebP textures. */
export const DEMO_WALK3D: Walk3d = {
  desktop: {
    source: { kind: "url", url: LIVING_ROOM_SOG },
    format: "sog",
    bytes: 43_087_848,
    splats: 3_849_693,
  },
  // A frame of the scan at the spawn point (captured from the viewer), so it carries the same CC BY credit.
  poster: { kind: "url", url: "/media/tours/demo/living-room-kitchen-walk.jpg" },
  spawn: { x: 1.2, y: 0, z: 2.2, yaw: 0.9 },
  eyeHeight: 2.75,
  floorPolygon: [
    [-4.7, 2.85],
    [4.9, 2.85],
    [4.9, -1.5],
    [3.2, -1.5],
    [3.2, 0.95],
    [0.75, 0.95],
    [0.75, -3.35],
    [-1.7, -3.35],
    [-1.7, -1.65],
    [-3.0, -1.65],
    [-3.0, 1.6],
    [-4.7, 1.6],
  ],
  hotspots: [
    { label: { sr: "Dnevna soba", en: "Living area", ru: "Гостиная", de: "Wohnbereich" }, x: -1.2, z: 2.3, yaw: 0.7 },
    { label: { sr: "Trpezarija", en: "Dining area", ru: "Столовая", de: "Essbereich" }, x: 4.2, z: -0.5, yaw: 1.49 },
    { label: { sr: "Kuhinja", en: "Kitchen", ru: "Кухня", de: "Küche" }, x: 4.4, z: 2.2, yaw: -1.16 },
  ],
  credits: "„Living Room and Kitchen”, ethan3111 (CC BY 4.0), https://superspl.at/scene/9917211a",
  aiGenerated: false,
  published: true,
};
