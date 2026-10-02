import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { floorToNumber } from "@/convex/lib/money";
import {
  activeChips,
  clearFilters,
  EMPTY_STATE,
  effectiveSort,
  FLOOR_OPTIONS,
  floorToNum,
  isCurated,
  NO_LOCATIONS,
  parseSearchParams,
  publishedAfter,
  removeChip,
  ROOM_OPTIONS,
  searchKey,
  searchQuery,
  toConvexFilters,
  toQuery,
  toQueryString,
  type FloorValue,
} from "./search-params";
import { effectiveSlugs, indexLocations, resolveLocations, type LocationNode } from "./search-locations";

const id = (value: string) => value as Id<"locations">;

describe("parseSearchParams", () => {
  it("round-trips every filter through the URL", () => {
    const query =
      "transaction=rent&type=apartment,house&location=vracar,dorcol&q=terasa&priceMin=500&priceMax=1500" +
      "&areaMin=40&areaMax=120&rooms=2,2.5,5&floorMin=PR&floorMax=5&notGround=1&notTop=1&heating=CG,gas" +
      "&construction=new&elevator=1&outdoor=1&parking=1&registered=1&moveIn=1&furnished=1&vatRefund=1" +
      "&mortgage=1&exclusive=1&hasTour=1&added=7d&sort=price_asc&bbox=20.3,44.7,20.6,44.9";
    const state = parseSearchParams(new URLSearchParams(query));
    expect(state).toMatchObject({
      transaction: "rent",
      types: ["apartment", "house"],
      locations: ["vracar", "dorcol"],
      q: "terasa",
      priceMin: 500,
      priceMax: 1500,
      rooms: [2, 2.5, 5],
      floorMin: "PR",
      floorMax: 5,
      heating: ["CG", "gas"],
      added: "7d",
      sort: "price_asc",
      bbox: { west: 20.3, south: 44.7, east: 20.6, north: 44.9 },
    });
    expect(state.toggles).toHaveLength(10);
    expect(parseSearchParams(new URLSearchParams(toQueryString(state)))).toEqual(state);
  });

  it("drops junk instead of throwing", () => {
    const state = parseSearchParams({
      transaction: "lease",
      type: "castle,apartment",
      rooms: "7,abc,3",
      priceMin: "-5",
      priceMax: "lots",
      floorMin: "99",
      added: "1y",
      sort: "random",
      bbox: "1,2,3",
      location: "Vračar,vracar,ok-slug",
    });
    expect(state).toEqual({ ...EMPTY_STATE, types: ["apartment"], rooms: [3], locations: ["vracar", "ok-slug"] });
  });

  it("swaps an inverted range and clamps huge values", () => {
    const state = parseSearchParams({ priceMin: "300000", priceMax: "100000", areaMax: "999999999" });
    expect(state.priceMin).toBe(100_000);
    expect(state.priceMax).toBe(300_000);
    expect(state.areaMax).toBe(100_000);
  });

  it("reads a Next searchParams record with repeated keys", () => {
    expect(parseSearchParams({ type: ["house", "apartment"] }).types).toEqual(["house"]);
  });

  it("cuts the text query by code points, never inside an emoji", () => {
    const state = parseSearchParams({ q: `${"a".repeat(79)}😀` });
    expect(state.q).toBe(`${"a".repeat(79)}😀`);
    expect(state.q?.isWellFormed()).toBe(true);
    expect(() => searchKey(state)).not.toThrow();
    expect(toConvexFilters(state, NO_LOCATIONS, 0).q?.isWellFormed()).toBe(true);

    expect(parseSearchParams({ q: `${"a".repeat(80)}😀` }).q).toBe("a".repeat(80));
    expect(parseSearchParams({ q: `${"a".repeat(79)} 😀` }).q).toBe(`${"a".repeat(79)}`);
    expect(parseSearchParams({ q: "\uD83D" }).q).toBeUndefined();
  });

  it("takes `added` from its own windows only, never from the prototype", () => {
    for (const added of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const state = parseSearchParams({ added });
      expect(state.added, added).toBeUndefined();
      expect(toConvexFilters(state, NO_LOCATIONS, Date.UTC(2026, 9, 2)).publishedAfter).toBeUndefined();
    }
    expect(parseSearchParams({ added: "14d" }).added).toBe("14d");
  });

  it("offers every structure as a chip, 4.5 rooms included", () => {
    expect(ROOM_OPTIONS).toContain(4.5);
    const state = parseSearchParams({ rooms: "4.5,5" });
    expect(state.rooms).toEqual([4.5, 5]);
    expect(toConvexFilters(state, NO_LOCATIONS, 0).rooms).toEqual([4.5, 5]);
  });
});

