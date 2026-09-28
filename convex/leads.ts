import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { logActivity } from "./lib/activity";
import { appError, invalidInput } from "./lib/errors";
import { computeValuation, floorToNumber } from "./lib/money";
import {
  assertHoneypotEmpty,
  consumeLimit,
  optionalPhone,
  optionalText,
  requireEmail,
  requireText,
} from "./lib/rateLimit";
import { isPublicScope } from "./lib/search";
import {
  conditionV,
  floorV,
  localeV,
  propertyTypeV,
  utmV,
  valuationResultV,
} from "./lib/validators";
import type { LeadType, Locale } from "./lib/validators";

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

/** Dedupes by email first, then phone. Anonymized contacts are never reused. */
async function upsertContact(
  ctx: MutationCtx,
  input: ContactInput,
  locale: Locale,
  marketing: boolean,
  now: number,
): Promise<Id<"contacts">> {
  const name = requireText(input.name, "Ime", 120, 2);
  const email = requireEmail(input.email);
  const phone = optionalPhone(input.phone);

  const consent = {
    privacy: true,
    marketing,
    textVersion: CONSENT_TEXT_VERSION,
    at: now,
    channel: "web",
  };

  let existing: Doc<"contacts"> | null = await ctx.db
    .query("contacts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (existing === null && phone !== undefined) {
    existing = await ctx.db
      .query("contacts")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
  }

  if (existing !== null && existing.anonymizedAt === undefined) {
    // Never overwrite an identifier from a public form: anyone who knows a
    // client's email could otherwise replace their phone number with their own
    // and have the agent call them about the client's property. Only fill gaps;
    // changing an existing value is an admin action (`contacts.merge`).
    await ctx.db.patch("contacts", existing._id, {
      ...(existing.phone === undefined && phone !== undefined ? { phone } : {}),
      locale,
      consents: [...existing.consents.slice(-19), consent],
    });
    return existing._id;
  }

  return await ctx.db.insert("contacts", {
    name,
    email,
    ...(phone !== undefined ? { phone } : {}),
    locale,
    tags: ["web"],
    consents: [consent],
    isDemo: false,
  });
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

async function createLead(
  ctx: MutationCtx,
  args: {
    type: LeadType;
    locale: Locale;
    contactId: Id<"contacts">;
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
    contactId: args.contactId,
    ...(args.message !== undefined ? { message: args.message } : {}),
    ...(args.answers !== undefined ? { answers: args.answers } : {}),
    ...(args.valuation !== undefined ? { valuation: args.valuation } : {}),
    source: "web",
    locale: args.locale,
    ...(args.utm !== undefined ? { utm: args.utm } : {}),
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
    summary: `Novi upit (${args.type}) sa sajta`,
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

    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isPublicScope(listing.scope)) {
      appError("NOT_FOUND", "Nekretnina nije pronađena.");
    }

    const now = Date.now();
    const message = requireText(args.message, "Poruka", 2000, 10);
    const contactId = await upsertContact(
      ctx,
      args.contact,
      args.locale,
      args.marketing,
      now,
    );

    const leadId = await createLead(ctx, {
      type: "inquiry",
      locale: args.locale,
      contactId,
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
    const contactId = await upsertContact(
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
      contactId,
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
    const contactId = await upsertContact(
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
      contactId,
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
    const contactId = await upsertContact(
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
      contactId,
      marketing: args.marketing,
      now,
      message,
      ...(subject !== undefined ? { answers: { subject } } : {}),
      ...(args.utm !== undefined ? { utm: args.utm } : {}),
    });

    return { leadId };
  },
});

