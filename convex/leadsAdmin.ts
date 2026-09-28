import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { assertCanEditAssignment, requireRole } from "./lib/auth";
import type { Viewer } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import {
  LEAD_PIPELINE,
  answersV,
  consentV,
  leadStatusV,
  leadTypeV,
  localeV,
  valuationResultV,
} from "./lib/validators";

const CRM = ["admin", "manager", "agent"] as const;
const MANAGERS = ["admin", "manager"] as const;

const leadRowV = v.object({
  _id: v.id("leads"),
  type: leadTypeV,
  status: leadStatusV,
  createdAt: v.number(),
  contactName: v.string(),
  contactEmail: v.optional(v.string()),
  contactPhone: v.optional(v.string()),
  listingRef: v.optional(v.string()),
  listingId: v.optional(v.id("listings")),
  agentId: v.optional(v.id("agents")),
  agentName: v.optional(v.string()),
  message: v.optional(v.string()),
  locale: localeV,
  firstResponseAt: v.optional(v.number()),
  nextActionAt: v.optional(v.number()),
  isDemo: v.boolean(),
});

async function toRow(ctx: QueryCtx, doc: Doc<"leads">) {
  const contact = await ctx.db.get("contacts", doc.contactId);
  const listing =
    doc.listingId !== undefined ? await ctx.db.get("listings", doc.listingId) : null;
  const agent = doc.agentId !== undefined ? await ctx.db.get("agents", doc.agentId) : null;
  return {
    _id: doc._id,
    type: doc.type,
    status: doc.status,
    createdAt: doc._creationTime,
    contactName: contact?.name ?? "—",
    ...(contact?.email !== undefined ? { contactEmail: contact.email } : {}),
    ...(contact?.phone !== undefined ? { contactPhone: contact.phone } : {}),
    ...(listing !== null ? { listingRef: listing.ref } : {}),
    ...(doc.listingId !== undefined ? { listingId: doc.listingId } : {}),
    ...(doc.agentId !== undefined ? { agentId: doc.agentId } : {}),
    ...(agent !== null ? { agentName: agent.name } : {}),
    ...(doc.message !== undefined ? { message: doc.message } : {}),
    locale: doc.locale,
    ...(doc.firstResponseAt !== undefined
      ? { firstResponseAt: doc.firstResponseAt }
      : {}),
    ...(doc.nextActionAt !== undefined ? { nextActionAt: doc.nextActionAt } : {}),
    isDemo: doc.isDemo,
  };
}

function ownLeadOnly(viewer: Viewer, doc: Doc<"leads">): boolean {
  if (viewer.role !== "agent") return true;
  return viewer.agentId !== undefined && doc.agentId === viewer.agentId;
}

