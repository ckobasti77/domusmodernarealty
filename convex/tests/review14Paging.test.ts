/// <reference types="vite/client" />
import type { FunctionReturnType } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { SearchFilters, Sort } from "../lib/validators";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation } from "./fixtures";

/**
 * Review 14: a post-filtered search page holds at most `numItems` cards, and
 * walking the cursors returns every match exactly once (it used to return a
 * whole 120-document window per page).
 */

type SearchPage = FunctionReturnType<typeof api.listings.search>;
type Card = SearchPage["page"][number];

const TOTAL = 180;
/** 50 houses among 180 listings, spread through every index order. */
const isHouse = (index: number) => index % 18 < 5;

/** 130 apartments and 50 houses, with ties on price, area and €/m². */
async function market() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agent = await makeAgent(ctx, "agent-a");
    const apartments: Id<"listings">[] = [];
    for (let index = 1; index <= TOTAL; index += 1) {
      const id = await makeListing(ctx, index, city, agent, {
        propertyType: isHouse(index) ? "house" : "apartment",
        price: 100_000 * (1 + (index % 3)),
        areaM2: 50 + 10 * (index % 4),
        rooms: index % 10 === 0 ? 4 : 2,
        mediaCount: 2,
      });
      if (!isHouse(index)) apartments.push(id);
    }
    return { city, apartments };
  });
  return { t, ...ids };
}

/** Follows `continueCursor` the way `usePaginatedQuery` does. */
async function walk(
  t: ReturnType<typeof testApp>,
  filters: SearchFilters,
  sort: Sort,
  numItems: number,
): Promise<SearchPage[]> {
  const pages: SearchPage[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 60; guard += 1) {
    const page: SearchPage = await t.query(api.listings.search, {
      filters,
      sort,
      paginationOpts: { cursor, numItems },
    });
    pages.push(page);
    if (page.isDone) return pages;
    cursor = page.continueCursor;
  }
  throw new Error("the cursor walk did not finish");
}

function idsOf(pages: readonly SearchPage[]): string[] {
  return pages.flatMap((page) => page.page.map((card) => card._id));
}

const ORDER: Record<Exclude<Sort, "relevance">, (a: Card, b: Card) => boolean> = {
  newest: (a, b) => (a.publishedAt ?? 0) >= (b.publishedAt ?? 0),
  price_asc: (a, b) => a.price <= b.price,
  price_desc: (a, b) => a.price >= b.price,
  ppm2_asc: (a, b) => a.pricePerM2 <= b.pricePerM2,
  ppm2_desc: (a, b) => a.pricePerM2 >= b.pricePerM2,
  area_desc: (a, b) => a.areaM2 >= b.areaM2,
};

