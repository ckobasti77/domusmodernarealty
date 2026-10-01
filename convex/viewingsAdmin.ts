import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { diffFields, logActivity } from "./lib/activity";
import { assertCanEditAssignment, isOwnAgent, requireRole } from "./lib/auth";
import type { Viewer } from "./lib/auth";
import { DAY_MS } from "./lib/belgradeTime";
import { appError, forbidden, invalidInput, notFound } from "./lib/errors";
import { leadStatusV, leadTypeV, viewingModeV, viewingStatusV } from "./lib/validators";
import type { ListingStatus, ViewingStatus } from "./lib/validators";

/**
 * Viewings in the admin (PRD B5): calendar, list, detail, status workflow,
 * post-viewing feedback and office-entered bookings.
 *
 * Agents see and change only viewings assigned to them. The scope is applied
 * in the index range (`by_agentId_and_*`), never by reading everyone's rows
 * and dropping the rest, so an agent's query cannot even touch a colleague's
 * viewing.
 */

const CRM = ["admin", "manager", "agent"] as const;

/**
 * Office-entered viewings may run longer than a one-hour web slot, never
 * longer than this: `viewings.request` and the clash check below look back
 * exactly this far for a viewing that is still running.
 */
const LONGEST_VIEWING_MS = 3 * 60 * 60_000;
const SHORTEST_VIEWING_MS = 15 * 60_000;
/** The calendar asks for a day or a week; a quarter is the most any view needs. */
const MAX_RANGE_MS = 92 * DAY_MS;
/** A busy week for the whole agency stays far below this. */
const RANGE_CAP = 500;
const FEEDBACK_MAX = 4000;
/** Staff may log a viewing that already happened, within reason. */
const BACKDATE_LIMIT_MS = 60 * DAY_MS;
const AHEAD_LIMIT_MS = 366 * DAY_MS;
/** Epoch bounds for an open-ended index range. */
const EPOCH_MIN = 0;
const EPOCH_MAX = 8.64e15;

const STATUS_WORD: Record<ViewingStatus, string> = {
  requested: "Zatraženo",
  confirmed: "Potvrđeno",
  done: "Održano",
  cancelled: "Otkazano",
  no_show: "Nije se pojavio",
};

/**
 * The status workflow. A request is confirmed or cancelled; a confirmed
 * viewing ends as held, no-show or cancelled. The two outcomes can be swapped
 * to correct a mistake, and a cancelled viewing can be re-confirmed while its
 * slot is still free.
 */
const TRANSITIONS: Record<ViewingStatus, readonly ViewingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["done", "no_show", "cancelled"],
  done: ["no_show"],
  no_show: ["done"],
  cancelled: ["confirmed"],
};

/** Outcomes that only make sense once the viewing has begun. */
const OUTCOMES: readonly ViewingStatus[] = ["done", "no_show"];
/** Statuses that hold the agent's time. */
const BLOCKING: readonly ViewingStatus[] = ["requested", "confirmed"];
/** Listings that are not on the market (or not yet) take no new viewings. */
const NOT_BOOKABLE: readonly ListingStatus[] = ["draft", "withdrawn", "archived", "sold", "rented"];

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

const viewingDetailV = viewingRowV.extend({
  contactEmail: v.optional(v.string()),
  createdAt: v.number(),
  /** Statuses this viewing may move to (the server enforces the same table). */
  next: v.array(viewingStatusV),
});

/** Per-call memo: a week of viewings shares a handful of agents and listings. */
type Lookups = {
  listings: Map<Id<"listings">, Doc<"listings"> | null>;
  agents: Map<Id<"agents">, Doc<"agents"> | null>;
};

function newLookups(): Lookups {
  return { listings: new Map(), agents: new Map() };
}

async function listingOf(ctx: QueryCtx, lookups: Lookups, id: Id<"listings">) {
  if (!lookups.listings.has(id)) lookups.listings.set(id, await ctx.db.get("listings", id));
  return lookups.listings.get(id) ?? null;
}

async function agentOf(ctx: QueryCtx, lookups: Lookups, id: Id<"agents">) {
  if (!lookups.agents.has(id)) lookups.agents.set(id, await ctx.db.get("agents", id));
  return lookups.agents.get(id) ?? null;
}

