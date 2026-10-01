import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { diffFields, logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { appError, invalidInput, notFound } from "./lib/errors";
import { type L10n, L10N_KEYS, l10nV } from "./lib/validators";

/**
 * Client testimonials (PRD B10). Anyone on the content team may write and
 * order them; only admin/manager may vouch for one (`setVerified`) — the one
 * switch that puts a testimonial on the public site — or delete it. Editing
 * the text of a verified testimonial takes it off the site until it is
 * confirmed again: a changed quote is not the quote the client approved.
 */

const CONTENT = ["admin", "manager", "editor"] as const;
const MANAGERS = ["admin", "manager"] as const;

/** The list is short by nature; this bounds every read of it. */
const MAX_TESTIMONIALS = 200;

const LIMITS = { quoteMin: 20, quote: 1000, author: 80, context: 120 } as const;

const testimonialV = v.object({
  _id: v.id("testimonials"),
  quote: l10nV,
  author: v.string(),
  context: v.optional(l10nV),
  verified: v.boolean(),
  order: v.number(),
  isDemo: v.boolean(),
});

async function inOrder(ctx: QueryCtx): Promise<Doc<"testimonials">[]> {
  return await ctx.db.query("testimonials").withIndex("by_order").take(MAX_TESTIMONIALS);
}

/** Trims every locale and drops empty translations. */
function cleanL10n(value: L10n): L10n {
  const out: L10n = { sr: value.sr.trim() };
  for (const locale of ["en", "ru", "de"] as const) {
    const text = value[locale]?.trim();
    if (text !== undefined && text.length > 0) out[locale] = text;
  }
  return out;
}

function checkLength(label: string, value: L10n, max: number): void {
  for (const locale of L10N_KEYS) {
    const text = value[locale];
    if (text !== undefined && text.length > max) {
      invalidInput(`${label} (${locale}) je predugačak — najviše ${max} znakova.`);
    }
  }
}

/** Per-locale leaves, so the change log says which translation changed. */
function snapshot(doc: { quote: L10n; author: string; context?: L10n }): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { author: doc.author };
  for (const locale of L10N_KEYS) {
    out[`quote.${locale}`] = doc.quote[locale];
    out[`context.${locale}`] = doc.context?.[locale];
  }
  return out;
}

export const listAll = query({
  args: {},
  returns: v.array(testimonialV),
  handler: async (ctx) => {
    await requireRole(ctx, CONTENT);
    const docs = await inOrder(ctx);
    return docs.map((doc) => ({
      _id: doc._id,
      quote: doc.quote,
      author: doc.author,
      ...(doc.context !== undefined ? { context: doc.context } : {}),
      verified: doc.verified,
      order: doc.order,
      isDemo: doc.isDemo,
    }));
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("testimonials")),
    quote: l10nV,
    author: v.string(),
    context: v.optional(l10nV),
  },
  returns: v.object({ id: v.id("testimonials"), unverified: v.boolean() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const author = args.author.trim();
    const quote = cleanL10n(args.quote);
    const contextValue = args.context !== undefined ? cleanL10n(args.context) : undefined;
    const context = contextValue !== undefined && contextValue.sr.length > 0 ? contextValue : undefined;

    if (author.length < 2) invalidInput("Ime klijenta je obavezno.");
    if (author.length > LIMITS.author) invalidInput(`Ime klijenta je predugačko — najviše ${LIMITS.author} znakova.`);
    if (quote.sr.length < LIMITS.quoteMin) invalidInput("Citat na srpskom je prekratak.");
    checkLength("Citat", quote, LIMITS.quote);
    if (context !== undefined) checkLength("Kontekst", context, LIMITS.context);

    const fields = { quote, author, context };

    if (args.id !== undefined) {
      const existing = await ctx.db.get("testimonials", args.id);
      if (existing === null) notFound("Preporuka");
      const diff = diffFields(snapshot(existing), snapshot(fields));
      // A changed text is not what the client approved: it leaves the site
      // until a manager confirms it again. An unchanged save keeps the status.
      const unverified = existing.verified && diff.length > 0;
      await ctx.db.patch("testimonials", args.id, {
        ...fields,
        ...(unverified ? { verified: false } : {}),
      });
      await logActivity(ctx, {
        entity: "testimonial",
        entityId: args.id,
        action: "testimonial.updated",
        summary: unverified ? `${author} (potvrda skinuta)` : author,
        diff,
        by: viewer._id,
      });
      return { id: args.id, unverified };
    }

    // The list (and every bounded read of it) stops at 200.
    const all = await inOrder(ctx);
    if (all.length >= MAX_TESTIMONIALS) {
      invalidInput(`Dostignut je najveći broj preporuka (${MAX_TESTIMONIALS}). Obrišite neku pre nego što dodate novu.`);
    }
    const last = all.at(-1);
    const id = await ctx.db.insert("testimonials", {
      ...fields,
      // Never public until someone confirms the client really said it.
      verified: false,
      order: last !== undefined ? last.order + 1 : 0,
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "testimonial",
      entityId: id,
      action: "testimonial.created",
      summary: author,
      by: viewer._id,
    });
    return { id, unverified: false };
  },
});

