import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { appError, invalidInput } from "./lib/errors";
import { computeValuation, floorToNumber } from "./lib/money";
import {
  assertHoneypotEmpty,
  cleanUtm,
  consumeEmailLimit,
  consumeLimit,
  optionalPhone,
  optionalText,
  requireEmail,
  requireText,
} from "./lib/rateLimit";
import { isListedScope } from "./lib/search";
import { belgradeWall, DAY_MS } from "./lib/belgradeTime";
import {
  conditionV,
  floorV,
  localeV,
  onsiteWindowV,
  propertyTypeV,
  utmV,
  valuationResultV,
} from "./lib/validators";
import type { LeadType, Locale } from "./lib/validators";
import { contactSearchText } from "./lib/contactSearch";

/** The privacy-consent text version stored with every lead (ZZPL Art. 15). */
export const CONSENT_TEXT_VERSION = "privacy-2026-09";

const contactInputV = v.object({
  name: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
});

const commonArgsV = {
  sessionKey: v.string(),
  locale: localeV,
  contact: contactInputV,
  marketing: v.boolean(),
  privacy: v.boolean(),
  /** Honeypot: bots fill it, humans never see it. */
  hp: v.optional(v.string()),
  utm: v.optional(utmV),
};

type ContactInput = { name: string; email: string; phone?: string };

function assertPrivacyConsent(privacy: boolean): void {
  if (!privacy) {
    invalidInput("Saglasnost za obradu podataka o ličnosti je obavezna.");
  }
}

/** Listing owners (`listingsAdmin.setOwner`) carry this tag; web forms never attach to them. */
const OWNER_TAG = "vlasnik";

/**
 * The contact a public form submission belongs to: the newest live contact
 * with this (normalized) email that is not a listing owner's private record.
 * Anonymized contacts have no email left, so they are never matched. There is
 * deliberately no fallback match by phone: anyone can type someone's number.
 */
