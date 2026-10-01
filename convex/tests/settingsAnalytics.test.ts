/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { LeadSource, LeadStatus, LeadType } from "../lib/validators";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

const PAGE = { cursor: null, numItems: 50 };
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

async function makeSettings(ctx: MutationCtx): Promise<Id<"settings">> {
  return await ctx.db.insert("settings", {
    key: "global",
    companyName: "Mihajlo Estate",
    legalName: "Mihajlo Estate d.o.o. Beograd",
    address: "Njegoševa 1, 11000 Beograd",
    pib: "000000000",
    mb: "00000000",
    registryNo: "000",
    phones: ["+381 11 000 0010"],
    email: "office@example.test",
    socials: {},
    officeHours: [{ weekday: 1, from: "09:00", to: "17:00" }],
    commissionText: { sr: "Provizija po dogovoru." },
    mortgage: { rate: 5.4, years: 25, downPct: 20 },
    eurRsd: 117.2,
    stats: [],
    seo: { defaultTitle: { sr: "Mihajlo Estate" }, defaultDescription: { sr: "Nekretnine u Beogradu." } },
    analytics: {},
    isDemo: true,
    updatedAt: Date.now(),
  });
}

async function makeLead(
  ctx: MutationCtx,
  options: {
    agentId?: Id<"agents">;
    listingId?: Id<"listings">;
    status?: LeadStatus;
    source?: LeadSource;
    type?: LeadType;
    respondedAfterMs?: number;
  } = {},
): Promise<Id<"leads">> {
  const contactId = await ctx.db.insert("contacts", {
    name: "Test Kupac",
    email: `kupac${Math.random().toString(36).slice(2)}@example.test`,
    tags: [],
    consents: [],
    isDemo: true,
  });
  return await ctx.db.insert("leads", {
    type: options.type ?? "inquiry",
    status: options.status ?? (options.respondedAfterMs !== undefined ? "contacted" : "new"),
    contactId,
    source: options.source ?? "web",
    locale: "sr-Latn",
    consent: { privacy: true, marketing: false, textVersion: "v1", at: Date.now() },
    ...(options.agentId !== undefined ? { agentId: options.agentId } : {}),
    ...(options.listingId !== undefined ? { listingId: options.listingId } : {}),
    ...(options.respondedAfterMs !== undefined ? { firstResponseAt: Date.now() + options.respondedAfterMs } : {}),
    isDemo: true,
  });
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agentA = await makeAgent(ctx, "agent-a");
    const agentB = await makeAgent(ctx, "agent-b");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const editor = await makeUser(ctx, "editor");
    const agentUser = await makeUser(ctx, "agent", agentA);
    const listing = await makeListing(ctx, 1, city, agentA);
    const settings = await makeSettings(ctx);
    return { city, agentA, agentB, admin, manager, editor, agentUser, listing, settings };
  });
  return { t, ids };
}

