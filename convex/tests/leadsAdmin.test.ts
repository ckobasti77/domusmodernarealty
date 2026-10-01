/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { LeadSource, LeadStatus, LeadType } from "../lib/validators";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

const PAGE = { cursor: null, numItems: 50 };

async function makeContact(ctx: MutationCtx, name: string): Promise<Id<"contacts">> {
  return await ctx.db.insert("contacts", {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@primer.local`,
    tags: ["web"],
    consents: [],
    isDemo: true,
  });
}

async function makeLead(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  overrides: {
    agentId?: Id<"agents">;
    listingId?: Id<"listings">;
    status?: LeadStatus;
    type?: LeadType;
    source?: LeadSource;
  } = {},
): Promise<Id<"leads">> {
  return await ctx.db.insert("leads", {
    type: overrides.type ?? "inquiry",
    status: overrides.status ?? "new",
    ...(overrides.agentId !== undefined ? { agentId: overrides.agentId } : {}),
    ...(overrides.listingId !== undefined ? { listingId: overrides.listingId } : {}),
    contactId,
    message: "Zanima me stan, molim Vas da me pozovete.",
    source: overrides.source ?? "web",
    locale: "sr-Latn",
    consent: {
      privacy: true,
      marketing: false,
      textVersion: "privacy-2026-09",
      at: Date.now(),
      channel: "web",
    },
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
    const contactA = await makeContact(ctx, "Ana Anić");
    const contactB = await makeContact(ctx, "Bojan Bojić");
    const leadA = await makeLead(ctx, contactA, { agentId: agentA, listingId: listing });
    const leadA2 = await makeLead(ctx, contactA, {
      agentId: agentA,
      status: "contacted",
      type: "valuation",
      source: "phone",
    });
    const leadB = await makeLead(ctx, contactB, { agentId: agentB });
    const leadUnassigned = await makeLead(ctx, contactB, { type: "general" });
    return {
      city,
      agentA,
      agentB,
      admin,
      manager,
      editor,
      agentUser,
      listing,
      contactA,
      contactB,
      leadA,
      leadA2,
      leadB,
      leadUnassigned,
    };
  });
  return { t, ids };
}

describe("agent scoping", () => {
  test("an agent lists only their own leads, whatever filter they send", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    const own = await asAgent.query(api.leadsAdmin.list, { paginationOpts: PAGE });
    expect(own.page.map((row) => row._id).sort()).toEqual([ids.leadA, ids.leadA2].sort());

    const spoofed = await asAgent.query(api.leadsAdmin.list, {
      agentId: ids.agentB,
      paginationOpts: PAGE,
    });
    expect(spoofed.page.every((row) => row.agentId === ids.agentA)).toBe(true);

    const unassigned = await asAgent.query(api.leadsAdmin.list, {
      unassigned: true,
      paginationOpts: PAGE,
    });
    expect(unassigned.page.map((row) => row._id)).not.toContain(ids.leadUnassigned);
  });

  test("an agent's kanban holds only their own cards", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const columns = await asAgent.query(api.leadsAdmin.kanban, {});
    const cards = columns.flatMap((column) => column.items);
    expect(cards.map((card) => card._id).sort()).toEqual([ids.leadA, ids.leadA2].sort());
    expect(columns.find((column) => column.status === "new")?.total).toBe(1);
    expect(columns.find((column) => column.status === "contacted")?.total).toBe(1);
  });

  test("an agent cannot open or change a colleague's lead", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    expect(await asAgent.query(api.leadsAdmin.get, { id: ids.leadB })).toBeNull();
    expect(await asAgent.query(api.leadsAdmin.get, { id: ids.leadA })).not.toBeNull();
    // A stale or foreign `?id=` reads as "not found", never as an error.
    expect(await asAgent.query(api.leadsAdmin.get, { id: "nije-id" })).toBeNull();
    expect(await asAgent.query(api.leadsAdmin.get, { id: ids.contactA })).toBeNull();

    await expect(
      asAgent.mutation(api.leadsAdmin.setStatus, { id: ids.leadB, status: "contacted" }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asAgent.mutation(api.leadsAdmin.addNote, { id: ids.leadB, body: "Pozvati sutra." }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asAgent.mutation(api.leadsAdmin.assign, { id: ids.leadA, agentId: ids.agentB }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });

  test("an agent account without a profile sees nothing", async () => {
    const { t, ids } = await setup();
    const orphan = await t.run(async (ctx) => makeUser(ctx, "agent"));
    const asOrphan = t.withIdentity({ subject: orphan });
    const list = await asOrphan.query(api.leadsAdmin.list, { paginationOpts: PAGE });
    expect(list.page).toHaveLength(0);
    const columns = await asOrphan.query(api.leadsAdmin.kanban, {});
    expect(columns.every((column) => column.items.length === 0)).toBe(true);
    expect(await asOrphan.query(api.leadsAdmin.get, { id: ids.leadUnassigned })).toBeNull();
  });

  test("an editor has no access to leads", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    await expect(asEditor.query(api.leadsAdmin.kanban, {})).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });
});

describe("list filters", () => {
  test("type, source, agent, unassigned and date filters narrow the inbox", async () => {
    const { t, ids } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });

    const all = await asManager.query(api.leadsAdmin.list, { paginationOpts: PAGE });
    expect(all.page).toHaveLength(4);
    // Newest first.
    expect(all.page[0]?._id).toBe(ids.leadUnassigned);

    const valuations = await asManager.query(api.leadsAdmin.list, {
      type: "valuation",
      paginationOpts: PAGE,
    });
    expect(valuations.page.map((row) => row._id)).toEqual([ids.leadA2]);

    const byPhone = await asManager.query(api.leadsAdmin.list, {
      source: "phone",
      paginationOpts: PAGE,
    });
    expect(byPhone.page.map((row) => row._id)).toEqual([ids.leadA2]);

    const agentB = await asManager.query(api.leadsAdmin.list, {
      agentId: ids.agentB,
      paginationOpts: PAGE,
    });
    expect(agentB.page.map((row) => row._id)).toEqual([ids.leadB]);

    const nobody = await asManager.query(api.leadsAdmin.list, {
      unassigned: true,
      paginationOpts: PAGE,
    });
    expect(nobody.page.map((row) => row._id)).toEqual([ids.leadUnassigned]);

    const newAgentA = await asManager.query(api.leadsAdmin.list, {
      agentId: ids.agentA,
      status: "new",
      paginationOpts: PAGE,
    });
    expect(newAgentA.page.map((row) => row._id)).toEqual([ids.leadA]);

    const future = await asManager.query(api.leadsAdmin.list, {
      createdFrom: Date.now() + 86_400_000,
      paginationOpts: PAGE,
    });
    expect(future.page).toHaveLength(0);
  });
});

describe("pipeline mutations", () => {
  test("a status change is logged as lead.status.<status> and sets the first response", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await asAgent.mutation(api.leadsAdmin.setStatus, { id: ids.leadA, status: "qualified" });

    const state = await t.run(async (ctx) => {
      const lead = await ctx.db.get("leads", ids.leadA);
      const activity = await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.leadA))
        .take(10);
      return { lead, activity };
    });
    expect(state.lead?.status).toBe("qualified");
    expect(state.lead?.firstResponseAt).toBeTypeOf("number");
    const row = state.activity.find((item) => item.action === "lead.status.qualified");
    expect(row?.by).toBe(ids.agentUser);
    expect(row?.summary).toBe("Novi → Kvalifikovan");
  });

  test("losing a lead needs a reason, which leaves again with the stage", async () => {
    const { t, ids } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });

    await expect(
      asManager.mutation(api.leadsAdmin.setStatus, { id: ids.leadB, status: "lost" }),
    ).rejects.toThrow(/razlog/i);
    await expect(
      asManager.mutation(api.leadsAdmin.setStatus, {
        id: ids.leadB,
        status: "lost",
        lossReason: "   ",
      }),
    ).rejects.toThrow(/razlog/i);

    await asManager.mutation(api.leadsAdmin.setStatus, {
      id: ids.leadB,
      status: "lost",
      lossReason: "Kupio preko druge agencije",
    });
    let lead = await t.run(async (ctx) => ctx.db.get("leads", ids.leadB));
    expect(lead?.status).toBe("lost");
    expect(lead?.lossReason).toBe("Kupio preko druge agencije");

    await asManager.mutation(api.leadsAdmin.setStatus, { id: ids.leadB, status: "contacted" });
    lead = await t.run(async (ctx) => ctx.db.get("leads", ids.leadB));
    expect(lead?.lossReason).toBeUndefined();
  });

  test("assigning is for managers and is logged; notes, next action and response are recorded", async () => {
    const { t, ids } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });

    await asManager.mutation(api.leadsAdmin.assign, {
      id: ids.leadUnassigned,
      agentId: ids.agentA,
    });
    await asManager.mutation(api.leadsAdmin.addNote, {
      id: ids.leadUnassigned,
      body: "Klijent traži stan do 150.000 €.",
    });
    await asManager.mutation(api.leadsAdmin.setNextAction, {
      id: ids.leadUnassigned,
      nextActionAt: Date.UTC(2026, 9, 3, 10),
    });
    await expect(
      asManager.mutation(api.leadsAdmin.addNote, { id: ids.leadUnassigned, body: "  " }),
    ).rejects.toThrow(/prazna/);

    const detail = await asManager.query(api.leadsAdmin.get, { id: ids.leadUnassigned });
    expect(detail?.lead.agentId).toBe(ids.agentA);
    expect(detail?.lead.nextActionAt).toBe(Date.UTC(2026, 9, 3, 10));
    expect(detail?.lead.firstResponseAt).toBeTypeOf("number");
    expect(detail?.notes[0]?.body).toBe("Klijent traži stan do 150.000 €.");
    const actions = detail?.timeline.map((item) => item.action) ?? [];
    expect(actions).toEqual(
      expect.arrayContaining(["lead.assigned", "lead.note", "lead.nextAction", "lead.created"]),
    );
    // The note shows once, from `leadNotes`, not again from its activity row.
    expect(actions.filter((action) => action === "lead.note")).toHaveLength(1);

    // Now agent A's lead: they may work it.
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const mine = await asAgent.query(api.leadsAdmin.get, { id: ids.leadUnassigned });
    expect(mine).not.toBeNull();
  });

  test("marking as responded moves a new lead to contacted once", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await asAgent.mutation(api.leadsAdmin.markResponded, { id: ids.leadA });
    await asAgent.mutation(api.leadsAdmin.markResponded, { id: ids.leadA });
    const state = await t.run(async (ctx) => ({
      lead: await ctx.db.get("leads", ids.leadA),
      logged: (
        await ctx.db
          .query("activity")
          .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.leadA))
          .take(10)
      ).filter((row) => row.action === "lead.responded"),
    }));
    expect(state.lead?.status).toBe("contacted");
    expect(state.logged).toHaveLength(1);
  });
});

describe("awaitingResponse", () => {
  test("lists unanswered new leads past the threshold, scoped for agents", async () => {
    const { t, ids } = await setup();
    const later = Date.now() + 2 * 3_600_000;

    const asManager = t.withIdentity({ subject: ids.manager });
    const all = await asManager.query(api.leadsAdmin.awaitingResponse, { now: later });
    expect(all.map((row) => row._id).sort()).toEqual(
      [ids.leadA, ids.leadB, ids.leadUnassigned].sort(),
    );
    const fresh = await asManager.query(api.leadsAdmin.awaitingResponse, { now: Date.now() });
    expect(fresh).toHaveLength(0);

    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const mine = await asAgent.query(api.leadsAdmin.awaitingResponse, { now: later });
    expect(mine.map((row) => row._id)).toEqual([ids.leadA]);
  });
});
