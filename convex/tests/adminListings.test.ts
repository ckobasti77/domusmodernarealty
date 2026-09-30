/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

const PAGE = { cursor: null, numItems: 20 };

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agentA = await makeAgent(ctx, "agent-a");
    const agentB = await makeAgent(ctx, "agent-b");
    const admin = await makeUser(ctx, "admin");
    const agentUser = await makeUser(ctx, "agent", agentA);
    const listingA = await makeListing(ctx, 1, city, agentA, { status: "draft" });
    const listingB = await makeListing(ctx, 2, city, agentB, { price: 300_000 });
    return { city, agentA, agentB, admin, agentUser, listingA, listingB };
  });
  return { t, ids };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("publish checklist context", () => {
  test("a listing whose agent is hidden from the site cannot be published", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => ctx.db.patch("agents", ids.agentA, { isPublic: false }));
    const asAdmin = t.withIdentity({ subject: ids.admin });

    await expect(
      asAdmin.mutation(api.listingsAdmin.publish, { id: ids.listingA }),
    ).rejects.toThrow(/PUBLISH_BLOCKED|blokirana/);

    const detail = await asAdmin.query(api.listingsAdmin.get, { id: ids.listingA, now: Date.now() });
    const agentItem = detail?.checklist.find((item) => item.code === "agent");
    expect(agentItem?.ok).toBe(false);
  });

  test("the demo registry number is a warning, never a blocker", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) =>
      ctx.db.insert("settings", {
        key: "global",
        companyName: "Mihajlo Estate",
        legalName: "Mihajlo Estate d.o.o.",
        address: "Beograd",
        pib: "000000000",
        mb: "00000000",
        registryNo: "000",
        phones: [],
        email: "info@example.test",
        socials: {},
        officeHours: [],
        commissionText: { sr: "Provizija" },
        mortgage: { rate: 4.5, years: 25, downPct: 20 },
        stats: [],
        seo: { defaultTitle: { sr: "x" }, defaultDescription: { sr: "x" } },
        analytics: {},
        isDemo: true,
        updatedAt: Date.now(),
      }),
    );
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const detail = await asAdmin.query(api.listingsAdmin.get, { id: ids.listingA, now: Date.now() });
    const registry = detail?.checklist.find((item) => item.code === "registry");
    expect(registry).toMatchObject({ ok: false, warning: true });
    expect(detail?.checklistContext.registryOk).toBe(false);

    const result = await asAdmin.mutation(api.listingsAdmin.publish, { id: ids.listingA });
    expect(result.status).toBe("published");
  });
});

describe("admin listing table", () => {
  test("an agent is pinned to their own listings whatever filter they send", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    const own = await asAgent.query(api.listingsAdmin.list, { paginationOpts: PAGE });
    expect(own.page.map((row) => row._id)).toEqual([ids.listingA]);

    const spoofed = await asAgent.query(api.listingsAdmin.list, {
      agentId: ids.agentB,
      paginationOpts: PAGE,
    });
    expect(spoofed.page.map((row) => row._id)).toEqual([ids.listingA]);

    const counts = await asAgent.query(api.listingsAdmin.counts, {});
    expect(counts.find((row) => row.status === "draft")?.count).toBe(1);
    expect(counts.find((row) => row.status === "published")?.count).toBe(0);
  });

  test("text search and quick find match the reference number", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });

    const byText = await asAdmin.query(api.listingsAdmin.list, {
      q: "ME-2002",
      paginationOpts: PAGE,
    });
    expect(byText.page.map((row) => row._id)).toContain(ids.listingB);

    const quick = await asAdmin.query(api.listingsAdmin.quickFind, { q: "2002" });
    expect(quick[0]?._id).toBe(ids.listingB);
  });

  test("bulk demo delete removes demo rows and skips real ones", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const real = await t.run(async (ctx) => {
      const id = await makeListing(ctx, 3, ids.city, ids.agentA);
      await ctx.db.patch("listings", id, { isDemo: false });
      return id;
    });
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const result = await asAdmin.mutation(api.listingsAdmin.bulk, {
      ids: [ids.listingB, real],
      action: "deleteDemo",
    });
    expect(result.done).toBe(1);
    expect(result.skipped).toEqual([{ ref: "ME-2003", reason: "Nije demo nekretnina" }]);
    // Each deletion runs in its own scheduled transaction.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(async (ctx) => ({
      demo: await ctx.db.get("listings", ids.listingB),
      real: await ctx.db.get("listings", real),
    }));
    expect(left.demo).toBeNull();
    expect(left.real).not.toBeNull();
  });
});

