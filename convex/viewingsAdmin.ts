import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { assertCanEditAssignment, requireRole } from "./lib/auth";
import type { Viewer } from "./lib/auth";
import { appError, invalidInput, notFound } from "./lib/errors";
import { viewingModeV, viewingStatusV } from "./lib/validators";

const CRM = ["admin", "manager", "agent"] as const;

const viewingRowV = v.object({
  _id: v.id("viewings"),
  listingId: v.id("listings"),
  listingRef: v.string(),
  listingTitleSr: v.string(),
  leadId: v.optional(v.id("leads")),
  agentId: v.id("agents"),
  agentName: v.string(),
  contactName: v.optional(v.string()),
  contactPhone: v.optional(v.string()),
  start: v.number(),
  end: v.number(),
  mode: viewingModeV,
  status: viewingStatusV,
  feedback: v.optional(v.string()),
  isDemo: v.boolean(),
});

async function toRow(ctx: QueryCtx, doc: Doc<"viewings">) {
  const listing = await ctx.db.get("listings", doc.listingId);
  const agent = await ctx.db.get("agents", doc.agentId);
  const lead = doc.leadId !== undefined ? await ctx.db.get("leads", doc.leadId) : null;
  const contact =
    lead !== null ? await ctx.db.get("contacts", lead.contactId) : null;
  return {
    _id: doc._id,
    listingId: doc.listingId,
    listingRef: listing?.ref ?? "—",
    listingTitleSr: listing?.title.sr ?? "—",
    ...(doc.leadId !== undefined ? { leadId: doc.leadId } : {}),
    agentId: doc.agentId,
    agentName: agent?.name ?? "—",
    ...(contact !== null ? { contactName: contact.name } : {}),
    ...(contact?.phone !== undefined ? { contactPhone: contact.phone } : {}),
    start: doc.start,
    end: doc.end,
    mode: doc.mode,
    status: doc.status,
    ...(doc.feedback !== undefined ? { feedback: doc.feedback } : {}),
    isDemo: doc.isDemo,
  };
}

function ownOnly(viewer: Viewer, doc: Doc<"viewings">): boolean {
  if (viewer.role !== "agent") return true;
  return viewer.agentId !== undefined && doc.agentId === viewer.agentId;
}

/** Calendar range. `from`/`to` are absolute epoch ms supplied by the client. */
export const range = query({
  args: { from: v.number(), to: v.number(), status: v.optional(viewingStatusV) },
  returns: v.array(viewingRowV),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    if (args.to <= args.from) return [];
    if (args.to - args.from > 90 * 86_400_000) {
      invalidInput("Opseg je ograničen na 90 dana.");
    }

    const docs = await ctx.db
      .query("viewings")
      .withIndex("by_start", (q) => q.gte("start", args.from).lt("start", args.to))
      .take(500);

    const out = [];
    for (const doc of docs) {
      if (!ownOnly(viewer, doc)) continue;
      if (args.status !== undefined && doc.status !== args.status) continue;
      out.push(await toRow(ctx, doc));
    }
    return out;
  },
});

export const list = query({
  args: { status: v.optional(viewingStatusV), limit: v.optional(v.number()) },
  returns: v.array(viewingRowV),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const docs =
      args.status !== undefined
        ? await ctx.db
            .query("viewings")
            .withIndex("by_status_and_start", (q) => q.eq("status", args.status!))
            .order("desc")
            .take(limit * 2)
        : await ctx.db.query("viewings").order("desc").take(limit * 2);

    const out = [];
    for (const doc of docs) {
      if (!ownOnly(viewer, doc)) continue;
      out.push(await toRow(ctx, doc));
      if (out.length >= limit) break;
    }
    return out;
  },
});

export const setStatus = mutation({
  args: { id: v.id("viewings"), status: viewingStatusV },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("viewings", args.id);
    if (doc === null) notFound("Razgledanje");
    assertCanEditAssignment(viewer, doc);

    await ctx.db.patch("viewings", doc._id, { status: args.status });

    // Confirming a viewing advances its lead into the viewing stage.
    if (args.status === "confirmed" && doc.leadId !== undefined) {
      const lead = await ctx.db.get("leads", doc.leadId);
      if (lead !== null && (lead.status === "new" || lead.status === "contacted")) {
        await ctx.db.patch("leads", lead._id, { status: "viewing" });
      }
    }

    await logActivity(ctx, {
      entity: "viewing",
      entityId: doc._id,
      action: `viewing.${args.status}`,
      summary: `${doc.status} → ${args.status}`,
      by: viewer._id,
    });
    return null;
  },
});

export const setFeedback = mutation({
  args: { id: v.id("viewings"), feedback: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("viewings", args.id);
    if (doc === null) notFound("Razgledanje");
    assertCanEditAssignment(viewer, doc);

    const feedback = args.feedback.trim().slice(0, 4000);
    await ctx.db.patch("viewings", doc._id, { feedback });
    await logActivity(ctx, {
      entity: "viewing",
      entityId: doc._id,
      action: "viewing.feedback",
      summary: feedback.slice(0, 80),
      by: viewer._id,
    });
    return null;
  },
});

/** Staff-created viewing (phone bookings). Overlap is still checked. */
export const create = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    leadId: v.optional(v.id("leads")),
    start: v.number(),
    end: v.number(),
    mode: viewingModeV,
  },
  returns: v.object({ id: v.id("viewings") }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    if (args.end <= args.start) invalidInput("Termin nije ispravan.");
    if (viewer.role === "agent" && viewer.agentId !== args.agentId) {
      invalidInput("Možete zakazati samo svoja razgledanja.");
    }

    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null) notFound("Nekretnina");
    const agent = await ctx.db.get("agents", args.agentId);
    if (agent === null) notFound("Agent");

    const dayStart = args.start - (args.start % 86_400_000);
    const clashes = await ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) =>
        q
          .eq("agentId", args.agentId)
          .gte("start", dayStart)
          .lt("start", dayStart + 86_400_000),
      )
      .take(100);
    if (
      clashes.some(
        (item) =>
          (item.status === "requested" || item.status === "confirmed") &&
          item.start < args.end &&
          item.end > args.start,
      )
    ) {
      appError("SLOT_TAKEN", "Agent već ima razgledanje u tom terminu.");
    }

    const id = await ctx.db.insert("viewings", {
      listingId: args.listingId,
      ...(args.leadId !== undefined ? { leadId: args.leadId } : {}),
      agentId: args.agentId,
      start: args.start,
      end: args.end,
      mode: args.mode,
      status: "confirmed",
      isDemo: false,
    });

    await logActivity(ctx, {
      entity: "viewing",
      entityId: id,
      action: "viewing.created",
      summary: `${listing.ref} · ${agent.name}`,
      by: viewer._id,
    });
    return { id };
  },
});
