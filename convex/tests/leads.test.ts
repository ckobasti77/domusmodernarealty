/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const neighborhood = await makeLocation(ctx, "vracar", "neighborhood", city);
    const agent = await makeAgent(ctx, "agent-one");
    const admin = await makeUser(ctx, "admin");
    const listing = await makeListing(ctx, 1, city, agent, { price: 200_000 });
    return { city, neighborhood, agent, admin, listing };
  });
  return { t, ids };
}

const CONTACT = {
  name: "Test Klijent",
  email: "klijent@primer.local",
  phone: "+381 60 123 4567",
};

function session(suffix = "a"): string {
  return `sess-${suffix}${"0".repeat(10)}`;
}

describe("public lead mutations", () => {
  test("an inquiry creates a contact, a lead and bumps the listing counter", async () => {
    const { t, ids } = await setup();
    const { leadId } = await t.mutation(api.leads.createInquiry, {
      sessionKey: session(),
      locale: "sr-Latn",
      contact: CONTACT,
      marketing: false,
      privacy: true,
      listingId: ids.listing,
      message: "Zanima me da li je stan slobodan i kada može razgledanje.",
    });

    const state = await t.run(async (ctx) => {
      const lead = await ctx.db.get("leads", leadId);
      const contacts = await ctx.db.query("contacts").take(10);
      const stats = await ctx.db
        .query("listingStats")
        .withIndex("by_listingId", (q) => q.eq("listingId", ids.listing))
        .unique();
      const activity = await ctx.db.query("activity").take(10);
      return { lead, contacts, stats, activity };
    });

    expect(state.lead?.type).toBe("inquiry");
    expect(state.lead?.status).toBe("new");
    expect(state.lead?.agentId).toBe(ids.agent);
    expect(state.lead?.consent.privacy).toBe(true);
    expect(state.contacts).toHaveLength(1);
    expect(state.stats?.leads).toBe(1);
    expect(state.activity.some((row) => row.action === "lead.created")).toBe(true);
  });

  test("the honeypot silently rejects and the privacy consent is mandatory", async () => {
    const { t, ids } = await setup();

    await expect(
      t.mutation(api.leads.createInquiry, {
        sessionKey: session("b"),
        locale: "sr-Latn",
        contact: CONTACT,
        marketing: false,
        privacy: true,
        hp: "http://spam.example",
        listingId: ids.listing,
        message: "Zanima me stan i termin razgledanja ove nedelje.",
      }),
    ).rejects.toThrow(/SPAM|odbijen/);

    await expect(
      t.mutation(api.leads.createInquiry, {
        sessionKey: session("c"),
        locale: "sr-Latn",
        contact: CONTACT,
        marketing: false,
        privacy: false,
        listingId: ids.listing,
        message: "Zanima me stan i termin razgledanja ove nedelje.",
      }),
    ).rejects.toThrow(/INVALID_INPUT|Saglasnost/);
  });

  test("the rate limiter stops a burst from one session", async () => {
    const { t, ids } = await setup();
    const key = session("limit");
    let accepted = 0;
    let limited = false;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await t.mutation(api.leads.createInquiry, {
          sessionKey: key,
          locale: "sr-Latn",
          contact: { ...CONTACT, email: `k${attempt}@primer.local` },
          marketing: false,
          privacy: true,
          listingId: ids.listing,
          message: `Poruka broj ${attempt} sa dovoljno znakova za validaciju.`,
        });
        accepted += 1;
      } catch (error) {
        limited = true;
        expect(JSON.stringify(error)).toMatch(/RATE_LIMITED|Previše zahteva/);
        break;
      }
    }

    // Token bucket: capacity 3, so the 4th request in the same instant is capped.
    expect(accepted).toBeLessThanOrEqual(4);
    expect(limited).toBe(true);
  });

  test("a valuation computes a server-side range from the location average", async () => {
    const { t, ids } = await setup();
    const { valuation } = await t.mutation(api.leads.createValuation, {
      sessionKey: session("val"),
      locale: "sr-Latn",
      contact: { ...CONTACT, email: "procena@primer.local" },
      marketing: true,
      privacy: true,
      locationId: ids.neighborhood,
      propertyType: "apartment",
      areaM2: 60,
      rooms: 2,
      floor: 3,
      totalFloors: 5,
      hasElevator: true,
      condition: "renovated",
    });

    expect(valuation.pricePerM2).toBeGreaterThan(0);
    expect(valuation.low).toBeLessThan(valuation.mid);
    expect(valuation.high).toBeGreaterThan(valuation.mid);

    const lead = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("leads")
        .withIndex("by_type_and_status", (q) => q.eq("type", "valuation"))
        .take(1);
      return rows[0];
    });
    expect(lead.valuation?.mid).toBe(valuation.mid);
    expect(lead.answers?.areaM2).toBe(60);
  });

  test("contacts dedupe by email across forms", async () => {
    const { t, ids } = await setup();
    await t.mutation(api.leads.createGeneral, {
      sessionKey: session("g1"),
      locale: "sr-Latn",
      contact: CONTACT,
      marketing: false,
      privacy: true,
      message: "Opšte pitanje o uslovima poslovanja i proviziji.",
    });
    await t.mutation(api.leads.createSeller, {
      sessionKey: session("g2"),
      locale: "sr-Latn",
      contact: CONTACT,
      marketing: true,
      privacy: true,
      propertyType: "apartment",
      areaM2: 70,
      message: "Prodajem stan, molim za kontakt.",
    });

    const state = await t.run(async (ctx) => {
      const contacts = await ctx.db.query("contacts").take(10);
      const leads = await ctx.db.query("leads").take(10);
      return { contacts, leads };
    });
    expect(state.contacts).toHaveLength(1);
    // A later form never edits the contact (audit M6): each submission's
    // consent is recorded on its own lead.
    expect(state.contacts[0].consents.length).toBe(1);
    expect(state.leads).toHaveLength(2);
    expect(state.leads.map((lead) => lead.consent.marketing).sort()).toEqual([false, true]);
    expect(ids.listing).toBeDefined();
  });
});

