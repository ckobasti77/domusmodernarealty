/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ViewingStatus } from "../lib/validators";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PAGE = { cursor: null, numItems: 20 };

async function makeViewing(
  ctx: MutationCtx,
  listingId: Id<"listings">,
  agentId: Id<"agents">,
  start: number,
  status: ViewingStatus = "requested",
  leadId?: Id<"leads">,
): Promise<Id<"viewings">> {
  return await ctx.db.insert("viewings", {
    listingId,
    agentId,
    ...(leadId !== undefined ? { leadId } : {}),
    start,
    end: start + HOUR,
    mode: "in_person",
    status,
    isDemo: false,
  });
}

async function makeLead(
  ctx: MutationCtx,
  listingId: Id<"listings">,
  agentId: Id<"agents">,
  name: string,
): Promise<Id<"leads">> {
  const contactId = await ctx.db.insert("contacts", {
    name,
    phone: "+381 60 000 0000",
    tags: [],
    consents: [],
    isDemo: false,
  });
  return await ctx.db.insert("leads", {
    type: "viewing",
    status: "new",
    listingId,
    agentId,
    contactId,
    source: "phone",
    locale: "sr-Latn",
    consent: { privacy: true, marketing: false, textVersion: "test", at: Date.now() },
    isDemo: false,
  });
}

async function setup() {
  const t = testApp();
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agentA = await makeAgent(ctx, "agent-a");
    const agentB = await makeAgent(ctx, "agent-b");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const editor = await makeUser(ctx, "editor");
    const agentUser = await makeUser(ctx, "agent", agentA);
    const listingA = await makeListing(ctx, 1, city, agentA);
    const listingB = await makeListing(ctx, 2, city, agentB);
    const leadA = await makeLead(ctx, listingA, agentA, "Ana Kupac");
    const leadB = await makeLead(ctx, listingB, agentB, "Branko Kupac");
    const ownFuture = await makeViewing(ctx, listingA, agentA, now + DAY, "requested", leadA);
    const ownPast = await makeViewing(ctx, listingA, agentA, now - DAY, "confirmed");
    const otherFuture = await makeViewing(ctx, listingB, agentB, now + DAY + 2 * HOUR, "requested", leadB);
    const otherPast = await makeViewing(ctx, listingB, agentB, now - 2 * DAY, "confirmed");
    return {
      city,
      agentA,
      agentB,
      admin,
      manager,
      editor,
      agentUser,
      listingA,
      listingB,
      leadA,
      leadB,
      ownFuture,
      ownPast,
      otherFuture,
      otherPast,
    };
  });
  return { t, ids, now };
}

async function activityFor(t: ReturnType<typeof testApp>, entityId: string) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("activity").order("desc").take(50);
    return rows.filter((row) => row.entity === "viewing" && row.entityId === entityId);
  });
}

