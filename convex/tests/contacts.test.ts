/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { contactSearchText } from "../lib/contactSearch";
import { emailLimitKey } from "../lib/rateLimit";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

const PAGE = { cursor: null, numItems: 50 };
const PHONE = "+381 60 123 4567";

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

async function makeLead(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  agentId: Id<"agents">,
  listingId?: Id<"listings">,
): Promise<Id<"leads">> {
  return await ctx.db.insert("leads", {
    type: "general",
    status: "new",
    ...(listingId !== undefined ? { listingId } : {}),
    agentId,
    contactId,
    message: "Pozovite me, Đorđe, Njegoševa 12.",
    source: "phone",
    locale: "sr-Latn",
    consent: { privacy: true, marketing: false, textVersion: "v", at: Date.now() },
    isDemo: false,
  });
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agent = await makeAgent(ctx, "agent-a");
    const otherAgent = await makeAgent(ctx, "agent-b");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const agentUser = await makeUser(ctx, "agent", agent);
    const listing = await makeListing(ctx, 1, city, agent);
    const contact = await makeContact(ctx, {
      name: "Đorđe Petrović",
      email: "djordje.petrovic@primer.local",
      phone: PHONE,
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
      submittedPhone: "+381 64 999 8888",
      utm: { source: "google", term: "đorđe petrović stan", content: "oglas-za-đorđa" },
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
      start: Date.now() - 86_400_000,
      end: Date.now() - 82_800_000,
      mode: "in_person",
      status: "done",
      isDemo: false,
    });
    return { city, agent, otherAgent, admin, manager, agentUser, listing, contact, lead, viewing };
  });
  return { t, ids };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("contacts access", () => {
  test("contacts are for admin and manager only", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await expect(asAgent.query(api.contacts.list, { paginationOpts: PAGE })).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
    await expect(asAgent.mutation(api.contacts.exportCsv, {})).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(asAgent.mutation(api.contacts.anonymize, { id: ids.contact })).rejects.toThrow(
      /FORBIDDEN|dozvolu/,
    );
    await expect(t.mutation(api.contacts.exportCsv, {})).rejects.toThrow(/UNAUTHENTICATED|prijavljeni/);
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
  test("removes every identifier and all free text, keeps the lead history and logs it", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await asAgent.mutation(api.leadsAdmin.addNote, {
      id: ids.lead,
      body: "Đorđe zove posle 17 h na 060 123 4567.",
    });
    // H1: feedback written through the real mutation.
    await asAgent.mutation(api.viewingsAdmin.setFeedback, {
      id: ids.viewing,
      feedback: "Đorđe se seli zbog posla u Novi Sad, supruga trudna.",
    });
    const asManager = t.withIdentity({ subject: ids.manager });
    await asManager.mutation(api.leadsAdmin.setStatus, {
      id: ids.lead,
      status: "lost",
      lossReason: "Đorđe kupio preko rođaka",
    });

    await asManager.mutation(api.contacts.anonymize, { id: ids.contact });

    const state = await t.run(async (ctx) => ({
      contact: await ctx.db.get("contacts", ids.contact),
      lead: await ctx.db.get("leads", ids.lead),
      viewing: await ctx.db.get("viewings", ids.viewing),
      notes: await ctx.db
        .query("leadNotes")
        .withIndex("by_leadId_and_at", (q) => q.eq("leadId", ids.lead))
        .take(10),
      activity: await ctx.db.query("activity").take(200),
    }));

    expect(state.contact).toMatchObject({ name: "Anonimizovan kontakt", tags: ["anonimizovan"] });
    expect(state.contact?.email).toBeUndefined();
    expect(state.contact?.phone).toBeUndefined();
    expect(state.contact?.searchText).toBeUndefined();
    expect(state.contact?.anonymizedAt).toBeTypeOf("number");

    expect(state.lead?.status).toBe("lost");
    expect(state.lead?.message).toBeUndefined();
    expect(state.lead?.answers).toBeUndefined();
    expect(state.lead?.valuation).toBeUndefined();
    expect(state.lead?.lossReason).toBeUndefined();
    expect(state.lead?.submittedPhone).toBeUndefined();
    expect(state.lead?.utm).toEqual({ source: "google" });
    expect(state.viewing?.feedback).toBeUndefined();
    expect(state.notes).toHaveLength(0);

    const log = JSON.stringify(state.activity);
    for (const fragment of ["060 123", "Novi Sad", "rođaka", "Đorđe", "Petrović"]) {
      expect(log, fragment).not.toContain(fragment);
    }
    const logged = state.activity.find((row) => row.action === "contact.anonymized");
    expect(logged?.by).toBe(ids.manager);

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const csv = await asAdmin.mutation(api.contacts.exportCsv, {});
    expect(csv.rows).toBe(0);
    expect(csv.csv).not.toContain("Petrović");
  });

  test("an erased contact takes no new free text; the stage can still move", async () => {
    const { t, ids } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });
    await asManager.mutation(api.contacts.anonymize, { id: ids.contact });

    await expect(
      asManager.mutation(api.contacts.setNote, { id: ids.contact, note: "Novi broj 061…" }),
    ).rejects.toThrow(/Anonimizovan/);
    await expect(
      asManager.mutation(api.leadsAdmin.addNote, { id: ids.lead, body: "Zvao ponovo." }),
    ).rejects.toThrow(/anonimizovan/);
    await expect(
      asManager.mutation(api.leadsAdmin.setStatus, {
        id: ids.lead,
        status: "lost",
        lossReason: "Odustao",
      }),
    ).rejects.toThrow(/anonimizovan/);
    await expect(
      asManager.mutation(api.viewingsAdmin.setFeedback, { id: ids.viewing, feedback: "Tekst" }),
    ).rejects.toThrow(/anonimizovan/);

    await asManager.mutation(api.leadsAdmin.setStatus, { id: ids.lead, status: "lost" });
    const lead = await t.run(async (ctx) => ctx.db.get("leads", ids.lead));
    expect(lead?.status).toBe("lost");
    expect(lead?.lossReason).toBeUndefined();
  });

  test("large histories are scrubbed completely through the scheduler, newest rows included", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const extraLeads = await t.run(async (ctx) => {
      const out: Id<"leads">[] = [];
      for (let index = 0; index < 7; index += 1) {
        out.push(await makeLead(ctx, ids.contact, ids.agent));
      }
      const base = Date.now();
      for (let index = 0; index < 130; index += 1) {
        await ctx.db.insert("leadNotes", { leadId: ids.lead, body: `Beleška ${index}: Đorđe`, at: base + index });
        // Legacy rows that still quote the note text.
        await ctx.db.insert("activity", {
          entity: "lead",
          entityId: ids.lead,
          action: "lead.note",
          summary: `Đorđe beleška ${index}`,
          at: base + index,
        });
      }
      return out;
    });

    const asManager = t.withIdentity({ subject: ids.manager });
    await asManager.mutation(api.contacts.anonymize, { id: ids.contact });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await t.run(async (ctx) => ({
      notes: await ctx.db
        .query("leadNotes")
        .withIndex("by_leadId_and_at", (q) => q.eq("leadId", ids.lead))
        .take(10),
      activity: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.lead))
        .take(500),
      leads: await Promise.all(extraLeads.map((id) => ctx.db.get("leads", id))),
    }));
    expect(state.notes).toHaveLength(0);
    expect(state.activity.length).toBeGreaterThanOrEqual(130);
    expect(state.activity.every((row) => row.summary === undefined || !row.summary.includes("Đorđe"))).toBe(true);
    expect(state.leads.every((lead) => lead !== null && lead.message === undefined)).toBe(true);
  });
});