describe("settingsAdmin.update", () => {
  test("only an admin may read or change the settings", async () => {
    const { t, ids } = await setup();
    for (const user of [ids.manager, ids.agentUser, ids.editor]) {
      const as = t.withIdentity({ subject: user });
      await expect(as.query(api.settingsAdmin.get, {})).rejects.toThrow(/FORBIDDEN|dozvolu/);
      await expect(
        as.mutation(api.settingsAdmin.update, { patch: { companyName: "Druga agencija" } }),
      ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    }
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const data = await asAdmin.query(api.settingsAdmin.get, {});
    expect(data?.settings.companyName).toBe("Mihajlo Estate");
  });

  test("PIB and MB must have exactly 9 and 8 digits", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await expect(asAdmin.mutation(api.settingsAdmin.update, { patch: { pib: "12345678" } })).rejects.toThrow(
      /PIB/,
    );
    await expect(asAdmin.mutation(api.settingsAdmin.update, { patch: { pib: "10405213A" } })).rejects.toThrow(
      /PIB/,
    );
    await expect(asAdmin.mutation(api.settingsAdmin.update, { patch: { mb: "123456789" } })).rejects.toThrow(
      /Matični broj/,
    );
    await expect(asAdmin.mutation(api.settingsAdmin.update, { patch: { registryNo: "  " } })).rejects.toThrow(
      /Registar posrednika/,
    );
    await expect(
      asAdmin.mutation(api.settingsAdmin.update, { patch: { socials: { instagram: "http://example.com/x" } } }),
    ).rejects.toThrow(/Instagram/);
    await expect(
      asAdmin.mutation(api.settingsAdmin.update, { patch: { analytics: { ga4Id: "UA-12345" } } }),
    ).rejects.toThrow(/GA4/);
  });

  test("a change logs a field-level diff; a no-op logs nothing", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });

    const result = await asAdmin.mutation(api.settingsAdmin.update, {
      patch: {
        companyName: "  Mihajlo Estate Beograd ",
        socials: { instagram: "https://www.instagram.com/mihajlo.estate" },
        mortgage: { rate: 4.9, years: 25, downPct: 20 },
      },
    });
    expect(result.changed).toBe(3);

    const log = await t.run(async (ctx) =>
      ctx.db
        .query("activity")
        .withIndex("by_entity_and_at", (q) => q.eq("entity", "settings"))
        .collect(),
    );
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe("settings.updated");
    expect(log[0]?.by).toBe(ids.admin);
    expect(log[0]?.diff).toEqual(
      expect.arrayContaining([
        { field: "companyName", from: "Mihajlo Estate", to: "Mihajlo Estate Beograd" },
        { field: "socials.instagram", to: "https://www.instagram.com/mihajlo.estate" },
        { field: "mortgage.rate", from: "5.4", to: "4.9" },
      ]),
    );

    const again = await asAdmin.mutation(api.settingsAdmin.update, {
      patch: { companyName: "Mihajlo Estate Beograd" },
    });
    expect(again.changed).toBe(0);
    const after = await t.run(async (ctx) => ctx.db.query("activity").collect());
    expect(after).toHaveLength(1);
  });

  test("real legal data ends the demo state; placeholders keep it", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });

    const partial = await asAdmin.mutation(api.settingsAdmin.update, {
      patch: { pib: "104052135", mb: "20084693" },
    });
    expect(partial.isDemo).toBe(true);

    const real = await asAdmin.mutation(api.settingsAdmin.update, { patch: { registryNo: "1234" } });
    expect(real.isDemo).toBe(false);
    const stored = await t.run(async (ctx) => ctx.db.get("settings", ids.settings));
    expect(stored?.isDemo).toBe(false);

    // Real settings: the publish checklist now requires the registry number.
    const detail = await asAdmin.query(api.listingsAdmin.get, { id: ids.listing, now: Date.now() });
    expect(detail?.checklistContext.registryRequired).toBe(true);
    expect(detail?.checklistContext.registryOk).toBe(true);

    const log = await t.run(async (ctx) => ctx.db.query("activity").collect());
    expect(log.map((row) => row.action)).toEqual(["settings.updated", "settings.legal.real"]);
  });

  test("optional fields are cleared with an empty string or null", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await asAdmin.mutation(api.settingsAdmin.update, {
      patch: { insurance: "Polisa 123", officeLat: 44.81, officeLng: 20.46 },
    });
    await expect(
      asAdmin.mutation(api.settingsAdmin.update, { patch: { officeLat: null } }),
    ).rejects.toThrow(/obe koordinate/);
    await asAdmin.mutation(api.settingsAdmin.update, {
      patch: { insurance: "", officeLat: null, officeLng: null },
    });
    const stored = await t.run(async (ctx) => ctx.db.get("settings", ids.settings));
    expect(stored?.insurance).toBeUndefined();
    expect(stored?.officeLat).toBeUndefined();
    expect(stored?.officeLng).toBeUndefined();
  });
});

