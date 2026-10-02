/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { belgradeMidnight, belgradeWall, DAY_MS, fromBelgradeWall } from "../lib/belgradeTime";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation } from "./fixtures";

/**
 * The public side of the listing detail page (night-run step 07): booking
 * rules evaluated in Belgrade time on the server, listings that are off the
 * market, per-address limits, and what the detail DTO may reveal.
 */

type Listing = Id<"listings">;

async function setup(status?: "sold") {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agent = await makeAgent(ctx, "agent-one");
    const listing = await makeListing(ctx, 1, city, agent, status !== undefined ? { status } : {});
    return { city, agent, listing };
  });
  return { t, ids };
}

/** The instant of `hh:mm` Belgrade time on the next Monday at least two days out. */
function nextMondayAt(hours: number, minutes = 0): number {
  let noon = belgradeMidnight(Date.now() + 2 * DAY_MS) + 12 * 3_600_000;
  while (new Date(belgradeWall(noon)).getUTCDay() !== 1) noon += DAY_MS;
  const wallMidnight = belgradeWall(noon) - (belgradeWall(noon) % DAY_MS);
  return fromBelgradeWall(wallMidnight + (hours * 60 + minutes) * 60_000);
}

function viewing(listingId: Listing, start: number, email: string, sessionSuffix: string, end = start + 3_600_000) {
  return {
    sessionKey: `sess-${sessionSuffix}${"0".repeat(10)}`,
    locale: "sr-Latn" as const,
    listingId,
    start,
    end,
    mode: "in_person" as const,
    contact: { name: "Test Posetilac", email },
    marketing: false,
    privacy: true,
  };
}

function inquiry(listingId: Listing, email: string, sessionSuffix: string) {
  return {
    sessionKey: `sess-${sessionSuffix}${"0".repeat(10)}`,
    locale: "sr-Latn" as const,
    listingId,
    contact: { name: "Test Kupac", email },
    marketing: false,
    privacy: true,
    message: "Da li je stan još uvek dostupan za razgledanje?",
  };
}