describe("merge", () => {
  test("moves leads and history, logs no names, keeps the owner as the survivor", async () => {
    const { t, ids } = await setup();
    const { duplicate, owner } = await t.run(async (ctx) => ({
      duplicate: await makeContact(ctx, { name: "Djordje Petrovic", phone: "060 123 4567" }),
      owner: await makeContact(ctx, { name: "Vlasnik Stana", tags: ["vlasnik"] }),
    }));
    const dupLead = await t.run(async (ctx) => makeLead(ctx, duplicate, ids.agent));
    const asManager = t.withIdentity({ subject: ids.manager });
    await asManager.mutation(api.contacts.setNote, { id: duplicate, note: "Duplikat" });
    await t.run(async (ctx) =>
      ctx.db.insert("activity", {
        entity: "contact",
        entityId: duplicate,
        action: "contact.merged",
        summary: "Stari Zapis → Djordje Petrovic (1 upita)",
        at: Date.now(),
      }),
    );

    const result = await asManager.mutation(api.contacts.merge, {
      intoId: ids.contact,
      fromId: duplicate,
    });
    expect(result.movedLeads).toBe(1);
    const state = await t.run(async (ctx) => ({
      moved: await ctx.db.get("leads", dupLead),
      gone: await ctx.db.get("contacts", duplicate),
      fromRows: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", duplicate))
        .take(10),
      intoRows: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.contact))
        .take(10),
    }));
    expect(state.moved?.contactId).toBe(ids.contact);
    expect(state.gone).toBeNull();
    expect(state.fromRows).toHaveLength(0);
    expect(state.intoRows.map((row) => row.action)).toEqual(
      expect.arrayContaining(["contact.note", "contact.merged"]),
    );
    const log = JSON.stringify(state.intoRows);
    expect(log).not.toContain("Petrovi");
    expect(log).not.toContain("Stari Zapis");

    await expect(
      asManager.mutation(api.contacts.merge, { intoId: ids.contact, fromId: owner }),
    ).rejects.toThrow(/vlasnik/);
  });
});

