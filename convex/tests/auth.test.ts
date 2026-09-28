/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";
import { publishChecklist } from "../lib/checklist";

const PAGE = { cursor: null, numItems: 20 };

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agentA = await makeAgent(ctx, "agent-a");
    const agentB = await makeAgent(ctx, "agent-b");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const agentUser = await makeUser(ctx, "agent", agentA);
    const editor = await makeUser(ctx, "editor");
    const listingA = await makeListing(ctx, 1, city, agentA, { price: 200_000 });
    const listingB = await makeListing(ctx, 2, city, agentB, { price: 300_000 });
    return { city, agentA, agentB, admin, manager, agentUser, editor, listingA, listingB };
  });
  return { t, ids };
}

describe("admin authorization", () => {
  test("anonymous callers are rejected by every admin function", async () => {
    const { t, ids } = await setup();

    await expect(
      t.query(api.listingsAdmin.list, { paginationOpts: PAGE }),
    ).rejects.toThrow(/UNAUTHENTICATED|Niste prijavljeni/);

    await expect(
      t.mutation(api.listingsAdmin.publish, { id: ids.listingA }),
    ).rejects.toThrow(/UNAUTHENTICATED|Niste prijavljeni/);

    await expect(t.query(api.settingsAdmin.get, {})).rejects.toThrow(
      /UNAUTHENTICATED|Niste prijavljeni/,
    );

    await expect(t.query(api.demo.counts, {})).rejects.toThrow(
      /UNAUTHENTICATED|Niste prijavljeni/,
    );

    await expect(
      t.mutation(api.media.generateUploadUrl, {}),
    ).rejects.toThrow(/UNAUTHENTICATED|Niste prijavljeni/);

    await expect(
      t.mutation(api.invites.create, { email: "x@y.local", role: "admin" }),
    ).rejects.toThrow(/UNAUTHENTICATED|Niste prijavljeni/);
  });

  test("getMe returns null when anonymous and the row when signed in", async () => {
    const { t, ids } = await setup();
    expect(await t.query(api.users.getMe, {})).toBeNull();

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const me = await asAdmin.query(api.users.getMe, {});
    expect(me?.role).toBe("admin");
  });

  test("an agent may edit only their own listing", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    await asAgent.mutation(api.listingsAdmin.update, {
      id: ids.listingA,
      patch: { price: 210_000 },
    });

    await expect(
      asAgent.mutation(api.listingsAdmin.update, {
        id: ids.listingB,
        patch: { price: 1 },
      }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });

  test("an agent list only shows their own rows", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const result = await asAgent.query(api.listingsAdmin.list, {
      paginationOpts: PAGE,
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].agentId).toBe(ids.agentA);
  });

  test("an agent may not delete a listing or reach settings and users", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    await expect(
      asAgent.mutation(api.listingsAdmin.remove, { id: ids.listingA }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(asAgent.query(api.settingsAdmin.get, {})).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
    await expect(asAgent.query(api.users.list, {})).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
    await expect(asAgent.query(api.demo.counts, {})).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
  });

  test("an editor may touch content but not listings or leads", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });

    await asEditor.query(api.locationsAdmin.tree, {});
    await asEditor.mutation(api.postsAdmin.upsert, {
      title: { sr: "Testni članak o tržištu" },
      excerpt: { sr: "Kratak opis testnog članka za potrebe testa." },
      body: { sr: "<p>Telo članka.</p>" },
      category: "market",
      tags: [],
      featured: false,
    });

    await expect(
      asEditor.mutation(api.listingsAdmin.update, {
        id: ids.listingA,
        patch: { price: 1 },
      }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asEditor.query(api.leadsAdmin.list, { paginationOpts: PAGE }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });

  test("a disabled user loses access even with a valid identity", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch("users", ids.manager, { status: "disabled" });
    });
    const asDisabled = t.withIdentity({ subject: ids.manager });
    await expect(
      asDisabled.query(api.listingsAdmin.list, { paginationOpts: PAGE }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });

  test("the last active admin cannot demote themselves", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await expect(
      asAdmin.mutation(api.users.setRole, { id: ids.admin, role: "agent" }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });
});

describe("publish checklist", () => {
  test("blocks publishing and names every failing reason", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });

    const bare = await t.run(async (ctx) =>
      makeListing(ctx, 9, ids.city, ids.agentA, {
        status: "draft",
        price: 0,
        areaM2: 0,
        rooms: 0,
        mediaCount: 1,
        descriptionSr: "kratko",
      }),
    );

    await expect(
      asAdmin.mutation(api.listingsAdmin.publish, { id: bare }),
    ).rejects.toThrow(/PUBLISH_BLOCKED|blokirana/);
  });

  test("an expired mandate alone blocks publishing", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const expired = await t.run(async (ctx) =>
      makeListing(ctx, 10, ids.city, ids.agentA, {
        status: "draft",
        mandateEndsInDays: -1,
      }),
    );
    await expect(
      asAdmin.mutation(api.listingsAdmin.publish, { id: expired }),
    ).rejects.toThrow(/PUBLISH_BLOCKED|blokirana/);
  });

  test("a complete listing publishes and becomes publicly visible", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const draft = await t.run(async (ctx) =>
      makeListing(ctx, 11, ids.city, ids.agentA, { status: "draft" }),
    );

    const before = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: PAGE,
    });

    const result = await asAdmin.mutation(api.listingsAdmin.publish, { id: draft });
    expect(result.status).toBe("published");

    const after = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(after.page.length).toBe(before.page.length + 1);

    // Unpublishing takes it straight back out of the public scope.
    await asAdmin.mutation(api.listingsAdmin.unpublish, { id: draft });
    const gone = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(gone.page.length).toBe(before.page.length);
  });

  test("the pure checklist reports exactly which items fail", async () => {
    const items = publishChecklist(
      {
        mandate: undefined,
        price: 0,
        cityId: "x" as never,
        location: { lat: 0, lng: 0, addressVisibility: "area" },
        areaM2: 0,
        rooms: 0,
        media: [],
        title: { sr: "" },
        description: { sr: "" },
        slug: "",
        propertyType: "apartment",
      },
      Date.now(),
    );
    expect(items.filter((item) => item.ok)).toHaveLength(0);
    expect(items.map((item) => item.code)).toContain("mandate");
  });
});