/**
 * The gate that puts a testimonial on the public site. Only admin/manager may
 * flip it, and the activity log records who vouched for it.
 *
 * Confirming carries the text the manager actually read (`reviewed`): if an
 * editor changed the testimonial in the meantime, the confirmation would
 * otherwise publish words nobody checked, so it is refused with CONFLICT.
 */
export const setVerified = mutation({
  args: {
    id: v.id("testimonials"),
    verified: v.boolean(),
    /** Required to confirm (`verified: true`); ignored when taking one down. */
    reviewed: v.optional(v.object({ author: v.string(), quote: l10nV, context: v.optional(l10nV) })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("testimonials", args.id);
    if (doc === null) notFound("Preporuka");
    if (args.verified && doc.isDemo) {
      invalidInput(
        "Demo preporuka se ne može potvrditi. Unesite stvarnu preporuku klijenta.",
      );
    }
    if (args.verified) {
      if (args.reviewed === undefined) invalidInput("Potvrda mora da navede tekst koji ste pročitali.");
      if (diffFields(snapshot(doc), snapshot(args.reviewed)).length > 0) {
        appError(
          "CONFLICT",
          "Preporuka je u međuvremenu izmenjena. Pročitajte novu verziju pre nego što je potvrdite.",
        );
      }
    }
    if (doc.verified === args.verified) return null;

    await ctx.db.patch("testimonials", args.id, { verified: args.verified });
    await logActivity(ctx, {
      entity: "testimonial",
      entityId: args.id,
      action: args.verified ? "testimonial.verified" : "testimonial.unverified",
      summary: doc.author,
      diff: [{ field: "verified", from: doc.verified ? "da" : "ne", to: args.verified ? "da" : "ne" }],
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Moves one testimonial a place up or down, then renumbers the list 0..n-1 so
 * ties left by older data cannot make a move a no-op.
 */
export const move = mutation({
  args: { id: v.id("testimonials"), direction: v.union(v.literal("up"), v.literal("down")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const docs = await inOrder(ctx);
    const index = docs.findIndex((doc) => doc._id === args.id);
    if (index === -1) notFound("Preporuka");
    const target = args.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= docs.length) return null;

    const reordered = [...docs];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    for (const [order, doc] of reordered.entries()) {
      if (doc.order !== order) await ctx.db.patch("testimonials", doc._id, { order });
    }
    await logActivity(ctx, {
      entity: "testimonial",
      entityId: args.id,
      action: "testimonial.reordered",
      summary: docs[index].author,
      diff: [{ field: "order", from: String(index + 1), to: String(target + 1) }],
      by: viewer._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("testimonials") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("testimonials", args.id);
    if (doc === null) notFound("Preporuka");
    await ctx.db.delete("testimonials", args.id);
    await logActivity(ctx, {
      entity: "testimonial",
      entityId: args.id,
      action: "testimonial.deleted",
      summary: doc.author,
      by: viewer._id,
    });
    return null;
  },
});