describe("editor side effects", () => {
  test("emptied optional fields are cleared, and places must form one chain", async () => {
    const { t, ids } = await setup();
    const places = await t.run(async (ctx) => {
      const vracar = await makeLocation(ctx, "vracar", "municipality", ids.city);
      const neimar = await makeLocation(ctx, "neimar", "neighborhood", vracar);
      const other = await makeLocation(ctx, "novi-sad");
      const liman = await makeLocation(ctx, "liman", "municipality", other);
      return { vracar, neimar, liman };
    });
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await asAdmin.mutation(api.listingsAdmin.update, {
      id: ids.listingA,
      patch: { yearBuilt: 1938, municipalityId: places.vracar, neighborhoodId: places.neimar },
    });

    // A municipality of another city is refused.
    await expect(
      asAdmin.mutation(api.listingsAdmin.update, {
        id: ids.listingA,
        patch: { municipalityId: places.liman },
      }),
    ).rejects.toThrow(/ne pripada/);

    await asAdmin.mutation(api.listingsAdmin.update, {
      id: ids.listingA,
      patch: {},
      unset: ["yearBuilt", "neighborhoodId", "municipalityId"],
    });
    const doc = await t.run(async (ctx) => ctx.db.get("listings", ids.listingA));
    expect(doc?.yearBuilt).toBeUndefined();
    expect(doc?.municipalityId).toBeUndefined();
    expect(doc?.neighborhoodId).toBeUndefined();
  });

  test("document verification is attributed to the caller, not the client", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const at = Date.now();
    await asAgent.mutation(api.listingsAdmin.update, {
      id: ids.listingA,
      patch: {
        legal: {
          registration: "registered",
          legalization: "legal",
          docsVerifiedAt: at - 86_400_000 * 30,
          docsVerifiedBy: ids.admin,
        },
      },
    });
    const doc = await t.run(async (ctx) => ctx.db.get("listings", ids.listingA));
    expect(doc?.legal.docsVerifiedBy).toBe(ids.agentUser);
    // Stamped by the server, not the client-supplied (possibly backdated) time.
    expect(doc?.legal.docsVerifiedAt).toBeGreaterThanOrEqual(at);

    // A later autosave with a different time keeps the original stamp.
    await asAgent.mutation(api.listingsAdmin.update, {
      id: ids.listingA,
      patch: { legal: { registration: "registered", legalization: "legal", docsVerifiedAt: 1 } },
    });
    const again = await t.run(async (ctx) => ctx.db.get("listings", ids.listingA));
    expect(again?.legal.docsVerifiedAt).toBe(doc?.legal.docsVerifiedAt);
  });

  test("the owner contact is private staff data", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await asAdmin.mutation(api.listingsAdmin.setOwner, {
      id: ids.listingB,
      name: "Petar Petrović",
      phone: "+381 64 123 4567",
    });
    const detail = await asAdmin.query(api.listingsAdmin.get, { id: ids.listingB, now: Date.now() });
    expect(detail?.owner).toMatchObject({ name: "Petar Petrović", phone: "+381 64 123 4567" });

    const slug = detail?.listing.slug ?? "";
    const pub = await t.query(api.listings.bySlug, { slug });
    expect(pub.kind).toBe("listing");
    expect(JSON.stringify(pub)).not.toContain("Petrović");
    expect(JSON.stringify(pub)).not.toContain("ownerContactId");
  });

  test("a preview link works for staff and dies when its token is cleared", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const { token, expiresAt } = await asAdmin.mutation(api.listingsAdmin.rotatePreviewToken, {
      id: ids.listingA,
    });
    const slug = (await t.run(async (ctx) => ctx.db.get("listings", ids.listingA)))?.slug ?? "";

    expect((await t.query(api.listings.bySlug, { slug })).kind).toBe("missing");
    const preview = await t.query(api.listings.previewBySlug, { slug, token, now: Date.now() });
    expect(preview?.ref).toBe("ME-2001");

    // The scheduled expiry clears the token server-side, so a caller who lies
    // about `now` still loses access.
    await t.mutation(internal.listingsInternal.expirePreviewToken, { id: ids.listingA, token });
    expect(
      await t.query(api.listings.previewBySlug, { slug, token, now: expiresAt - 1 }),
    ).toBeNull();
  });

  test("a duplicate gets its own blobs, no contract and no preview token", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const storageId: Id<"_storage"> = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 224])], { type: "image/jpeg" })),
    );
    await t.run(async (ctx) => {
      const doc = await ctx.db.get("listings", ids.listingA);
      if (doc === null) throw new Error("fixture missing");
      await ctx.db.patch("listings", ids.listingA, {
        previewToken: "x".repeat(40),
        media: [
          ...doc.media,
          {
            id: "stored-1",
            image: { kind: "storage", storageId },
            alt: { sr: "Uploadovana" },
            order: doc.media.length,
          },
        ],
      });
    });

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const { id } = await asAdmin.mutation(api.listingsAdmin.duplicate, { id: ids.listingA });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const copy = await t.run(async (ctx) => ctx.db.get("listings", id));
    expect(copy?.mandate).toBeUndefined();
    expect(copy?.previewToken).toBeUndefined();
    expect(copy?.status).toBe("draft");
    const stored = copy?.media.filter((item) => item.image.kind === "storage") ?? [];
    expect(stored).toHaveLength(1);
    const copiedImage = stored[0]?.image;
    expect(copiedImage?.kind === "storage" ? copiedImage.storageId : null).not.toBe(storageId);
    expect(copy?.media.map((item) => item.order)).toEqual(copy?.media.map((_item, index) => index));
  });
});
