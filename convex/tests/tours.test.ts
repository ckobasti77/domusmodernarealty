/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

/**
 * Step 11: tour rules enforced by toursAdmin / listingsAdmin and read by the
 * public `tours` queries.
 */

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agentA = await makeAgent(ctx, "agent-a");
    const agentB = await makeAgent(ctx, "agent-b");
    const admin = await makeUser(ctx, "admin");
    const agentUser = await makeUser(ctx, "agent", agentA);
    const listing = await makeListing(ctx, 1, city, agentA);
    const other = await makeListing(ctx, 2, city, agentB);
    return { admin, agentUser, listing, other };
  });
  return { t, ids, asAdmin: t.withIdentity({ subject: ids.admin }) };
}

const PANO = { kind: "url" as const, url: "/media/tours/demo/modern_bathroom-4096.jpg" };

type RunCtx = Parameters<Parameters<ReturnType<typeof testApp>["run"]>[0]>[0];

/**
 * convex-test does not record a blob's content type; uploads through an upload
 * URL do, so the test sets it the way production storage would.
 */
async function storeTyped(ctx: RunCtx, bytes: BlobPart, contentType: string): Promise<Id<"_storage">> {
  const id = await ctx.storage.store(new Blob([bytes], { type: contentType }));
  await (ctx.db as unknown as { patch: (id: Id<"_storage">, value: { contentType: string }) => Promise<void> }).patch(id, {
    contentType,
  });
  return id;
}

describe("360° scenes", () => {
  test("public scenes appear only for a live self-hosted tour", async () => {
    const { t, ids, asAdmin } = await setup();
    await asAdmin.mutation(api.toursAdmin.upsertScene, { listingId: ids.listing, title: { sr: "Kupatilo" }, pano: PANO });

    expect(await t.query(api.tours.scenes, { listingId: ids.listing })).toHaveLength(0);
    await asAdmin.mutation(api.toursAdmin.setTour360, {
      listingId: ids.listing,
      tour360: { provider: "self", published: true },
    });
    expect(await t.query(api.tours.scenes, { listingId: ids.listing })).toHaveLength(1);

    // Switching to Matterport keeps the scenes stored but stops serving them.
    await asAdmin.mutation(api.toursAdmin.setTour360, {
      listingId: ids.listing,
      tour360: { provider: "matterport", externalId: "SxQL3iGyoDo", published: true },
    });
    expect(await t.query(api.tours.scenes, { listingId: ids.listing })).toHaveLength(0);
    const listing = await t.run(async (ctx) => ctx.db.get("listings", ids.listing));
    expect(listing?.hasTour).toBe(true);
  });

  test("a self-hosted tour stores no external URL, and a foreign player URL is refused", async () => {
    const { t, ids, asAdmin } = await setup();
    await asAdmin.mutation(api.toursAdmin.setTour360, {
      listingId: ids.listing,
      tour360: { provider: "self", url: "https://evil.example/", externalId: "x", published: false },
    });
    const stored = await t.run(async (ctx) => ctx.db.get("listings", ids.listing));
    expect(stored?.tour360).toEqual({ provider: "self", published: false });

    await expect(
      asAdmin.mutation(api.toursAdmin.setTour360, {
        listingId: ids.listing,
        tour360: { provider: "kuula", url: "https://evil.example/share/abc", published: true },
      }),
    ).rejects.toThrow(/Kuula/);
  });

  test("URL panoramas must be site files, and one blob cannot fill two slots", async () => {
    const { t, ids, asAdmin } = await setup();
    await expect(
      asAdmin.mutation(api.toursAdmin.upsertScene, {
        listingId: ids.listing,
        title: { sr: "Spolja" },
        pano: { kind: "url", url: "https://example.com/pano.jpg" },
      }),
    ).rejects.toThrow(/Panoramu otpremite/);

    const blob = await t.run(async (ctx) => storeTyped(ctx, new Uint8Array([255, 216, 255, 224]), "image/jpeg"));
    const image = { kind: "storage" as const, storageId: blob };
    await expect(
      asAdmin.mutation(api.toursAdmin.upsertScene, {
        listingId: ids.listing,
        title: { sr: "Soba" },
        pano: image,
        thumb: image,
      }),
    ).rejects.toThrow(/dva polja/);
  });

  test("an agent cannot edit another agent's tour", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await expect(
      asAgent.mutation(api.toursAdmin.upsertScene, { listingId: ids.other, title: { sr: "Soba" }, pano: PANO }),
    ).rejects.toThrow();
  });
});

