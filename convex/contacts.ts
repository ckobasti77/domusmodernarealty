import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { contactSearchText, words } from "./lib/contactSearch";
import { consentV, leadStatusV, leadTypeV, localeV } from "./lib/validators";
import type { Locale } from "./lib/validators";

const MANAGERS = ["admin", "manager"] as const;

/** The list shows "20+" rather than counting every lead of a busy contact. */
const LEAD_COUNT_CAP = 20;
/** Search results are one page: the best matches, never a scan. */
const SEARCH_TAKE = 30;
/**
 * Anonymization works in bounded pages so no transaction limit is ever hit and
 * nothing is silently left behind: leads per transaction, rows per page of an
 * activity log or of notes, viewings per page of one lead. Whatever does not
 * fit continues in a scheduled mutation until it is done.
 */
const ANONYMIZE_BATCH = 5;
const SCRUB_PAGE = 100;
const VIEWING_PAGE = 10;
/** Rows per CSV export (PRD B6). A larger database needs a paged export. */
const EXPORT_CAP = 2000;
/** Owners of a listing (`listingsAdmin.setOwner`) carry this tag. */
const OWNER_TAG = "vlasnik";
const ANONYMIZED_NAME = "Anonimizovan kontakt";

/* ------------------------------------------------------------ search text */

/** A phone-looking query searches digits; anything else, folded words. */
function searchTerm(raw: string): string {
  if (/^[\d\s+()/.-]+$/.test(raw)) {
    const digits = raw.replace(/\D/g, "").replace(/^00/, "");
    if (digits.length >= 3) return digits;
  }
  return words(raw).join(" ");
}

async function searchContacts(ctx: QueryCtx, raw: string): Promise<Doc<"contacts">[]> {
  const found = new Map<Id<"contacts">, Doc<"contacts">>();
  const add = (docs: Doc<"contacts">[]) => {
    for (const doc of docs) if (!found.has(doc._id)) found.set(doc._id, doc);
  };

  const term = searchTerm(raw);
  if (term.length > 0) {
    add(
      await ctx.db
        .query("contacts")
        .withSearchIndex("search_text", (s) => s.search("searchText", term))
        .take(SEARCH_TAKE),
    );
  }
  // Contacts written by a path that does not store `searchText` yet are
  // still found by their name as typed (case-insensitive, diacritics exact)…
  if (words(raw).length > 0) {
    add(
      await ctx.db
        .query("contacts")
        .withSearchIndex("search_name", (s) => s.search("name", raw))
        .take(SEARCH_TAKE),
    );
  }
  // …and by the start of their (lowercased) email address.
  const email = raw.toLowerCase();
  if (email.length >= 3 && !/\s/.test(email)) {
    add(
      await ctx.db
        .query("contacts")
        .withIndex("by_email", (q) => q.gte("email", email).lt("email", `${email}￿`))
        .take(10),
    );
  }
  return [...found.values()].slice(0, SEARCH_TAKE);
}

/* -------------------------------------------------------------------- rows */

const contactRowV = v.object({
  _id: v.id("contacts"),
  name: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  locale: v.optional(localeV),
  tags: v.array(v.string()),
  leadCount: v.number(),
  leadCountCapped: v.boolean(),
  lastActivityAt: v.number(),
  lastConsentAt: v.optional(v.number()),
  marketing: v.boolean(),
  anonymizedAt: v.optional(v.number()),
  isOwner: v.boolean(),
  createdAt: v.number(),
  isDemo: v.boolean(),
});

type Consent = Doc<"contacts">["consents"][number];

function latestConsent(consents: readonly Consent[]): Consent | undefined {
  let latest: Consent | undefined;
  for (const consent of consents) if (latest === undefined || consent.at >= latest.at) latest = consent;
  return latest;
}