export async function matchWebContact(
  ctx: MutationCtx,
  email: string,
): Promise<Doc<"contacts"> | null> {
  const sameEmail = await ctx.db
    .query("contacts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .order("desc")
    .take(10);
  return (
    sameEmail.find(
      (contact) => contact.anonymizedAt === undefined && !contact.tags.includes(OWNER_TAG),
    ) ?? null
  );
}

/** Where a submission landed, and a phone the visitor typed that the contact does not hold. */
type WebContact = { contactId: Id<"contacts">; submittedPhone?: string };

/**
 * Finds or creates the contact for a submission. A public form NEVER changes
 * an existing contact: not its phone, locale or consents (whoever knows a
 * client's email could otherwise swap in their own number or opt the client in
 * or out of marketing). The submitted phone and this submission's consent are
 * kept on the lead instead; editing a contact is an admin action.
 */
async function upsertContact(
  ctx: MutationCtx,
  input: ContactInput,
  locale: Locale,
  marketing: boolean,
  now: number,
): Promise<WebContact> {
  const name = requireText(input.name, "Ime", 120, 2);
  const email = requireEmail(input.email);
  const phone = optionalPhone(input.phone);
  // Fresh session keys are free for a script; an address is not.
  await consumeEmailLimit(ctx, "leadPerEmail", email);

  const existing = await matchWebContact(ctx, email);
  if (existing !== null) {
    return {
      contactId: existing._id,
      ...(phone !== undefined && phone !== existing.phone ? { submittedPhone: phone } : {}),
    };
  }

  const contactId = await ctx.db.insert("contacts", {
    name,
    email,
    ...(phone !== undefined ? { phone } : {}),
    searchText: contactSearchText({ name, email, phone }),
    locale,
    tags: ["web"],
    consents: [
      { privacy: true, marketing, textVersion: CONSENT_TEXT_VERSION, at: now, channel: "web" },
    ],
    isDemo: false,
  });
  return { contactId };
}

async function bumpListingLeads(
  ctx: MutationCtx,
  listingId: Id<"listings">,
): Promise<void> {
  const stats = await ctx.db
    .query("listingStats")
    .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
    .unique();
  if (stats === null) {
    await ctx.db.insert("listingStats", {
      listingId,
      views: 0,
      favorites: 0,
      leads: 1,
      viewings: 0,
    });
    return;
  }
  await ctx.db.patch("listingStats", stats._id, { leads: stats.leads + 1 });
}

/** Staff-facing Serbian wording for the activity log. */
const LEAD_TYPE_SUMMARY: Record<LeadType, string> = {
  inquiry: "upit o nekretnini",
  viewing: "zahtev za razgledanje",
  valuation: "zahtev za procenu",
  seller: "ponuda nekretnine za prodaju",
  general: "opšti upit",
};

async function createLead(
  ctx: MutationCtx,
  args: {
    type: LeadType;
    locale: Locale;
    contact: WebContact;
    marketing: boolean;
    now: number;
    listingId?: Id<"listings">;
    agentId?: Id<"agents">;
    message?: string;
    answers?: Record<string, string | number | boolean>;
    valuation?: Doc<"leads">["valuation"];
    utm?: Doc<"leads">["utm"];
  },
): Promise<Id<"leads">> {
  const leadId = await ctx.db.insert("leads", {
    type: args.type,
    status: "new",
    ...(args.listingId !== undefined ? { listingId: args.listingId } : {}),
    ...(args.agentId !== undefined ? { agentId: args.agentId } : {}),
    contactId: args.contact.contactId,
    ...(args.contact.submittedPhone !== undefined
      ? { submittedPhone: args.contact.submittedPhone }
      : {}),
    ...(args.message !== undefined ? { message: args.message } : {}),
    ...(args.answers !== undefined ? { answers: args.answers } : {}),
    ...(args.valuation !== undefined ? { valuation: args.valuation } : {}),
    source: "web",
    locale: args.locale,
    ...(args.utm !== undefined ? { utm: cleanUtm(args.utm) } : {}),
    consent: {
      privacy: true,
      marketing: args.marketing,
      textVersion: CONSENT_TEXT_VERSION,
      at: args.now,
      channel: "web",
    },
    isDemo: false,
  });

  if (args.listingId !== undefined) await bumpListingLeads(ctx, args.listingId);

  await logActivity(ctx, {
    entity: "lead",
    entityId: leadId,
    action: "lead.created",
    summary: `Sa sajta: ${LEAD_TYPE_SUMMARY[args.type]}`,
  });

  return leadId;
}

/* ------------------------------------------------------------------ inquiry */

export const createInquiry = mutation({
  args: {
    ...commonArgsV,
    listingId: v.id("listings"),
    message: v.string(),
  },
  returns: v.object({ leadId: v.id("leads") }),
  handler: async (ctx, args) => {
    assertHoneypotEmpty(args.hp);
    assertPrivacyConsent(args.privacy);
    await consumeLimit(ctx, "leadPerSession", args.sessionKey);

    // Sold and rented listings stay visible but take no inquiries (PRD A5).
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isListedScope(listing.scope)) {
      appError("NOT_FOUND", "Nekretnina nije pronađena.");
    }

    const now = Date.now();
    const message = requireText(args.message, "Poruka", 2000, 10);
    const contact = await upsertContact(
      ctx,
      args.contact,
      args.locale,
      args.marketing,
      now,
    );

    const leadId = await createLead(ctx, {
      type: "inquiry",
      locale: args.locale,
      contact,
      marketing: args.marketing,
      now,
      listingId: listing._id,
      agentId: listing.agentId,
      message,
      ...(args.utm !== undefined ? { utm: args.utm } : {}),
    });

    return { leadId };
  },
});

/* ---------------------------------------------------------------- valuation */