describe("3D walkthrough", () => {
  test("validates hosts and polygons, and takes an uploaded model's size from storage", async () => {
    const { t, ids, asAdmin } = await setup();
    await expect(
      asAdmin.mutation(api.toursAdmin.setWalk3d, {
        listingId: ids.listing,
        walk3d: { desktop: { source: { kind: "url", url: "https://example.com/a.spz" }, format: "spz" }, published: true },
      }),
    ).rejects.toThrow(/dozvoljenom serveru/);

    await expect(
      asAdmin.mutation(api.toursAdmin.setWalk3d, {
        listingId: ids.listing,
        walk3d: {
          desktop: { source: { kind: "url", url: "https://d28zzqy0iyovbz.cloudfront.net/x/meta.json" }, format: "sog" },
          floorPolygon: [[0, 0], [1, 1]],
          published: false,
        },
      }),
    ).rejects.toThrow(/Tlocrt/);

    const model = await t.run(async (ctx) => storeTyped(ctx, new Uint8Array(1234), "application/octet-stream"));
    await asAdmin.mutation(api.toursAdmin.setWalk3d, {
      listingId: ids.listing,
      walk3d: {
        desktop: { source: { kind: "storage", storageId: model }, format: "spz", bytes: 9_999_999 },
        eyeHeight: 2.75,
        published: true,
      },
    });
    const stored = await t.run(async (ctx) => ctx.db.get("listings", ids.listing));
    expect(stored?.walk3d?.desktop?.bytes).toBe(1234);
    expect(stored?.hasTour).toBe(true);

    const pub = await t.query(api.tours.walk3d, { listingId: ids.listing });
    expect(pub?.desktopBytes).toBe(1234);
    expect(JSON.stringify(pub)).not.toContain(model);
  });

  test("refuses an uploaded 'model' that a browser would render as a page", async () => {
    const { t, ids, asAdmin } = await setup();
    const page = await t.run(async (ctx) => storeTyped(ctx, "<script>alert(1)</script>", "text/html"));
    await expect(
      asAdmin.mutation(api.toursAdmin.setWalk3d, {
        listingId: ids.listing,
        walk3d: { desktop: { source: { kind: "storage", storageId: page }, format: "spz" }, published: false },
      }),
    ).rejects.toThrow(/nije dozvoljen/);
  });

  test("deleting the listing deletes its uploaded panoramas and models", async () => {
    const { t, ids, asAdmin } = await setup();
    const [pano, model] = await t.run(async (ctx) => [
      await storeTyped(ctx, new Uint8Array([255, 216, 255, 224]), "image/jpeg"),
      await storeTyped(ctx, new Uint8Array(64), "application/octet-stream"),
    ]);
    await asAdmin.mutation(api.toursAdmin.upsertScene, {
      listingId: ids.listing,
      title: { sr: "Soba" },
      pano: { kind: "storage", storageId: pano },
    });
    await asAdmin.mutation(api.toursAdmin.setWalk3d, {
      listingId: ids.listing,
      walk3d: { desktop: { source: { kind: "storage", storageId: model }, format: "spz" }, published: false },
    });

    await asAdmin.mutation(api.listingsAdmin.remove, { id: ids.listing });
    const left = await t.run(async (ctx) => ({
      pano: await ctx.db.system.get("_storage", pano),
      model: await ctx.db.system.get("_storage", model),
      scenes: await ctx.db
        .query("tourScenes")
        .withIndex("by_listingId_and_order", (q) => q.eq("listingId", ids.listing))
        .take(5),
    }));
    expect(left.pano).toBeNull();
    expect(left.model).toBeNull();
    expect(left.scenes).toHaveLength(0);
  });
});