/**
 * The person behind a viewing, when the viewer may see them: admin and manager
 * always; an agent only while the viewing's lead is assigned to them. After a
 * lead is reassigned, the previous agent keeps the calendar entry but no
 * longer reads the client's name, phone or email through it.
 */
async function contactOf(ctx: QueryCtx, viewer: Viewer, doc: Doc<"viewings">) {
  if (doc.leadId === undefined) return null;
  const lead = await ctx.db.get("leads", doc.leadId);
  if (lead === null) return null;
  const allowed =
    viewer.role === "admin" ||
    viewer.role === "manager" ||
    (lead.agentId !== undefined && isOwnAgent(viewer, lead.agentId));
  return allowed ? await ctx.db.get("contacts", lead.contactId) : null;
}

async function toRow(ctx: QueryCtx, viewer: Viewer, lookups: Lookups, doc: Doc<"viewings">) {
  const listing = await listingOf(ctx, lookups, doc.listingId);
  const agent = await agentOf(ctx, lookups, doc.agentId);
  const contact = await contactOf(ctx, viewer, doc);
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

/**
 * The agent a query is pinned to: an agent always sees only their own
 * viewings (whatever filter they send); `null` means "nothing to show" (an
 * agent account without a profile). Admin and manager may filter by agent.
 */
function scopedAgentId(
  viewer: Viewer,
  requested: Id<"agents"> | undefined,
): Id<"agents"> | null | undefined {
  if (viewer.role === "agent") return viewer.agentId ?? null;
  return requested;
}

function canSee(viewer: Viewer, doc: Doc<"viewings">): boolean {
  if (viewer.role === "admin" || viewer.role === "manager") return true;
  return viewer.role === "agent" && isOwnAgent(viewer, doc.agentId);
}

/** Viewings whose start is in [from, to), through the narrowest index for the scope. */
function viewingsStarting(
  ctx: QueryCtx,
  agentId: Id<"agents"> | undefined,
  status: ViewingStatus | undefined,
  from: number,
  to: number,
) {
  if (agentId !== undefined && status !== undefined) {
    return ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_status_and_start", (q) =>
        q.eq("agentId", agentId).eq("status", status).gte("start", from).lt("start", to),
      );
  }
  if (agentId !== undefined) {
    return ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) =>
        q.eq("agentId", agentId).gte("start", from).lt("start", to),
      );
  }
  if (status !== undefined) {
    return ctx.db
      .query("viewings")
      .withIndex("by_status_and_start", (q) =>
        q.eq("status", status).gte("start", from).lt("start", to),
      );
  }
  return ctx.db
    .query("viewings")
    .withIndex("by_start", (q) => q.gte("start", from).lt("start", to));
}

/**
 * Refuses a slot that overlaps another requested or confirmed viewing of the
 * same agent. Looks back `LONGEST_VIEWING_MS` so a long viewing that started
 * earlier still counts.
 */
async function assertSlotFree(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  start: number,
  end: number,
  except?: Id<"viewings">,
): Promise<void> {
  const nearby = await ctx.db
    .query("viewings")
    .withIndex("by_agentId_and_start", (q) =>
      q.eq("agentId", agentId).gte("start", start - LONGEST_VIEWING_MS).lt("start", end),
    )
    .take(100);
  const clash = nearby.some(
    (item) =>
      item._id !== except &&
      BLOCKING.includes(item.status) &&
      item.start < end &&
      item.end > start,
  );
  if (clash) appError("SLOT_TAKEN", "Agent već ima razgledanje u tom terminu.");
}

const EARLY_STAGE: Record<"new" | "contacted", string> = {
  new: "Novi",
  contacted: "Kontaktiran",
};

/**
 * A lead with a confirmed viewing has reached the viewing stage of the
 * pipeline. Booking it counts as the first response, and the stage change is
 * logged on the lead like any other (PRD B4).
 */
