import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { slugify } from "./lib/slug";
import { availabilitySlotV, imageV, l10nV } from "./lib/validators";

const MANAGERS = ["admin", "manager"] as const;
const READERS = ["admin", "manager", "agent", "editor"] as const;

const agentAdminRowV = v.object({
  _id: v.id("agents"),
  slug: v.string(),
  name: v.string(),
  role: l10nV,
  bio: v.optional(l10nV),
  photoUrl: v.optional(v.string()),
  languages: v.array(v.string()),
  phone: v.optional(v.string()),
  viber: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  email: v.optional(v.string()),
  areas: v.array(v.id("locations")),
  licenseId: v.optional(v.string()),
  isPublic: v.boolean(),
  order: v.number(),
  availability: v.array(availabilitySlotV),
  userId: v.optional(v.id("users")),
  listingCount: v.number(),
  isDemo: v.boolean(),
});

export const list = query({
  args: {},
  returns: v.array(agentAdminRowV),
  handler: async (ctx) => {
    await requireRole(ctx, READERS);
    const docs = await ctx.db.query("agents").take(200);
    docs.sort((a, b) => a.order - b.order);

    const out = [];
    for (const doc of docs) {
      const photoUrl =
        doc.photo === undefined
          ? null
          : doc.photo.kind === "url"
            ? doc.photo.url
            : await ctx.storage.getUrl(doc.photo.storageId);
      const listings = await ctx.db
        .query("listings")
        .withIndex("by_agentId", (q) => q.eq("agentId", doc._id))
        .take(300);
      out.push({
        _id: doc._id,
        slug: doc.slug,
        name: doc.name,
        role: doc.role,
        ...(doc.bio !== undefined ? { bio: doc.bio } : {}),
        ...(photoUrl !== null ? { photoUrl } : {}),
        languages: doc.languages,
        ...(doc.phone !== undefined ? { phone: doc.phone } : {}),
        ...(doc.viber !== undefined ? { viber: doc.viber } : {}),
        ...(doc.whatsapp !== undefined ? { whatsapp: doc.whatsapp } : {}),
        ...(doc.email !== undefined ? { email: doc.email } : {}),
        areas: doc.areas,
        ...(doc.licenseId !== undefined ? { licenseId: doc.licenseId } : {}),
        isPublic: doc.isPublic,
        order: doc.order,
        availability: doc.availability,
        ...(doc.userId !== undefined ? { userId: doc.userId } : {}),
        listingCount: listings.length,
        isDemo: doc.isDemo,
      });
    }
    return out;
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("agents")),
    name: v.string(),
    slug: v.optional(v.string()),
    role: l10nV,
    bio: v.optional(l10nV),
    photo: v.optional(imageV),
    languages: v.array(v.string()),
    phone: v.optional(v.string()),
    viber: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    email: v.optional(v.string()),
    areas: v.array(v.id("locations")),
    licenseId: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  returns: v.object({ id: v.id("agents"), slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const name = args.name.trim();
    if (name.length < 2) invalidInput("Ime agenta je obavezno.");

    const base = args.slug !== undefined ? slugify(args.slug) : slugify(name);
    let slug = base;
    let suffix = 2;
    for (;;) {
      const clash = await ctx.db
        .query("agents")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (clash === null || clash._id === args.id) break;
      slug = `${base}-${suffix}`;
      suffix += 1;
      if (suffix > 30) break;
    }

    const fields = {
      slug,
      name,
      role: args.role,
      ...(args.bio !== undefined ? { bio: args.bio } : {}),
      photo: args.photo,
      languages: args.languages.slice(0, 8),
      phone: args.phone,
      viber: args.viber,
      whatsapp: args.whatsapp,
      email: args.email,
      areas: args.areas.slice(0, 20),
      licenseId: args.licenseId,
      isPublic: args.isPublic,
    };

    if (args.id !== undefined) {
      const existing = await ctx.db.get("agents", args.id);
      if (existing === null) notFound("Agent");
      await ctx.db.patch("agents", args.id, fields);
      await logActivity(ctx, {
        entity: "agent",
        entityId: args.id,
        action: "agent.updated",
        summary: name,
        by: viewer._id,
      });
      return { id: args.id, slug };
    }

    const siblings = await ctx.db.query("agents").take(200);
    const id = await ctx.db.insert("agents", {
      ...fields,
      order: siblings.length,
      availability: [
        { weekday: 1, from: "09:00", to: "17:00" },
        { weekday: 2, from: "09:00", to: "17:00" },
        { weekday: 3, from: "09:00", to: "17:00" },
        { weekday: 4, from: "09:00", to: "17:00" },
        { weekday: 5, from: "09:00", to: "16:00" },
      ],
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "agent",
      entityId: id,
      action: "agent.created",
      summary: name,
      by: viewer._id,
    });
    return { id, slug };
  },
});

export const setAvailability = mutation({
  args: { id: v.id("agents"), availability: v.array(availabilitySlotV) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ["admin", "manager", "agent"]);
    const agent = await ctx.db.get("agents", args.id);
    if (agent === null) notFound("Agent");
    if (viewer.role === "agent" && viewer.agentId !== args.id) {
      invalidInput("Možete menjati samo svoje radno vreme.");
    }

    for (const slot of args.availability) {
      if (slot.weekday < 0 || slot.weekday > 6) {
        invalidInput("Dan u nedelji mora biti 0–6.");
      }
      if (!/^\d{1,2}:\d{2}$/.test(slot.from) || !/^\d{1,2}:\d{2}$/.test(slot.to)) {
        invalidInput("Vreme se unosi u formatu HH:MM.");
      }
      if (slot.to <= slot.from) invalidInput("Kraj mora biti posle početka.");
    }

    await ctx.db.patch("agents", args.id, {
      availability: args.availability.slice(0, 40),
    });
    await logActivity(ctx, {
      entity: "agent",
      entityId: args.id,
      action: "agent.availability",
      summary: agent.name,
      by: viewer._id,
    });
    return null;
  },
});

export const reorder = mutation({
  args: { ids: v.array(v.id("agents")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    let order = 0;
    for (const id of args.ids) {
      const doc = await ctx.db.get("agents", id);
      if (doc === null) continue;
      await ctx.db.patch("agents", id, { order });
      order += 1;
    }
    await logActivity(ctx, {
      entity: "agent",
      action: "agent.reordered",
      by: viewer._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const agent = await ctx.db.get("agents", args.id);
    if (agent === null) notFound("Agent");

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.id))
      .take(1);
    if (listings.length > 0) {
      invalidInput(
        "Agent ima dodeljene nekretnine. Prvo ih prebacite na drugog agenta.",
      );
    }

    if (agent.photo?.kind === "storage") {
      await ctx.storage.delete(agent.photo.storageId);
    }
    if (agent.userId !== undefined) {
      await ctx.db.patch("users", agent.userId, { agentId: undefined });
    }
    await ctx.db.delete("agents", args.id);
    await logActivity(ctx, {
      entity: "agent",
      entityId: args.id,
      action: "agent.deleted",
      summary: agent.name,
      by: viewer._id,
    });
    return null;
  },
});
