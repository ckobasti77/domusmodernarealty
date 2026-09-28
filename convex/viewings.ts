import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { appError, invalidInput } from "./lib/errors";
import {
  assertHoneypotEmpty,
  consumeLimit,
  optionalPhone,
  optionalText,
  requireEmail,
  requireText,
} from "./lib/rateLimit";
import { isPublicScope } from "./lib/search";
import { localeV, viewingModeV } from "./lib/validators";
import { CONSENT_TEXT_VERSION } from "./leads";

const MAX_SLOT_MS = 3 * 60 * 60 * 1000;

/**
 * Public viewing request. Re-checks the slot against the agent's weekly
 * availability AND existing requested/confirmed viewings, so a stale UI cannot
 * double-book. Creates the viewing plus a `viewing` lead.
 */
export const request = mutation({
  args: {
    sessionKey: v.string(),
    locale: localeV,
    listingId: v.id("listings"),
    start: v.number(),
    end: v.number(),
    mode: viewingModeV,
    contact: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
    }),
    message: v.optional(v.string()),
    marketing: v.boolean(),
    privacy: v.boolean(),
    hp: v.optional(v.string()),
  },
  returns: v.object({ viewingId: v.id("viewings"), leadId: v.id("leads") }),
  handler: async (ctx, args) => {
    assertHoneypotEmpty(args.hp);
    if (!args.privacy) {
      invalidInput("Saglasnost za obradu podataka o ličnosti je obavezna.");
    }
    await consumeLimit(ctx, "viewingPerSession", args.sessionKey);

    const now = Date.now();
    if (args.end <= args.start) invalidInput("Termin nije ispravan.");
    if (args.end - args.start > MAX_SLOT_MS) {
      invalidInput("Termin je predug.");
    }
    if (args.start < now) invalidInput("Izabrani termin je u prošlosti.");
    if (args.start > now + 60 * 86_400_000) {
      invalidInput("Termin se može zakazati najviše 60 dana unaprijed.");
    }

    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isPublicScope(listing.scope)) {
      appError("NOT_FOUND", "Nekretnina nije pronađena.");
    }
    const agent = await ctx.db.get("agents", listing.agentId);
    if (agent === null) appError("NOT_FOUND", "Agent nije pronađen.");

    // 1) the slot must sit inside the agent's weekly availability
    const startDate = new Date(args.start);
    const weekday = startDate.getUTCDay();
    const dayStart = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    );
    const withinAvailability = agent.availability.some((slot) => {
      if (slot.weekday !== weekday) return false;
      const from = parseHm(slot.from);
      const to = parseHm(slot.to);
      if (from === null || to === null) return false;
      return args.start >= dayStart + from && args.end <= dayStart + to;
    });
    if (!withinAvailability) {
      appError("SLOT_TAKEN", "Izabrani termin nije u radnom vremenu agenta.");
    }

    // 2) the slot must not overlap a requested or confirmed viewing
    const dayEnd = dayStart + 86_400_000;
    const sameDay = await ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) =>
        q.eq("agentId", agent._id).gte("start", dayStart).lt("start", dayEnd),
      )
      .take(100);
    const clash = sameDay.some(
      (item) =>
        (item.status === "requested" || item.status === "confirmed") &&
        item.start < args.end &&
        item.end > args.start,
    );
    if (clash) {
      appError("SLOT_TAKEN", "Termin je upravo zauzet. Izaberite drugi.");
    }

    // 3) contact + lead
    const name = requireText(args.contact.name, "Ime", 120, 2);
    const email = requireEmail(args.contact.email);
    const phone = optionalPhone(args.contact.phone);
    const message = optionalText(args.message, "Poruka", 1000);

    const consent = {
      privacy: true,
      marketing: args.marketing,
      textVersion: CONSENT_TEXT_VERSION,
      at: now,
      channel: "web",
    };

    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    let contactId;
    if (existing !== null && existing.anonymizedAt === undefined) {
      await ctx.db.patch("contacts", existing._id, {
        name,
        ...(phone !== undefined ? { phone } : {}),
        locale: args.locale,
        consents: [...existing.consents.slice(-19), consent],
      });
      contactId = existing._id;
    } else {
      contactId = await ctx.db.insert("contacts", {
        name,
        email,
        ...(phone !== undefined ? { phone } : {}),
        locale: args.locale,
        tags: ["web", "razgledanje"],
        consents: [consent],
        isDemo: false,
      });
    }

    const leadId = await ctx.db.insert("leads", {
      type: "viewing",
      status: "new",
      listingId: listing._id,
      agentId: agent._id,
      contactId,
      ...(message !== undefined ? { message } : {}),
      answers: {
        start: args.start,
        end: args.end,
        mode: args.mode,
      },
      source: "web",
      locale: args.locale,
      consent,
      isDemo: false,
    });

    const viewingId = await ctx.db.insert("viewings", {
      listingId: listing._id,
      leadId,
      agentId: agent._id,
      start: args.start,
      end: args.end,
      mode: args.mode,
      status: "requested",
      isDemo: false,
    });

    const stats = await ctx.db
      .query("listingStats")
      .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
      .unique();
    if (stats === null) {
      await ctx.db.insert("listingStats", {
        listingId: listing._id,
        views: 0,
        favorites: 0,
        leads: 1,
        viewings: 1,
      });
    } else {
      await ctx.db.patch("listingStats", stats._id, {
        leads: stats.leads + 1,
        viewings: stats.viewings + 1,
      });
    }

    await logActivity(ctx, {
      entity: "viewing",
      entityId: viewingId,
      action: "viewing.requested",
      summary: `Zahtev za razgledanje ${listing.ref}`,
    });

    return { viewingId, leadId };
  },
});

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60 + minutes) * 60_000;
}