describe("activity.list", () => {
  async function seedLog(ctx: MutationCtx, ids: { admin: Id<"users">; manager: Id<"users">; listing: Id<"listings"> }) {
    const base = Date.UTC(2026, 8, 1);
    await ctx.db.insert("activity", {
      entity: "listing",
      entityId: ids.listing,
      action: "listing.updated",
      diff: [{ field: "price", from: "200000", to: "190000" }],
      by: ids.admin,
      at: base,
    });
    await ctx.db.insert("activity", {
      entity: "lead",
      entityId: "missing",
      action: "lead.status.won",
      by: ids.manager,
      at: base + DAY,
    });
    await ctx.db.insert("activity", {
      entity: "settings",
      action: "settings.updated",
      by: ids.admin,
      at: base + 2 * DAY,
    });
    await ctx.db.insert("activity", { entity: "demo", action: "demo.purge.started", at: base + 3 * DAY });
    return base;
  }

  test("agents and editors are refused", async () => {
    const { t, ids } = await setup();
    for (const user of [ids.agentUser, ids.editor]) {
      const as = t.withIdentity({ subject: user });
      await expect(as.query(api.activity.list, { paginationOpts: PAGE })).rejects.toThrow(/FORBIDDEN|dozvolu/);
      await expect(as.query(api.activity.staff, {})).rejects.toThrow(/FORBIDDEN|dozvolu/);
    }
  });

  test("filters by entity, user and date range, newest first, with links and names", async () => {
    const { t, ids } = await setup();
    const base = await t.run(async (ctx) => seedLog(ctx, ids));
    const asManager = t.withIdentity({ subject: ids.manager });

    const all = await asManager.query(api.activity.list, { paginationOpts: PAGE });
    expect(all.page.map((row) => row.action)).toEqual([
      "demo.purge.started",
      "settings.updated",
      "lead.status.won",
      "listing.updated",
    ]);
    expect(all.page[3]).toMatchObject({
      byName: "admin",
      byId: ids.admin,
      target: { kind: "listing", id: ids.listing },
      diff: [{ field: "price", from: "200000", to: "190000" }],
    });
    // A lead that no longer exists gets no link; settings always link.
    expect(all.page[2]?.target).toBeUndefined();
    expect(all.page[1]?.target).toEqual({ kind: "settings" });
    expect(all.page[0]?.byName).toBe("sistem");

    const listings = await asManager.query(api.activity.list, { entity: "listing", paginationOpts: PAGE });
    expect(listings.page.map((row) => row.entity)).toEqual(["listing"]);

    const byAdmin = await asManager.query(api.activity.list, { by: ids.admin, paginationOpts: PAGE });
    expect(byAdmin.page.map((row) => row.action)).toEqual(["settings.updated", "listing.updated"]);

    const adminSettings = await asManager.query(api.activity.list, {
      by: ids.admin,
      entity: "settings",
      paginationOpts: PAGE,
    });
    expect(adminSettings.page.map((row) => row.action)).toEqual(["settings.updated"]);

    const window = await asManager.query(api.activity.list, {
      from: base + DAY,
      to: base + 3 * DAY,
      paginationOpts: PAGE,
    });
    expect(window.page.map((row) => row.action)).toEqual(["settings.updated", "lead.status.won"]);

    const staff = await asManager.query(api.activity.staff, {});
    expect(staff.map((user) => user.name)).toEqual(["admin", "agent", "editor", "manager"]);
  });
});

