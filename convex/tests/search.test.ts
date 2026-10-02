/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation } from "./fixtures";
import { normalizeText, pickDriver } from "../lib/search";
import { computeValuation, floorToNumber } from "../lib/money";
import { foldDiacritics, listingSlug, slugify } from "../lib/slug";

const PAGE = { cursor: null, numItems: 50 };

/** A small, deliberately varied fixture the filter tests share. */
async function fixture() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const municipality = await makeLocation(ctx, "vracar", "municipality", city);
    const neighborhood = await makeLocation(ctx, "neimar", "neighborhood", municipality);
    const otherCity = await makeLocation(ctx, "novi-sad");
    const agent = await makeAgent(ctx, "agent-one");

    // 0: cheap small 1-room, CG, ground floor, not registered
    await makeListing(ctx, 0, city, agent, {
      price: 90_000,
      areaM2: 32,
      rooms: 1,
      floor: "PR",
      registered: false,
      municipalityId: municipality,
      neighborhoodId: neighborhood,
    });
    // 1: mid 2-room with a lift and a terrace, gas heating
    await makeListing(ctx, 1, city, agent, {
      price: 200_000,
      areaM2: 60,
      rooms: 2,
      floor: 3,
      heating: ["gas"],
      features: { elevator: true, terrace: true },
      municipalityId: municipality,
    });
    // 2: expensive 4-room penthouse, top floor, heat pump, VAT refund, tour
    await makeListing(ctx, 2, city, agent, {
      price: 700_000,
      areaM2: 130,
      rooms: 4,
      floor: 6,
      totalFloors: 6,
      heating: ["heat_pump", "floor"],
      constructionType: "new",
      condition: "lux",
      features: { elevator: true, terrace: true },
      parking: ["garage"],
      vatRefundEligible: true,
      mortgageEligible: true,
      isExclusive: true,
      isFeatured: true,
      hasTour: true,
      titleSr: "Penthaus sa terasom na Čukarici",
      municipalityId: municipality,
    });
    // 3: a rental, so it must never appear in a sale search
    await makeListing(ctx, 3, city, agent, {
      transaction: "rent",
      price: 650,
      areaM2: 55,
      rooms: 2,
    });
    // 4: a draft, so it must never appear publicly
    await makeListing(ctx, 4, city, agent, { status: "draft", price: 250_000 });
    // 5: sold — reachable by slug, excluded from search
    await makeListing(ctx, 5, city, agent, { status: "sold", price: 180_000 });
    // 6: another city
    await makeListing(ctx, 6, otherCity, agent, { price: 150_000, areaM2: 70, rooms: 3 });

    return { city, municipality, neighborhood, otherCity, agent };
  });
  return { t, ids };
}