export const list = query({
  args: {
    status: v.optional(leadStatusV),
    type: v.optional(leadTypeV),
    agentId: v.optional(v.id("agents")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(leadRowV),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const scopedAgentId =
      viewer.role === "agent" ? viewer.agentId : (args.agentId ?? undefined);

    const result =
      scopedAgentId !== undefined
        ? await ctx.db
            .query("leads")
            .withIndex("by_agentId_and_status", (q) => q.eq("agentId", scopedAgentId))
            .order("desc")
            .paginate(args.paginationOpts)
        : args.status !== undefined
          ? await ctx.db
              .query("leads")
              .withIndex("by_status_and_creation", (q) => q.eq("status", args.status!))
              .order("desc")
              .paginate(args.paginationOpts)
          : await ctx.db.query("leads").order("desc").paginate(args.paginationOpts);

    const page = [];
    for (const doc of result.page) {
      if (!ownLeadOnly(viewer, doc)) continue;
      if (args.status !== undefined && doc.status !== args.status) continue;
      if (args.type !== undefined && doc.type !== args.type) continue;
      page.push(await toRow(ctx, doc));
    }
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const kanban = query({
  args: { limitPerColumn: v.optional(v.number()) },
  returns: v.array(
    v.object({ status: leadStatusV, total: v.number(), items: v.array(leadRowV) }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const limit = Math.min(Math.max(args.limitPerColumn ?? 20, 1), 50);

    const columns = [];
    for (const status of LEAD_PIPELINE) {
      const docs = await ctx.db
        .query("leads")
        .withIndex("by_status_and_creation", (q) => q.eq("status", status))
        .order("desc")
        .take(limit * 3);
      const mine = docs.filter((doc) => ownLeadOnly(viewer, doc));
      const items = [];
      for (const doc of mine.slice(0, limit)) items.push(await toRow(ctx, doc));
      columns.push({ status, total: mine.length, items });
    }
    return columns;
  },
});

export const get = query({
  args: { id: v.id("leads") },
  returns: v.union(
    v.object({
      lead: leadRowV,
      answers: v.optional(answersV),
      valuation: v.optional(valuationResultV),
      consent: consentV,
      notes: v.array(
        v.object({
          _id: v.id("leadNotes"),
          body: v.string(),
          at: v.number(),
          authorName: v.optional(v.string()),
        }),
      ),
      timeline: v.array(
        v.object({ action: v.string(), summary: v.optional(v.string()), at: v.number() }),
      ),
      viewings: v.array(
        v.object({
          _id: v.id("viewings"),
          start: v.number(),
          end: v.number(),
          status: v.string(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("leads", args.id);
    if (doc === null) return null;
    if (!ownLeadOnly(viewer, doc)) return null;

    const noteDocs = await ctx.db
      .query("leadNotes")
      .withIndex("by_leadId_and_at", (q) => q.eq("leadId", doc._id))
      .order("desc")
      .take(50);
    const notes = [];
    for (const note of noteDocs) {
      const author =
        note.authorId !== undefined ? await ctx.db.get("users", note.authorId) : null;
      notes.push({
        _id: note._id,
        body: note.body,
        at: note.at,
        ...(author?.name !== undefined ? { authorName: author.name } : {}),
      });
    }

    const activity = await ctx.db
      .query("activity")
      .withIndex("by_entityId_and_at", (q) => q.eq("entityId", doc._id))
      .order("desc")
      .take(50);

    const viewingDocs =
      doc.listingId !== undefined
        ? await ctx.db
            .query("viewings")
            .withIndex("by_listingId_and_start", (q) =>
              q.eq("listingId", doc.listingId!),
            )
            .take(30)
        : [];

    return {
      lead: await toRow(ctx, doc),
      ...(doc.answers !== undefined ? { answers: doc.answers } : {}),
      ...(doc.valuation !== undefined ? { valuation: doc.valuation } : {}),
      consent: doc.consent,
      notes,
      timeline: activity.map((row) => ({
        action: row.action,
        ...(row.summary !== undefined ? { summary: row.summary } : {}),
        at: row.at,
      })),
      viewings: viewingDocs
        .filter((item) => item.leadId === doc._id)
        .map((item) => ({
          _id: item._id,
          start: item.start,
          end: item.end,
          status: item.status,
        })),
    };
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("leads"),
    status: leadStatusV,
    lossReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("leads", args.id);
    if (doc === null) notFound("Upit");
    assertCanEditAssignment(viewer, doc);

    if (args.status === "lost" && (args.lossReason ?? "").trim().length === 0) {
      invalidInput("Navedite razlog gubitka.");
    }

    const now = Date.now();
    await ctx.db.patch("leads", doc._id, {
      status: args.status,
      ...(args.status === "lost"
        ? { lossReason: (args.lossReason ?? "").trim().slice(0, 300) }
        : {}),
      ...(doc.firstResponseAt === undefined && args.status !== "new"
        ? { firstResponseAt: now }
        : {}),
    });

    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: `lead.status.${args.status}`,
      summary: `${doc.status} → ${args.status}`,
      by: viewer._id,
    });
    return null;
  },
});

export const assign = mutation({
  args: { id: v.id("leads"), agentId: v.optional(v.id("agents")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("leads", args.id);
    if (doc === null) notFound("Upit");

    const agent =
      args.agentId !== undefined ? await ctx.db.get("agents", args.agentId) : null;
    if (args.agentId !== undefined && agent === null) notFound("Agent");

    await ctx.db.patch("leads", doc._id, { agentId: args.agentId });
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.assigned",
      summary: agent?.name ?? "bez agenta",
      by: viewer._id,
    });
    return null;
  },
});

export const addNote = mutation({
  args: { id: v.id("leads"), body: v.string() },
  returns: v.object({ id: v.id("leadNotes") }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("leads", args.id);
    if (doc === null) notFound("Upit");
    assertCanEditAssignment(viewer, doc);

    const body = args.body.trim();
    if (body.length === 0) invalidInput("Napomena ne može biti prazna.");
    if (body.length > 4000) invalidInput("Napomena je predugačka.");

    const now = Date.now();
    const id = await ctx.db.insert("leadNotes", {
      leadId: doc._id,
      authorId: viewer._id,
      body,
      at: now,
    });
    if (doc.firstResponseAt === undefined) {
      await ctx.db.patch("leads", doc._id, { firstResponseAt: now });
    }
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.note",
      summary: body.slice(0, 80),
      by: viewer._id,
    });
    return { id };
  },
});

export const setNextAction = mutation({
  args: { id: v.id("leads"), nextActionAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("leads", args.id);
    if (doc === null) notFound("Upit");
    assertCanEditAssignment(viewer, doc);

    await ctx.db.patch("leads", doc._id, { nextActionAt: args.nextActionAt });
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.nextAction",
      by: viewer._id,
    });
    return null;
  },
});

export const markResponded = mutation({
  args: { id: v.id("leads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("leads", args.id);
    if (doc === null) notFound("Upit");
    assertCanEditAssignment(viewer, doc);

    if (doc.firstResponseAt !== undefined) return null;
    await ctx.db.patch("leads", doc._id, {
      firstResponseAt: Date.now(),
      ...(doc.status === "new" ? { status: "contacted" as const } : {}),
    });
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.responded",
      by: viewer._id,
    });
    return null;
  },
});

/** Leads with no response after `thresholdMs` — the dashboard to-do list. */
export const awaitingResponse = query({
  args: { now: v.number(), thresholdMs: v.optional(v.number()) },
  returns: v.array(leadRowV),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const threshold = args.thresholdMs ?? 3_600_000;
    const docs = await ctx.db
      .query("leads")
      .withIndex("by_status_and_creation", (q) => q.eq("status", "new"))
      .order("desc")
      .take(100);
    const out = [];
    for (const doc of docs) {
      if (!ownLeadOnly(viewer, doc)) continue;
      if (doc.firstResponseAt !== undefined) continue;
      if (args.now - doc._creationTime < threshold) continue;
      out.push(await toRow(ctx, doc));
      if (out.length >= 20) break;
    }
    return out;
  },
});