describe("viewing slots are Belgrade office hours", () => {
  test("slots across the October DST change start at 09:00 Belgrade on both sides", async () => {
    const { t, ids } = await setup();
    // Monday 19 Oct 2026 (UTC+2) and Monday 26 Oct 2026 (UTC+1), agent hours Mon 09-17.
    const slots = await t.query(api.agents.slots, {
      agentId: ids.agent,
      fromDay: Date.UTC(2026, 9, 18, 22),
      days: 14,
    });
    const starts = slots.map((slot) => slot.start);
    expect(starts).toContain(Date.UTC(2026, 9, 19, 7));
    expect(starts).toContain(Date.UTC(2026, 9, 26, 8));
    expect(starts).not.toContain(Date.UTC(2026, 9, 26, 7));
    // Eight one-hour slots per Monday, two Mondays in the window.
    expect(slots).toHaveLength(16);
    expect(slots.every((slot) => slot.end - slot.start === 3_600_000)).toBe(true);
  });

  test("the window is capped at 14 days", async () => {
    const { t, ids } = await setup();
    const slots = await t.query(api.agents.slots, {
      agentId: ids.agent,
      fromDay: Date.UTC(2026, 9, 18, 22),
      days: 60,
    });
    expect(slots).toHaveLength(16);
  });

  test("a request on the grid is accepted; off-grid starts and odd lengths are refused", async () => {
    const { t, ids } = await setup();
    await t.mutation(api.viewings.request, viewing(ids.listing, nextMondayAt(10), "grid@primer.local", "g1"));

    await expect(
      t.mutation(api.viewings.request, viewing(ids.listing, nextMondayAt(11, 30), "pola@primer.local", "g2")),
    ).rejects.toThrow(/SLOT_TAKEN|radnom vremenu/);
    const start = nextMondayAt(13);
    await expect(
      t.mutation(api.viewings.request, viewing(ids.listing, start, "kratko@primer.local", "g3", start + 60_000)),
    ).rejects.toThrow(/INVALID_INPUT|nije ispravan/);
    await expect(
      t.mutation(api.viewings.request, viewing(ids.listing, nextMondayAt(20), "vece@primer.local", "g4")),
    ).rejects.toThrow(/SLOT_TAKEN|radnom vremenu/);
  });

  test("one open request per address and listing, answered like a success", async () => {
    const { t, ids } = await setup();
    await t.mutation(api.viewings.request, viewing(ids.listing, nextMondayAt(9), "jednom@primer.local", "o1"));
    // The repeat must not tell a stranger that this address already asked
    // (review 14, SEC-5): same answer as a first request, nothing stored.
    await expect(
      t.mutation(api.viewings.request, viewing(ids.listing, nextMondayAt(14), "jednom@primer.local", "o2")),
    ).resolves.toBeNull();
    const stored = await t.run(async (ctx) => ({
      leads: (await ctx.db.query("leads").take(10)).length,
      starts: (await ctx.db.query("viewings").take(10)).map((row) => row.start),
    }));
    expect(stored).toEqual({ leads: 1, starts: [nextMondayAt(9)] });
  });

  test("a non-public agent takes no web bookings", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => ctx.db.patch("agents", ids.agent, { isPublic: false }));
    await expect(
      t.mutation(api.viewings.request, viewing(ids.listing, nextMondayAt(10), "skriven@primer.local", "n1")),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("off-market listings and abuse limits", () => {
  test("a sold listing refuses inquiries and viewing requests", async () => {
    const { t, ids } = await setup("sold");
    await expect(t.mutation(api.leads.createInquiry, inquiry(ids.listing, "prodato@primer.local", "s1"))).rejects.toThrow(
      /NOT_FOUND/,
    );
    await expect(
      t.mutation(api.viewings.request, viewing(ids.listing, nextMondayAt(10), "prodato@primer.local", "s2")),
    ).rejects.toThrow(/NOT_FOUND/);
  });

  test("fresh session keys do not buy more than three inquiries per address", async () => {
    const { t, ids } = await setup();
    for (const suffix of ["e1", "e2", "e3"]) {
      await t.mutation(api.leads.createInquiry, inquiry(ids.listing, "isti@primer.local", suffix));
    }
    await expect(t.mutation(api.leads.createInquiry, inquiry(ids.listing, "isti@primer.local", "e4"))).rejects.toThrow(
      /RATE_LIMITED/,
    );
  });

  test("an overlong email is refused before the pattern check", async () => {
    const { t, ids } = await setup();
    const email = `a@${".".repeat(300)}@x.rs`;
    await expect(t.mutation(api.leads.createInquiry, inquiry(ids.listing, email, "l1"))).rejects.toThrow(/INVALID_INPUT/);
  });

  test("campaign tags are trimmed to 200 characters", async () => {
    const { t, ids } = await setup();
    const { leadId } = await t.mutation(api.leads.createInquiry, {
      ...inquiry(ids.listing, "utm@primer.local", "u1"),
      utm: { source: "x".repeat(5_000), medium: "  " },
    });
    const lead = await t.run(async (ctx) => ctx.db.get("leads", leadId));
    expect(lead?.utm?.source).toHaveLength(200);
    expect(lead?.utm?.medium).toBeUndefined();
  });
});

describe("what the detail page reveals", () => {
  async function detail(t: ReturnType<typeof testApp>, listing: Listing) {
    const slug = await t.run(async (ctx) => (await ctx.db.get("listings", listing))?.slug ?? "");
    const result = await t.query(api.listings.bySlug, { slug });
    if (result.kind !== "listing") throw new Error(`expected a listing, got ${result.kind}`);
    return result.listing;
  }

  test("nearby-place distances are rounded when the address is hidden", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) =>
      ctx.db.patch("listings", ids.listing, {
        poi: [
          { kind: "park", name: "Karađorđev park", distanceM: 120 },
          { kind: "school", name: "OŠ Vladislav Ribnikar", distanceM: 430 },
        ],
      }),
    );
    const listing = await detail(t, ids.listing);
    expect(listing.poi?.map((item) => item.distanceM)).toEqual([250, 500]);
  });

  test("the gallery opens on the cover staff chose, then keeps their order", async () => {
    const { t, ids } = await setup();
    const ordered = await t.run(async (ctx) => {
      const doc = await ctx.db.get("listings", ids.listing);
      if (doc === null) throw new Error("listing missing");
      const media = [...doc.media]
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({ ...item, isCover: index === 2 }));
      await ctx.db.patch("listings", ids.listing, { media });
      return media.map((item) => item.image);
    });
    const listing = await detail(t, ids.listing);
    const urls = listing.media.map((image) => image.url);
    const expected = [ordered[2], ordered[0], ordered[1], ...ordered.slice(3)].map((image) =>
      image.kind === "url" ? image.url : "",
    );
    expect(urls.map((url) => url.split("?")[0])).toEqual(expected.map((url) => url.split("?")[0]));
  });

  test("a hidden agent is replaced by the agency's own contact", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) =>
      ctx.db.patch("agents", ids.agent, { isPublic: false, phone: "+381 60 000 0001", email: "tajni@primer.local" }),
    );
    const listing = await detail(t, ids.listing);
    expect(listing.agent.name).not.toBe("agent-one");
    expect(listing.agent.phone).not.toBe("+381 60 000 0001");
    expect(listing.agent.email).not.toBe("tajni@primer.local");
    expect(listing.agent.licenseId).toBeUndefined();
  });

  test("price edits made before publication are not a price history", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      const listing = await ctx.db.get("listings", ids.listing);
      const publishedAt = listing?.publishedAt ?? Date.now();
      await ctx.db.insert("priceChanges", { listingId: ids.listing, at: publishedAt - 86_400_000, from: 210_000, to: 200_000 });
      await ctx.db.insert("priceChanges", { listingId: ids.listing, at: publishedAt + 86_400_000, from: 200_000, to: 190_000 });
    });
    const listing = await detail(t, ids.listing);
    expect(listing.priceHistory).toHaveLength(1);
    expect(listing.priceHistory[0].price).toBe(190_000);
  });
});