export const createValuation = mutation({
  args: {
    ...commonArgsV,
    locationId: v.id("locations"),
    propertyType: propertyTypeV,
    areaM2: v.number(),
    rooms: v.number(),
    floor: floorV,
    totalFloors: v.optional(v.number()),
    hasElevator: v.optional(v.boolean()),
    condition: conditionV,
    yearBuilt: v.optional(v.number()),
    addressNote: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.object({ leadId: v.id("leads"), valuation: valuationResultV }),
  handler: async (ctx, args) => {
    assertHoneypotEmpty(args.hp);
    assertPrivacyConsent(args.privacy);
    await consumeLimit(ctx, "valuationPerSession", args.sessionKey);

    // NaN and Infinity satisfy both comparisons, so test finiteness first.
    if (!Number.isFinite(args.areaM2) || args.areaM2 < 8 || args.areaM2 > 2000) {
      invalidInput("Kvadratura mora biti između 8 i 2000 m².");
    }
    if (!Number.isFinite(args.rooms) || args.rooms < 0 || args.rooms > 20) {
      invalidInput("Broj soba mora biti između 0 i 20.");
    }
    // The remaining numbers are stored for staff and feed the estimate, so they
    // get the same treatment: whole numbers in a plausible range, or nothing.
    if (typeof args.floor === "number" && (!Number.isInteger(args.floor) || args.floor < -2 || args.floor > 100)) {
      invalidInput("Sprat mora biti ceo broj između -2 i 100.");
    }
    if (
      args.totalFloors !== undefined &&
      (!Number.isInteger(args.totalFloors) || args.totalFloors < 0 || args.totalFloors > 100)
    ) {
      invalidInput("Ukupan broj spratova mora biti ceo broj između 0 i 100.");
    }
    const latestYear = new Date().getUTCFullYear() + 5;
    if (
      args.yearBuilt !== undefined &&
      (!Number.isInteger(args.yearBuilt) || args.yearBuilt < 1800 || args.yearBuilt > latestYear)
    ) {
      invalidInput(`Godina izgradnje mora biti između 1800 i ${latestYear}.`);
    }

    const location = await ctx.db.get("locations", args.locationId);
    if (location === null) appError("NOT_FOUND", "Lokacija nije pronađena.");

    // Fall back up the tree when a neighborhood has no average yet.
    let avg = location.avgPricePerM2Sale;
    let basisId = location._id;
    let parentId = location.parentId;
    let guard = 0;
    while (avg === undefined && parentId !== undefined && guard < 3) {
      const parent: Doc<"locations"> | null = await ctx.db.get("locations", parentId);
      if (parent === null) break;
      avg = parent.avgPricePerM2Sale;
      basisId = parent._id;
      parentId = parent.parentId;
      guard += 1;
    }
    if (avg === undefined) {
      appError(
        "INVALID_INPUT",
        "Za odabranu lokaciju još nemamo prosečnu cenu. Pozovite nas za procenu.",
      );
    }

    const valuation = computeValuation({
      avgPricePerM2: avg,
      areaM2: args.areaM2,
      condition: args.condition,
      floorNum: floorToNumber(args.floor, args.totalFloors),
      ...(args.totalFloors !== undefined ? { totalFloors: args.totalFloors } : {}),
      ...(args.hasElevator !== undefined ? { hasElevator: args.hasElevator } : {}),
    });

    const now = Date.now();
    const contact = await upsertContact(
      ctx,
      args.contact,
      args.locale,
      args.marketing,
      now,
    );

    const answers: Record<string, string | number | boolean> = {
      locationSlug: location.slug,
      basisLocationId: basisId,
      propertyType: args.propertyType,
      areaM2: args.areaM2,
      rooms: args.rooms,
      floor: String(args.floor),
      condition: args.condition,
    };
    if (args.totalFloors !== undefined) answers.totalFloors = args.totalFloors;
    if (args.hasElevator !== undefined) answers.hasElevator = args.hasElevator;
    if (args.yearBuilt !== undefined) answers.yearBuilt = args.yearBuilt;
    const addressNote = optionalText(args.addressNote, "Adresa", 300);
    if (addressNote !== undefined) answers.addressNote = addressNote;

    const leadId = await createLead(ctx, {
      type: "valuation",
      locale: args.locale,
      contact,
      marketing: args.marketing,
      now,
      answers,
      valuation,
      ...(optionalText(args.message, "Poruka", 2000) !== undefined
        ? { message: optionalText(args.message, "Poruka", 2000) }
        : {}),
      ...(args.utm !== undefined ? { utm: args.utm } : {}),
    });

    return { leadId, valuation };
  },
});

/* ----------------------------------------------------- on-site valuation ask */

/** The funnel's result screen offers the follow-up for this long. */
const ONSITE_REQUEST_WINDOW_MS = 6 * 60 * 60_000;
/** How far ahead a visitor may propose the visit. */
const ONSITE_MAX_DAYS = 30;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` of the Belgrade calendar day containing `at`. */
function belgradeIsoDate(at: number): string {
  return new Date(belgradeWall(at)).toISOString().slice(0, 10);
}

/**
 * The CTA on the valuation result (PRD A6 step 3): the visitor asks for the
 * free on-site valuation and proposes a day and a part of the day. It
 * annotates the valuation lead they just created instead of opening a second
 * one, so the agent sees the indicative range and the request together.
 *
 * Only a fresh valuation lead qualifies (the id comes back from
 * `createValuation` to the submitting browser and is useless hours later),
 * only once, and through the same per-session bucket as every other form.
 */
export const requestOnsiteValuation = mutation({
  args: {
    sessionKey: v.string(),
    leadId: v.id("leads"),
    preferredDate: v.string(),
    preferredWindow: onsiteWindowV,
    note: v.optional(v.string()),
    /** Honeypot, as on every public form. */
    hp: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertHoneypotEmpty(args.hp);
    await consumeLimit(ctx, "leadPerSession", args.sessionKey);

    const lead = await ctx.db.get("leads", args.leadId);
    const now = Date.now();
    if (
      lead === null ||
      lead.type !== "valuation" ||
      lead.source !== "web" ||
      now - lead._creationTime > ONSITE_REQUEST_WINDOW_MS
    ) {
      appError("NOT_FOUND", "Zahtev za procenu nije pronađen.");
    }
    if (lead.answers?.onsiteRequested === true) {
      appError("ALREADY_REQUESTED", "Procena na terenu je već zatražena.");
    }

    const today = belgradeIsoDate(now);
    const last = belgradeIsoDate(now + ONSITE_MAX_DAYS * DAY_MS);
    if (
      !ISO_DATE_RE.test(args.preferredDate) ||
      Number.isNaN(Date.parse(`${args.preferredDate}T12:00:00Z`)) ||
      args.preferredDate < today ||
      args.preferredDate > last
    ) {
      invalidInput("Izaberite dan u narednih 30 dana.");
    }
    const note = optionalText(args.note, "Napomena", 600);

    await ctx.db.patch("leads", lead._id, {
      answers: {
        ...(lead.answers ?? {}),
        onsiteRequested: true,
        onsiteDate: args.preferredDate,
        onsiteWindow: args.preferredWindow,
        ...(note !== undefined ? { onsiteNote: note } : {}),
      },
    });

    await logActivity(ctx, {
      entity: "lead",
      entityId: lead._id,
      action: "lead.onsiteRequested",
      summary: "Sa sajta: zatražena procena na terenu",
    });
    return null;
  },
});

/* ------------------------------------------------------------------- seller */

export const createSeller = mutation({
  args: {
    ...commonArgsV,
    locationId: v.optional(v.id("locations")),
    propertyType: propertyTypeV,
    areaM2: v.number(),
    rooms: v.optional(v.number()),
    expectedPrice: v.optional(v.number()),
    addressNote: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.object({ leadId: v.id("leads") }),
  handler: async (ctx, args) => {
    assertHoneypotEmpty(args.hp);
    assertPrivacyConsent(args.privacy);
    await consumeLimit(ctx, "leadPerSession", args.sessionKey);

    if (!Number.isFinite(args.areaM2) || args.areaM2 < 8 || args.areaM2 > 20000) {
      invalidInput("Kvadratura mora biti između 8 i 20000 m².");
    }
    if (
      args.rooms !== undefined &&
      (!Number.isFinite(args.rooms) || args.rooms < 0 || args.rooms > 30)
    ) {
      invalidInput("Broj soba mora biti između 0 i 30.");
    }
    if (
      args.expectedPrice !== undefined &&
      (!Number.isFinite(args.expectedPrice) ||
        args.expectedPrice < 0 ||
        args.expectedPrice > 100_000_000)
    ) {
      invalidInput("Očekivana cena nije realna.");
    }

    const answers: Record<string, string | number | boolean> = {
      propertyType: args.propertyType,
      areaM2: args.areaM2,
    };
    if (args.rooms !== undefined) answers.rooms = args.rooms;
    if (args.expectedPrice !== undefined) {
      answers.expectedPrice = args.expectedPrice;
    }
    const addressNote = optionalText(args.addressNote, "Adresa", 300);
    if (addressNote !== undefined) answers.addressNote = addressNote;
    if (args.locationId !== undefined) {
      const location = await ctx.db.get("locations", args.locationId);
      if (location !== null) answers.locationSlug = location.slug;
    }

    const now = Date.now();
    const contact = await upsertContact(
      ctx,
      args.contact,
      args.locale,
      args.marketing,
      now,
    );
    const message = optionalText(args.message, "Poruka", 2000);

    const leadId = await createLead(ctx, {
      type: "seller",
      locale: args.locale,
      contact,
      marketing: args.marketing,
      now,
      answers,
      ...(message !== undefined ? { message } : {}),
      ...(args.utm !== undefined ? { utm: args.utm } : {}),
    });

    return { leadId };
  },
});

/* ------------------------------------------------------------------ general */

export const createGeneral = mutation({
  args: {
    ...commonArgsV,
    subject: v.optional(v.string()),
    message: v.string(),
  },
  returns: v.object({ leadId: v.id("leads") }),
  handler: async (ctx, args) => {
    assertHoneypotEmpty(args.hp);
    assertPrivacyConsent(args.privacy);
    await consumeLimit(ctx, "leadPerSession", args.sessionKey);

    const now = Date.now();
    const message = requireText(args.message, "Poruka", 2000, 10);
    const contact = await upsertContact(
      ctx,
      args.contact,
      args.locale,
      args.marketing,
      now,
    );

    const subject = optionalText(args.subject, "Tema", 160);
    const leadId = await createLead(ctx, {
      type: "general",
      locale: args.locale,
      contact,
      marketing: args.marketing,
      now,
      message,
      ...(subject !== undefined ? { answers: { subject } } : {}),
      ...(args.utm !== undefined ? { utm: args.utm } : {}),
    });

    return { leadId };
  },
});