describe("viewing requests", () => {
  test("a slot inside the agent's hours is accepted and creates a lead", async () => {
    const { t, ids } = await setup();
    const start = nextMonday10Utc();
    const { viewingId, leadId } = await t.mutation(api.viewings.request, {
      sessionKey: session("v1"),
      locale: "sr-Latn",
      listingId: ids.listing,
      start,
      end: start + 3_600_000,
      mode: "in_person",
      contact: { ...CONTACT, email: "razgledanje@primer.local" },
      marketing: false,
      privacy: true,
    });

    const state = await t.run(async (ctx) => ({
      viewing: await ctx.db.get("viewings", viewingId),
      lead: await ctx.db.get("leads", leadId),
    }));
    expect(state.viewing?.status).toBe("requested");
    expect(state.lead?.type).toBe("viewing");
  });

  test("a slot outside the agent's hours is refused", async () => {
    const { t, ids } = await setup();
    const start = nextMonday10Utc() + 12 * 3_600_000; // 22:00
    await expect(
      t.mutation(api.viewings.request, {
        sessionKey: session("v2"),
        locale: "sr-Latn",
        listingId: ids.listing,
        start,
        end: start + 3_600_000,
        mode: "in_person",
        contact: { ...CONTACT, email: "pozno@primer.local" },
        marketing: false,
        privacy: true,
      }),
    ).rejects.toThrow(/SLOT_TAKEN|radnom vremenu/);
  });

  test("a double booking of the same slot is refused", async () => {
    const { t, ids } = await setup();
    const start = nextMonday10Utc();
    const args = {
      locale: "sr-Latn" as const,
      listingId: ids.listing,
      start,
      end: start + 3_600_000,
      mode: "in_person" as const,
      marketing: false,
      privacy: true,
    };
    await t.mutation(api.viewings.request, {
      ...args,
      sessionKey: session("d1"),
      contact: { ...CONTACT, email: "prvi@primer.local" },
    });
    await expect(
      t.mutation(api.viewings.request, {
        ...args,
        sessionKey: session("d2"),
        contact: { ...CONTACT, email: "drugi@primer.local" },
      }),
    ).rejects.toThrow(/SLOT_TAKEN|zauzet/);
  });
});

describe("view tracking", () => {
  test("counts once per session and never for a hidden listing", async () => {
    const { t, ids } = await setup();
    const key = session("view");

    const first = await t.mutation(api.stats.trackView, {
      listingId: ids.listing,
      sessionKey: key,
    });
    const second = await t.mutation(api.stats.trackView, {
      listingId: ids.listing,
      sessionKey: key,
    });
    expect(first.counted).toBe(true);
    expect(second.counted).toBe(false);

    const draft = await t.run(async (ctx) =>
      makeListing(ctx, 7, ids.city, ids.agent, { status: "draft" }),
    );
    const hidden = await t.mutation(api.stats.trackView, {
      listingId: draft,
      sessionKey: session("view2"),
    });
    expect(hidden.counted).toBe(false);

    const stats = await t.run(async (ctx) =>
      ctx.db
        .query("listingStats")
        .withIndex("by_listingId", (q) => q.eq("listingId", ids.listing))
        .unique(),
    );
    expect(stats?.views).toBe(1);
  });
});

/** Monday 10:00 UTC, always in the future, inside the fixture agent's hours. */
function nextMonday10Utc(): number {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0),
  );
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() !== 1);
  return date.getTime();
}