describe("listings.search pages a post-filtered search by numItems", () => {
  test("every driver: pages of at most numItems, every match once, in order", async () => {
    const { t, city, apartments } = await market();
    const cases: { filters: SearchFilters; sort: Exclude<Sort, "relevance"> }[] = [
      { filters: { transaction: "sale", propertyType: ["apartment"] }, sort: "newest" },
      { filters: { transaction: "sale", cityId: [city], propertyType: ["apartment"] }, sort: "newest" },
      { filters: { transaction: "sale", propertyType: ["apartment"] }, sort: "price_asc" },
      { filters: { transaction: "sale", cityId: [city], propertyType: ["apartment"] }, sort: "price_desc" },
      { filters: { transaction: "sale", propertyType: ["apartment"] }, sort: "ppm2_asc" },
      { filters: { transaction: "sale", propertyType: ["apartment"] }, sort: "area_desc" },
    ];

    for (const { filters, sort } of cases) {
      const pages = await walk(t, filters, sort, 24);
      const sizes = pages.map((page) => page.page.length);
      // Every page but the last is full: the page ends on its 24th match.
      expect(sizes, sort).toEqual([24, 24, 24, 24, 24, 10]);

      const ids = idsOf(pages);
      expect(new Set(ids).size, sort).toBe(ids.length);
      expect([...ids].sort(), sort).toEqual([...apartments].sort());

      const cards = pages.flatMap((page) => page.page);
      const inOrder = cards.every((card, index) => index === 0 || ORDER[sort](cards[index - 1], card));
      expect(inOrder, sort).toBe(true);
    }

    const counted = await t.query(api.listings.count, {
      filters: { transaction: "sale", propertyType: ["apartment"] },
    });
    expect(counted).toEqual({ count: 130, exact: true });
  });

  test("a selective filter comes back in short pages without losing a match", async () => {
    const { t } = await market();
    const small = await walk(t, { transaction: "sale", rooms: [4] }, "price_asc", 5);
    expect(small.every((page) => page.page.length <= 5)).toBe(true);
    const ids = idsOf(small);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(TOTAL / 10);

    // 6 matches per price: the first page ends on the scan limit (the two
    // cheaper prices, 120 listings) and the next resumes after a run of 60 ties.
    const wide = await walk(t, { transaction: "sale", rooms: [4] }, "price_asc", 24);
    expect(wide.map((page) => page.page.length)).toEqual([12, 6]);
    expect([...idsOf(wide)].sort()).toEqual([...ids].sort());
  });

  test("a page bounded by endCursor (a split page) reads exactly its range", async () => {
    const { t } = await market();
    const filters: SearchFilters = { transaction: "sale", propertyType: ["apartment"] };
    const first = await t.query(api.listings.search, {
      filters,
      sort: "price_asc",
      paginationOpts: { cursor: null, numItems: 24 },
    });
    const bounded = await t.query(api.listings.search, {
      filters,
      sort: "price_asc",
      paginationOpts: { cursor: null, endCursor: first.continueCursor, numItems: 24 },
    });
    expect(bounded.page.map((card) => card._id)).toEqual(first.page.map((card) => card._id));

    const next = (cursor: string) =>
      t.query(api.listings.search, { filters, sort: "price_asc", paginationOpts: { cursor, numItems: 24 } });
    const [after, afterBounded] = await Promise.all([next(first.continueCursor), next(bounded.continueCursor)]);
    expect(afterBounded.page.map((card) => card._id)).toEqual(after.page.map((card) => card._id));
  });

  test("text search pages by numItems too, in relevance and in a sorted window", async () => {
    const { t, apartments } = await market();
    for (const sort of ["relevance", "price_asc"] as const) {
      const pages = await walk(t, { transaction: "sale", propertyType: ["apartment"], q: "testni stan" }, sort, 24);
      expect(pages.every((page) => page.page.length <= 24), sort).toBe(true);
      const ids = idsOf(pages);
      expect(new Set(ids).size, sort).toBe(ids.length);
      expect([...ids].sort(), sort).toEqual([...apartments].sort());
      if (sort === "price_asc") {
        const prices = pages.flatMap((page) => page.page.map((card) => card.price));
        expect(prices).toEqual([...prices].sort((a, b) => a - b));
      }
    }
    await expect(
      t.query(api.listings.search, {
        filters: { transaction: "sale", q: "testni stan" },
        sort: "relevance",
        paginationOpts: { cursor: "not-a-cursor", numItems: 24 },
      }),
    ).rejects.toThrow(/kursor/);
  });

  test("an unsearchable query answers empty without reading the market", async () => {
    const { t } = await market();
    const filters: SearchFilters = { transaction: "sale", q: "###" };
    const page = await t.query(api.listings.search, {
      filters,
      sort: "relevance",
      paginationOpts: { cursor: null, numItems: 24 },
    });
    expect(page).toMatchObject({ page: [], isDone: true, scanned: 0 });
    expect(await t.query(api.listings.count, { filters })).toEqual({ count: 0, exact: true });
    expect(await t.query(api.listings.mapPoints, { filters })).toEqual({ points: [], truncated: false });
  });
});

describe("listings.bySlug redirects", () => {
  test("a slug renamed away twice redirects to its latest owner", async () => {
    const t = testApp();
    const { first, second } = await t.run(async (ctx) => {
      const city = await makeLocation(ctx, "beograd");
      const agent = await makeAgent(ctx, "agent-a");
      const first = await makeListing(ctx, 1, city, agent);
      const second = await makeListing(ctx, 2, city, agent);
      // A left "stan-x", B took it and left it as well.
      await ctx.db.insert("slugRedirects", { from: "stan-x", listingId: first, at: Date.now() });
      await ctx.db.insert("slugRedirects", { from: "stan-x", listingId: second, at: Date.now() });
      return { first, second };
    });
    const slugs = await t.run(async (ctx) => ({
      first: (await ctx.db.get("listings", first))?.slug,
      second: (await ctx.db.get("listings", second))?.slug,
    }));
    const result = await t.query(api.listings.bySlug, { slug: "stan-x" });
    expect(result).toEqual({ kind: "redirect", slug: slugs.second });
    expect(slugs.second).not.toBe(slugs.first);
  });
});