describe("listings.search filters", () => {
  test("returns only listed sale listings by default", async () => {
    const { t } = await fixture();
    const result = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: PAGE,
    });
    const refs = result.page.map((card) => card.ref);
    expect(refs).toHaveLength(4);
    expect(result.page.every((card) => card.status === "published")).toBe(true);
  });

  test("rent and sale are separate scopes", async () => {
    const { t } = await fixture();
    const rent = await t.query(api.listings.search, {
      filters: { transaction: "rent" },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(rent.page).toHaveLength(1);
    expect(rent.page[0].transaction).toBe("rent");
  });

  test("price range narrows the result set", async () => {
    const { t } = await fixture();
    const result = await t.query(api.listings.search, {
      filters: { transaction: "sale", priceMin: 100_000, priceMax: 300_000 },
      sort: "price_asc",
      paginationOpts: PAGE,
    });
    expect(result.page.map((card) => card.price)).toEqual([150_000, 200_000]);
  });

  test("area range narrows the result set", async () => {
    const { t } = await fixture();
    const result = await t.query(api.listings.search, {
      filters: { transaction: "sale", areaMin: 60, areaMax: 100 },
      sort: "area_desc",
      paginationOpts: PAGE,
    });
    expect(result.page.map((card) => card.areaM2)).toEqual([70, 60]);
  });

  test("rooms filter treats 4 as exact and 5 as 5+", async () => {
    const { t } = await fixture();
    const exact = await t.query(api.listings.search, {
      filters: { transaction: "sale", rooms: [4] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(exact.page.map((card) => card.rooms)).toEqual([4]);

    const fivePlus = await t.query(api.listings.search, {
      filters: { transaction: "sale", rooms: [5] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(fivePlus.page).toHaveLength(0);
  });

  test("floor bands exclude the ground and the top floor", async () => {
    const { t } = await fixture();
    const notGround = await t.query(api.listings.search, {
      filters: { transaction: "sale", floorBands: ["not_ground"] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(notGround.page.every((card) => card.floorNum > 0.5)).toBe(true);

    const notTop = await t.query(api.listings.search, {
      filters: { transaction: "sale", floorBands: ["not_top"] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(
      notTop.page.some((card) => card.floorNum === card.totalFloors),
    ).toBe(false);
  });

  test("heating, features, parking and toggles all post-filter correctly", async () => {
    const { t } = await fixture();

    const gas = await t.query(api.listings.search, {
      filters: { transaction: "sale", heating: ["gas"] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(gas.page).toHaveLength(1);

    const lift = await t.query(api.listings.search, {
      filters: { transaction: "sale", features: ["elevator", "terrace"] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(lift.page).toHaveLength(2);

    const garage = await t.query(api.listings.search, {
      filters: { transaction: "sale", parking: ["garage"] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(garage.page).toHaveLength(1);

    const registered = await t.query(api.listings.search, {
      filters: { transaction: "sale", registered: true },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(registered.page).toHaveLength(3);

    const vat = await t.query(api.listings.search, {
      filters: { transaction: "sale", vatRefund: true },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(vat.page).toHaveLength(1);

    const tours = await t.query(api.listings.search, {
      filters: { transaction: "sale", hasTour: true },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(tours.page).toHaveLength(1);

    const exclusive = await t.query(api.listings.search, {
      filters: { transaction: "sale", exclusive: true },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(exclusive.page).toHaveLength(1);
  });

  test("location filters work at city, municipality and neighborhood level", async () => {
    const { t, ids } = await fixture();

    const byCity = await t.query(api.listings.search, {
      filters: { transaction: "sale", cityId: [ids.otherCity] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(byCity.page).toHaveLength(1);

    const byMunicipality = await t.query(api.listings.search, {
      filters: { transaction: "sale", municipalityId: [ids.municipality] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(byMunicipality.page).toHaveLength(3);

    const byNeighborhood = await t.query(api.listings.search, {
      filters: { transaction: "sale", neighborhoodId: [ids.neighborhood] },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(byNeighborhood.page).toHaveLength(1);
  });

  test("locations from different levels are one OR-ed multi-select", async () => {
    const { t, ids } = await fixture();
    // Neimar (one listing) + Novi Sad (one listing): both, not the empty intersection.
    const mixed = await t.query(api.listings.search, {
      filters: {
        transaction: "sale",
        cityId: [ids.otherCity],
        neighborhoodId: [ids.neighborhood],
      },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(mixed.page).toHaveLength(2);

    // Two places + a price range must not ride a single-place index.
    const ranged = await t.query(api.listings.search, {
      filters: {
        transaction: "sale",
        cityId: [ids.otherCity],
        municipalityId: [ids.municipality],
        priceMin: 100_000,
        priceMax: 800_000,
      },
      sort: "price_asc",
      paginationOpts: PAGE,
    });
    expect(ranged.page.map((card) => card.price)).toEqual([150_000, 200_000, 700_000]);
    expect(
      pickDriver(
        { transaction: "sale", cityId: [ids.otherCity], municipalityId: [ids.municipality], priceMin: 1 },
        "price_asc",
      ).driver,
    ).toBe("price");
  });

  test("an unfiltered search pages exactly by numItems, a post-filtered one by its matches", async () => {
    const { t } = await fixture();
    const exact = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(exact.page).toHaveLength(2);
    expect(exact.isDone).toBe(false);
    const rest = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: { cursor: exact.continueCursor, numItems: 2 },
    });
    expect(rest.page).toHaveLength(2);
    expect(new Set([...exact.page, ...rest.page].map((card) => card._id)).size).toBe(4);

    const filtered = await t.query(api.listings.search, {
      filters: { transaction: "sale", rooms: [2, 4] },
      sort: "newest",
      paginationOpts: { cursor: null, numItems: 1 },
    });
    // At most numItems cards per page (review 14, CVX-8); the cursor walk below covers the rest.
    expect(filtered.page).toHaveLength(1);
    expect(filtered.isDone).toBe(false);
  });

  test("walking the cursor returns every match once, with a tiny page size", async () => {
    const { t } = await fixture();
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard += 1) {
      const result: { page: { _id: string }[]; isDone: boolean; continueCursor: string } = await t.query(
        api.listings.search,
        { filters: { transaction: "sale", features: ["elevator"] }, sort: "price_asc", paginationOpts: { cursor, numItems: 1 } },
      );
      seen.push(...result.page.map((card) => card._id));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    const counted = await t.query(api.listings.count, { filters: { transaction: "sale", features: ["elevator"] } });
    expect(seen).toHaveLength(counted.count);
    expect(new Set(seen).size).toBe(seen.length);
  });

  test("a range filter never changes the order: price range + newest = newest", async () => {
    const { t } = await fixture();
    const newest = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: { cursor: null, numItems: 3 },
    });
    const ranged = await t.query(api.listings.search, {
      filters: { transaction: "sale", priceMax: 10_000_000 },
      sort: "newest",
      paginationOpts: { cursor: null, numItems: 3 },
    });
    // The first three NEWEST listings, not the three most expensive re-sorted.
    expect(ranged.page.slice(0, 3).map((card) => card._id)).toEqual(newest.page.map((card) => card._id));
    expect(ranged.orderedInWindow).toBe(false);

    const byArea = await t.query(api.listings.search, {
      filters: { transaction: "sale", areaMin: 1 },
      sort: "price_asc",
      paginationOpts: PAGE,
    });
    const prices = byArea.page.map((card) => card.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test("the map, the list and the count agree on a text query", async () => {
    const { t } = await fixture();
    const filters = { transaction: "sale" as const, q: "penthaus" };
    const list = await t.query(api.listings.search, { filters, sort: "relevance", paginationOpts: PAGE });
    const map = await t.query(api.listings.mapPoints, { filters });
    const counted = await t.query(api.listings.count, { filters });
    expect(list.page.length).toBeGreaterThan(0);
    expect(map.points.map((point) => point._id).sort()).toEqual(list.page.map((card) => card._id).sort());
    expect(counted.count).toBe(list.page.length);
  });

  test("relevance without a query means newest first", async () => {
    const { t } = await fixture();
    const relevance = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "relevance",
      paginationOpts: PAGE,
    });
    const newest = await t.query(api.listings.search, { filters: { transaction: "sale" }, sort: "newest", paginationOpts: PAGE });
    expect(relevance.page.map((card) => card._id)).toEqual(newest.page.map((card) => card._id));
  });

  test("the outdoor toggle accepts a terrace, loggia or balcony", async () => {
    const { t } = await fixture();
    const outdoor = await t.query(api.listings.search, {
      filters: { transaction: "sale", outdoor: true },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(outdoor.page).toHaveLength(2);
  });

  test("every sort order is honoured", async () => {
    const { t } = await fixture();
    const asc = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "price_asc",
      paginationOpts: PAGE,
    });
    const desc = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "price_desc",
      paginationOpts: PAGE,
    });
    expect(asc.page.map((card) => card.price)).toEqual([90_000, 150_000, 200_000, 700_000]);
    expect(desc.page.map((card) => card.price)).toEqual([700_000, 200_000, 150_000, 90_000]);

    const ppm2 = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "ppm2_asc",
      paginationOpts: PAGE,
    });
    const values = ppm2.page.map((card) => card.pricePerM2);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  test("combining a range with a city uses the compound index and still filters", async () => {
    const { t, ids } = await fixture();
    const result = await t.query(api.listings.search, {
      filters: {
        transaction: "sale",
        cityId: [ids.city],
        priceMin: 150_000,
        priceMax: 750_000,
        features: ["elevator"],
      },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(result.page).toHaveLength(2);
    expect(result.page.every((card) => card.cityId === ids.city)).toBe(true);
  });

  test("text search folds diacritics both ways", async () => {
    const { t } = await fixture();
    const hit = await t.query(api.listings.search, {
      filters: { transaction: "sale", q: "cukarica penthaus" },
      sort: "relevance",
      paginationOpts: PAGE,
    });
    expect(hit.page.length).toBeGreaterThanOrEqual(1);
    expect(hit.page[0].title.sr).toContain("Penthaus");
  });

  test("count agrees with search and reports exactness", async () => {
    const { t } = await fixture();
    const result = await t.query(api.listings.count, {
      filters: { transaction: "sale" },
    });
    expect(result).toEqual({ count: 4, exact: true });
  });

  test("mapPoints returns the same set and respects a bbox", async () => {
    const { t } = await fixture();
    const all = await t.query(api.listings.mapPoints, {
      filters: { transaction: "sale" },
    });
    expect(all.points).toHaveLength(4);
    expect(all.truncated).toBe(false);

    const none = await t.query(api.listings.mapPoints, {
      filters: { transaction: "sale", bbox: { west: 0, south: 0, east: 1, north: 1 } },
    });
    expect(none.points).toHaveLength(0);

    // The fixture pins sit at 44.8 / 20.45 ("area" precision snaps to the same cell).
    const belgrade = { west: 20.3, south: 44.7, east: 20.6, north: 44.9 };
    const inside = await t.query(api.listings.mapPoints, {
      filters: { transaction: "sale", bbox: belgrade },
    });
    expect(inside.points).toHaveLength(4);
    const listed = await t.query(api.listings.search, {
      filters: { transaction: "sale", bbox: belgrade },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(listed.page.map((card) => card._id).sort()).toEqual(
      inside.points.map((point) => point._id).sort(),
    );
    const counted = await t.query(api.listings.count, {
      filters: { transaction: "sale", bbox: { west: 0, south: 0, east: 1, north: 1 } },
    });
    expect(counted).toEqual({ count: 0, exact: true });
  });

  test("map points carry what the pin popup shows", async () => {
    const { t } = await fixture();
    const { points } = await t.query(api.listings.mapPoints, {
      filters: { transaction: "sale", rooms: [4] },
    });
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ price: 700_000, areaM2: 130, rooms: 4 });
    expect(points[0].title.sr).toContain("Penthaus");
  });

  test("search cards carry a short gallery, other card surfaces only the cover", async () => {
    const { t } = await fixture();
    const result = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: PAGE,
    });
    for (const card of result.page) {
      expect(card.images).toHaveLength(5);
      expect(card.images?.[0].id).toBe(card.cover?.id);
    }
    const featured = await t.query(api.listings.featured, {});
    expect(featured.every((card) => card.images === undefined)).toBe(true);
  });

  test("bySlug resolves published and sold, refuses drafts, and follows redirects", async () => {
    const { t } = await fixture();
    const published = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("listings")
        .withIndex("by_scope_and_publishedAt", (q) => q.eq("scope", "listed:sale"))
        .take(10);
      return rows[0];
    });
    const found = await t.query(api.listings.bySlug, { slug: published.slug });
    expect(found.kind).toBe("listing");

    const draft = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("listings")
        .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "draft"))
        .take(1);
      return rows[0];
    });
    const hidden = await t.query(api.listings.bySlug, { slug: draft.slug });
    expect(hidden.kind).toBe("missing");

    const sold = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("listings")
        .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "sold"))
        .take(1);
      return rows[0];
    });
    const soldResult = await t.query(api.listings.bySlug, { slug: sold.slug });
    expect(soldResult.kind).toBe("listing");

    await t.run(async (ctx) => {
      await ctx.db.insert("slugRedirects", {
        from: "stari-slug",
        listingId: published._id,
        at: Date.now(),
      });
    });
    const redirect = await t.query(api.listings.bySlug, { slug: "stari-slug" });
    expect(redirect).toEqual({ kind: "redirect", slug: published.slug });
  });

  test("area-level coordinates are snapped but stable, exact ones are not", async () => {
    const { t } = await fixture();
    const first = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: PAGE,
    });
    const second = await t.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: PAGE,
    });
    expect(first.page[0].lat).toBe(second.page[0].lat);
    expect(first.page[0].lat).not.toBe(44.8);
    expect(first.page[0].coordPrecision).toBe("area");
  });

  test("the detail DTO never leaks the mandate or the preview token", async () => {
    const { t } = await fixture();
    const published = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("listings")
        .withIndex("by_scope_and_publishedAt", (q) => q.eq("scope", "listed:sale"))
        .take(1);
      return rows[0];
    });
    const result = await t.query(api.listings.bySlug, { slug: published.slug });
    expect(result.kind).toBe("listing");
    if (result.kind !== "listing") return;
    const keys = Object.keys(result.listing);
    expect(keys).not.toContain("mandate");
    expect(keys).not.toContain("previewToken");
    expect(keys).not.toContain("ownerContactId");
    expect(keys).not.toContain("createdBy");
  });
});

describe("pure search helpers", () => {
  test("normalizeText folds every sr-Latn diacritic", () => {
    expect(normalizeText("Čačak Ćuprija Šabac Žabalj Đakovica")).toBe(
      "cacak cuprija sabac zabalj djakovica",
    );
    expect(foldDiacritics("Njegoševa")).toBe("njegoseva");
  });

  test("slugs are ASCII and carry the ref", () => {
    expect(slugify("Trosoban stan, Vračar!")).toBe("trosoban-stan-vracar");
    expect(listingSlug("Trosoban stan Vračar", "ME-1042")).toBe(
      "trosoban-stan-vracar-me-1042",
    );
  });

  test("floorToNumber sorts Serbian floor labels", () => {
    expect(floorToNumber("SUT")).toBe(-1);
    expect(floorToNumber("PSUT")).toBe(-0.5);
    expect(floorToNumber("PR")).toBe(0);
    expect(floorToNumber("VPR")).toBe(0.5);
    expect(floorToNumber("PK", 5)).toBe(6);
    expect(floorToNumber(4)).toBe(4);
  });

  test("valuation moves with condition and floor", () => {
    const lux = computeValuation({
      avgPricePerM2: 4000,
      areaM2: 60,
      condition: "lux",
      floorNum: 3,
    });
    const poor = computeValuation({
      avgPricePerM2: 4000,
      areaM2: 60,
      condition: "needs_renovation",
      floorNum: 3,
    });
    expect(lux.mid).toBeGreaterThan(poor.mid);
    expect(lux.low).toBeLessThan(lux.mid);
    expect(lux.high).toBeGreaterThan(lux.mid);
  });
});

describe("mandate expiry cron", () => {
  test("withdraws expired mandates and ignores listings that have none", async () => {
    const { t, ids } = await fixture();

    const expired = await t.run(async (ctx) => {
      const id = await makeListing(ctx, 20, ids.city, ids.agent, {
        mandateEndsInDays: -3,
        titleSr: "Stan sa istekim ugovorom o posredovanju",
      });
      // A published listing with NO mandate at all: `undefined` sorts below every
      // number in the index, so a naive `lt(now)` range would swallow the batch.
      const noMandate = await makeListing(ctx, 21, ids.city, ids.agent, {
        titleSr: "Stan bez ugovora o posredovanju",
      });
      await ctx.db.patch("listings", noMandate, {
        mandate: undefined,
        mandateEnd: undefined,
      });
      return { id, noMandate };
    });

    const result = await t.mutation(internal.listingsInternal.expireMandates, {});
    expect(result.withdrawn).toBe(1);

    const after = await t.run(async (ctx) => ({
      expired: await ctx.db.get("listings", expired.id),
      noMandate: await ctx.db.get("listings", expired.noMandate),
    }));
    expect(after.expired?.status).toBe("withdrawn");
    expect(after.expired?.scope).toBe("hidden:sale");
    expect(after.noMandate?.status).toBe("published");

    const logged = await t.run(async (ctx) =>
      ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", expired.id))
        .take(5),
    );
    expect(logged.some((row) => row.action === "listing.mandateExpired")).toBe(true);
  });
});