describe("viewings: agent scoping", () => {
  test("an agent sees only their own viewings in the calendar range, whatever agent filter they send", async () => {
    const { t, ids, now } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const window = { from: now - 3 * DAY, to: now + 3 * DAY };

    const own = await asAgent.query(api.viewingsAdmin.range, window);
    expect(own.map((row) => row._id).sort()).toEqual([ids.ownFuture, ids.ownPast].sort());

    const spoofed = await asAgent.query(api.viewingsAdmin.range, { ...window, agentId: ids.agentB });
    expect(spoofed.map((row) => row._id).sort()).toEqual([ids.ownFuture, ids.ownPast].sort());

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const all = await asAdmin.query(api.viewingsAdmin.range, window);
    expect(all).toHaveLength(4);
    const onlyB = await asAdmin.query(api.viewingsAdmin.range, { ...window, agentId: ids.agentB });
    expect(onlyB.map((row) => row._id).sort()).toEqual([ids.otherFuture, ids.otherPast].sort());
  });

  test("the range includes a viewing that is still running at its start", async () => {
    const { t, ids, now } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const midway = await asAdmin.query(api.viewingsAdmin.range, {
      from: now + DAY + 30 * 60_000,
      to: now + DAY + 45 * 60_000,
      agentId: ids.agentA,
    });
    expect(midway.map((row) => row._id)).toEqual([ids.ownFuture]);
  });

  test("the list splits upcoming and past and stays inside the agent's own viewings", async () => {
    const { t, ids, now } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    const upcoming = await asAgent.query(api.viewingsAdmin.list, {
      when: "upcoming",
      now,
      agentId: ids.agentB,
      paginationOpts: PAGE,
    });
    expect(upcoming.page.map((row) => row._id)).toEqual([ids.ownFuture]);
    expect(upcoming.page[0]?.contactName).toBe("Ana Kupac");

    const past = await asAgent.query(api.viewingsAdmin.list, { when: "past", now, paginationOpts: PAGE });
    expect(past.page.map((row) => row._id)).toEqual([ids.ownPast]);

    const confirmed = await asAgent.query(api.viewingsAdmin.list, {
      when: "past",
      now,
      status: "requested",
      paginationOpts: PAGE,
    });
    expect(confirmed.page).toHaveLength(0);

    const asManager = t.withIdentity({ subject: ids.manager });
    const allPast = await asManager.query(api.viewingsAdmin.list, { when: "past", now, paginationOpts: PAGE });
    expect(allPast.page.map((row) => row._id)).toEqual([ids.ownPast, ids.otherPast]);
  });

  test("an agent cannot open, change or annotate a colleague's viewing", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    expect(await asAgent.query(api.viewingsAdmin.get, { id: ids.otherFuture })).toBeNull();
    expect(await asAgent.query(api.viewingsAdmin.get, { id: "not-an-id" })).toBeNull();
    expect((await asAgent.query(api.viewingsAdmin.get, { id: ids.ownFuture }))?.next).toEqual([
      "confirmed",
      "cancelled",
    ]);

    await expect(
      asAgent.mutation(api.viewingsAdmin.setStatus, { id: ids.otherFuture, status: "confirmed" }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asAgent.mutation(api.viewingsAdmin.setFeedback, { id: ids.otherPast, feedback: "Tuđe" }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);

    const untouched = await t.run(async (ctx) => ctx.db.get("viewings", ids.otherFuture));
    expect(untouched?.status).toBe("requested");
  });

  test("an agent books only for themselves, on their own listings, with their own leads", async () => {
    const { t, ids, now } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const slot = { start: now + 3 * DAY, end: now + 3 * DAY + HOUR, mode: "in_person" as const };

    await expect(
      asAgent.mutation(api.viewingsAdmin.create, { ...slot, listingId: ids.listingA, agentId: ids.agentB }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asAgent.mutation(api.viewingsAdmin.create, { ...slot, listingId: ids.listingB, agentId: ids.agentA }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asAgent.mutation(api.viewingsAdmin.create, {
        ...slot,
        listingId: ids.listingA,
        agentId: ids.agentA,
        leadId: ids.leadB,
      }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);

    expect(await asAgent.query(api.viewingsAdmin.bookingContext, { listingId: ids.listingB })).toBeNull();
    const context = await asAgent.query(api.viewingsAdmin.bookingContext, { listingId: ids.listingA });
    expect(context?.leads.map((lead) => lead._id)).toEqual([ids.leadA]);
    expect(await asAgent.query(api.viewingsAdmin.leadForBooking, { id: ids.leadB })).toBeNull();
  });

  test("editors have no access to viewings", async () => {
    const { t, ids, now } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    await expect(
      asEditor.query(api.viewingsAdmin.range, { from: now, to: now + DAY }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });
});

describe("viewings: status workflow", () => {
  test("an invalid transition is refused and an outcome waits for the start", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    await expect(
      asAgent.mutation(api.viewingsAdmin.setStatus, { id: ids.ownFuture, status: "done" }),
    ).rejects.toThrow(/INVALID_INPUT|ne može/);

    await asAgent.mutation(api.viewingsAdmin.setStatus, { id: ids.ownFuture, status: "confirmed" });
    await expect(
      asAgent.mutation(api.viewingsAdmin.setStatus, { id: ids.ownFuture, status: "done" }),
    ).rejects.toThrow(/INVALID_INPUT|počne/);

    await asAgent.mutation(api.viewingsAdmin.setStatus, { id: ids.ownPast, status: "done" });
    await expect(
      asAgent.mutation(api.viewingsAdmin.setStatus, { id: ids.ownPast, status: "requested" }),
    ).rejects.toThrow(/INVALID_INPUT|ne može/);
  });

  test("confirming advances the lead; a status change and feedback are logged on the viewing", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });

    await asAgent.mutation(api.viewingsAdmin.setStatus, { id: ids.ownFuture, status: "confirmed" });
    const lead = await t.run(async (ctx) => ctx.db.get("leads", ids.leadA));
    expect(lead?.status).toBe("viewing");

    const statusLog = await activityFor(t, ids.ownFuture);
    expect(statusLog[0]).toMatchObject({
      action: "viewing.status.confirmed",
      by: ids.agentUser,
      diff: [{ field: "status", from: "requested", to: "confirmed" }],
    });

    await asAgent.mutation(api.viewingsAdmin.setFeedback, {
      id: ids.ownPast,
      feedback: "  Dopao im se raspored, brinu zbog parkinga.  ",
    });
    const stored = await t.run(async (ctx) => ctx.db.get("viewings", ids.ownPast));
    expect(stored?.feedback).toBe("Dopao im se raspored, brinu zbog parkinga.");
    const feedbackLog = await activityFor(t, ids.ownPast);
    expect(feedbackLog[0]).toMatchObject({ action: "viewing.feedback", by: ids.agentUser });

    // Saving the same text again is a no-op, not a second log line.
    await asAgent.mutation(api.viewingsAdmin.setFeedback, {
      id: ids.ownPast,
      feedback: "Dopao im se raspored, brinu zbog parkinga.",
    });
    expect(await activityFor(t, ids.ownPast)).toHaveLength(1);
  });

  test("a cancelled viewing is re-confirmed only while its slot is free", async () => {
    const { t, ids, now } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });

    await asManager.mutation(api.viewingsAdmin.setStatus, { id: ids.ownFuture, status: "cancelled" });
    await asManager.mutation(api.viewingsAdmin.create, {
      listingId: ids.listingA,
      agentId: ids.agentA,
      start: now + DAY + 30 * 60_000,
      end: now + DAY + 90 * 60_000,
      mode: "video",
    });
    await expect(
      asManager.mutation(api.viewingsAdmin.setStatus, { id: ids.ownFuture, status: "confirmed" }),
    ).rejects.toThrow(/SLOT_TAKEN|terminu/);
  });
});