describe("exportCsv", () => {
  test("escapes quotes, separators and newlines, neutralises formulas and logs itself", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      await makeContact(ctx, { name: '=HYPERLINK("http://zlo.example","klik")', email: "a@b.local" });
      await makeContact(ctx, { name: "Marko; \"Mare\"\nMarković", email: "m@b.local" });
      await makeContact(ctx, { name: "@SUM(A1)", phone: "-1+1" });
    });
    const asManager = t.withIdentity({ subject: ids.manager });
    const { csv, rows, truncated } = await asManager.mutation(api.contacts.exportCsv, {});

    expect(rows).toBe(4);
    expect(truncated).toBe(false);
    const lines = csv.split("\r\n");
    expect(lines[0]?.split(";")[0]).toBe("Ime");
    expect(csv).toContain(`"'=HYPERLINK(""http://zlo.example"",""klik"")"`);
    expect(csv).toContain(`"Marko; ""Mare""\nMarković"`);
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-1+1");
    // The phone starts with "+": kept as text, not a formula.
    expect(csv).toContain(`'${PHONE}`);
    expect(csv).not.toMatch(/(^|;)[=+@-]/m);

    // M5: the audit row commits with the export, with the real count.
    const audit = await t.run(async (ctx) =>
      (await ctx.db.query("activity").take(50)).filter((row) => row.action === "contact.exported"),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ by: ids.manager, summary: "CSV izvoz: 4 kontakata" });
  });
});

