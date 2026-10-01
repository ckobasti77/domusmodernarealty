/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { contactSearchText } from "../lib/contactSearch";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

const PAGE = { cursor: null, numItems: 50 };

async function makeContact(
  ctx: MutationCtx,
  fields: { name: string; email?: string; phone?: string; tags?: string[]; marketing?: boolean },
): Promise<Id<"contacts">> {
  return await ctx.db.insert("contacts", {
    name: fields.name,
    ...(fields.email !== undefined ? { email: fields.email } : {}),
    ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
    locale: "sr-Latn",
    tags: fields.tags ?? ["web"],
    consents: [
      {
        privacy: true,
        marketing: fields.marketing ?? false,
        textVersion: "privacy-2026-09",
        at: Date.now(),
        channel: "web",
      },
    ],
    searchText: contactSearchText(fields),
    isDemo: false,
  });
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agent = await makeAgent(ctx, "agent-a");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const agentUser = await makeUser(ctx, "agent", agent);
    const listing = await makeListing(ctx, 1, city, agent);
    const contact = await makeContact(ctx, {
      name: "Đorđe Petrović",
      email: "djordje.petrovic@primer.local",
      phone: "+381 60 123 4567",
      marketing: true,
    });
    const lead = await ctx.db.insert("leads", {
      type: "valuation",
      status: "contacted",
      listingId: listing,
      agentId: agent,
      contactId: contact,
      message: "Moj stan je u Njegoševoj 12, treći sprat.",
      answers: { addressNote: "Njegoševa 12", areaM2: 64 },
      valuation: { low: 180_000, high: 200_000, mid: 190_000, pricePerM2: 2968, basis: "vracar" },
      source: "web",
      locale: "sr-Latn",
      consent: {
        privacy: true,
        marketing: true,
        textVersion: "privacy-2026-09",
        at: Date.now(),
        channel: "web",
      },
      isDemo: false,
    });
    const viewing = await ctx.db.insert("viewings", {
      listingId: listing,
      leadId: lead,
      agentId: agent,
      start: Date.now() + 86_400_000,
      end: Date.now() + 90_000_000,
      mode: "in_person",
      status: "done",
      feedback: "Đorđe je rekao da se seli zbog posla u Novi Sad.",
      isDemo: false,
    });
    return { city, agent, admin, manager, agentUser, listing, contact, lead, viewing };
  });
  return { t, ids };
}

describe("contacts access", () => {
  test("contacts are for admin and manager only", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await expect(asAgent.query(api.contacts.list, { paginationOpts: PAGE })).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
    await expect(asAgent.query(api.contacts.exportCsv, {})).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(asAgent.mutation(api.contacts.anonymize, { id: ids.contact })).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
    await expect(t.query(api.contacts.exportCsv, {})).rejects.toThrow(/UNAUTHENTICATED|prijavljeni/);
  });

  test("the list counts leads and search folds diacritics and phone formats", async () => {
    const { t, ids } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });

    const all = await asManager.query(api.contacts.list, { paginationOpts: PAGE });
    expect(all.page).toHaveLength(1);
    expect(all.page[0]).toMatchObject({ leadCount: 1, marketing: true, leadCountCapped: false });

    for (const q of ["petrovic", "Đorđe", "djordje", "060 123", "+381 60", "djordje.petrovic@pri"]) {
      const found = await asManager.query(api.contacts.list, { q, paginationOpts: PAGE });
      expect(found.page.map((row) => row._id), q).toContain(ids.contact);
    }
    const none = await asManager.query(api.contacts.list, { q: "jovanovic", paginationOpts: PAGE });
    expect(none.page).toHaveLength(0);
  });
});

