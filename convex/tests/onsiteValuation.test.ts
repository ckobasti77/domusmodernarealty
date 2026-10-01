/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { belgradeWall, DAY_MS } from "../lib/belgradeTime";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation } from "./fixtures";

afterEach(() => {
  vi.useRealTimers();
});

const CONTACT = { name: "Test Prodavac", email: "procena@primer.local" };

function session(suffix: string): string {
  return `sess-${suffix}${"0".repeat(10)}`;
}

/** `YYYY-MM-DD` of the Belgrade day `days` after now. */
function belgradeDay(days: number): string {
  return new Date(belgradeWall(Date.now() + days * DAY_MS)).toISOString().slice(0, 10);
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const neighborhood = await makeLocation(ctx, "vracar", "neighborhood", city);
    const agent = await makeAgent(ctx, "agent-one");
    const listing = await makeListing(ctx, 1, city, agent, { price: 200_000 });
    return { city, neighborhood, listing };
  });
  const { leadId } = await t.mutation(api.leads.createValuation, {
    sessionKey: session("val"),
    locale: "en",
    contact: CONTACT,
    marketing: false,
    privacy: true,
    locationId: ids.neighborhood,
    propertyType: "apartment",
    areaM2: 64,
    rooms: 2.5,
    floor: 3,
    condition: "renovated",
  });
  return { t, ids, leadId };
}

describe("leads.requestOnsiteValuation", () => {
  test("annotates the fresh valuation lead with the proposed visit and logs it", async () => {
    vi.useFakeTimers();
    const { t, leadId } = await setup();
    const day = belgradeDay(2);

    await t.mutation(api.leads.requestOnsiteValuation, {
      sessionKey: session("val"),
      leadId,
      preferredDate: day,
      preferredWindow: "afternoon",
      note: "  Interfon ne radi, pozovite.  ",
    });

    const { lead, activity } = await t.run(async (ctx) => ({
      lead: await ctx.db.get("leads", leadId),
      activity: await ctx.db.query("activity").take(20),
    }));
    expect(lead?.type).toBe("valuation");
    expect(lead?.answers).toMatchObject({
      areaM2: 64,
      condition: "renovated",
      onsiteRequested: true,
      onsiteDate: day,
      onsiteWindow: "afternoon",
      onsiteNote: "Interfon ne radi, pozovite.",
    });
    expect(activity.some((row) => row.action === "lead.onsiteRequested" && row.entityId === leadId)).toBe(true);

    await expect(
      t.mutation(api.leads.requestOnsiteValuation, {
        sessionKey: session("val"),
        leadId,
        preferredDate: day,
        preferredWindow: "morning",
      }),
    ).rejects.toThrow(/ALREADY_REQUESTED|već zatražena/);
  });

  test("rejects days in the past, beyond 30 days or malformed", async () => {
    vi.useFakeTimers();
    const { t, leadId } = await setup();
    for (const preferredDate of [belgradeDay(-1), belgradeDay(31), "2026-13-45", "sutra"]) {
      await expect(
        t.mutation(api.leads.requestOnsiteValuation, {
          sessionKey: session(`d${preferredDate.length}`),
          leadId,
          preferredDate,
          preferredWindow: "morning",
        }),
      ).rejects.toThrow(/INVALID_INPUT|narednih 30 dana/);
    }
  });

  test("only a web valuation lead from the last six hours qualifies", async () => {
    vi.useFakeTimers();
    const { t, ids, leadId } = await setup();

    const inquiry = await t.mutation(api.leads.createInquiry, {
      sessionKey: session("inq"),
      locale: "en",
      contact: { name: "Kupac", email: "kupac@primer.local" },
      marketing: false,
      privacy: true,
      listingId: ids.listing,
      message: "Da li je stan još uvek dostupan za razgledanje?",
    });
    await expect(
      t.mutation(api.leads.requestOnsiteValuation, {
        sessionKey: session("inq"),
        leadId: inquiry.leadId,
        preferredDate: belgradeDay(1),
        preferredWindow: "midday",
      }),
    ).rejects.toThrow(/NOT_FOUND|nije pronađen/);

    vi.setSystemTime(Date.now() + 6 * 60 * 60_000 + 1_000);
    await expect(
      t.mutation(api.leads.requestOnsiteValuation, {
        sessionKey: session("late"),
        leadId,
        preferredDate: belgradeDay(1),
        preferredWindow: "midday",
      }),
    ).rejects.toThrow(/NOT_FOUND|nije pronađen/);
  });

  test("the honeypot rejects the request", async () => {
    const { t, leadId } = await setup();
    await expect(
      t.mutation(api.leads.requestOnsiteValuation, {
        sessionKey: session("hp"),
        leadId,
        preferredDate: belgradeDay(1),
        preferredWindow: "morning",
        hp: "http://spam.example",
      }),
    ).rejects.toThrow(/SPAM|odbijen/);
  });
});
