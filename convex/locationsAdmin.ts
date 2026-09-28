import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { slugify } from "./lib/slug";
import { imageV, l10nListV, l10nV, locationKindV } from "./lib/validators";

const CONTENT = ["admin", "manager", "editor"] as const;
const READERS = ["admin", "manager", "agent", "editor"] as const;

const rowV = v.object({
  _id: v.id("locations"),
  kind: locationKindV,
  parentId: v.optional(v.id("locations")),
  slug: v.string(),
  name: l10nV,
  intro: v.optional(l10nV),
  facts: v.optional(l10nListV),
  coverUrl: v.optional(v.string()),
  avgPricePerM2Sale: v.optional(v.number()),
  avgPricePerM2Rent: v.optional(v.number()),
  lat: v.number(),
  lng: v.number(),
  featured: v.boolean(),
  order: v.number(),
  saleCount: v.number(),
  rentCount: v.number(),
  isDemo: v.boolean(),
});

export const tree = query({
  args: {},
  returns: v.array(rowV),
  handler: async (ctx) => {
    await requireRole(ctx, READERS);
    const docs = await ctx.db.query("locations").take(600);
    docs.sort((a, b) => a.kind.localeCompare(b.kind) || a.order - b.order);

    const out = [];
    for (const doc of docs) {
      const counts = await ctx.db
        .query("locationCounts")
        .withIndex("by_locationId", (q) => q.eq("locationId", doc._id))
        .unique();
      const coverUrl =
        doc.cover === undefined
          ? null
          : doc.cover.kind === "url"
            ? doc.cover.url
            : await ctx.storage.getUrl(doc.cover.storageId);
      out.push({
        _id: doc._id,
        kind: doc.kind,
        ...(doc.parentId !== undefined ? { parentId: doc.parentId } : {}),
        slug: doc.slug,
        name: doc.name,
        ...(doc.intro !== undefined ? { intro: doc.intro } : {}),
        ...(doc.facts !== undefined ? { facts: doc.facts } : {}),
        ...(coverUrl !== null ? { coverUrl } : {}),
        ...(doc.avgPricePerM2Sale !== undefined
          ? { avgPricePerM2Sale: doc.avgPricePerM2Sale }
          : {}),
        ...(doc.avgPricePerM2Rent !== undefined
          ? { avgPricePerM2Rent: doc.avgPricePerM2Rent }
          : {}),
        lat: doc.lat,
        lng: doc.lng,
        featured: doc.featured,
        order: doc.order,
        saleCount: counts?.sale ?? 0,
        rentCount: counts?.rent ?? 0,
        isDemo: doc.isDemo,
      });
    }
    return out;
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("locations")),
    kind: locationKindV,
    parentId: v.optional(v.id("locations")),
    slug: v.optional(v.string()),
    name: l10nV,
    intro: v.optional(l10nV),
    facts: v.optional(l10nListV),
    cover: v.optional(imageV),
    avgPricePerM2Sale: v.optional(v.number()),
    avgPricePerM2Rent: v.optional(v.number()),
    lat: v.number(),
    lng: v.number(),
    featured: v.boolean(),
  },
  returns: v.object({ id: v.id("locations"), slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    if (args.name.sr.trim().length < 2) invalidInput("Naziv je obavezan.");
    if (args.kind !== "city" && args.parentId === undefined) {
      invalidInput("Opština i naselje moraju imati nadređenu lokaciju.");
    }
    if (args.parentId !== undefined) {
      const parent = await ctx.db.get("locations", args.parentId);
      if (parent === null) notFound("Nadređena lokacija");
      if (parent._id === args.id) invalidInput("Lokacija ne može biti sama sebi nadređena.");
    }
    if (Math.abs(args.lat) > 90 || Math.abs(args.lng) > 180) {
      invalidInput("Koordinate nisu ispravne.");
    }

    const base = args.slug !== undefined ? slugify(args.slug) : slugify(args.name.sr);
    let slug = base;
    let suffix = 2;
    for (;;) {
      const clash = await ctx.db
        .query("locations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (clash === null || clash._id === args.id) break;
      slug = `${base}-${suffix}`;
      suffix += 1;
      if (suffix > 30) break;
    }

    const fields = {
      kind: args.kind,
      parentId: args.parentId,
      slug,
      name: args.name,
      intro: args.intro,
      facts: args.facts,
      cover: args.cover,
      avgPricePerM2Sale: args.avgPricePerM2Sale,
      avgPricePerM2Rent: args.avgPricePerM2Rent,
      lat: args.lat,
      lng: args.lng,
      featured: args.featured,
    };

    if (args.id !== undefined) {
      const existing = await ctx.db.get("locations", args.id);
      if (existing === null) notFound("Lokacija");
      await ctx.db.patch("locations", args.id, fields);
      await logActivity(ctx, {
        entity: "location",
        entityId: args.id,
        action: "location.updated",
        summary: args.name.sr,
        by: viewer._id,
      });
      return { id: args.id, slug };
    }

    const siblings = await ctx.db
      .query("locations")
      .withIndex("by_kind_and_order", (q) => q.eq("kind", args.kind))
      .take(400);
    const id = await ctx.db.insert("locations", {
      ...fields,
      order: siblings.length,
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "location",
      entityId: id,
      action: "location.created",
      summary: args.name.sr,
      by: viewer._id,
    });
    return { id, slug };
  },
});

export const setAvg = mutation({
  args: {
    id: v.id("locations"),
    avgPricePerM2Sale: v.optional(v.number()),
    avgPricePerM2Rent: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await ctx.db.get("locations", args.id);
    if (doc === null) notFound("Lokacija");
    if (
      (args.avgPricePerM2Sale !== undefined && args.avgPricePerM2Sale < 0) ||
      (args.avgPricePerM2Rent !== undefined && args.avgPricePerM2Rent < 0)
    ) {
      invalidInput("Cena po m² ne može biti negativna.");
    }

    await ctx.db.patch("locations", args.id, {
      avgPricePerM2Sale: args.avgPricePerM2Sale,
      avgPricePerM2Rent: args.avgPricePerM2Rent,
    });
    await logActivity(ctx, {
      entity: "location",
      entityId: args.id,
      action: "location.avgPrice",
      summary: `${doc.name.sr}: ${args.avgPricePerM2Sale ?? "—"} €/m²`,
      by: viewer._id,
    });
    return null;
  },
});

export const reorder = mutation({
  args: { ids: v.array(v.id("locations")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    let order = 0;
    for (const id of args.ids) {
      const doc = await ctx.db.get("locations", id);
      if (doc === null) continue;
      await ctx.db.patch("locations", id, { order });
      order += 1;
    }
    await logActivity(ctx, {
      entity: "location",
      action: "location.reordered",
      by: viewer._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("locations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ["admin", "manager"]);
    const doc = await ctx.db.get("locations", args.id);
    if (doc === null) notFound("Lokacija");

    const children = await ctx.db
      .query("locations")
      .withIndex("by_parentId_and_order", (q) => q.eq("parentId", args.id))
      .take(1);
    if (children.length > 0) {
      invalidInput("Lokacija ima podređene lokacije. Prvo ih obrišite ili premestite.");
    }

    const used = await ctx.db
      .query("listings")
      .withIndex("by_scope_and_cityId_and_price", (q) =>
        q.eq("scope", "listed:sale").eq("cityId", args.id),
      )
      .take(1);
    if (used.length > 0) {
      invalidInput("Lokacija se koristi na objavljenim nekretninama.");
    }

    const counts = await ctx.db
      .query("locationCounts")
      .withIndex("by_locationId", (q) => q.eq("locationId", args.id))
      .unique();
    if (counts !== null) await ctx.db.delete("locationCounts", counts._id);

    if (doc.cover?.kind === "storage") await ctx.storage.delete(doc.cover.storageId);
    await ctx.db.delete("locations", args.id);

    await logActivity(ctx, {
      entity: "location",
      entityId: args.id,
      action: "location.deleted",
      summary: doc.name.sr,
      by: viewer._id,
    });
    return null;
  },
});
