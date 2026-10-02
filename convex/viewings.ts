import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { logActivity } from "./lib/activity";
import {
  BOOKING_DAYS,
  BOOKING_LEAD_MS,
  belgradeWall,
  DAY_MS,
  VIEWING_SLOT_MS,
} from "./lib/belgradeTime";
import { appError, invalidInput } from "./lib/errors";
import {
  assertHoneypotEmpty,
  consumeEmailLimit,
  consumeLimit,
  optionalPhone,
  optionalText,
  requireEmail,
  requireText,
} from "./lib/rateLimit";
import { isListedScope } from "./lib/search";
import { localeV, viewingModeV } from "./lib/validators";
import { parseHm } from "./agents";
import { CONSENT_TEXT_VERSION, matchWebContact } from "./leads";
import { contactSearchText } from "./lib/contactSearch";

/** Viewings entered by the office can run longer than a web slot; overlap checks look this far back. */
const LONGEST_VIEWING_MS = 3 * 60 * 60 * 1000;

/**
 * Public viewing request. Re-checks the slot against the agent's weekly
 * availability AND existing requested/confirmed viewings, so a stale UI cannot
 * double-book. Creates the viewing plus a `viewing` lead.
 *
 * Every time rule is evaluated on the server in Europe/Belgrade (the agent's
 * hours are Belgrade wall-clock time): a web request is exactly one slot of
 * the agent's hourly grid, at least `BOOKING_LEAD_MS` ahead and at most
 * `BOOKING_DAYS` out, on a listing that is still on the market.
 *
 * It returns nothing. A repeat request from an address that already holds an
 * open one for this listing gets the same answer and is not stored: an error
 * there told anyone who knew an e-mail address whether its owner was looking
 * at the property and, being a throw, refunded the rate-limit tokens, so it
 * could be asked without limit. The open request stands. (The repeat's slot
 * stays free in `agents.slots`, so a determined prober can still infer it,
 * but only at the price of a rate-limited request that books a real slot in
 * the owner's name whenever there was no open request.)
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
  returns: v.null(),
  handler: async (ctx, args) => {
    assertHoneypotEmpty(args.hp);
    if (!args.privacy) {
      invalidInput("Saglasnost za obradu podataka o ličnosti je obavezna.");
    }
    await consumeLimit(ctx, "viewingPerSession", args.sessionKey);

    const now = Date.now();
    if (args.end - args.start !== VIEWING_SLOT_MS) invalidInput("Termin nije ispravan.");
    if (args.start < now + BOOKING_LEAD_MS) {
      // Usually a widget left open past the slot's lead time: for the visitor
      // the slot is simply gone, the same answer as a taken one.
      appError("SLOT_TAKEN", "Termin mora biti najmanje dva sata unapred.");
    }
    // PRD A5: the widget offers the next 14 days.
    if (args.start > now + BOOKING_DAYS * DAY_MS) {
      invalidInput("Termin se može zakazati najviše 14 dana unapred.");
    }

    // Sold and rented listings stay visible but take no bookings (PRD A5).
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing === null || !isListedScope(listing.scope)) {
      appError("NOT_FOUND", "Nekretnina nije pronađena.");
    }
    const agent = await ctx.db.get("agents", listing.agentId);
    if (agent === null || !agent.isPublic) appError("NOT_FOUND", "Agent nije pronađen.");

    // 1) the slot must be one step of the agent's hourly grid inside their
    //    weekly availability, compared in Belgrade wall-clock time.
    const wallStart = belgradeWall(args.start);
    const weekday = new Date(wallStart).getUTCDay();
    const intoDay = wallStart % DAY_MS;
    const onGrid = agent.availability.some((slot) => {
      if (slot.weekday !== weekday) return false;
      const from = parseHm(slot.from);
      const to = parseHm(slot.to);
      if (from === null || to === null) return false;
      return (
        intoDay >= from &&
        intoDay + VIEWING_SLOT_MS <= to &&
        (intoDay - from) % VIEWING_SLOT_MS === 0
      );
    });
    if (!onGrid) {
      appError("SLOT_TAKEN", "Izabrani termin nije u radnom vremenu agenta.");
    }

    // 2) the slot must not overlap a requested or confirmed viewing. The window
    //    is widened by the longest allowed slot so an evening viewing that runs
    //    past midnight still counts.
    const windowStart = args.start - (args.start % DAY_MS) - LONGEST_VIEWING_MS;
    const sameDay = await ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) =>
        q
          .eq("agentId", agent._id)
          .gte("start", windowStart)
          .lt("start", windowStart + DAY_MS + 2 * LONGEST_VIEWING_MS),
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
    // Fresh session keys are free for a script; an address is not.
    await consumeEmailLimit(ctx, "viewingPerEmail", email);

    const consent = {
      privacy: true,
      marketing: args.marketing,
      textVersion: CONSENT_TEXT_VERSION,
      at: now,
      channel: "web",
    };

    // A public form never changes an existing contact (see `leads.ts`): the
    // typed phone and this request's consent stay on the lead.
    const existing = await matchWebContact(ctx, email);

    let contactId;
    let submittedPhone: string | undefined;
    if (existing !== null) {
      // One open request per visitor and listing: the agent answers it before
      // the same address can hold a second slot on this property. The repeat
      // is answered like a success (see above) and the tokens stay spent.
      const open = await ctx.db
        .query("leads")
        .withIndex("by_contactId", (q) => q.eq("contactId", existing._id))
        .order("desc")
        .take(50);
      if (open.some((lead) => lead.type === "viewing" && lead.listingId === listing._id && lead.status === "new")) {
        return null;
      }
      contactId = existing._id;
      if (phone !== undefined && phone !== existing.phone) submittedPhone = phone;
    } else {
      contactId = await ctx.db.insert("contacts", {
        name,
        email,
        ...(phone !== undefined ? { phone } : {}),
        searchText: contactSearchText({ name, email, phone }),
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
      ...(submittedPhone !== undefined ? { submittedPhone } : {}),
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

    return null;
  },
});
