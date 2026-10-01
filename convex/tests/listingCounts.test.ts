/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

type Counts = { status: string; count: number }[];

/** `{ published: 2, draft: 1 }`, zero rows dropped, for compact assertions. */
function nonZero(rows: Counts): Record<string, number> {
  return Object.fromEntries(rows.filter((row) => row.count > 0).map((row) => [row.status, row.count]));
}

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Listings inserted straight into the table (as the seed does, without the
 * counting hook), then counted by the recount migration.
 */
async function setup() {
  vi.useFakeTimers();
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agentA = await makeAgent(ctx, "agent-a");
    const agentB = await makeAgent(ctx, "agent-b");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const agentUser = await makeUser(ctx, "agent", agentA);
    const publishedA = await makeListing(ctx, 1, city, agentA);
    const draftA = await makeListing(ctx, 2, city, agentA, { status: "draft" });
    const publishedB = await makeListing(ctx, 3, city, agentB);
    return { city, agentA, agentB, admin, manager, agentUser, publishedA, draftA, publishedB };
  });
  await t.mutation(internal.countsMigrations.recountListingStatus, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, ids };
}

describe("listing status counters", () => {
  test("before the counters are initialized, counts come from a capped scan", async () => {
    const t = testApp();
    const ids = await t.run(async (ctx) => {
      const city = await makeLocation(ctx, "beograd");
      const agent = await makeAgent(ctx, "agent-a");
      const admin = await makeUser(ctx, "admin");
      await makeListing(ctx, 1, city, agent);
      await makeListing(ctx, 2, city, agent, { status: "draft" });
      return { admin };
    });
    const rows = await t.withIdentity({ subject: ids.admin }).query(api.listingsAdmin.counts, {});
    expect(nonZero(rows)).toEqual({ published: 1, draft: 1 });
    const check = await t.query(internal.countsMigrations.checkListingStatus, {});
    expect(check).toMatchObject({ ok: false, keys: 0, listings: 2 });
  });

  test("the recount rebuilds agency-wide and per-agent counts", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    expect(nonZero(await asAdmin.query(api.listingsAdmin.counts, {}))).toEqual({ published: 2, draft: 1 });
    expect(nonZero(await asAgent.query(api.listingsAdmin.counts, {}))).toEqual({ published: 1, draft: 1 });

    const check = await t.query(internal.countsMigrations.checkListingStatus, {});
    expect(check).toMatchObject({ ok: true, listings: 3, keys: 3 });

    // Running it again changes nothing.
    await t.mutation(internal.countsMigrations.recountListingStatus, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(nonZero(await asAdmin.query(api.listingsAdmin.counts, {}))).toEqual({ published: 2, draft: 1 });
  });

  test("publish, withdraw, reassign and delete keep the counts right", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const asManager = t.withIdentity({ subject: ids.manager });
    const counts = async (subject: Id<"users">) =>
      nonZero(await t.withIdentity({ subject }).query(api.listingsAdmin.counts, {}));

    await asAdmin.mutation(api.listingsAdmin.publish, { id: ids.draftA });
    expect(await counts(ids.admin)).toEqual({ published: 3 });
    expect(await counts(ids.agentUser)).toEqual({ published: 2 });

    await asAdmin.mutation(api.listingsAdmin.unpublish, { id: ids.publishedA });
    expect(await counts(ids.admin)).toEqual({ published: 2, withdrawn: 1 });

    await asAdmin.mutation(api.listingsAdmin.setStatus, { id: ids.publishedB, status: "sold" });
    expect(await counts(ids.admin)).toEqual({ published: 1, withdrawn: 1, sold: 1 });

    // Reassigning moves the listing between the agents' own counts only.
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.publishedA, patch: { agentId: ids.agentB } });
    expect(await counts(ids.agentUser)).toEqual({ published: 1 });
    expect(await counts(ids.admin)).toEqual({ published: 1, withdrawn: 1, sold: 1 });

    await asManager.mutation(api.listingsAdmin.remove, { id: ids.publishedA });
    expect(await counts(ids.admin)).toEqual({ published: 1, sold: 1 });

    const dashboard = await asManager.query(api.analytics.dashboard, { now: Date.now() });
    expect(dashboard).toMatchObject({ activeListings: 1, draftListings: 0, newLeads7dCapped: false });

    const check = await t.query(internal.countsMigrations.checkListingStatus, {});
    expect(check.ok).toBe(true);
  });

  test("an autosave that changes nothing counted writes no counter row", async () => {
    const { t, ids } = await setup();
    const before = await t.run(async (ctx) => ctx.db.query("listingStatusCounts").collect());
    await t
      .withIdentity({ subject: ids.admin })
      .mutation(api.listingsAdmin.update, { id: ids.draftA, patch: { price: 210_000 } });
    const after = await t.run(async (ctx) => ctx.db.query("listingStatusCounts").collect());
    expect(after.map((row) => [row._id, row.count])).toEqual(before.map((row) => [row._id, row.count]));
  });

  test("re-applying every listing (location rebuild) cannot double-count", async () => {
    const { t, ids } = await setup();
    await t.mutation(internal.listingsInternal.rebuildLocationCounts, {});
    await t.mutation(internal.listingsInternal.rebuildLocationCounts, {});
    const rows = await t.withIdentity({ subject: ids.admin }).query(api.listingsAdmin.counts, {});
    expect(nonZero(rows)).toEqual({ published: 2, draft: 1 });
  });

  test("a listing inserted without the hook is counted on its next save", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const created = await asAdmin.mutation(api.listingsAdmin.create, {
      transaction: "sale",
      propertyType: "apartment",
      cityId: ids.city,
      agentId: ids.agentA,
      titleSr: "Nov stan na Vračaru za test",
    });
    await asAdmin.mutation(api.listingsAdmin.update, { id: created.id, patch: { price: 150_000 } });
    expect(nonZero(await asAdmin.query(api.listingsAdmin.counts, {}))).toEqual({ published: 2, draft: 2 });
    const check = await t.query(internal.countsMigrations.checkListingStatus, {});
    expect(check.ok).toBe(true);
  });
});
