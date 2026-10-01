import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { assertCanEditAssignment, requireRole } from "./lib/auth";
import type { Viewer } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import {
  LEAD_PIPELINE,
  answersV,
  consentV,
  leadSourceV,
  leadStatusV,
  leadTypeV,
  localeV,
  valuationResultV,
  viewingModeV,
  viewingStatusV,
} from "./lib/validators";
import type { LeadSource, LeadStatus, LeadType } from "./lib/validators";

const CRM = ["admin", "manager", "agent"] as const;
const MANAGERS = ["admin", "manager"] as const;

/** Staff-facing Serbian stage names for activity summaries (PRD B4 order). */
const STATUS_SR: Record<LeadStatus, string> = {
  new: "Novi",
  contacted: "Kontaktiran",
  qualified: "Kvalifikovan",
  viewing: "Razgledanje",
  offer: "Ponuda",
  won: "Dobijen",
  lost: "Izgubljen",
};

/** Rows read per kanban column; the column count reads "100+" beyond it. */
const KANBAN_SCAN = 100;
const LOSS_REASON_MAX = 300;
/** A next step further than this from today is a typo, not a plan. */
const NEXT_ACTION_RANGE_MS = 5 * 366 * 24 * 3_600_000;
/** Office viewings may run this long; a reassigned viewing's clash check looks back this far. */
const LONGEST_VIEWING_MS = 3 * 3_600_000;
/** Author shown when a user row has no display name (never an email address). */
const TEAM_MEMBER = "Član tima";

