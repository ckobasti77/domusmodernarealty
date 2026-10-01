/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

const CENTER = { lat: 44.8125, lng: 20.4612 };

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const vracar = await makeLocation(ctx, "vracar", "municipality", city);
    const agentProfile = await makeAgent(ctx, "agent-a");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const editor = await makeUser(ctx, "editor");
    const agentUser = await makeUser(ctx, "agent", agentProfile);
    return { city, vracar, agentProfile, admin, manager, editor, agentUser };
  });
  return {
    t,
    ids,
    asAdmin: t.withIdentity({ subject: ids.admin }),
    asManager: t.withIdentity({ subject: ids.manager }),
    asEditor: t.withIdentity({ subject: ids.editor }),
    asAgent: t.withIdentity({ subject: ids.agentUser }),
  };
}

async function activityFor(t: ReturnType<typeof testApp>, entityId: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("activity")
      .withIndex("by_entityId_and_at", (q) => q.eq("entityId", entityId))
      .order("desc")
      .take(20),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("roles", () => {
  test("an editor creates and edits a location; an agent may only read the tree", async () => {
    vi.useFakeTimers();
    const { t, ids, asEditor, asAgent } = await setup();

    const created = await asEditor.mutation(api.locationsAdmin.upsert, {
      kind: "neighborhood",
      parentId: ids.vracar,
      name: { sr: "Neimar", en: "Neimar" },
      ...CENTER,
      featured: false,
    });
    expect(created.slug).toBe("neimar");
    const doc = await t.run(async (ctx) => ctx.db.get("locations", created.id));
    expect(doc).toMatchObject({ kind: "neighborhood", parentId: ids.vracar, isDemo: false });
    // Unique across the table: after the fixtures' order 0.
    expect(doc?.order).toBe(1);
    expect((await activityFor(t, created.id))[0]).toMatchObject({
      action: "location.created",
      by: ids.editor,
    });

    await asEditor.mutation(api.locationsAdmin.upsert, {
      id: ids.vracar,
      kind: "municipality",
      parentId: ids.city,
      name: { sr: "Vračar", en: "Vracar" },
      avgPricePerM2Sale: 4800,
      avgPricePerM2Rent: 14.5,
      ...CENTER,
      featured: true,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const updated = await t.run(async (ctx) => ctx.db.get("locations", ids.vracar));
    // A rename keeps the public URL; editing seeded content makes it real.
    expect(updated).toMatchObject({ slug: "vracar", featured: true, avgPricePerM2Sale: 4800, isDemo: false });
    const [log] = await activityFor(t, ids.vracar);
    expect(log).toMatchObject({ action: "location.updated", by: ids.editor });
    const fields = log?.diff?.map((entry) => entry.field) ?? [];
    expect(fields).toEqual(expect.arrayContaining(["name.sr", "avgPricePerM2Sale", "featured"]));
    expect(fields).not.toContain("slug");

    await expect(
      asAgent.mutation(api.locationsAdmin.upsert, {
        kind: "city",
        name: { sr: "Subotica" },
        lat: 46.1,
        lng: 19.66,
        featured: false,
      }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(asAgent.query(api.locationsAdmin.get, { id: ids.city })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    const tree = await asAgent.query(api.locationsAdmin.tree, {});
    expect(tree.map((row) => row.kind)).toEqual(["city", "municipality", "neighborhood"]);
  });

  test("only admin and manager delete", async () => {
    const { t, ids, asEditor, asManager } = await setup();
    const leaf = await t.run(async (ctx) => makeLocation(ctx, "neimar", "neighborhood", ids.vracar));
    await expect(asEditor.mutation(api.locationsAdmin.remove, { id: leaf })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await asManager.mutation(api.locationsAdmin.remove, { id: leaf });
    expect(await t.run(async (ctx) => ctx.db.get("locations", leaf))).toBeNull();
  });
});

describe("hierarchy", () => {
  test("each kind only goes under the kinds that may hold it", async () => {
    const { t, ids, asEditor } = await setup();
    const neighborhood = await t.run(async (ctx) => makeLocation(ctx, "neimar", "neighborhood", ids.vracar));
    const base = { ...CENTER, featured: false };

    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, { ...base, kind: "municipality", name: { sr: "Zemun" } }),
    ).rejects.toThrow(/pripadati gradu/);
    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, {
        ...base,
        kind: "municipality",
        parentId: ids.vracar,
        name: { sr: "Zemun" },
      }),
    ).rejects.toThrow(/samo gradu/);
    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, {
        ...base,
        kind: "neighborhood",
        parentId: neighborhood,
        name: { sr: "Crveni krst" },
      }),
    ).rejects.toThrow(/opštini ili gradu/);
    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, {
        ...base,
        kind: "city",
        parentId: ids.city,
        name: { sr: "Pančevo" },
      }),
    ).rejects.toThrow(/najvišeg nivoa/);
    // A kind is fixed once created.
    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, {
        ...base,
        id: neighborhood,
        kind: "municipality",
        parentId: ids.city,
        name: { sr: "Neimar" },
      }),
    ).rejects.toThrow(/Vrsta lokacije/);

    // A neighborhood may sit right under a city (Novi Sad has no municipalities here).
    const direct = await asEditor.mutation(api.locationsAdmin.upsert, {
      ...base,
      kind: "neighborhood",
      parentId: ids.city,
      name: { sr: "Ada Ciganlija" },
    });
    expect(direct.slug).toBe("ada-ciganlija");
  });

  test("a location that listings use cannot move to another parent", async () => {
    const { t, ids, asEditor } = await setup();
    const setupIds = await t.run(async (ctx) => {
      const zvezdara = await makeLocation(ctx, "zvezdara", "municipality", ids.city);
      const neimar = await makeLocation(ctx, "neimar", "neighborhood", ids.vracar);
      const empty = await makeLocation(ctx, "prazno", "neighborhood", ids.vracar);
      await makeListing(ctx, 1, ids.city, ids.agentProfile, {
        status: "draft",
        municipalityId: ids.vracar,
        neighborhoodId: neimar,
      });
      return { zvezdara, neimar, empty };
    });
    const move = (id: Id<"locations">, name: string) =>
      asEditor.mutation(api.locationsAdmin.upsert, {
        id,
        kind: "neighborhood",
        parentId: setupIds.zvezdara,
        name: { sr: name },
        ...CENTER,
        featured: false,
      });

    await expect(move(setupIds.neimar, "Neimar")).rejects.toThrow(/koriste nekretnine/);
    await move(setupIds.empty, "Prazno");
    const moved = await t.run(async (ctx) => ctx.db.get("locations", setupIds.empty));
    expect(moved?.parentId).toBe(setupIds.zvezdara);
  });
});