describe("viewings: office bookings", () => {
  test("a manager books a confirmed viewing for a lead; a clash is refused", async () => {
    const { t, ids, now } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });
    const start = now + 5 * DAY;

    const { id } = await asManager.mutation(api.viewingsAdmin.create, {
      listingId: ids.listingB,
      agentId: ids.agentB,
      leadId: ids.leadB,
      start,
      end: start + 90 * 60_000,
      mode: "in_person",
    });

    const detail = await asManager.query(api.viewingsAdmin.get, { id });
    expect(detail).toMatchObject({ status: "confirmed", contactName: "Branko Kupac", listingRef: "ME-2002" });
    const lead = await t.run(async (ctx) => ctx.db.get("leads", ids.leadB));
    expect(lead?.status).toBe("viewing");
    expect((await activityFor(t, id))[0]).toMatchObject({ action: "viewing.created", by: ids.manager });

    await expect(
      asManager.mutation(api.viewingsAdmin.create, {
        listingId: ids.listingA,
        agentId: ids.agentB,
        start: start + HOUR,
        end: start + 2 * HOUR,
        mode: "video",
      }),
    ).rejects.toThrow(/SLOT_TAKEN|terminu/);

    await expect(
      asManager.mutation(api.viewingsAdmin.create, {
        listingId: ids.listingA,
        agentId: ids.agentA,
        start,
        end: start + 5 * HOUR,
        mode: "video",
      }),
    ).rejects.toThrow(/INVALID_INPUT|najviše 3 sata/);
  });
});
