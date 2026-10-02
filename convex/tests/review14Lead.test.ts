/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

/**
 * Review 14 (lead's own fixes): "price on request" is gone (Art. 18), the light
 * `locations.intro` query, and the favorites funnel signal (ARC-7).
 */

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agent = await makeAgent(ctx, "agent-a");
    const admin = await makeUser(ctx, "admin");
    const live = await makeListing(ctx, 1, city, agent);
    const draft = await makeListing(ctx, 2, city, agent, { status: "draft" });
    return { city, agent, admin, live, draft };
  });
  return { t, ids };
}

const SESSION = "sess-review14-a";

afterEach(() => {
  vi.useRealTimers();
});

describe("Art. 18: every ad shows its price", () => {
  test("the editor can no longer mark a price as 'on request'", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await expect(
      asAdmin.mutation(api.listingsAdmin.update, {
        id: ids.draft,
        // @ts-expect-error The field was removed (Art. 18); an old client that still sends it is refused.
        patch: { priceOnRequest: true },
      }),
    ).rejects.toThrow(/priceOnRequest/);
  });
});

describe("locations.intro", () => {
  test("returns a place's intro, or null for a place without one or an unknown slug", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => ctx.db.patch("locations", ids.city, { intro: { sr: "Prestonica.", en: "The capital." } }));
    expect(await t.query(api.locations.intro, { slug: "beograd" })).toEqual({ sr: "Prestonica.", en: "The capital." });
    await t.run(async (ctx) => makeLocation(ctx, "novi-sad"));
    expect(await t.query(api.locations.intro, { slug: "novi-sad" })).toBeNull();
    expect(await t.query(api.locations.intro, { slug: "nema" })).toBeNull();
  });
});

describe("stats.trackFavorite", () => {
  async function favorites(t: Awaited<ReturnType<typeof setup>>["t"], listingId: Awaited<ReturnType<typeof setup>>["ids"]["live"]) {
    return t.run(async (ctx) => {
      const row = await ctx.db
        .query("listingStats")
        .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
        .unique();
      return row?.favorites ?? 0;
    });
  }

  test("counts a listing once per session and creates the stats row", async () => {
    const { t, ids } = await setup();
    expect(await t.mutation(api.stats.trackFavorite, { listingId: ids.live, sessionKey: SESSION })).toEqual({ counted: true });
    expect(await t.mutation(api.stats.trackFavorite, { listingId: ids.live, sessionKey: SESSION })).toEqual({ counted: false });
    expect(await favorites(t, ids.live)).toBe(1);

    await t.mutation(api.stats.trackFavorite, { listingId: ids.live, sessionKey: "sess-review14-b" });
    expect(await favorites(t, ids.live)).toBe(2);
  });

  test("ignores listings that are not on the site and leaves views alone", async () => {
    const { t, ids } = await setup();
    expect(await t.mutation(api.stats.trackFavorite, { listingId: ids.draft, sessionKey: SESSION })).toEqual({ counted: false });
    expect(await favorites(t, ids.draft)).toBe(0);

    await t.mutation(api.stats.trackView, { listingId: ids.live, sessionKey: SESSION });
    await t.mutation(api.stats.trackFavorite, { listingId: ids.live, sessionKey: SESSION });
    const row = await t.run(async (ctx) =>
      ctx.db
        .query("listingStats")
        .withIndex("by_listingId", (q) => q.eq("listingId", ids.live))
        .unique(),
    );
    expect({ views: row?.views, favorites: row?.favorites }).toEqual({ views: 1, favorites: 1 });
  });

  test("refuses a malformed session key", async () => {
    const { t, ids } = await setup();
    await expect(t.mutation(api.stats.trackFavorite, { listingId: ids.live, sessionKey: "x" })).rejects.toThrow(
      /INVALID_INPUT/,
    );
  });

  test("the nightly prune drops old view and favorite marks, newer ones stay", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    const { t, ids } = await setup();
    await t.mutation(api.stats.trackView, { listingId: ids.live, sessionKey: SESSION });
    await t.mutation(api.stats.trackFavorite, { listingId: ids.live, sessionKey: SESSION });

    vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
    await t.mutation(api.stats.trackFavorite, { listingId: ids.live, sessionKey: "sess-review14-new" });
    const result = await t.mutation(internal.stats.pruneSessionMarks, {});
    expect(result).toEqual({ deleted: 2, more: false });

    const left = await t.run(async (ctx) => ({
      views: (await ctx.db.query("listingViews").take(10)).length,
      favorites: (await ctx.db.query("listingFavorites").take(10)).map((row) => row.sessionKey),
    }));
    expect(left).toEqual({ views: 0, favorites: ["sess-review14-new"] });
    // The counters are history: pruning the dedupe rows never lowers them.
    expect(await favorites(t, ids.live)).toBe(2);
  });
});
