import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { consentV, localeV } from "./lib/validators";

const MANAGERS = ["admin", "manager"] as const;

const contactRowV = v.object({
  _id: v.id("contacts"),
  name: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  locale: v.optional(localeV),
  tags: v.array(v.string()),
  leadCount: v.number(),
  lastConsentAt: v.optional(v.number()),
  marketing: v.boolean(),
  anonymizedAt: v.optional(v.number()),
  createdAt: v.number(),
  isDemo: v.boolean(),
});

export const list = query({
  args: { q: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(contactRowV),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const result = await ctx.db
      .query("contacts")
      .order("desc")
      .paginate(args.paginationOpts);

    const needle = args.q?.trim().toLowerCase();
    const page = [];
    for (const doc of result.page) {
      if (
        needle !== undefined &&
        needle.length > 0 &&
        !`${doc.name} ${doc.email ?? ""} ${doc.phone ?? ""}`
          .toLowerCase()
          .includes(needle)
      ) {
        continue;
      }
      const leads = await ctx.db
        .query("leads")
        .withIndex("by_contactId", (q) => q.eq("contactId", doc._id))
        .take(50);
      const last = doc.consents[doc.consents.length - 1];
      page.push({
        _id: doc._id,
        name: doc.name,
        ...(doc.email !== undefined ? { email: doc.email } : {}),
        ...(doc.phone !== undefined ? { phone: doc.phone } : {}),
        ...(doc.locale !== undefined ? { locale: doc.locale } : {}),
        tags: doc.tags,
        leadCount: leads.length,
        ...(last !== undefined ? { lastConsentAt: last.at } : {}),
        marketing: last?.marketing === true,
        ...(doc.anonymizedAt !== undefined ? { anonymizedAt: doc.anonymizedAt } : {}),
        createdAt: doc._creationTime,
        isDemo: doc.isDemo,
      });
    }
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const get = query({
  args: { id: v.id("contacts") },
  returns: v.union(
    v.object({
      contact: contactRowV,
      consents: v.array(consentV),
      note: v.optional(v.string()),
      leads: v.array(
        v.object({
          _id: v.id("leads"),
          type: v.string(),
          status: v.string(),
          createdAt: v.number(),
          listingRef: v.optional(v.string()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("contacts", args.id);
    if (doc === null) return null;

    const leadDocs = await ctx.db
      .query("leads")
      .withIndex("by_contactId", (q) => q.eq("contactId", doc._id))
      .take(50);
    const leads = [];
    for (const lead of leadDocs) {
      const listing =
        lead.listingId !== undefined
          ? await ctx.db.get("listings", lead.listingId)
          : null;
      leads.push({
        _id: lead._id,
        type: lead.type,
        status: lead.status,
        createdAt: lead._creationTime,
        ...(listing !== null ? { listingRef: listing.ref } : {}),
      });
    }

    const last = doc.consents[doc.consents.length - 1];
    return {
      contact: {
        _id: doc._id,
        name: doc.name,
        ...(doc.email !== undefined ? { email: doc.email } : {}),
        ...(doc.phone !== undefined ? { phone: doc.phone } : {}),
        ...(doc.locale !== undefined ? { locale: doc.locale } : {}),
        tags: doc.tags,
        leadCount: leadDocs.length,
        ...(last !== undefined ? { lastConsentAt: last.at } : {}),
        marketing: last?.marketing === true,
        ...(doc.anonymizedAt !== undefined ? { anonymizedAt: doc.anonymizedAt } : {}),
        createdAt: doc._creationTime,
        isDemo: doc.isDemo,
      },
      consents: doc.consents,
      ...(doc.note !== undefined ? { note: doc.note } : {}),
      leads,
    };
  },
});

export const setNote = mutation({
  args: { id: v.id("contacts"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("contacts", args.id);
    if (doc === null) notFound("Kontakt");
    await ctx.db.patch("contacts", doc._id, {
      note: args.note.trim().slice(0, 4000),
    });
    await logActivity(ctx, {
      entity: "contact",
      entityId: doc._id,
      action: "contact.note",
      by: viewer._id,
    });
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

    await ctx.db.patch("contacts", into._id, {
      phone: into.phone ?? from.phone,
      locale: into.locale ?? from.locale,
      tags: Array.from(new Set([...into.tags, ...from.tags])),
      consents: [...into.consents, ...from.consents].slice(-20),
      note: [into.note, from.note].filter(Boolean).join("\n---\n").slice(0, 4000),
    });
    await ctx.db.delete("contacts", from._id);

    await logActivity(ctx, {
      entity: "contact",
      entityId: into._id,
      action: "contact.merged",
      summary: `${from.name} → ${into.name} (${leads.length} upita)`,
      by: viewer._id,
    });
    return { movedLeads: leads.length };
  },
});

/** ZZPL erasure: keeps the lead history, drops every identifier. */
export const anonymize = mutation({
  args: { id: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("contacts", args.id);
    if (doc === null) notFound("Kontakt");
    if (doc.anonymizedAt !== undefined) return null;

    const now = Date.now();
    await ctx.db.patch("contacts", doc._id, {
      name: "Anonimizovan kontakt",
      email: undefined,
      phone: undefined,
      note: undefined,
      tags: ["anonimizovan"],
      anonymizedAt: now,
    });

    // `answers` holds the valuation/seller `addressNote` (the subject's own
    // address) and `leadNotes` holds whatever staff typed, so ZZPL erasure has to
    // reach both — clearing `message` alone left the address behind.
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_contactId", (q) => q.eq("contactId", doc._id))
      .take(201);
    if (leads.length > 200) {
      invalidInput(
        "Kontakt ima previše upita za jednu operaciju. Pokrenite anonimizaciju ponovo.",
      );
    }
    for (const lead of leads) {
      await ctx.db.patch("leads", lead._id, {
        message: undefined,
        answers: undefined,
        valuation: undefined,
      });
      const notes = await ctx.db
        .query("leadNotes")
        .withIndex("by_leadId_and_at", (q) => q.eq("leadId", lead._id))
        .take(50);
      for (const note of notes) await ctx.db.delete("leadNotes", note._id);
    }

    await logActivity(ctx, {
      entity: "contact",
      entityId: doc._id,
      action: "contact.anonymized",
      summary: `${leads.length} upita očišćeno`,
      by: viewer._id,
    });
    return null;
  },
});

function csvCell(value: string | number | undefined): string {
  if (value === undefined) return "";
  let text = String(value);
  // A contact name arrives from a public form. A leading =, +, - or @ makes Excel
  // and LibreOffice treat the cell as a formula, so prefix it to neutralise it.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV export for the contacts table (PRD B6). Capped at 2000 rows. */
export const exportCsv = query({
  args: {},
  returns: v.object({ csv: v.string(), rows: v.number() }),
  handler: async (ctx) => {
    await requireRole(ctx, MANAGERS);
    const docs = await ctx.db.query("contacts").order("desc").take(2000);
    const header = [
      "name",
      "email",
      "phone",
      "locale",
      "tags",
      "marketing",
      "consentAt",
      "consentVersion",
      "createdAt",
      "isDemo",
    ].join(";");

    const lines = docs.map((doc) => {
      const last = doc.consents[doc.consents.length - 1];
      return [
        csvCell(doc.name),
        csvCell(doc.email),
        csvCell(doc.phone),
        csvCell(doc.locale),
        csvCell(doc.tags.join(",")),
        csvCell(last?.marketing === true ? "da" : "ne"),
        csvCell(last !== undefined ? new Date(last.at).toISOString() : ""),
        csvCell(last?.textVersion),
        csvCell(new Date(doc._creationTime).toISOString()),
        csvCell(doc.isDemo ? "da" : "ne"),
      ].join(";");
    });

    return { csv: [header, ...lines].join("\r\n"), rows: docs.length };
  },
});
