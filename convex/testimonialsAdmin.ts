import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { l10nV } from "./lib/validators";

const CONTENT = ["admin", "manager", "editor"] as const;
const MANAGERS = ["admin", "manager"] as const;

export const listAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("testimonials"),
      quote: l10nV,
      author: v.string(),
      context: v.optional(l10nV),
      verified: v.boolean(),
      order: v.number(),
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, CONTENT);
    const docs = await ctx.db.query("testimonials").take(200);
    docs.sort((a, b) => a.order - b.order);
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
  returns: v.object({ id: v.id("testimonials") }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const author = args.author.trim();
    if (author.length < 2) invalidInput("Ime klijenta je obavezno.");
    if (args.quote.sr.trim().length < 20) invalidInput("Citat je prekratak.");

    const fields = { quote: args.quote, author, context: args.context };

    if (args.id !== undefined) {
      const existing = await ctx.db.get("testimonials", args.id);
      if (existing === null) notFound("Preporuka");
      // Editing the text invalidates the verification: it must be re-checked.
      await ctx.db.patch("testimonials", args.id, { ...fields, verified: false });
      await logActivity(ctx, {
        entity: "testimonial",
        entityId: args.id,
        action: "testimonial.updated",
        summary: author,
        by: viewer._id,
      });
      return { id: args.id };
    }

    const siblings = await ctx.db.query("testimonials").take(200);
    const id = await ctx.db.insert("testimonials", {
      ...fields,
      // Never public until someone confirms the client really said it.
      verified: false,
      order: siblings.length,
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "testimonial",
      entityId: id,
      action: "testimonial.created",
      summary: author,
      by: viewer._id,
    });
    return { id };
  },
});

/**
 * The gate that puts a testimonial on the public site. Only admin/manager may
 * flip it, and the activity log records who vouched for it.
 */
export const setVerified = mutation({
  args: { id: v.id("testimonials"), verified: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("testimonials", args.id);
    if (doc === null) notFound("Preporuka");
    if (args.verified && doc.isDemo) {
      invalidInput(
        "Demo preporuka se ne može verifikovati. Unesite stvarnu preporuku klijenta.",
      );
    }

    await ctx.db.patch("testimonials", args.id, { verified: args.verified });
    await logActivity(ctx, {
      entity: "testimonial",
      entityId: args.id,
      action: args.verified ? "testimonial.verified" : "testimonial.unverified",
      summary: doc.author,
      by: viewer._id,
    });
    return null;
  },
});

export const reorder = mutation({
  args: { ids: v.array(v.id("testimonials")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    let order = 0;
    for (const id of args.ids) {
      const doc = await ctx.db.get("testimonials", id);
      if (doc === null) continue;
      await ctx.db.patch("testimonials", id, { order });
      order += 1;
    }
    await logActivity(ctx, {
      entity: "testimonial",
      action: "testimonial.reordered",
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