async function toRow(ctx: QueryCtx, doc: Doc<"contacts">) {
  const leads = await ctx.db
    .query("leads")
    .withIndex("by_contactId", (q) => q.eq("contactId", doc._id))
    .order("desc")
    .take(LEAD_COUNT_CAP + 1);
  const last = latestConsent(doc.consents);
  return {
    _id: doc._id,
    name: doc.name,
    ...(doc.email !== undefined ? { email: doc.email } : {}),
    ...(doc.phone !== undefined ? { phone: doc.phone } : {}),
    ...(doc.locale !== undefined ? { locale: doc.locale } : {}),
    tags: doc.tags,
    leadCount: Math.min(leads.length, LEAD_COUNT_CAP),
    leadCountCapped: leads.length > LEAD_COUNT_CAP,
    lastActivityAt: Math.max(doc._creationTime, leads[0]?._creationTime ?? 0, last?.at ?? 0),
    ...(last !== undefined ? { lastConsentAt: last.at } : {}),
    marketing: last?.marketing === true,
    ...(doc.anonymizedAt !== undefined ? { anonymizedAt: doc.anonymizedAt } : {}),
    isOwner: doc.tags.includes(OWNER_TAG),
    createdAt: doc._creationTime,
    isDemo: doc.isDemo,
  };
}

/* ------------------------------------------------------------------ queries */

/**
 * Contacts newest first (PRD B6). With `q`, one page of the best matches:
 * folded full-text search on `searchText`, the raw name, and an email prefix.
 */
export const list = query({
  args: { q: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(contactRowV),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const q = (args.q ?? "").trim().slice(0, 100);

    if (q.length > 0) {
      const page = [];
      for (const doc of await searchContacts(ctx, q)) page.push(await toRow(ctx, doc));
      return { page, isDone: true, continueCursor: "" };
    }

    const result = await ctx.db.query("contacts").order("desc").paginate(args.paginationOpts);
    const page = [];
    for (const doc of result.page) page.push(await toRow(ctx, doc));
    // The whole result, so `splitCursor` / `pageStatus` reach the client.
    return { ...result, page };
  },
});

const LEAD_HISTORY_CAP = 50;