describe("anonymize", () => {
  test("removes every identifier, keeps the lead history and logs it", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await asAgent.mutation(api.leadsAdmin.addNote, {
      id: ids.lead,
      body: "Đorđe zove posle 17 h na 060 123 4567.",
    });

    const asManager = t.withIdentity({ subject: ids.manager });
    await asManager.mutation(api.contacts.anonymize, { id: ids.contact });

    const state = await t.run(async (ctx) => ({
      contact: await ctx.db.get("contacts", ids.contact),
      lead: await ctx.db.get("leads", ids.lead),
      viewing: await ctx.db.get("viewings", ids.viewing),
      notes: await ctx.db
        .query("leadNotes")
        .withIndex("by_leadId_and_at", (q) => q.eq("leadId", ids.lead))
        .take(10),
      leadActivity: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.lead))
        .take(20),
      contactActivity: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.contact))
        .take(20),
    }));

    expect(state.contact).toMatchObject({ name: "Anonimizovan kontakt", tags: ["anonimizovan"] });
    expect(state.contact?.email).toBeUndefined();
    expect(state.contact?.phone).toBeUndefined();
    expect(state.contact?.searchText).toBeUndefined();
    expect(state.contact?.anonymizedAt).toBeTypeOf("number");

    expect(state.lead?.status).toBe("contacted");
    expect(state.lead?.message).toBeUndefined();
    expect(state.lead?.answers).toBeUndefined();
    expect(state.lead?.valuation).toBeUndefined();
    expect(state.viewing?.feedback).toBeUndefined();
    expect(state.notes).toHaveLength(0);
    expect(JSON.stringify(state.leadActivity)).not.toContain("060 123");

    const logged = state.contactActivity.find((row) => row.action === "contact.anonymized");
    expect(logged?.by).toBe(ids.manager);

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const csv = await asAdmin.query(api.contacts.exportCsv, {});
    expect(csv.rows).toBe(0);
    expect(csv.csv).not.toContain("Petrović");

    await expect(
      asManager.mutation(api.contacts.setNote, { id: ids.contact, note: "Novi broj 061…" }),
    ).rejects.toThrow(/Anonimizovan/);
  });
});

describe("merge", () => {
  test("moves leads, keeps the owner as the survivor and refuses the other way", async () => {
    const { t, ids } = await setup();
    const { duplicate, owner } = await t.run(async (ctx) => ({
      duplicate: await makeContact(ctx, { name: "Djordje Petrovic", phone: "060 123 4567" }),
      owner: await makeContact(ctx, { name: "Vlasnik Stana", tags: ["vlasnik"] }),
    }));
    const dupLead = await t.run(async (ctx) =>
      ctx.db.insert("leads", {
        type: "general",
        status: "new",
        contactId: duplicate,
        source: "phone",
        locale: "sr-Latn",
        consent: { privacy: true, marketing: false, textVersion: "v", at: Date.now() },
        isDemo: false,
      }),
    );
    const asManager = t.withIdentity({ subject: ids.manager });

    const result = await asManager.mutation(api.contacts.merge, {
      intoId: ids.contact,
      fromId: duplicate,
    });
    expect(result.movedLeads).toBe(1);
    const moved = await t.run(async (ctx) => ctx.db.get("leads", dupLead));
    expect(moved?.contactId).toBe(ids.contact);
    expect(await t.run(async (ctx) => ctx.db.get("contacts", duplicate))).toBeNull();

    await expect(
      asManager.mutation(api.contacts.merge, { intoId: ids.contact, fromId: owner }),
    ).rejects.toThrow(/vlasnik/);
  });
});

describe("exportCsv", () => {
  test("escapes quotes, separators and newlines and neutralises formulas", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      await makeContact(ctx, { name: '=HYPERLINK("http://zlo.example","klik")', email: "a@b.local" });
      await makeContact(ctx, { name: "Marko; \"Mare\"\nMarković", email: "m@b.local" });
      await makeContact(ctx, { name: "@SUM(A1)", phone: "-1+1" });
    });
    const asManager = t.withIdentity({ subject: ids.manager });
    const { csv, rows, truncated } = await asManager.query(api.contacts.exportCsv, {});

    expect(rows).toBe(4);
    expect(truncated).toBe(false);
    const lines = csv.split("\r\n");
    expect(lines[0]?.split(";")[0]).toBe("Ime");
    expect(csv).toContain(`"'=HYPERLINK(""http://zlo.example"",""klik"")"`);
    expect(csv).toContain(`"Marko; ""Mare""\nMarković"`);
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-1+1");
    // The phone starts with "+": kept as text, not a formula.
    expect(csv).toContain("'+381 60 123 4567");
    expect(csv).not.toMatch(/(^|;)[=+@-]/m);
  });
});
