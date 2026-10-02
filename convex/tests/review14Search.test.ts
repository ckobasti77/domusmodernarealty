import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { applyDerived, locationNamesFor } from "../lib/derive";
import { floorToNumber } from "../lib/money";
import type { SearchFilters } from "../lib/validators";
import { makeAgent, makeListing, makeLocation } from "./fixtures";

/**
 * Review 14 regressions in the public search: Cyrillic and decomposed queries,
 * queries with nothing searchable in them, the 4.5-room structure, the "not
 * the top floor" band, and the `searchText` rebuild after the fold changed.
 */

const PAGE = { cursor: null, numItems: 24 };

afterEach(() => {
  vi.useRealTimers();
});

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => ({
    city: await makeLocation(ctx, "beograd"),
    agent: await makeAgent(ctx, "agent-one"),
  }));
  return { t, ids };
}

/** Search, count and map for one filter set, as ids. */
async function everyView(t: ReturnType<typeof testApp>, filters: SearchFilters) {
  const sort = filters.q !== undefined ? "relevance" : "newest";
  const list = await t.query(api.listings.search, { filters, sort, paginationOpts: PAGE });
  const count = await t.query(api.listings.count, { filters });
  const map = await t.query(api.listings.mapPoints, { filters });
  return {
    list: list.page.map((card) => card._id).sort(),
    count,
    map: map.points.map((point) => point._id).sort(),
  };
}

describe("text search across scripts", () => {
  test("a Cyrillic or decomposed query finds the Latin listing; list, count and map agree", async () => {
    const { t, ids } = await setup();
    const dorcol = await t.run(async (ctx) => {
      await makeListing(ctx, 2, ids.city, ids.agent, { titleSr: "Kuća Senjak vila sa baštom" });
      return await makeListing(ctx, 1, ids.city, ids.agent, { titleSr: "Stan Dorćol centar terasa" });
    });

    // Serbian Cyrillic, the Russian spelling, and "č" typed as c + combining caron.
    for (const q of ["Дорћол", "Дорчол", "ДОРЋОЛ", "Dorc\u030Col"]) {
      const views = await everyView(t, { transaction: "sale", q });
      expect(views.list, q).toEqual([dorcol]);
      expect(views.count, q).toEqual({ count: 1, exact: true });
      expect(views.map, q).toEqual([dorcol]);
    }
  });

  test("a query with nothing searchable in it matches nothing, a blank one is no query", async () => {
    const { t, ids } = await setup();
    const all = await t.run(async (ctx) => [
      await makeListing(ctx, 1, ids.city, ids.agent),
      await makeListing(ctx, 2, ids.city, ids.agent),
    ]);

    for (const q of ["###", "😀", "東京"]) {
      const views = await everyView(t, { transaction: "sale", q });
      expect(views, q).toEqual({ list: [], count: { count: 0, exact: true }, map: [] });
    }
    const blank = await everyView(t, { transaction: "sale", q: "   " });
    expect(blank.list).toEqual([...all].sort());
    expect(blank.count).toEqual({ count: 2, exact: true });
  });
});

describe("structure and floor filters", () => {
  test("a 4.5-room listing is found by its own chip, not by 4 or 5+", async () => {
    const { t, ids } = await setup();
    const listing = await t.run(async (ctx) => makeListing(ctx, 1, ids.city, ids.agent, { rooms: 4.5 }));
    expect((await everyView(t, { transaction: "sale", rooms: [4.5] })).list).toEqual([listing]);
    expect((await everyView(t, { transaction: "sale", rooms: [4] })).list).toEqual([]);
    expect((await everyView(t, { transaction: "sale", rooms: [5] })).list).toEqual([]);
  });

  test("an attic or a penthouse is never 'not the top floor', building height known or not", async () => {
    const { t, ids } = await setup();
    const middle = await t.run(async (ctx) => {
      await makeListing(ctx, 2, ids.city, ids.agent, { floor: "PK", totalFloors: 5 });
      const atticUnknown = await makeListing(ctx, 3, ids.city, ids.agent, { floor: "PK" });
      await ctx.db.patch("listings", atticUnknown, { totalFloors: undefined, floorNum: floorToNumber("PK") });
      const penthouse = await makeListing(ctx, 4, ids.city, ids.agent, { floor: 7 });
      await ctx.db.patch("listings", penthouse, { totalFloors: undefined, isPenthouse: true });
      return await makeListing(ctx, 1, ids.city, ids.agent, { floor: 3, totalFloors: 5 });
    });

    const views = await everyView(t, { transaction: "sale", floorBands: ["not_top"] });
    expect(views).toEqual({ list: [middle], count: { count: 1, exact: true }, map: [middle] });
  });
});

describe("searchMigrations.rebuildListingSearchText", () => {
  test("re-derives every stale haystack in self-scheduled batches, then changes nothing", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const russian = await t.run(async (ctx) => {
      await ctx.db.patch("locations", ids.city, { name: { sr: "Beograd", en: "Belgrade", ru: "Белград" } });
      // More than one batch (100), so the continuation is exercised.
      for (let index = 1; index <= 104; index += 1) {
        await makeListing(ctx, index, ids.city, ids.agent, { mediaCount: 1 });
      }
      const listing = await makeListing(ctx, 105, ids.city, ids.agent, {
        mediaCount: 1,
        titleSr: "Trosoban stan na Dorćolu",
      });
      // A stored haystack from before the fold knew Cyrillic: the Russian
      // title is not in it.
      await ctx.db.patch("listings", listing, {
        title: { sr: "Trosoban stan na Dorćolu", ru: "Трёхкомнатная квартира на Дорчоле" },
      });
      return listing;
    });
    const stale = await t.query(api.listings.search, {
      filters: { transaction: "sale", q: "квартира" },
      sort: "relevance",
      paginationOpts: PAGE,
    });
    expect(stale.page).toHaveLength(0);

    const first = await t.mutation(internal.searchMigrations.rebuildListingSearchText, {});
    expect(first).toMatchObject({ scanned: 100, done: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const mismatched = await t.run(async (ctx) => {
      const out: Id<"listings">[] = [];
      for (const doc of await ctx.db.query("listings").take(200)) {
        const { searchText } = applyDerived(doc, await locationNamesFor(ctx, doc), false);
        if (searchText !== doc.searchText) out.push(doc._id);
      }
      return out;
    });
    expect(mismatched).toEqual([]);

    const found = await t.query(api.listings.search, {
      filters: { transaction: "sale", q: "квартира" },
      sort: "relevance",
      paginationOpts: PAGE,
    });
    expect(found.page.map((card) => card._id)).toEqual([russian]);
    const belgrade = await t.query(api.listings.count, { filters: { transaction: "sale", q: "Белград" } });
    expect(belgrade).toEqual({ count: 105, exact: true });

    const again = await t.mutation(internal.searchMigrations.rebuildListingSearchText, {});
    expect(again).toEqual({ scanned: 100, updated: 0, done: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});
