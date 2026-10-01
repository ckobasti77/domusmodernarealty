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

describe("audit fixes", () => {
  const HOUR = 3_600_000;

  async function viewing(
    t: Awaited<ReturnType<typeof setup>>["t"],
    fields: { listingId: Id<"listings">; agentId: Id<"agents">; leadId?: Id<"leads">; start: number; status?: "requested" | "confirmed" | "done" },
  ): Promise<Id<"viewings">> {
    return await t.run(async (ctx) =>
      ctx.db.insert("viewings", {
        listingId: fields.listingId,
        agentId: fields.agentId,
        ...(fields.leadId !== undefined ? { leadId: fields.leadId } : {}),
        start: fields.start,
        end: fields.start + HOUR,
        mode: "in_person",
        status: fields.status ?? "requested",
        isDemo: false,
      }),
    );
  }

  test("reassigning a lead hands its open viewings over; a clash stays and the old agent loses the contact", async () => {
    const { t, ids } = await setup();
    const start = Date.now() + 3 * 24 * HOUR;
    const open = await viewing(t, { listingId: ids.listing, agentId: ids.agentA, leadId: ids.leadA, start });
    const clashing = await viewing(t, {
      listingId: ids.listing,
      agentId: ids.agentA,
      leadId: ids.leadA,
      start: start + 5 * HOUR,
      status: "confirmed",
    });
    const held = await viewing(t, { listingId: ids.listing, agentId: ids.agentA, leadId: ids.leadA, start: start - 24 * HOUR, status: "done" });
    // Agent B is busy when the second viewing takes place.
    await viewing(t, { listingId: ids.listing, agentId: ids.agentB, start: start + 5 * HOUR + 30 * 60_000, status: "confirmed" });

    const asManager = t.withIdentity({ subject: ids.manager });
    const result = await asManager.mutation(api.leadsAdmin.assign, { id: ids.leadA, agentId: ids.agentB });
    expect(result).toEqual({ movedViewings: 1, clashedViewings: 1 });

    const state = await t.run(async (ctx) => ({
      open: await ctx.db.get("viewings", open),
      clashing: await ctx.db.get("viewings", clashing),
      held: await ctx.db.get("viewings", held),
    }));
    expect(state.open?.agentId).toBe(ids.agentB);
    expect(state.clashing?.agentId).toBe(ids.agentA);
    expect(state.held?.agentId).toBe(ids.agentA);

    // Agent A still has the clashing viewing in the calendar, but no longer the client.
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const detail = await asAgent.query(api.viewingsAdmin.get, { id: clashing });
    expect(detail).not.toBeNull();
    expect(detail?.contactName).toBeUndefined();
    expect(detail?.contactEmail).toBeUndefined();
  });

  test("a note answers a new lead: no note text in the log, stage moves to contacted", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await asAgent.mutation(api.leadsAdmin.addNote, { id: ids.leadA, body: "Tajna beleška o klijentu." });

    const state = await t.run(async (ctx) => ({
      lead: await ctx.db.get("leads", ids.leadA),
      activity: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.leadA))
        .take(10),
    }));
    expect(state.lead?.status).toBe("contacted");
    expect(state.lead?.firstResponseAt).toBeTypeOf("number");
    expect(state.activity.map((row) => row.action)).toEqual(
      expect.arrayContaining(["lead.note", "lead.status.contacted"]),
    );
    expect(JSON.stringify(state.activity)).not.toContain("Tajna");
  });

  test("the next action date is bounded and the list returns the full pagination result", async () => {
    const { t, ids } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });
    await expect(
      asManager.mutation(api.leadsAdmin.setNextAction, {
        id: ids.leadA,
        nextActionAt: Date.now() + 10 * 366 * 24 * HOUR,
      }),
    ).rejects.toThrow(/pet godina/);

    const page = await asManager.query(api.leadsAdmin.list, { paginationOpts: { cursor: null, numItems: 2 } });
    expect(page.page).toHaveLength(2);
    expect(page.isDone).toBe(false);
    expect(typeof page.continueCursor).toBe("string");
  });

  test("confirming a viewing advances the lead, counts as a response and is logged on the lead", async () => {
    const { t, ids } = await setup();
    const requested = await viewing(t, {
      listingId: ids.listing,
      agentId: ids.agentA,
      leadId: ids.leadA,
      start: Date.now() + 2 * 24 * HOUR,
    });
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await asAgent.mutation(api.viewingsAdmin.setStatus, { id: requested, status: "confirmed" });

    const state = await t.run(async (ctx) => ({
      lead: await ctx.db.get("leads", ids.leadA),
      activity: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.leadA))
        .take(10),
    }));
    expect(state.lead?.status).toBe("viewing");
    expect(state.lead?.firstResponseAt).toBeTypeOf("number");
    expect(state.activity.find((row) => row.action === "lead.status.viewing")).toMatchObject({
      by: ids.agentUser,
      summary: "Novi → Razgledanje",
    });
  });

  test("an office booking must match the lead's listing and a listing on the market", async () => {
    const { t, ids } = await setup();
    const other = await t.run(async (ctx) => makeListing(ctx, 9, ids.city, ids.agentA, { status: "draft" }));
    const asManager = t.withIdentity({ subject: ids.manager });
    const start = Date.now() + 4 * 24 * HOUR;

    await expect(
      asManager.mutation(api.viewingsAdmin.create, {
        listingId: other,
        agentId: ids.agentA,
        start,
        end: start + HOUR,
        mode: "in_person",
      }),
    ).rejects.toThrow(/nije u ponudi/);

    await t.run(async (ctx) => ctx.db.patch("listings", other, { status: "published" }));
    await expect(
      asManager.mutation(api.viewingsAdmin.create, {
        listingId: other,
        agentId: ids.agentA,
        leadId: ids.leadA,
        start,
        end: start + HOUR,
        mode: "in_person",
      }),
    ).rejects.toThrow(/drugu nekretninu/);
  });
});