describe("serialization", () => {
  it("omits defaults so equal searches share one URL", () => {
    expect(toQuery(EMPTY_STATE)).toEqual({});
    expect(toQuery({ ...EMPTY_STATE, sort: "newest" })).toEqual({});
    expect(toQuery({ ...EMPTY_STATE, transaction: "rent", types: ["house"] })).toEqual({
      transaction: "rent",
      type: "house",
    });
  });

  it("keeps the landing's entry points on the same contract", () => {
    expect(searchQuery({ transaction: "sale", location: "vracar", priceMax: 250000, hasTour: true })).toEqual({
      location: "vracar",
      priceMax: "250000",
      hasTour: "1",
    });
  });

  it("encodes a hand-built state holding half an emoji instead of throwing", () => {
    const state = { ...EMPTY_STATE, q: "stan \uD83D", locations: ["vra\uDE00car"] };
    expect(toQueryString(state)).toBe("location=vracar&q=stan");
    expect(toConvexFilters(state, NO_LOCATIONS, 0).q).toBe("stan");
    expect(toQuery({ ...EMPTY_STATE, q: "\uD83D" })).toEqual({});
  });
});

describe("derivations", () => {
  it("defaults to relevance only with a text query", () => {
    expect(effectiveSort(EMPTY_STATE)).toBe("newest");
    expect(effectiveSort({ ...EMPTY_STATE, q: "vracar" })).toBe("relevance");
    expect(effectiveSort({ ...EMPTY_STATE, sort: "relevance" })).toBe("newest");
  });

  it("rounds the recency window down to the hour", () => {
    const now = Date.UTC(2026, 8, 30, 14, 37, 12);
    expect(publishedAfter("1d", now)).toBe(Date.UTC(2026, 8, 29, 14));
    expect(publishedAfter("7d", now + 60_000)).toBe(publishedAfter("7d", now));
  });

  it("maps the toggles and floors onto the Convex filters", () => {
    const filters = toConvexFilters(
      {
        ...EMPTY_STATE,
        floorMin: "VPR",
        notTop: true,
        toggles: ["elevator", "outdoor", "parking", "furnished", "hasTour"],
      },
      { ...NO_LOCATIONS, municipalityId: [id("m1")] },
      0,
    );
    expect(filters).toMatchObject({
      transaction: "sale",
      municipalityId: ["m1"],
      floorMin: 0.5,
      floorBands: ["not_top"],
      features: ["elevator"],
      outdoor: true,
      parking: ["garage", "garage_spot", "parking_spot"],
      furnishing: ["furnished"],
      hasTour: true,
    });
    expect(filters.cityId).toBeUndefined();
  });

  it("puts the floor selects on the server's floorNum scale", () => {
    const named: FloorValue[] = ["SUT", "PSUT", "PR", "VPR", 1, 30];
    expect(named.map(floorToNum)).toEqual([-1, -0.5, 0, 0.5, 1, 30]);
    expect(FLOOR_OPTIONS.map(floorToNum)).toEqual(FLOOR_OPTIONS.map((value) => floorToNumber(value)));
    const scale = FLOOR_OPTIONS.map(floorToNum);
    expect(scale.every((value, index) => index === 0 || value > scale[index - 1])).toBe(true);
    // The attic is not a select value: it sits above the building, floor 1 at least.
    expect(floorToNumber("PK", 4)).toBe(5);
    expect(floorToNumber("PK")).toBe(1);
  });

  it("chips remove exactly one value and 'clear all' keeps transaction + sort", () => {
    const state = parseSearchParams({ transaction: "rent", rooms: "2,3", sort: "price_desc", elevator: "1" });
    const chips = activeChips(state);
    expect(chips).toHaveLength(3);
    expect(removeChip(state, { kind: "rooms", value: 2 }).rooms).toEqual([3]);
    expect(clearFilters(state)).toEqual({ ...EMPTY_STATE, transaction: "rent", sort: "price_desc" });
  });

  it("treats transaction + one type + one place as curated, anything deeper as not", () => {
    expect(isCurated(parseSearchParams({ transaction: "rent", type: "apartment", location: "vracar" }))).toBe(true);
    expect(isCurated(parseSearchParams({ type: "apartment,house" }))).toBe(false);
    expect(isCurated(parseSearchParams({ rooms: "2" }))).toBe(false);
    expect(isCurated(parseSearchParams({ sort: "price_asc" }))).toBe(false);
  });
});

describe("location tree", () => {
  const nodes: LocationNode[] = [
    { _id: id("bg"), kind: "city", slug: "beograd", name: { sr: "Beograd" }, order: 0, saleCount: 3, rentCount: 1 },
    { _id: id("vr"), kind: "municipality", parentId: id("bg"), slug: "vracar", name: { sr: "Vračar" }, order: 1, saleCount: 2, rentCount: 0 },
    { _id: id("ne"), kind: "neighborhood", parentId: id("vr"), slug: "neimar", name: { sr: "Neimar" }, order: 2, saleCount: 1, rentCount: 0 },
    { _id: id("ns"), kind: "city", slug: "novi-sad", name: { sr: "Novi Sad" }, order: 3, saleCount: 1, rentCount: 0 },
  ];
  const index = indexLocations(nodes);

  it("drops unknown slugs and places already covered by a selected parent", () => {
    expect(effectiveSlugs(index, ["neimar", "beograd", "nowhere"])).toEqual(["beograd"]);
    expect(effectiveSlugs(index, ["neimar", "novi-sad"])).toEqual(["neimar", "novi-sad"]);
  });

  it("groups ids by level for the OR-ed Convex filter", () => {
    expect(resolveLocations(index, ["neimar", "novi-sad"])).toEqual({
      cityId: ["ns"],
      municipalityId: [],
      neighborhoodId: ["ne"],
    });
  });
});