describe("analytics", () => {
  test("every analytics query refuses agents and editors", async () => {
    const { t, ids } = await setup();
    const now = Date.now();
    for (const user of [ids.agentUser, ids.editor]) {
      const as = t.withIdentity({ subject: user });
      await expect(as.query(api.analytics.leadsOverTime, { now, days: 30 })).rejects.toThrow(/FORBIDDEN|dozvolu/);
      await expect(as.query(api.analytics.responseTimes, { now, days: 30 })).rejects.toThrow(/FORBIDDEN|dozvolu/);
      await expect(as.query(api.analytics.topListings, {})).rejects.toThrow(/FORBIDDEN|dozvolu/);
      await expect(as.query(api.analytics.topListingsByLeads, { now, days: 30 })).rejects.toThrow(
        /FORBIDDEN|dozvolu/,
      );
      // Even for the agent's own listing: the funnel is an agency-level view.
      await expect(as.query(api.analytics.listingFunnel, { listingId: ids.listing })).rejects.toThrow(
        /FORBIDDEN|dozvolu/,
      );
    }
  });

  test("funnel, weekly buckets and response times", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("listingStats", {
        listingId: ids.listing,
        views: 200,
        favorites: 12,
        leads: 0,
        viewings: 0,
      });
      await makeLead(ctx, { agentId: ids.agentA, listingId: ids.listing, respondedAfterMs: 30 * MINUTE });
      await makeLead(ctx, {
        agentId: ids.agentA,
        listingId: ids.listing,
        respondedAfterMs: 3 * HOUR,
        status: "won",
        source: "phone",
        type: "viewing",
      });
      await makeLead(ctx, { agentId: ids.agentB, respondedAfterMs: 90 * MINUTE });
      await makeLead(ctx, { source: "email" });
      await ctx.db.insert("viewings", {
        listingId: ids.listing,
        agentId: ids.agentA,
        start: Date.now() - DAY,
        end: Date.now() - DAY + HOUR,
        mode: "in_person",
        status: "done",
        isDemo: true,
      });
      await ctx.db.insert("viewings", {
        listingId: ids.listing,
        agentId: ids.agentA,
        start: Date.now() + DAY,
        end: Date.now() + DAY + HOUR,
        mode: "in_person",
        status: "cancelled",
        isDemo: true,
      });
    });
    const asManager = t.withIdentity({ subject: ids.manager });
    const now = Date.now() + 2 * HOUR;

    const funnel = await asManager.query(api.analytics.listingFunnel, { listingId: ids.listing });
    expect(funnel).toMatchObject({
      views: 200,
      favorites: 12,
      leads: 2,
      leadsWon: 1,
      viewings: 1,
      viewingsDone: 1,
      capped: false,
    });
    expect(await asManager.query(api.analytics.listingFunnel, { listingId: "not-an-id" })).toBeNull();

    const trend = await asManager.query(api.analytics.leadsOverTime, { now, days: 30 });
    expect(trend.weeks).toHaveLength(5);
    expect(trend.weeks.at(-1)?.partial).toBe(true);
    expect(trend.totals).toMatchObject({
      total: 4,
      bySource: { web: 2, phone: 1, email: 1, portal: 0, walk_in: 0 },
      byType: { inquiry: 3, viewing: 1 },
    });
    expect(trend.weeks.reduce((sum, week) => sum + week.total, 0)).toBe(4);

    const top = await asManager.query(api.analytics.topListingsByLeads, { now, days: 30 });
    expect(top.rows[0]).toMatchObject({ listingId: ids.listing, periodLeads: 2, views: 200 });

    const response = await asManager.query(api.analytics.responseTimes, { now, days: 30 });
    const rowA = response.rows.find((row) => row.agentId === ids.agentA);
    expect(rowA).toMatchObject({
      leads: 2,
      responded: 2,
      medianMinutes: 105,
      avgMinutes: 105,
      within1h: 1,
      eligible1h: 2,
      within24h: 2,
      openUnanswered: 0,
    });
    const unassigned = response.rows.find((row) => row.agentId === undefined);
    expect(unassigned).toMatchObject({ name: "Nedodeljeni upiti", leads: 1, responded: 0, openUnanswered: 1 });
    expect(response.total).toMatchObject({ leads: 4, responded: 3, medianMinutes: 90, openUnanswered: 1 });
  });
});