describe("validation", () => {
  test("slugs are unique: an explicit clash is refused, a derived one gets a suffix", async () => {
    const { t, ids, asEditor } = await setup();
    const base = { kind: "municipality" as const, parentId: ids.city, ...CENTER, featured: false };

    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, { ...base, name: { sr: "Vračar novi" }, slug: "Vračar" }),
    ).rejects.toThrow(/zauzeta/);

    const derived = await asEditor.mutation(api.locationsAdmin.upsert, { ...base, name: { sr: "Vračar" } });
    expect(derived.slug).toBe("vracar-2");

    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, {
        ...base,
        id: derived.id,
        name: { sr: "Vračar" },
        slug: "beograd",
      }),
    ).rejects.toThrow(/zauzeta/);

    const renamed = await asEditor.mutation(api.locationsAdmin.upsert, {
      ...base,
      id: derived.id,
      name: { sr: "Vračar" },
      slug: "vracar-istok",
    });
    expect(renamed.slug).toBe("vracar-istok");
    expect((await t.run(async (ctx) => ctx.db.get("locations", derived.id)))?.slug).toBe("vracar-istok");
  });

  test("coordinates outside Serbia, negative prices and foreign cover hosts are refused", async () => {
    const { ids, asEditor } = await setup();
    const base = {
      id: ids.vracar,
      kind: "municipality" as const,
      parentId: ids.city,
      name: { sr: "Vračar" },
      featured: false,
    };

    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, { ...base, lat: CENTER.lng, lng: CENTER.lat }),
    ).rejects.toThrow(/u Srbiji/);
    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, { ...base, ...CENTER, avgPricePerM2Sale: -1 }),
    ).rejects.toThrow(/negativna/);
    await expect(
      asEditor.mutation(api.locationsAdmin.upsert, {
        ...base,
        ...CENTER,
        cover: { kind: "url", url: "https://example.com/vracar.jpg" },
      }),
    ).rejects.toThrow(/nije dozvoljena/);
  });

  test("replacing an uploaded cover frees the old blob", async () => {
    const { t, ids, asEditor } = await setup();
    const storageId: Id<"_storage"> = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 224])], { type: "image/jpeg" })),
    );
    const base = {
      id: ids.vracar,
      kind: "municipality" as const,
      parentId: ids.city,
      name: { sr: "vracar", en: "vracar" },
      ...CENTER,
      featured: false,
    };

    // convex-test records no content type, so the upload is linked directly
    // (the upsert would rightly refuse a blob that is not a known image type).
    await t.run(async (ctx) => ctx.db.patch("locations", ids.vracar, { cover: { kind: "storage", storageId } }));
    const detail = await asEditor.query(api.locationsAdmin.get, { id: ids.vracar });
    expect(detail?.coverUrl).toBeTypeOf("string");

    await asEditor.mutation(api.locationsAdmin.upsert, {
      ...base,
      cover: { kind: "url", url: "https://images.unsplash.com/photo-1632343084054-5b108ffb8be3" },
    });
    expect(await t.run(async (ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  });
});