/** One contact for the sheet; `id` comes from the URL, so any string is accepted. */
export const get = query({
  args: { id: v.string() },
  returns: v.union(
    v.object({
      contact: contactRowV,
      /**
       * Every consent on record, newest first: the contact's own plus the one
       * each lead was submitted with (public forms never edit the contact).
       */
      consents: v.array(consentV),
      note: v.optional(v.string()),
      leads: v.array(
        v.object({
          _id: v.id("leads"),
          type: leadTypeV,
          status: leadStatusV,
          createdAt: v.number(),
          listingRef: v.optional(v.string()),
          agentName: v.optional(v.string()),
        }),
      ),
      leadsCapped: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const id = ctx.db.normalizeId("contacts", args.id);
    const doc = id === null ? null : await ctx.db.get("contacts", id);
    if (doc === null) return null;

    const leadDocs = await ctx.db
      .query("leads")
      .withIndex("by_contactId", (q) => q.eq("contactId", doc._id))
      .order("desc")
      .take(LEAD_HISTORY_CAP + 1);
    const leads = [];
    for (const lead of leadDocs.slice(0, LEAD_HISTORY_CAP)) {
      const listing =
        lead.listingId !== undefined ? await ctx.db.get("listings", lead.listingId) : null;
      const agent = lead.agentId !== undefined ? await ctx.db.get("agents", lead.agentId) : null;
      leads.push({
        _id: lead._id,
        type: lead.type,
        status: lead.status,
        createdAt: lead._creationTime,
        ...(listing !== null ? { listingRef: listing.ref } : {}),
        ...(agent !== null ? { agentName: agent.name } : {}),
      });
    }

    const consents = new Map<string, Consent>();
    for (const consent of [...doc.consents, ...leadDocs.map((lead) => lead.consent)]) {
      const key = `${consent.at}|${consent.textVersion}|${consent.marketing}|${consent.channel ?? ""}`;
      if (!consents.has(key)) consents.set(key, consent);
    }

    return {
      contact: await toRow(ctx, doc),
      consents: [...consents.values()].sort((a, b) => b.at - a.at),
      ...(doc.note !== undefined ? { note: doc.note } : {}),
      leads,
      leadsCapped: leadDocs.length > LEAD_HISTORY_CAP,
    };
  },
});

/* ---------------------------------------------------------------- mutations */

export const setNote = mutation({
  args: { id: v.id("contacts"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("contacts", args.id);
    if (doc === null) notFound("Kontakt");
    if (doc.anonymizedAt !== undefined) invalidInput("Anonimizovan kontakt se ne menja.");

    const note = args.note.trim();
    if (note.length > 4000) invalidInput("Beleška je predugačka (najviše 4000 znakova).");
    const next = note.length > 0 ? note : undefined;
    if (next === doc.note) return null;

    await ctx.db.patch("contacts", doc._id, { note: next });
    await logActivity(ctx, {
      entity: "contact",
      entityId: doc._id,
      action: "contact.note",
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Activity rows that may quote free text about a person (staff notes, viewing
 * feedback, the names in an old merge summary). An anonymization clears their
 * `summary` AND `diff`; the rest of the log holds no personal data.
 */
const FREE_TEXT_ACTIONS = new Set(["lead.note", "contact.note", "contact.merged", "viewing.feedback"]);

function holdsFreeText(row: Doc<"activity">): boolean {
  return FREE_TEXT_ACTIONS.has(row.action) && (row.summary !== undefined || row.diff !== undefined);
}

/**
 * Moves the deleted duplicate's activity onto the surviving contact (so its
 * history follows) and drops free text on the way. Rows leave the `from`
 * range as they are re-keyed, so each page simply reads the first rows again.
 */
async function rekeyActivity(
  ctx: MutationCtx,
  fromId: Id<"contacts">,
  intoId: Id<"contacts">,
): Promise<void> {
  const rows = await ctx.db
    .query("activity")
    .withIndex("by_entityId_and_at", (q) => q.eq("entityId", fromId))
    .take(SCRUB_PAGE);
  for (const row of rows) {
    await ctx.db.patch("activity", row._id, {
      entityId: intoId,
      ...(holdsFreeText(row) ? { summary: undefined, diff: undefined } : {}),
    });
  }
  if (rows.length === SCRUB_PAGE) {
    await ctx.scheduler.runAfter(0, internal.contacts.rekeyActivityRest, { fromId, intoId });
  }
}

export const rekeyActivityRest = internalMutation({
  args: { fromId: v.id("contacts"), intoId: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await rekeyActivity(ctx, args.fromId, args.intoId);
    return null;
  },
});

/** Merges `fromId` into `intoId`: leads are repointed, then the duplicate goes. */
export const merge = mutation({
  args: { intoId: v.id("contacts"), fromId: v.id("contacts") },
  returns: v.object({ movedLeads: v.number() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    if (args.intoId === args.fromId) invalidInput("Izaberite dva različita kontakta.");

    const into = await ctx.db.get("contacts", args.intoId);
    const from = await ctx.db.get("contacts", args.fromId);
    if (into === null || from === null) notFound("Kontakt");
    if (into.anonymizedAt !== undefined || from.anonymizedAt !== undefined) {
      invalidInput("Anonimizovani kontakti se ne spajaju.");
    }
    // A listing points at its owner through `ownerContactId` (no index to
    // repoint it), so an owner may only ever be the surviving contact.
    if (from.tags.includes(OWNER_TAG)) {
      invalidInput(
        "Kontakt koji uklanjate je vlasnik nekretnine. Spojite ga u suprotnom smeru.",
      );
    }

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_contactId", (q) => q.eq("contactId", from._id))
      .take(201);
    // Deleting `from` while lead 201+ still pointed at it orphaned those leads.
    if (leads.length > 200) {
      invalidInput(
        "Kontakt ima previše upita za jedno spajanje. Spojite ga u više koraka.",
      );
    }
    for (const lead of leads) {
      await ctx.db.patch("leads", lead._id, { contactId: into._id });
    }

    const email = into.email ?? from.email;
    const phone = into.phone ?? from.phone;
    await ctx.db.patch("contacts", into._id, {
      email,
      phone,
      locale: into.locale ?? from.locale,
      tags: Array.from(new Set([...into.tags, ...from.tags])),
      consents: [...into.consents, ...from.consents].sort((a, b) => a.at - b.at).slice(-20),
      note: [into.note, from.note].filter(Boolean).join("\n---\n").slice(0, 4000) || undefined,
      searchText: contactSearchText({
        name: into.name,
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      }),
      isDemo: into.isDemo && from.isDemo,
    });
    await ctx.db.delete("contacts", from._id);
    await rekeyActivity(ctx, from._id, into._id);

    // Ids and counts only: a name in the log would outlive an anonymization.
    await logActivity(ctx, {
      entity: "contact",
      entityId: into._id,
      action: "contact.merged",
      summary: `Spojen duplikat ${from._id} (${leads.length} upita)`,
      by: viewer._id,
    });
    return { movedLeads: leads.length };
  },
});

/**
 * Clears free text from an entity's activity, a page at a time from `after`
 * (an `at` timestamp). Rows sharing the boundary timestamp are read again,
 * which is harmless: the patch is idempotent.
 */
async function scrubActivityFrom(ctx: MutationCtx, entityId: string, after: number): Promise<void> {
  const rows = await ctx.db
    .query("activity")
    .withIndex("by_entityId_and_at", (q) => q.eq("entityId", entityId).gte("at", after))
    .take(SCRUB_PAGE);
  for (const row of rows) {
    if (holdsFreeText(row)) {
      await ctx.db.patch("activity", row._id, { summary: undefined, diff: undefined });
    }
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (rows.length === SCRUB_PAGE && first !== undefined && last !== undefined) {
    await ctx.scheduler.runAfter(0, internal.contacts.scrubActivityRest, {
      entityId,
      // A full page within one millisecond would never advance; step past it.
      after: last.at === first.at ? last.at + 1 : last.at,
    });
  }
}

export const scrubActivityRest = internalMutation({
  args: { entityId: v.string(), after: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await scrubActivityFrom(ctx, args.entityId, args.after);
    return null;
  },
});

/** Deletes a lead's staff notes, a page per transaction. */
async function deleteNotes(ctx: MutationCtx, leadId: Id<"leads">): Promise<void> {
  const notes = await ctx.db
    .query("leadNotes")
    .withIndex("by_leadId_and_at", (q) => q.eq("leadId", leadId))
    .take(SCRUB_PAGE);
  for (const note of notes) await ctx.db.delete("leadNotes", note._id);
  if (notes.length === SCRUB_PAGE) {
    await ctx.scheduler.runAfter(0, internal.contacts.deleteNotesRest, { leadId });
  }
}

export const deleteNotesRest = internalMutation({
  args: { leadId: v.id("leads") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await deleteNotes(ctx, args.leadId);
    return null;
  },
});

/** Clears the feedback of a lead's viewings and their activity, from `after` (a start time). */
async function scrubViewingsFrom(ctx: MutationCtx, leadId: Id<"leads">, after: number): Promise<void> {
  const viewings = await ctx.db
    .query("viewings")
    .withIndex("by_leadId_and_start", (q) => q.eq("leadId", leadId).gte("start", after))
    .take(VIEWING_PAGE);
  for (const viewing of viewings) {
    if (viewing.feedback !== undefined) {
      await ctx.db.patch("viewings", viewing._id, { feedback: undefined });
    }
    await scrubActivityFrom(ctx, viewing._id, 0);
  }
  const first = viewings[0];
  const last = viewings[viewings.length - 1];
  if (viewings.length === VIEWING_PAGE && first !== undefined && last !== undefined) {
    await ctx.scheduler.runAfter(0, internal.contacts.scrubViewingsRest, {
      leadId,
      after: last.start === first.start ? last.start + 1 : last.start,
    });
  }
}

export const scrubViewingsRest = internalMutation({
  args: { leadId: v.id("leads"), after: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await scrubViewingsFrom(ctx, args.leadId, args.after);
    return null;
  },
});

/**
 * Erases what a lead holds about the person: the message, the form answers
 * (the valuation/seller `addressNote` is their own address), the valuation,
 * the loss reason, a phone typed into a later form, the free-text campaign
 * tags, staff notes, viewing feedback, and free text in the activity log of
 * the lead and of each of its viewings.
 */
async function scrubLead(ctx: MutationCtx, lead: Doc<"leads">): Promise<void> {
  let utm: Doc<"leads">["utm"];
  if (lead.utm !== undefined) {
    const { term: _term, content: _content, ...kept } = lead.utm;
    utm = kept;
  }
  await ctx.db.patch("leads", lead._id, {
    message: undefined,
    answers: undefined,
    valuation: undefined,
    lossReason: undefined,
    submittedPhone: undefined,
    utm,
  });
  await deleteNotes(ctx, lead._id);
  await scrubActivityFrom(ctx, lead._id, 0);
  await scrubViewingsFrom(ctx, lead._id, 0);
}

/**
 * Scrubs the contact's leads created after `after` (a `_creationTime`), a
 * batch per transaction; the rest continues in the scheduler.
 */
async function scrubLeadsFrom(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  after: number,
): Promise<{ scrubbed: number; done: boolean }> {
  const leads = await ctx.db
    .query("leads")
    .withIndex("by_contactId", (q) => q.eq("contactId", contactId).gt("_creationTime", after))
    .take(ANONYMIZE_BATCH + 1);
  const batch = leads.slice(0, ANONYMIZE_BATCH);
  for (const lead of batch) await scrubLead(ctx, lead);
  const last = batch[batch.length - 1];
  const done = leads.length <= ANONYMIZE_BATCH;
  if (!done && last !== undefined) {
    await ctx.scheduler.runAfter(0, internal.contacts.anonymizeRemainingLeads, {
      contactId,
      after: last._creationTime,
    });
  }
  return { scrubbed: batch.length, done };
}

/**
 * ZZPL erasure: keeps the lead history (type, stage, dates, listing, agent)
 * and drops every identifier and every piece of free text about the person.
 * The contact itself is erased at once; anything beyond the first batch is
 * cleaned by scheduled mutations until nothing is left.
 */
export const anonymize = mutation({
  args: { id: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("contacts", args.id);
    if (doc === null) notFound("Kontakt");
    if (doc.anonymizedAt !== undefined) return null;

    await ctx.db.patch("contacts", doc._id, {
      name: ANONYMIZED_NAME,
      email: undefined,
      phone: undefined,
      note: undefined,
      searchText: undefined,
      tags: ["anonimizovan"],
      anonymizedAt: Date.now(),
    });
    await scrubActivityFrom(ctx, doc._id, 0);
    const batch = await scrubLeadsFrom(ctx, doc._id, 0);

    await logActivity(ctx, {
      entity: "contact",
      entityId: doc._id,
      action: "contact.anonymized",
      summary: batch.done
        ? `${batch.scrubbed} upita očišćeno`
        : `${batch.scrubbed}+ upita, ostatak se čisti u pozadini`,
      by: viewer._id,
    });
    return null;
  },
});

/** The continuation of `anonymize` for a contact with many leads. */
export const anonymizeRemainingLeads = internalMutation({
  args: { contactId: v.id("contacts"), after: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await scrubLeadsFrom(ctx, args.contactId, args.after);
    return null;
  },
});

/**
 * One-off backfill of `searchText` for contacts written before it existed.
 * Run: `npx convex run contacts:backfillSearchText '{}'` (it pages itself).
 */
export const backfillSearchText = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ updated: v.number(), done: v.boolean() }),
  handler: async (ctx, args): Promise<{ updated: number; done: boolean }> => {
    const result = await ctx.db
      .query("contacts")
      .paginate({ numItems: 200, cursor: args.cursor ?? null });
    let updated = 0;
    for (const doc of result.page) {
      const next =
        doc.anonymizedAt !== undefined
          ? undefined
          : contactSearchText({
              name: doc.name,
              ...(doc.email !== undefined ? { email: doc.email } : {}),
              ...(doc.phone !== undefined ? { phone: doc.phone } : {}),
            });
      if (next === doc.searchText) continue;
      await ctx.db.patch("contacts", doc._id, { searchText: next });
      updated += 1;
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.contacts.backfillSearchText, {
        cursor: result.continueCursor,
      });
    }
    return { updated, done: result.isDone };
  },
});

/* ---------------------------------------------------------------------- CSV */

/**
 * `;` separates cells: Excel with Serbian regional settings uses the comma as
 * the decimal mark and `;` as its list separator, so a double-clicked file
 * opens in columns. The client prepends a UTF-8 BOM so č, ć, š, ž, đ and
 * Cyrillic survive (no `sep=` line: it makes Excel ignore the BOM).
 */
const SEPARATOR = ";";

function csvCell(value: string | undefined): string {
  if (value === undefined || value.length === 0) return "";
  let text = value;
  // Names arrive from a public form. A leading =, +, - or @ (or a tab/CR)
  // makes Excel and LibreOffice evaluate the cell as a formula; the quote
  // prefix keeps it text (OWASP "CSV injection").
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";,\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Last Sunday of a month at 01:00 UTC, when Europe switches summer time. */
function lastSundayAt1Utc(year: number, monthIndex: number): number {
  const day = new Date(Date.UTC(year, monthIndex + 1, 0, 1));
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day.getTime();
}

/** `2026-09-30 14:05` in Belgrade time (CET/CEST), which Excel reads as a date. */
function belgradeDateTime(ms: number): string {
  const year = new Date(ms).getUTCFullYear();
  const summer = ms >= lastSundayAt1Utc(year, 2) && ms < lastSundayAt1Utc(year, 9);
  const local = new Date(ms + (summer ? 2 : 1) * 3_600_000).toISOString();
  return `${local.slice(0, 10)} ${local.slice(11, 16)}`;
}

const LOCALE_SR: Record<Locale, string> = {
  "sr-Latn": "srpski",
  en: "engleski",
  ru: "ruski",
  de: "nemački",
};

/**
 * CSV export of the contacts table (PRD B6), newest first, capped at
 * EXPORT_CAP rows. Anonymized contacts are left out: they hold no identifier
 * worth exporting. Returned as text; the browser adds the BOM and downloads.
 *
 * A mutation, not a query: the export of personal data and its audit row
 * (`contact.exported`, with the real row count) commit in ONE transaction, so
 * there is no export without a trace, whatever the client does.
 */
export const exportCsv = mutation({
  args: {},
  returns: v.object({ csv: v.string(), rows: v.number(), truncated: v.boolean() }),
  handler: async (ctx) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const docs = await ctx.db.query("contacts").order("desc").take(EXPORT_CAP + 1);
    const truncated = docs.length > EXPORT_CAP;
    const header = [
      "Ime",
      "E-pošta",
      "Telefon",
      "Jezik",
      "Oznake",
      "Marketing saglasnost",
      "Saglasnost data",
      "Verzija teksta saglasnosti",
      "Kanal",
      "Kreiran",
      "Demo",
    ].join(SEPARATOR);

    const lines = [];
    for (const doc of docs.slice(0, EXPORT_CAP)) {
      if (doc.anonymizedAt !== undefined) continue;
      const last = latestConsent(doc.consents);
      lines.push(
        [
          csvCell(doc.name),
          csvCell(doc.email),
          csvCell(doc.phone),
          csvCell(doc.locale !== undefined ? LOCALE_SR[doc.locale] : undefined),
          csvCell(doc.tags.join(", ")),
          csvCell(last === undefined ? undefined : last.marketing ? "da" : "ne"),
          csvCell(last !== undefined ? belgradeDateTime(last.at) : undefined),
          csvCell(last?.textVersion),
          csvCell(last?.channel),
          csvCell(belgradeDateTime(doc._creationTime)),
          csvCell(doc.isDemo ? "da" : "ne"),
        ].join(SEPARATOR),
      );
    }

    await logActivity(ctx, {
      entity: "contact",
      action: "contact.exported",
      summary: `CSV izvoz: ${lines.length} kontakata${truncated ? ` (prvih ${EXPORT_CAP})` : ""}`,
      by: viewer._id,
    });
    return { csv: [header, ...lines].join("\r\n"), rows: lines.length, truncated };
  },
});