describe("settingsAdmin.update compares full values", () => {
  test("a change past the logged 200 characters is saved and logged", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const long = `${"Provizija se ugovara pojedinačno. ".repeat(10)}Kraj A.`;
    await asAdmin.mutation(api.settingsAdmin.update, {
      patch: { commissionText: { sr: "Provizija po dogovoru.", en: long } },
    });

    const edited = `${long.slice(0, -2)}B.`;
    const result = await asAdmin.mutation(api.settingsAdmin.update, {
      patch: { commissionText: { sr: "Provizija po dogovoru.", en: edited } },
    });
    expect(result.changed).toBe(1);
    const stored = await t.run(async (ctx) => ctx.db.get("settings", ids.settings));
    expect(stored?.commissionText.en).toBe(edited);

    const log = await t.run(async (ctx) =>
      ctx.db
        .query("activity")
        .withIndex("by_entity_and_at", (q) => q.eq("entity", "settings"))
        .order("desc")
        .first(),
    );
    const entry = log?.diff?.find((item) => item.field === "commissionText.en");
    // Clipped around the first difference, so the edit is visible in the log.
    expect(entry?.from).toMatch(/A\.$/);
    expect(entry?.to).toMatch(/B\.$/);
    expect(entry?.from?.length).toBeLessThanOrEqual(202);
  });

  test("a demo flag that only flips is written and logged", async () => {
    const { t, ids } = await setup();
    // Real numbers entered directly, but the flag was never cleared.
    await t.run(async (ctx) =>
      ctx.db.patch("settings", ids.settings, { pib: "104052135", mb: "20084693", registryNo: "1234" }),
    );
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const result = await asAdmin.mutation(api.settingsAdmin.update, { patch: { companyName: "Mihajlo Estate" } });
    expect(result).toEqual({ changed: 1, isDemo: false });
    const stored = await t.run(async (ctx) => ctx.db.get("settings", ids.settings));
    expect(stored?.isDemo).toBe(false);
    const log = await t.run(async (ctx) => ctx.db.query("activity").collect());
    expect(log[0]).toMatchObject({ action: "settings.legal.real", diff: [{ field: "isDemo", from: "da", to: "ne" }] });
  });
});

describe("activity privacy for managers", () => {
  test("account and invitation rows are admin-only; e-mails never reach a manager", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      const nameless = await ctx.db.insert("users", { email: "bez.imena@example.test", role: "editor", status: "active" });
      await ctx.db.insert("activity", {
        entity: "user",
        action: "invite.created",
        summary: "nova@example.test (Urednik)",
        by: ids.admin,
        at: 1_000,
      });
      await ctx.db.insert("activity", {
        entity: "agent",
        action: "agent.created",
        summary: "Ana (uz pozivnicu za ana@example.test)",
        by: nameless,
        at: 2_000,
      });
    });

    const asManager = t.withIdentity({ subject: ids.manager });
    const managerView = await asManager.query(api.activity.list, { paginationOpts: PAGE });
    expect(managerView.page.map((row) => row.action)).toEqual(["agent.created"]);
    expect(managerView.page[0]).toMatchObject({
      byName: "Član tima",
      summary: "Ana (uz pozivnicu za [e-pošta skrivena])",
    });
    await expect(asManager.query(api.activity.list, { entity: "user", paginationOpts: PAGE })).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
    const managerStaff = await asManager.query(api.activity.staff, {});
    expect(managerStaff.some((user) => user.name.includes("@"))).toBe(false);

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const adminView = await asAdmin.query(api.activity.list, { paginationOpts: PAGE });
    expect(adminView.page.map((row) => row.action)).toEqual(["agent.created", "invite.created"]);
    expect(adminView.page[0]).toMatchObject({
      byName: "bez.imena@example.test",
      summary: "Ana (uz pozivnicu za ana@example.test)",
    });
    const adminStaff = await asAdmin.query(api.activity.staff, {});
    expect(adminStaff.map((user) => user.name)).toContain("bez.imena@example.test");
  });
});