describe("delete", () => {
  test("refused while children or any listing (drafts too) use it", async () => {
    const { t, ids, asAdmin } = await setup();
    await expect(asAdmin.mutation(api.locationsAdmin.remove, { id: ids.city })).rejects.toThrow(
      /podređene lokacije/,
    );

    await t.run(async (ctx) =>
      makeListing(ctx, 1, ids.city, ids.agentProfile, { status: "draft", municipalityId: ids.vracar }),
    );
    await expect(asAdmin.mutation(api.locationsAdmin.remove, { id: ids.vracar })).rejects.toThrow(
      /koristi na nekretninama/,
    );
    const detail = await asAdmin.query(api.locationsAdmin.get, { id: ids.vracar });
    expect(detail).toMatchObject({ inUse: true, hasChildren: false, saleCount: 0 });
  });

  test("an unused leaf is deleted, dropped from agents' areas and logged", async () => {
    const { t, ids, asAdmin } = await setup();
    const leaf = await t.run(async (ctx) => {
      const id = await makeLocation(ctx, "neimar", "neighborhood", ids.vracar);
      await ctx.db.patch("agents", ids.agentProfile, { areas: [ids.vracar, id] });
      return id;
    });

    await asAdmin.mutation(api.locationsAdmin.remove, { id: leaf });

    const agent = await t.run(async (ctx) => ctx.db.get("agents", ids.agentProfile));
    expect(agent?.areas).toEqual([ids.vracar]);
    expect((await activityFor(t, leaf))[0]).toMatchObject({ action: "location.deleted", by: ids.admin });
  });
});

describe("reorder", () => {
  test("permutes one level with strictly increasing orders and refuses a stale list", async () => {
    const { t, ids, asEditor, asAgent } = await setup();
    // The fixtures give every row order 0: the slots must still come out distinct.
    const [a, b] = await t.run(async (ctx) => [
      await makeLocation(ctx, "zemun", "municipality", ids.city),
      await makeLocation(ctx, "zvezdara", "municipality", ids.city),
    ]);

    await expect(
      asAgent.mutation(api.locationsAdmin.reorder, { parentId: ids.city, ids: [b, a, ids.vracar] }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asEditor.mutation(api.locationsAdmin.reorder, { parentId: ids.city, ids: [b, a] }),
    ).rejects.toThrow(/u međuvremenu promenio/);
    await expect(
      asEditor.mutation(api.locationsAdmin.reorder, { parentId: ids.city, ids: [b, a, a] }),
    ).rejects.toThrow(/u međuvremenu promenio/);

    await asEditor.mutation(api.locationsAdmin.reorder, { parentId: ids.city, ids: [b, a, ids.vracar] });

    const children = await t.run(async (ctx) =>
      ctx.db
        .query("locations")
        .withIndex("by_parentId_and_order", (q) => q.eq("parentId", ids.city))
        .take(10),
    );
    expect(children.map((doc) => doc._id)).toEqual([b, a, ids.vracar]);
    expect(new Set(children.map((doc) => doc.order)).size).toBe(3);
    expect((await activityFor(t, ids.city))[0]).toMatchObject({ action: "location.reordered", by: ids.editor });
  });
});

describe("rename", () => {
  test("re-indexes the search text of every listing that uses the location", async () => {
    vi.useFakeTimers();
    const { t, ids, asEditor } = await setup();
    const [published, draft] = await t.run(async (ctx) => [
      await makeListing(ctx, 1, ids.city, ids.agentProfile),
      await makeListing(ctx, 2, ids.city, ids.agentProfile, { status: "draft", transaction: "rent" }),
    ]);

    await asEditor.mutation(api.locationsAdmin.upsert, {
      id: ids.city,
      kind: "city",
      name: { sr: "Beograd", en: "Belgrade", ru: "Белград", de: "Belgrad" },
      ...CENTER,
      featured: true,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const texts = await t.run(async (ctx) => [
      (await ctx.db.get("listings", published))?.searchText ?? "",
      (await ctx.db.get("listings", draft))?.searchText ?? "",
    ]);
    for (const text of texts) {
      expect(text).toContain("belgrade");
      expect(text).toContain("belgrad");
    }
  });
});