async function advanceLead(
  ctx: MutationCtx,
  leadId: Id<"leads"> | undefined,
  by: Id<"users">,
): Promise<void> {
  if (leadId === undefined) return;
  const lead = await ctx.db.get("leads", leadId);
  if (lead === null || (lead.status !== "new" && lead.status !== "contacted")) return;
  await ctx.db.patch("leads", lead._id, {
    status: "viewing",
    ...(lead.firstResponseAt === undefined ? { firstResponseAt: Date.now() } : {}),
  });
  await logActivity(ctx, {
    entity: "lead",
    entityId: lead._id,
    action: "lead.status.viewing",
    summary: `${EARLY_STAGE[lead.status]} → Razgledanje`,
    by,
  });
}

/** True when the viewing's lead belongs to a contact erased under ZZPL. */
async function leadContactAnonymized(ctx: QueryCtx, leadId: Id<"leads"> | undefined): Promise<boolean> {
  if (leadId === undefined) return false;
  const lead = await ctx.db.get("leads", leadId);
  if (lead === null) return false;
  const contact = await ctx.db.get("contacts", lead.contactId);
  return contact?.anonymizedAt !== undefined;
}

/**
 * Calendar range. `from`/`to` are absolute epoch ms of the visible Belgrade
 * day or week, computed by the client. A viewing that started before `from`
 * but is still running at `from` is included.
 */
export const range = query({
  args: {
    from: v.number(),
    to: v.number(),
    status: v.optional(viewingStatusV),
    agentId: v.optional(v.id("agents")),
  },
  returns: v.array(viewingRowV),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    if (!(args.to > args.from)) return [];
    if (args.to - args.from > MAX_RANGE_MS) {
      invalidInput("Opseg kalendara je ograničen na tri meseca.");
    }
    const agentId = scopedAgentId(viewer, args.agentId);
    if (agentId === null) return [];

    const docs = await viewingsStarting(
      ctx,
      agentId,
      args.status,
      args.from - LONGEST_VIEWING_MS,
      args.to,
    ).take(RANGE_CAP);

    const lookups = newLookups();
    const out = [];
    for (const doc of docs) {
      if (doc.end <= args.from) continue;
      out.push(await toRow(ctx, viewer, lookups, doc));
    }
    return out;
  },
});

/**
 * The list view, one page at a time. "upcoming" are viewings still running or
 * ahead (soonest first), "past" those already over (latest first). `now` is an
 * argument because queries never read the clock.
 */
