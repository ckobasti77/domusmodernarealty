/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { purgeDemoTable } from "../demo";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

/**
 * Review 14: demo listings that staff made their own survive "Obriši demo";
 * deleting a listing keeps the outcome of held viewings; the dashboard finds
 * every contract that is about to end.
 */

const DAY = 86_400_000;

type RunCtx = Parameters<Parameters<ReturnType<typeof testApp>["run"]>[0]>[0];

/** convex-test records no content type; production storage does. */
async function storeTyped(ctx: RunCtx, contentType: string): Promise<Id<"_storage">> {
  const id = await ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 224])], { type: contentType }));
  await (ctx.db as unknown as { patch: (id: Id<"_storage">, value: { contentType: string }) => Promise<void> }).patch(
    id,
    { contentType },
  );
  return id;
}

async function insertContact(ctx: RunCtx, name: string, isDemo: boolean): Promise<Id<"contacts">> {
  return await ctx.db.insert("contacts", { name, tags: [], consents: [], isDemo });
}

async function insertLead(ctx: RunCtx, listingId: Id<"listings">, isDemo: boolean): Promise<Id<"leads">> {
  return await ctx.db.insert("leads", {
    type: "inquiry",
    status: "new",
    listingId,
    contactId: await insertContact(ctx, "Kupac", isDemo),
    source: "web",
    locale: "sr-Latn",
    consent: { privacy: true, marketing: false, textVersion: "v1", at: Date.now() },
    isDemo,
  });
}