describe("public forms and existing contacts", () => {
  const FORM = {
    locale: "sr-Latn" as const,
    privacy: true,
    message: "Zanima me procena mog stana na Vračaru.",
  };

  test("a submission never edits an existing contact; its phone and consent stay on the lead", async () => {
    const { t, ids } = await setup();
    const before = await t.run(async (ctx) => ctx.db.get("contacts", ids.contact));

    const { leadId } = await t.mutation(api.leads.createGeneral, {
      ...FORM,
      sessionKey: "sess-public-0000",
      contact: { name: "Neko Drugi", email: "Djordje.Petrovic@primer.local", phone: "+381 69 111 2222" },
      marketing: false,
    });

    const state = await t.run(async (ctx) => ({
      contact: await ctx.db.get("contacts", ids.contact),
      lead: await ctx.db.get("leads", leadId),
    }));
    expect(state.lead?.contactId).toBe(ids.contact);
    expect(state.lead?.submittedPhone).toBe("+381 69 111 2222");
    expect(state.lead?.consent.marketing).toBe(false);
    expect(state.contact?.phone).toBe(PHONE);
    expect(state.contact?.name).toBe("Đorđe Petrović");
    expect(state.contact?.consents).toEqual(before?.consents);

    const asManager = t.withIdentity({ subject: ids.manager });
    const detail = await asManager.query(api.contacts.get, { id: ids.contact });
    // The contact-level marketing flag is untouched; the lead's consent is on record.
    expect(detail?.contact.marketing).toBe(true);
    expect(detail?.consents.some((consent) => consent.marketing === false)).toBe(true);
    const lead = await asManager.query(api.leadsAdmin.get, { id: leadId });
    expect(lead?.lead.submittedPhone).toBe("+381 69 111 2222");
  });

  test("no match by phone, and never onto a listing owner's private contact", async () => {
    const { t, ids } = await setup();
    const owner = await t.run(async (ctx) =>
      makeContact(ctx, { name: "Vlasnik Stana", email: "vlasnik@primer.local", tags: ["vlasnik"] }),
    );

    const byPhone = await t.mutation(api.leads.createGeneral, {
      ...FORM,
      sessionKey: "sess-public-0001",
      contact: { name: "Treće Lice", email: "trece@primer.local", phone: PHONE },
      marketing: false,
    });
    const asOwner = await t.mutation(api.leads.createGeneral, {
      ...FORM,
      sessionKey: "sess-public-0002",
      contact: { name: "Vlasnik Stana", email: "vlasnik@primer.local" },
      marketing: true,
    });

    const leads = await t.run(async (ctx) => ({
      byPhone: await ctx.db.get("leads", byPhone.leadId),
      asOwner: await ctx.db.get("leads", asOwner.leadId),
    }));
    expect(leads.byPhone?.contactId).not.toBe(ids.contact);
    expect(leads.asOwner?.contactId).not.toBe(owner);
  });

  test("the per-email rate-limit key is a digest, not the address", async () => {
    const key = await emailLimitKey("djordje.petrovic@primer.local");
    expect(key).not.toContain("djordje");
    expect(key).not.toContain("@");
    expect(await emailLimitKey("djordje.petrovic@primer.local")).toBe(key);
    expect(await emailLimitKey("drugi@primer.local")).not.toBe(key);
  });
});

describe("listing owner", () => {
  test("setOwner never rewrites a contact that is another agent's client", async () => {
    const { t, ids } = await setup();
    const agentUser = ids.agentUser;
    // The owner contact also asked about something through a colleague.
    const shared = await t.run(async (ctx) => {
      const contact = await makeContact(ctx, { name: "Zajednički Klijent", tags: ["vlasnik"] });
      await ctx.db.patch("listings", ids.listing, { ownerContactId: contact });
      await makeLead(ctx, contact, ids.otherAgent);
      return contact;
    });

    const asAgent = t.withIdentity({ subject: agentUser });
    await asAgent.mutation(api.listingsAdmin.setOwner, {
      id: ids.listing,
      name: "Promenjeno Ime",
      phone: "+381 63 000 0000",
    });

    const state = await t.run(async (ctx) => ({
      shared: await ctx.db.get("contacts", shared),
      listing: await ctx.db.get("listings", ids.listing),
    }));
    expect(state.shared?.name).toBe("Zajednički Klijent");
    expect(state.listing?.ownerContactId).not.toBe(shared);
    const fresh = await t.run(async (ctx) =>
      state.listing?.ownerContactId !== undefined ? ctx.db.get("contacts", state.listing.ownerContactId) : null,
    );
    expect(fresh).toMatchObject({ name: "Promenjeno Ime", tags: ["vlasnik"] });
  });
});