export const list = query({
  args: {
    when: v.union(v.literal("upcoming"), v.literal("past")),
    now: v.number(),
    status: v.optional(viewingStatusV),
    agentId: v.optional(v.id("agents")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(viewingRowV),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const agentId = scopedAgentId(viewer, args.agentId);
    if (agentId === null) return { page: [], isDone: true, continueCursor: "" };

    // The index orders by start; whether a viewing is over depends on its end,
    // which differs from the start by at most LONGEST_VIEWING_MS. The filter
    // only settles the rows inside that boundary window.
    const result =
      args.when === "upcoming"
        ? await viewingsStarting(ctx, agentId, args.status, args.now - LONGEST_VIEWING_MS, EPOCH_MAX)
            .order("asc")
            .filter((q) => q.gt(q.field("end"), args.now))
            .paginate(args.paginationOpts)
        : await viewingsStarting(ctx, agentId, args.status, EPOCH_MIN, args.now)
            .order("desc")
            .filter((q) => q.lte(q.field("end"), args.now))
            .paginate(args.paginationOpts);

    const lookups = newLookups();
    const page = [];
    for (const doc of result.page) page.push(await toRow(ctx, viewer, lookups, doc));
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

/**
 * One viewing for the detail sheet. Takes the raw `?id=` string, so a stale or
 * edited link shows "not found" instead of failing validation; a colleague's
 * viewing is also `null` for an agent.
 */
export const get = query({
  args: { id: v.string() },
  returns: v.union(viewingDetailV, v.null()),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const id = ctx.db.normalizeId("viewings", args.id);
    if (id === null) return null;
    const doc = await ctx.db.get("viewings", id);
    if (doc === null || !canSee(viewer, doc)) return null;

    const row = await toRow(ctx, viewer, newLookups(), doc);
    const contact = await contactOf(ctx, viewer, doc);
    return {
      ...row,
      ...(contact?.email !== undefined ? { contactEmail: contact.email } : {}),
      createdAt: doc._creationTime,
      next: [...TRANSITIONS[doc.status]],
    };
  },
});

/**
 * What the "Novo razgledanje" dialog needs once a listing is picked: the
 * listing's agent (the default assignee) and the open leads on that listing
 * the viewing can be attached to. Agents get only leads assigned to them.
 */
export const bookingContext = query({
  args: { listingId: v.id("listings") },
  returns: v.union(
    v.object({
      listingAgentId: v.id("agents"),
      leads: v.array(
        v.object({
          _id: v.id("leads"),
          contactName: v.string(),
          type: leadTypeV,
          status: leadStatusV,
          createdAt: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null) return null;
    if (viewer.role === "agent" && !isOwnAgent(viewer, listing.agentId)) return null;

    const recent = await ctx.db
      .query("leads")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(60);
    const leads = [];
    for (const lead of recent) {
      if (lead.status === "won" || lead.status === "lost") continue;
      if (viewer.role === "agent" && (lead.agentId === undefined || !isOwnAgent(viewer, lead.agentId))) {
        continue;
      }
      const contact = await ctx.db.get("contacts", lead.contactId);
      leads.push({
        _id: lead._id,
        contactName: contact?.name ?? "—",
        type: lead.type,
        status: lead.status,
        createdAt: lead._creationTime,
      });
      if (leads.length >= 20) break;
    }
    return { listingAgentId: listing.agentId, leads };
  },
});

/**
 * A lead the viewing will be booked for (`?new=1&lead=<id>` from the lead
 * detail): its contact and listing, to prefill the dialog. `null` when the
 * lead does not exist or belongs to another agent.
 */
export const leadForBooking = query({
  args: { id: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("leads"),
      contactName: v.string(),
      listingId: v.optional(v.id("listings")),
      listingRef: v.optional(v.string()),
      listingTitleSr: v.optional(v.string()),
      agentId: v.optional(v.id("agents")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const id = ctx.db.normalizeId("leads", args.id);
    if (id === null) return null;
    const lead = await ctx.db.get("leads", id);
    if (lead === null) return null;
    if (viewer.role === "agent" && (lead.agentId === undefined || !isOwnAgent(viewer, lead.agentId))) {
      return null;
    }
    const contact = await ctx.db.get("contacts", lead.contactId);
    const listing = lead.listingId !== undefined ? await ctx.db.get("listings", lead.listingId) : null;
    // An agent may attach the lead, but only book on a listing of their own.
    const listingVisible =
      listing !== null && (viewer.role !== "agent" || isOwnAgent(viewer, listing.agentId));
    return {
      _id: lead._id,
      contactName: contact?.name ?? "—",
      ...(listingVisible
        ? { listingId: listing._id, listingRef: listing.ref, listingTitleSr: listing.title.sr }
        : {}),
      ...(lead.agentId !== undefined ? { agentId: lead.agentId } : {}),
    };
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
    if (doc.status === args.status) return null;

    if (!TRANSITIONS[doc.status].includes(args.status)) {
      invalidInput(
        `Status „${STATUS_WORD[doc.status]}” ne može da pređe u „${STATUS_WORD[args.status]}”.`,
      );
    }
    if (OUTCOMES.includes(args.status) && doc.start > Date.now()) {
      invalidInput("Ishod razgledanja se beleži tek kada termin počne.");
    }
    // Re-opening a cancelled viewing takes the slot back, if nobody else has.
    if (args.status === "confirmed" && doc.status === "cancelled") {
      await assertSlotFree(ctx, doc.agentId, doc.start, doc.end, doc._id);
    }

    await ctx.db.patch("viewings", doc._id, { status: args.status });
    if (args.status === "confirmed") await advanceLead(ctx, doc.leadId, viewer._id);

    await logActivity(ctx, {
      entity: "viewing",
      entityId: doc._id,
      action: `viewing.status.${args.status}`,
      summary: `${STATUS_WORD[doc.status]} → ${STATUS_WORD[args.status]}`,
      diff: diffFields({ status: doc.status }, { status: args.status }),
      by: viewer._id,
    });
    return null;
  },
});

/** Post-viewing notes. An empty text clears them. */
export const setFeedback = mutation({
  args: { id: v.id("viewings"), feedback: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CRM);
    const doc = await ctx.db.get("viewings", args.id);
    if (doc === null) notFound("Razgledanje");
    assertCanEditAssignment(viewer, doc);

    const feedback = args.feedback.trim();
    if (feedback.length > FEEDBACK_MAX) {
      invalidInput(`Utisak može imati najviše ${FEEDBACK_MAX} znakova.`);
    }
    const next = feedback.length > 0 ? feedback : undefined;
    if (next === doc.feedback) return null;
    // An erased person gets no new free text about them; clearing stays allowed.
    if (next !== undefined && (await leadContactAnonymized(ctx, doc.leadId))) {
      invalidInput("Kontakt ovog razgledanja je anonimizovan; utisak se više ne beleži.");
    }

    await ctx.db.patch("viewings", doc._id, { feedback: next });
    // Only THAT it changed: the text is staff free text about a person and
    // must not outlive an anonymization in the activity log.
    await logActivity(ctx, {
      entity: "viewing",
      entityId: doc._id,
      action: "viewing.feedback",
      summary:
        next === undefined
          ? "Utisak obrisan"
          : doc.feedback === undefined
            ? "Utisak dodat"
            : "Utisak izmenjen",
      diff: [{ field: "feedback" }],
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Staff-created viewing (a phone booking or a walk-in), confirmed at once.
 * Agents book only for themselves and only on their own listings; the slot is
 * checked against the agent's other requested and confirmed viewings, but not
 * against the weekly web hours (the office may agree any time by phone).
 */
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
    if (!Number.isFinite(args.start) || !Number.isFinite(args.end) || args.end <= args.start) {
      invalidInput("Termin nije ispravan.");
    }
    const duration = args.end - args.start;
    if (duration < SHORTEST_VIEWING_MS || duration > LONGEST_VIEWING_MS) {
      invalidInput("Razgledanje traje najmanje 15 minuta, a najviše 3 sata.");
    }
    const now = Date.now();
    if (args.start < now - BACKDATE_LIMIT_MS || args.start > now + AHEAD_LIMIT_MS) {
      invalidInput("Termin može biti najviše 60 dana unazad i godinu dana unapred.");
    }
    if (viewer.role === "agent" && !isOwnAgent(viewer, args.agentId)) {
      forbidden("zakazivanje razgledanja drugom agentu");
    }

    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null) notFound("Nekretnina");
    if (viewer.role === "agent" && !isOwnAgent(viewer, listing.agentId)) {
      forbidden("zakazivanje razgledanja ove nekretnine");
    }
    if (NOT_BOOKABLE.includes(listing.status)) {
      invalidInput("Ova nekretnina nije u ponudi, pa se razgledanje ne zakazuje.");
    }
    const agent = await ctx.db.get("agents", args.agentId);
    if (agent === null) notFound("Agent");

    // Without this an agent could attach a lead belonging to someone else and
    // then read that lead's contact name and phone back through `range`.
    if (args.leadId !== undefined) {
      const lead = await ctx.db.get("leads", args.leadId);
      if (lead === null) notFound("Upit");
      assertCanEditAssignment(viewer, lead);
      // The viewing must be of the property the client asked about.
      if (lead.listingId !== args.listingId) {
        invalidInput("Upit se odnosi na drugu nekretninu.");
      }
    }

    await assertSlotFree(ctx, args.agentId, args.start, args.end);

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
    await advanceLead(ctx, args.leadId, viewer._id);

    // The listing funnel counts every viewing, not only web requests.
    const stats = await ctx.db
      .query("listingStats")
      .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
      .unique();
    if (stats === null) {
      await ctx.db.insert("listingStats", {
        listingId: listing._id,
        views: 0,
        favorites: 0,
        leads: 0,
        viewings: 1,
      });
    } else {
      await ctx.db.patch("listingStats", stats._id, { viewings: stats.viewings + 1 });
    }

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