async function insertViewing(
  ctx: RunCtx,
  listingId: Id<"listings">,
  agentId: Id<"agents">,
  status: "requested" | "confirmed" | "done" | "cancelled" | "no_show",
  isDemo = false,
): Promise<Id<"viewings">> {
  const start = Date.now() + (status === "done" || status === "no_show" ? -2 : 2) * DAY;
  return await ctx.db.insert("viewings", {
    listingId,
    agentId,
    start,
    end: start + 3_600_000,
    mode: "in_person",
    status,
    isDemo,
  });
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agent = await makeAgent(ctx, "agent-a");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const agentUser = await makeUser(ctx, "agent", agent);
    return { city, agent, admin, manager, agentUser };
  });
  return { t, ids, asAdmin: t.withIdentity({ subject: ids.admin }) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("demo listings staff made their own", () => {
  test("a copy of a seeded listing is not demo, and the purge leaves it and its upload alone", async () => {
    vi.useFakeTimers();
    const { t, ids, asAdmin } = await setup();
    const seeded = await t.run((ctx) => makeListing(ctx, 1, ids.city, ids.agent));
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    const copy = await asAgent.mutation(api.listingsAdmin.duplicate, { id: seeded });
    const blob = await t.run((ctx) => storeTyped(ctx, "image/jpeg"));
    await asAgent.mutation(api.media.attach, {
      listingId: copy.id,
      target: "gallery",
      items: [{ image: { kind: "storage", storageId: blob }, alt: { sr: "Dnevna soba" } }],
    });
    expect(await t.run((ctx) => ctx.db.get("listings", copy.id))).toMatchObject({
      isDemo: false,
      createdBy: ids.agentUser,
    });

    await asAdmin.mutation(api.demo.purge, { confirm: "OBRIŠI DEMO" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await t.run(async (ctx) => ({
      seeded: await ctx.db.get("listings", seeded),
      copy: await ctx.db.get("listings", copy.id),
      blob: await ctx.db.system.get("_storage", blob),
    }));
    expect(after.seeded).toBeNull();
    expect(after.copy).not.toBeNull();
    expect(after.blob).not.toBeNull();
  });

  test("a real owner adopts a seeded listing; edits and unlinking leave the flag alone", async () => {
    vi.useFakeTimers();
    const { t, ids, asAdmin } = await setup();
    const seeded = await t.run((ctx) => makeListing(ctx, 1, ids.city, ids.agent));
    const isDemo = async () => (await t.run((ctx) => ctx.db.get("listings", seeded)))?.isDemo;

    await asAdmin.mutation(api.listingsAdmin.update, { id: seeded, patch: { title: { sr: "Izmenjen naslov oglasa" } } });
    await asAdmin.mutation(api.listingsAdmin.setOwner, { id: seeded, name: "" });
    expect(await isDemo()).toBe(true);

    await asAdmin.mutation(api.listingsAdmin.setOwner, { id: seeded, name: "Petar Petrović", phone: "+381 64 123 4567" });
    expect(await isDemo()).toBe(false);

    await asAdmin.mutation(api.demo.purge, { confirm: "OBRIŠI DEMO" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get("listings", seeded))).not.toBeNull();
  });

  test("a real owner is never written into a seeded demo contact", async () => {
    const { t, ids, asAdmin } = await setup();
    const { seeded, demoContact } = await t.run(async (ctx) => {
      const demoContact = await insertContact(ctx, "Demo vlasnik", true);
      const seeded = await makeListing(ctx, 1, ids.city, ids.agent);
      await ctx.db.patch("listings", seeded, { ownerContactId: demoContact });
      return { seeded, demoContact };
    });
    await asAdmin.mutation(api.listingsAdmin.setOwner, { id: seeded, name: "Jelena Jović" });

    const after = await t.run(async (ctx) => {
      const listing = await ctx.db.get("listings", seeded);
      const owner = listing?.ownerContactId !== undefined ? await ctx.db.get("contacts", listing.ownerContactId) : null;
      return { listing, owner, demo: await ctx.db.get("contacts", demoContact) };
    });
    expect(after.listing?.isDemo).toBe(false);
    expect(after.owner).toMatchObject({ name: "Jelena Jović", isDemo: false });
    expect(after.owner?._id).not.toBe(demoContact);
    expect(after.demo?.name).toBe("Demo vlasnik");
  });

  test("the purge skips demo listings with uploads or real leads and viewings, reading past them", async () => {
    const { t, ids } = await setup();
    const listings = await t.run(async (ctx) => {
      // The kept ones first: they head the `by_isDemo` index.
      const withPlan = await makeListing(ctx, 1, ids.city, ids.agent);
      const planBlob = await storeTyped(ctx, "image/png");
      await ctx.db.patch("listings", withPlan, {
        floorPlans: [{ id: "plan-1", image: { kind: "storage", storageId: planBlob }, alt: { sr: "Osnova" }, order: 0 }],
      });
      const withLead = await makeListing(ctx, 2, ids.city, ids.agent);
      await insertLead(ctx, withLead, false);
      const withViewing = await makeListing(ctx, 3, ids.city, ids.agent);
      await insertViewing(ctx, withViewing, ids.agent, "confirmed");
      const withScene = await makeListing(ctx, 4, ids.city, ids.agent);
      await ctx.db.insert("tourScenes", {
        listingId: withScene,
        order: 0,
        title: { sr: "Dnevna soba" },
        pano: { kind: "storage", storageId: await storeTyped(ctx, "image/jpeg") },
        links: [],
      });
      // Seeded rows only: demo leads and viewings do not keep a listing.
      const plain = [];
      for (const index of [5, 6, 7]) {
        const id = await makeListing(ctx, index, ids.city, ids.agent);
        await insertLead(ctx, id, true);
        await insertViewing(ctx, id, ids.agent, "requested", true);
        plain.push(id);
      }
      return { kept: [withPlan, withLead, withViewing, withScene], plain, planBlob };
    });

    expect(await t.run((ctx) => purgeDemoTable(ctx, "listings", 2))).toBe(2);
    expect(await t.run((ctx) => purgeDemoTable(ctx, "listings", 2))).toBe(1);
    expect(await t.run((ctx) => purgeDemoTable(ctx, "listings", 2))).toBe(0);

    const left = await t.run(async (ctx) => ({
      kept: await Promise.all(listings.kept.map((id) => ctx.db.get("listings", id))),
      plain: await Promise.all(listings.plain.map((id) => ctx.db.get("listings", id))),
      planBlob: await ctx.db.system.get("_storage", listings.planBlob),
    }));
    expect(left.kept.every((doc) => doc !== null && doc.isDemo)).toBe(true);
    expect(left.plain).toEqual([null, null, null]);
    expect(left.planBlob).not.toBeNull();
  });

  test("bulk demo delete skips a demo listing staff made their own, saying why", async () => {
    vi.useFakeTimers();
    const { t, ids, asAdmin } = await setup();
    const { kept, plain } = await t.run(async (ctx) => {
      const kept = await makeListing(ctx, 1, ids.city, ids.agent);
      const blob = await storeTyped(ctx, "image/jpeg");
      const doc = await ctx.db.get("listings", kept);
      await ctx.db.patch("listings", kept, {
        media: [...(doc?.media ?? []), { id: "up-1", image: { kind: "storage", storageId: blob }, alt: { sr: "Kuhinja" }, order: 6 }],
      });
      return { kept, plain: await makeListing(ctx, 2, ids.city, ids.agent) };
    });

    const result = await asAdmin.mutation(api.listingsAdmin.bulk, { ids: [kept, plain], action: "deleteDemo" });
    expect(result).toEqual({
      done: 1,
      skipped: [{ ref: "ME-2001", reason: "Sadrži otpremljene fajlove (fotografije, ture ili 3D)" }],
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get("listings", kept))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get("listings", plain))).toBeNull();
  });

  test("the purge removes the listing's own old addresses, not a redirect another listing owns", async () => {
    const { t, ids } = await setup();
    const { demo, real } = await t.run(async (ctx) => {
      const demo = await makeListing(ctx, 1, ids.city, ids.agent);
      const real = await makeListing(ctx, 2, ids.city, ids.agent);
      await ctx.db.patch("listings", real, { isDemo: false });
      const taken = (await ctx.db.get("listings", demo))?.slug ?? "";
      // The real listing left this slug earlier; the demo one took it later.
      await ctx.db.insert("slugRedirects", { from: taken, listingId: real, at: Date.now() - DAY });
      await ctx.db.insert("slugRedirects", { from: "stari-demo-oglas", listingId: demo, at: Date.now() });
      return { demo, real };
    });
    await t.run((ctx) => purgeDemoTable(ctx, "listings", 40));

    const redirects = await t.run(async (ctx) => ({
      demo: await ctx.db.query("slugRedirects").withIndex("by_listingId", (q) => q.eq("listingId", demo)).take(10),
      real: await ctx.db.query("slugRedirects").withIndex("by_listingId", (q) => q.eq("listingId", real)).take(10),
    }));
    expect(redirects.demo).toEqual([]);
    expect(redirects.real).toHaveLength(1);
  });
});

describe("deleting a listing", () => {
  test("calls off open viewings and keeps the outcome of held ones", async () => {
    const { t, ids } = await setup();
    const { listing, viewings } = await t.run(async (ctx) => {
      const listing = await makeListing(ctx, 1, ids.city, ids.agent);
      const viewings = {
        requested: await insertViewing(ctx, listing, ids.agent, "requested"),
        confirmed: await insertViewing(ctx, listing, ids.agent, "confirmed"),
        done: await insertViewing(ctx, listing, ids.agent, "done"),
        noShow: await insertViewing(ctx, listing, ids.agent, "no_show"),
      };
      return { listing, viewings };
    });
    await t.withIdentity({ subject: ids.manager }).mutation(api.listingsAdmin.remove, { id: listing });

    const status = await t.run(async (ctx) => ({
      requested: (await ctx.db.get("viewings", viewings.requested))?.status,
      confirmed: (await ctx.db.get("viewings", viewings.confirmed))?.status,
      done: (await ctx.db.get("viewings", viewings.done))?.status,
      noShow: (await ctx.db.get("viewings", viewings.noShow))?.status,
    }));
    expect(status).toEqual({ requested: "cancelled", confirmed: "cancelled", done: "done", noShow: "no_show" });
  });
});

describe("dashboard: contracts ending soon", () => {
  test("every contract ending within two weeks is listed, however long its listing sat untouched", async () => {
    vi.useFakeTimers();
    // 15:00 UTC on 2 Oct 2026.
    const now = Date.UTC(2026, 9, 2, 15);
    vi.setSystemTime(now);
    const { t, ids } = await setup();
    const rows = await t.run(async (ctx) => {
      const agentB = await makeAgent(ctx, "agent-b");
      // 300 listings edited recently, none with a contract ending soon.
      for (let index = 1; index <= 300; index += 1) {
        await makeListing(ctx, index, ids.city, ids.agent, { mediaCount: 1 });
      }
      const ending = async (index: number, end: number, status: "published" | "reserved", agent = ids.agent) => {
        const id = await makeListing(ctx, index, ids.city, agent, { mediaCount: 1, status });
        const doc = await ctx.db.get("listings", id);
        if (doc?.mandate === undefined) throw new Error("fixture missing");
        await ctx.db.patch("listings", id, { mandate: { ...doc.mandate, end }, mandateEnd: end });
        return id;
      };
      return {
        // Untouched for weeks: the oldest `updatedAt` of all.
        stale: await ending(400, now + 5 * DAY, "published"),
        tonight: await ending(401, now + 3 * 3_600_000, "published"),
        reservedB: await ending(402, now + 10 * DAY, "reserved", agentB),
        lastWeek: await ending(403, now - 7 * DAY, "published"),
        later: await ending(404, now + 20 * DAY, "published"),
      };
    });

    const asManager = t.withIdentity({ subject: ids.manager });
    const all = await asManager.query(api.listingsAdmin.todos, { now });
    expect(all.mandateExpiring.map((row) => row.id)).toEqual([rows.tonight, rows.stale, rows.reservedB]);

    const own = await t.withIdentity({ subject: ids.agentUser }).query(api.listingsAdmin.todos, { now });
    expect(own.mandateExpiring.map((row) => row.id)).toEqual([rows.tonight, rows.stale]);
  });
});