const leadRowV = v.object({
  _id: v.id("leads"),
  type: leadTypeV,
  status: leadStatusV,
  source: leadSourceV,
  createdAt: v.number(),
  contactId: v.id("contacts"),
  contactName: v.string(),
  contactEmail: v.optional(v.string()),
  contactPhone: v.optional(v.string()),
  contactAnonymized: v.boolean(),
  /** A phone typed into a later web form; unverified, not the contact's. */
  submittedPhone: v.optional(v.string()),
  listingRef: v.optional(v.string()),
  listingTitle: v.optional(v.string()),
  listingId: v.optional(v.id("listings")),
  agentId: v.optional(v.id("agents")),
  agentName: v.optional(v.string()),
  message: v.optional(v.string()),
  lossReason: v.optional(v.string()),
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
    source: doc.source,
    createdAt: doc._creationTime,
    contactId: doc.contactId,
    contactName: contact?.name ?? "—",
    ...(contact?.email !== undefined ? { contactEmail: contact.email } : {}),
    ...(contact?.phone !== undefined ? { contactPhone: contact.phone } : {}),
    contactAnonymized: contact?.anonymizedAt !== undefined,
    ...(doc.submittedPhone !== undefined ? { submittedPhone: doc.submittedPhone } : {}),
    ...(listing !== null ? { listingRef: listing.ref, listingTitle: listing.title.sr } : {}),
    ...(doc.listingId !== undefined ? { listingId: doc.listingId } : {}),
    ...(doc.agentId !== undefined ? { agentId: doc.agentId } : {}),
    ...(agent !== null ? { agentName: agent.name } : {}),
    ...(doc.message !== undefined ? { message: doc.message } : {}),
    ...(doc.lossReason !== undefined ? { lossReason: doc.lossReason } : {}),
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

/* ------------------------------------------------------------------ filters */

const filterArgs = {
  type: v.optional(leadTypeV),
  /** Managers only; ignored for agents, who are always pinned to themselves. */
  agentId: v.optional(v.id("agents")),
  /** Managers only: leads nobody is assigned to yet. */
  unassigned: v.optional(v.boolean()),
  source: v.optional(leadSourceV),
  /** Inclusive `_creationTime` bounds (epoch ms), computed on the client. */
  createdFrom: v.optional(v.number()),
  createdTo: v.optional(v.number()),
};

type Filters = {
  status?: LeadStatus;
  type?: LeadType;
  agentId?: Id<"agents">;
  unassigned?: boolean;
  source?: LeadSource;
  createdFrom?: number;
  createdTo?: number;
};

/**
 * Whose leads a request may read. An agent is pinned to their own profile
 * whatever they send; an agent account without a profile reads nothing.
 */
type Scope =
  | { kind: "all" }
  | { kind: "agent"; agentId: Id<"agents"> | undefined }
  | { kind: "none" };

function scopeFor(viewer: Viewer, filters: Filters): Scope {
  if (viewer.role === "agent") {
    return viewer.agentId === undefined
      ? { kind: "none" }
      : { kind: "agent", agentId: viewer.agentId };
  }
  if (filters.agentId !== undefined) return { kind: "agent", agentId: filters.agentId };
  if (filters.unassigned === true) return { kind: "agent", agentId: undefined };
  return { kind: "all" };
}

function timeBounds(filters: Filters): { lo: number; hi: number } {
  return {
    lo: filters.createdFrom ?? 0,
    hi: filters.createdTo ?? Number.MAX_SAFE_INTEGER,
  };
}

/**
 * Defence in depth and the filters the chosen index could not express. The
 * scope check repeats the index predicate so a wrong index choice can never
 * leak another agent's lead.
 */
function matches(doc: Doc<"leads">, filters: Filters, scope: Scope): boolean {
  if (scope.kind === "none") return false;
  if (scope.kind === "agent" && doc.agentId !== scope.agentId) return false;
  if (filters.status !== undefined && doc.status !== filters.status) return false;
  if (filters.type !== undefined && doc.type !== filters.type) return false;
  if (filters.source !== undefined && doc.source !== filters.source) return false;
  const { lo, hi } = timeBounds(filters);
  return doc._creationTime >= lo && doc._creationTime <= hi;
}

/**
 * Picks ONE index range for the list, newest first. Every choice fixes all of
 * its equality fields, so the `_creationTime` bounds of the date filter apply
 * inside the index too. Priority: the agent scope (security and selectivity),
 * then type+status, status, type, source; whatever is left is checked by
 * `matches` after the read, which can make a page shorter than requested.
 */
function listIndex(ctx: QueryCtx, filters: Filters, scope: Scope) {
  const { lo, hi } = timeBounds(filters);
  const leads = ctx.db.query("leads");
  const { status, type, source } = filters;

  if (scope.kind === "agent") {
    const agentId = scope.agentId;
    if (status !== undefined) {
      return leads.withIndex("by_agentId_and_status", (q) =>
        q
          .eq("agentId", agentId)
          .eq("status", status)
          .gte("_creationTime", lo)
          .lte("_creationTime", hi),
      );
    }
    return leads.withIndex("by_agentId", (q) =>
      q.eq("agentId", agentId).gte("_creationTime", lo).lte("_creationTime", hi),
    );
  }
  if (type !== undefined && status !== undefined) {
    return leads.withIndex("by_type_and_status", (q) =>
      q.eq("type", type).eq("status", status).gte("_creationTime", lo).lte("_creationTime", hi),
    );
  }
  if (status !== undefined) {
    return leads.withIndex("by_status_and_creation", (q) =>
      q.eq("status", status).gte("_creationTime", lo).lte("_creationTime", hi),
    );
  }
  if (type !== undefined) {
    return leads.withIndex("by_type", (q) =>
      q.eq("type", type).gte("_creationTime", lo).lte("_creationTime", hi),
    );
  }
  if (source !== undefined) {
    return leads.withIndex("by_source", (q) =>
      q.eq("source", source).gte("_creationTime", lo).lte("_creationTime", hi),
    );
  }
  return leads.withIndex("by_creation_time", (q) =>
    q.gte("_creationTime", lo).lte("_creationTime", hi),
  );
}

/** One kanban column: the same idea as `listIndex` with the status fixed. */
function columnIndex(ctx: QueryCtx, status: LeadStatus, filters: Filters, scope: Scope) {
  const { lo, hi } = timeBounds(filters);
  const leads = ctx.db.query("leads");
  if (scope.kind === "agent") {
    const agentId = scope.agentId;
    return leads.withIndex("by_agentId_and_status", (q) =>
      q.eq("agentId", agentId).eq("status", status).gte("_creationTime", lo).lte("_creationTime", hi),
    );
  }
  const type = filters.type;
  if (type !== undefined) {
    return leads.withIndex("by_type_and_status", (q) =>
      q.eq("type", type).eq("status", status).gte("_creationTime", lo).lte("_creationTime", hi),
    );
  }
  return leads.withIndex("by_status_and_creation", (q) =>
    q.eq("status", status).gte("_creationTime", lo).lte("_creationTime", hi),
  );
}

/* ------------------------------------------------------------------ queries */

/**
 * The inbox (PRD B4), newest first. Filters that the chosen index cannot
 * express are applied to the page after the read, so a page may hold fewer
 * rows than `numItems` (never rows that fail a filter); the client tops short
 * pages up with `loadMore`.
 */
export const list = query({
  args: {
    ...filterArgs,
    status: v.optional(leadStatusV),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(leadRowV),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const { paginationOpts, ...filters } = args;
    const scope = scopeFor(viewer, filters);
    if (scope.kind === "none") return { page: [], isDone: true, continueCursor: "" };

    const result = await listIndex(ctx, filters, scope)
      .order("desc")
      .paginate(paginationOpts);

    const page = [];
    for (const doc of result.page) {
      if (!ownLeadOnly(viewer, doc) || !matches(doc, filters, scope)) continue;
      page.push(await toRow(ctx, doc));
    }
    // The whole result, so `splitCursor` / `pageStatus` reach the client.
    return { ...result, page };
  },
});

/**
 * The pipeline board: one column per stage with its newest cards. Agents read
 * only their own `by_agentId_and_status` ranges. `total` counts matching rows
 * among the first KANBAN_SCAN of the column; `capped` says there may be more.
 */
export const kanban = query({
  args: { ...filterArgs, limitPerColumn: v.optional(v.number()) },
  returns: v.array(
    v.object({
      status: leadStatusV,
      total: v.number(),
      capped: v.boolean(),
      items: v.array(leadRowV),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const { limitPerColumn, ...filters } = args;
    const limit = Math.min(Math.max(Math.floor(limitPerColumn ?? 20), 1), 50);
    const scope = scopeFor(viewer, filters);

    const columns = [];
    for (const status of LEAD_PIPELINE) {
      if (scope.kind === "none") {
        columns.push({ status, total: 0, capped: false, items: [] });
        continue;
      }
      const docs = await columnIndex(ctx, status, filters, scope)
        .order("desc")
        .take(KANBAN_SCAN);
      const mine = docs.filter(
        (doc) => ownLeadOnly(viewer, doc) && matches(doc, { ...filters, status }, scope),
      );
      const items = [];
      for (const doc of mine.slice(0, limit)) items.push(await toRow(ctx, doc));
      columns.push({
        status,
        total: mine.length,
        capped: docs.length === KANBAN_SCAN,
        items,
      });
    }
    return columns;
  },
});

const timelineItemV = v.object({
  key: v.string(),
  kind: v.union(v.literal("activity"), v.literal("note"), v.literal("viewing")),
  action: v.string(),
  summary: v.optional(v.string()),
  byName: v.optional(v.string()),
  /** For viewing rows: when the viewing takes place. */
  start: v.optional(v.number()),
  at: v.number(),
});

const TIMELINE_MAX = 100;

/**
 * One lead for the detail sheet. `id` comes straight from the URL (`?id=`), so
 * any string is accepted: a stale or foreign id reads as "not found".
 */
export const get = query({
  args: { id: v.string() },
  returns: v.union(
    v.object({
      lead: leadRowV,
      contactLocale: v.optional(localeV),
      utm: v.optional(
        v.object({
          source: v.optional(v.string()),
          medium: v.optional(v.string()),
          campaign: v.optional(v.string()),
          term: v.optional(v.string()),
          content: v.optional(v.string()),
        }),
      ),
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
      timeline: v.array(timelineItemV),
      viewings: v.array(
        v.object({
          _id: v.id("viewings"),
          start: v.number(),
          end: v.number(),
          status: viewingStatusV,
          mode: viewingModeV,
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const id = ctx.db.normalizeId("leads", args.id);
    const doc = id === null ? null : await ctx.db.get("leads", id);
    if (doc === null) return null;
    if (!ownLeadOnly(viewer, doc)) return null;

    const names = new Map<Id<"users">, string | undefined>();
    const nameOf = async (id: Id<"users"> | undefined): Promise<string | undefined> => {
      if (id === undefined) return undefined;
      if (names.has(id)) return names.get(id);
      const user = await ctx.db.get("users", id);
      const name = user === null ? undefined : (user.name ?? TEAM_MEMBER);
      names.set(id, name);
      return name;
    };

    const noteDocs = await ctx.db
      .query("leadNotes")
      .withIndex("by_leadId_and_at", (q) => q.eq("leadId", doc._id))
      .order("desc")
      .take(50);
    const notes = [];
    for (const note of noteDocs) {
      const authorName = await nameOf(note.authorId);
      notes.push({
        _id: note._id,
        body: note.body,
        at: note.at,
        ...(authorName !== undefined ? { authorName } : {}),
      });
    }

    const viewingDocs = await ctx.db
      .query("viewings")
      .withIndex("by_leadId_and_start", (q) => q.eq("leadId", doc._id))
      .order("desc")
      .take(50);

    const activity = await ctx.db
      .query("activity")
      .withIndex("by_entityId_and_at", (q) => q.eq("entityId", doc._id))
      .order("desc")
      .take(TIMELINE_MAX);

    const timeline: Infer<typeof timelineItemV>[] = [];
    // Notes come from `leadNotes` (full text, and seeded notes have no
    // activity row), so the note's activity row would only repeat it.
    for (const row of activity) {
      if (row.action === "lead.note") continue;
      const byName = await nameOf(row.by);
      timeline.push({
        key: row._id,
        kind: "activity" as const,
        action: row.action,
        ...(row.summary !== undefined ? { summary: row.summary } : {}),
        ...(byName !== undefined ? { byName } : {}),
        at: row.at,
      });
    }
    if (!activity.some((row) => row.action === "lead.created")) {
      timeline.push({
        key: `created-${doc._id}`,
        kind: "activity" as const,
        action: "lead.created",
        at: doc._creationTime,
      });
    }
    for (const note of notes) {
      timeline.push({
        key: note._id,
        kind: "note" as const,
        action: "lead.note",
        summary: note.body,
        ...(note.authorName !== undefined ? { byName: note.authorName } : {}),
        at: note.at,
      });
    }
    for (const viewing of viewingDocs) {
      timeline.push({
        key: viewing._id,
        kind: "viewing" as const,
        action: `viewing.${viewing.status}`,
        start: viewing.start,
        at: viewing._creationTime,
      });
    }
    timeline.sort((a, b) => b.at - a.at);

    const contact = await ctx.db.get("contacts", doc.contactId);

    return {
      lead: await toRow(ctx, doc),
      ...(contact?.locale !== undefined ? { contactLocale: contact.locale } : {}),
      ...(doc.utm !== undefined ? { utm: doc.utm } : {}),
      ...(doc.answers !== undefined ? { answers: doc.answers } : {}),
      ...(doc.valuation !== undefined ? { valuation: doc.valuation } : {}),
      consent: doc.consent,
      notes,
      timeline: timeline.slice(0, TIMELINE_MAX),
      viewings: viewingDocs.map((item) => ({
        _id: item._id,
        start: item.start,
        end: item.end,
        status: item.status,
        mode: item.mode,
      })),
    };
  },
});

/* ---------------------------------------------------------------- mutations */

async function loadEditableLead(
  ctx: QueryCtx,
  viewer: Viewer,
  id: Id<"leads">,
): Promise<Doc<"leads">> {
  const doc = await ctx.db.get("leads", id);
  if (doc === null) notFound("Upit");
  assertCanEditAssignment(viewer, doc);
  return doc;
}

/** True when the lead's contact was erased under ZZPL (`contacts.anonymize`). */
async function contactAnonymized(ctx: QueryCtx, lead: Doc<"leads">): Promise<boolean> {
  const contact = await ctx.db.get("contacts", lead.contactId);
  return contact?.anonymizedAt !== undefined;
}

const ERASED = "Kontakt ovog upita je anonimizovan; nove beleške i razlozi se ne beleže.";

/**
 * Hands the lead's open viewings (requested or confirmed) to the new agent, so
 * the previous one no longer holds the client's appointment. A viewing that
 * would clash with the new agent's calendar stays where it is and is counted,
 * for the office to rebook by hand.
 */
async function moveOpenViewings(
  ctx: MutationCtx,
  leadId: Id<"leads">,
  agentId: Id<"agents">,
): Promise<{ moved: number; clashed: number }> {
  const viewings = await ctx.db
    .query("viewings")
    .withIndex("by_leadId_and_start", (q) => q.eq("leadId", leadId))
    .take(50);
  let moved = 0;
  let clashed = 0;
  for (const viewing of viewings) {
    if (viewing.agentId === agentId) continue;
    if (viewing.status !== "requested" && viewing.status !== "confirmed") continue;
    const nearby = await ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) =>
        q
          .eq("agentId", agentId)
          .gte("start", viewing.start - LONGEST_VIEWING_MS)
          .lt("start", viewing.end),
      )
      .take(100);
    const clash = nearby.some(
      (item) =>
        (item.status === "requested" || item.status === "confirmed") &&
        item.start < viewing.end &&
        item.end > viewing.start,
    );
    if (clash) {
      clashed += 1;
      continue;
    }
    await ctx.db.patch("viewings", viewing._id, { agentId });
    moved += 1;
  }
  return { moved, clashed };
}

export const setStatus = mutation({
  args: {
    id: v.id("leads"),
    status: leadStatusV,
    lossReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await loadEditableLead(ctx, viewer, args.id);

    const reason = (args.lossReason ?? "").trim();
    // An erased person's lead still moves through the pipeline, but takes no
    // new free text: "Izgubljen" is recorded without a reason.
    const erased = await contactAnonymized(ctx, doc);
    if (erased && reason.length > 0) invalidInput(ERASED);
    if (args.status === "lost" && reason.length === 0 && !erased) {
      invalidInput("Navedite razlog gubitka.");
    }
    if (reason.length > LOSS_REASON_MAX) {
      invalidInput(`Razlog gubitka može imati najviše ${LOSS_REASON_MAX} znakova.`);
    }
    if (doc.status === args.status && (args.status !== "lost" || doc.lossReason === reason)) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch("leads", doc._id, {
      status: args.status,
      // A lead taken back out of "Izgubljen" no longer has a loss reason.
      lossReason: args.status === "lost" && reason.length > 0 ? reason : undefined,
      ...(doc.firstResponseAt === undefined && args.status !== "new"
        ? { firstResponseAt: now }
        : {}),
    });

    // The reason stays on the lead only: staff free text is kept out of the
    // activity log, which outlives an anonymization.
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: `lead.status.${args.status}`,
      summary: `${STATUS_SR[doc.status]} → ${STATUS_SR[args.status]}`,
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Assigns the lead (managers). The lead's open viewings follow it to the new
 * agent; `clashedViewings` counts those left behind because the new agent is
 * busy at that time.
 */
export const assign = mutation({
  args: { id: v.id("leads"), agentId: v.optional(v.id("agents")) },
  returns: v.object({ movedViewings: v.number(), clashedViewings: v.number() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("leads", args.id);
    if (doc === null) notFound("Upit");
    if (doc.agentId === args.agentId) return { movedViewings: 0, clashedViewings: 0 };

    const agent =
      args.agentId !== undefined ? await ctx.db.get("agents", args.agentId) : null;
    if (args.agentId !== undefined && agent === null) notFound("Agent");
    const previous =
      doc.agentId !== undefined ? await ctx.db.get("agents", doc.agentId) : null;

    await ctx.db.patch("leads", doc._id, { agentId: args.agentId });
    const viewings =
      args.agentId !== undefined
        ? await moveOpenViewings(ctx, doc._id, args.agentId)
        : { moved: 0, clashed: 0 };
    const viewingNote = [
      viewings.moved > 0 ? `razgledanja preneta: ${viewings.moved}` : undefined,
      viewings.clashed > 0 ? `u sukobu, ostala kod prethodnog agenta: ${viewings.clashed}` : undefined,
    ]
      .filter((part) => part !== undefined)
      .join("; ");
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.assigned",
      summary: `${agent?.name ?? "Bez agenta"}${viewingNote.length > 0 ? ` (${viewingNote})` : ""}`,
      diff: [
        {
          field: "agent",
          ...(previous !== null ? { from: previous.name } : {}),
          ...(agent !== null ? { to: agent.name } : {}),
        },
      ],
      by: viewer._id,
    });
    return { movedViewings: viewings.moved, clashedViewings: viewings.clashed };
  },
});

export const addNote = mutation({
  args: { id: v.id("leads"), body: v.string() },
  returns: v.object({ id: v.id("leadNotes") }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await loadEditableLead(ctx, viewer, args.id);

    const body = args.body.trim();
    if (body.length === 0) invalidInput("Beleška ne može biti prazna.");
    if (body.length > 4000) invalidInput("Beleška je predugačka (najviše 4000 znakova).");
    if (await contactAnonymized(ctx, doc)) invalidInput(ERASED);

    const now = Date.now();
    const id = await ctx.db.insert("leadNotes", {
      leadId: doc._id,
      authorId: viewer._id,
      body,
      at: now,
    });
    // A note means someone is working the lead: it counts as the first
    // response and takes a new lead to "Kontaktiran".
    await ctx.db.patch("leads", doc._id, {
      ...(doc.firstResponseAt === undefined ? { firstResponseAt: now } : {}),
      ...(doc.status === "new" ? { status: "contacted" as const } : {}),
    });
    // No text in the log: the note lives in `leadNotes` (the timeline reads
    // it there) and is deleted by an anonymization; the log is not.
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.note",
      by: viewer._id,
    });
    if (doc.status === "new") {
      await logActivity(ctx, {
        entity: "lead",
        entityId: doc._id,
        action: "lead.status.contacted",
        summary: `${STATUS_SR.new} → ${STATUS_SR.contacted}`,
        by: viewer._id,
      });
    }
    return { id };
  },
});

export const setNextAction = mutation({
  args: { id: v.id("leads"), nextActionAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await loadEditableLead(ctx, viewer, args.id);
    if (
      args.nextActionAt !== undefined &&
      (!Number.isFinite(args.nextActionAt) ||
        Math.abs(args.nextActionAt - Date.now()) > NEXT_ACTION_RANGE_MS)
    ) {
      invalidInput("Datum sledećeg koraka mora biti u narednih (ili proteklih) pet godina.");
    }
    if (doc.nextActionAt === args.nextActionAt) return null;

    await ctx.db.patch("leads", doc._id, { nextActionAt: args.nextActionAt });
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.nextAction",
      // `fromDateInput` stores 10:00 UTC, so the UTC date is the Belgrade date.
      summary:
        args.nextActionAt !== undefined
          ? `Sledeći korak: ${new Date(args.nextActionAt).toISOString().slice(0, 10)}`
          : "Sledeći korak uklonjen",
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
    const doc = await loadEditableLead(ctx, viewer, args.id);

    if (doc.firstResponseAt !== undefined) return null;
    await ctx.db.patch("leads", doc._id, {
      firstResponseAt: Date.now(),
      ...(doc.status === "new" ? { status: "contacted" as const } : {}),
    });
    await logActivity(ctx, {
      entity: "lead",
      entityId: doc._id,
      action: "lead.responded",
      ...(doc.status === "new"
        ? { summary: `${STATUS_SR.new} → ${STATUS_SR.contacted}` }
        : {}),
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Leads with no response after `thresholdMs` — the dashboard to-do list.
 * Reads only "new" leads created before `now - threshold`, and for an agent
 * only their own range, so older unanswered leads are never crowded out.
 */
export const awaitingResponse = query({
  args: { now: v.number(), thresholdMs: v.optional(v.number()) },
  returns: v.array(leadRowV),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const threshold = args.thresholdMs ?? 3_600_000;
    const before = args.now - threshold;
    if (viewer.role === "agent" && viewer.agentId === undefined) return [];

    const docs =
      viewer.role === "agent"
        ? await ctx.db
            .query("leads")
            .withIndex("by_agentId_and_status", (q) =>
              q
                .eq("agentId", viewer.agentId)
                .eq("status", "new")
                .lte("_creationTime", before),
            )
            .order("desc")
            .take(100)
        : await ctx.db
            .query("leads")
            .withIndex("by_status_and_creation", (q) =>
              q.eq("status", "new").lte("_creationTime", before),
            )
            .order("desc")
            .take(100);

    const out = [];
    for (const doc of docs) {
      if (!ownLeadOnly(viewer, doc)) continue;
      if (doc.firstResponseAt !== undefined) continue;
      out.push(await toRow(ctx, doc));
      if (out.length >= 20) break;
    }
    return out;
  },
});
