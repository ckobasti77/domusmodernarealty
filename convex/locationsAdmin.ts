import type { PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { locationIsReferenced } from "./demo";
import { diffFields, logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { applyDerived, locationNamesFor } from "./lib/derive";
import { imageUrl } from "./lib/dto";
import { appError, invalidInput } from "./lib/errors";
import { scopeKey } from "./lib/search";
import { slugify } from "./lib/slug";
import { assertImageRef, releaseReplacedImage } from "./lib/storage";
import { imageV, L10N_KEYS, l10nListV, l10nV, locationKindV } from "./lib/validators";
import type { diffEntryV, ImageRef, L10n, L10nList, LocationKind } from "./lib/validators";

/**
 * Admin for the location tree (PRD B8): city → municipality → neighborhood.
 *
 * Listings point at locations by id (`cityId`, `municipalityId`,
 * `neighborhoodId`), so renaming a place or changing its slug never orphans a
 * listing. What does depend on the slug is public: `/lokacije/<slug>` and the
 * search's `?location=<slug>` filter; the editor warns before it changes.
 */

const CONTENT = ["admin", "manager", "editor"] as const;
const READERS = ["admin", "manager", "agent", "editor"] as const;
const DELETERS = ["admin", "manager"] as const;

const KINDS = ["city", "municipality", "neighborhood"] as const;

/** Which kinds may hold a location of each kind. A city is always a root. */
const PARENT_KINDS: Record<LocationKind, readonly LocationKind[]> = {
  city: [],
  municipality: ["city"],
  neighborhood: ["municipality", "city"],
};

/** Per kind; Serbia's cities, municipalities and neighborhoods stay far below it. */
const MAX_PER_KIND = 500;
/** Children of one node (Belgrade has 17 municipalities). */
const MAX_SIBLINGS = 200;

/** A generous box around Serbia (same box the listing editor warns with). */
const SERBIA = { latMin: 41.8, latMax: 46.3, lngMin: 18.8, lngMax: 23.1 } as const;

const NAME_MAX = 80;
const INTRO_MAX = 1500;
const FACTS_MAX = 12;
const FACT_MAX = 200;
const SLUG_MIN = 2;
/** €/m²: the priciest Belgrade new-builds ask about 10.000; rent is per month. */
const SALE_MAX = 50_000;
const RENT_MAX = 500;

const REINDEX_BATCH = 100;
/** Every listing scope, so the re-index reaches drafts and closed listings too. */
const ALL_SCOPES = (["listed", "closed", "hidden"] as const).flatMap((bucket) =>
  (["sale", "rent"] as const).map((transaction) => scopeKey(bucket, transaction)),
);

/* ----------------------------------------------------------------- helpers */

function locationNotFound(): never {
  return appError("NOT_FOUND", "Lokacija nije pronađena.");
}

async function countsOf(
  ctx: QueryCtx,
  locationId: Id<"locations">,
): Promise<{ sale: number; rent: number }> {
  const row = await ctx.db
    .query("locationCounts")
    .withIndex("by_locationId", (q) => q.eq("locationId", locationId))
    .unique();
  return { sale: row?.sale ?? 0, rent: row?.rent ?? 0 };
}

/** Siblings in display order: the cities, or the children of one parent. */
async function siblingsOf(
  ctx: QueryCtx,
  parentId: Id<"locations"> | undefined,
): Promise<Doc<"locations">[]> {
  if (parentId === undefined) {
    return await ctx.db
      .query("locations")
      .withIndex("by_kind_and_order", (q) => q.eq("kind", "city"))
      .take(MAX_SIBLINGS + 1);
  }
  return await ctx.db
    .query("locations")
    .withIndex("by_parentId_and_order", (q) => q.eq("parentId", parentId))
    .take(MAX_SIBLINGS + 1);
}

/** The next free `order`; unique across the table so the featured list stays stable. */
async function nextOrder(ctx: QueryCtx): Promise<number> {
  let max = -1;
  for (const kind of KINDS) {
    const last = await ctx.db
      .query("locations")
      .withIndex("by_kind_and_order", (q) => q.eq("kind", kind))
      .order("desc")
      .first();
    if (last !== null && last.order > max) max = last.order;
  }
  return max + 1;
}

/** Throws unless `parentId` names a location that may hold a `kind`. */
async function validateParent(
  ctx: QueryCtx,
  kind: LocationKind,
  parentId: Id<"locations"> | undefined,
): Promise<Doc<"locations"> | null> {
  const allowed = PARENT_KINDS[kind];
  if (allowed.length === 0) {
    if (parentId !== undefined) invalidInput("Grad je lokacija najvišeg nivoa i nema nadređenu lokaciju.");
    return null;
  }
  if (parentId === undefined) {
    invalidInput(
      kind === "municipality"
        ? "Opština mora pripadati gradu."
        : "Naselje mora pripadati opštini ili gradu.",
    );
  }
  const parent = await ctx.db.get("locations", parentId);
  if (parent === null) appError("NOT_FOUND", "Nadređena lokacija nije pronađena.");
  if (!allowed.includes(parent.kind)) {
    invalidInput(
      kind === "municipality"
        ? "Opština može pripadati samo gradu."
        : "Naselje može pripadati samo opštini ili gradu.",
    );
  }
  return parent;
}

function cleanL10n(value: L10n, max: number, what: string): L10n {
  const out: L10n = { sr: value.sr.trim() };
  for (const key of ["en", "ru", "de"] as const) {
    const text = value[key]?.trim() ?? "";
    if (text.length > 0) out[key] = text;
  }
  for (const key of L10N_KEYS) {
    if ((out[key]?.length ?? 0) > max) invalidInput(`${what} može imati najviše ${max} znakova.`);
  }
  return out;
}

/** Undefined when every locale is empty, so the field is removed. */
function cleanOptionalL10n(value: L10n | undefined, max: number, what: string): L10n | undefined {
  if (value === undefined) return undefined;
  const out = cleanL10n(value, max, what);
  const filled = L10N_KEYS.some((key) => (out[key]?.length ?? 0) > 0);
  if (!filled) return undefined;
  if (out.sr.length === 0) invalidInput(`${what}: srpski tekst je obavezan kada postoji prevod.`);
  return out;
}

function cleanFacts(value: L10nList | undefined): L10nList | undefined {
  if (value === undefined) return undefined;
  const clean = (items: readonly string[] | undefined): string[] => {
    const list = (items ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
    if (list.length > FACTS_MAX) invalidInput(`Najviše ${FACTS_MAX} činjenica po jeziku.`);
    if (list.some((item) => item.length > FACT_MAX)) {
      invalidInput(`Jedna činjenica može imati najviše ${FACT_MAX} znakova.`);
    }
    return list;
  };
  const out: L10nList = { sr: clean(value.sr) };
  for (const key of ["en", "ru", "de"] as const) {
    const list = clean(value[key]);
    if (list.length > 0) out[key] = list;
  }
  const filled = L10N_KEYS.some((key) => (out[key]?.length ?? 0) > 0);
  if (!filled) return undefined;
  if (out.sr.length === 0) invalidInput("Činjenice: srpska lista je obavezna kada postoji prevod.");
  return out;
}

function cleanPrice(value: number | undefined, max: number, what: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) invalidInput(`${what} ne može biti negativna.`);
  if (value > max) invalidInput(`${what} je nerealno visoka (najviše ${max} €/m²).`);
  if (value === 0) return undefined;
  return Math.round(value * 100) / 100;
}

function assertInSerbia(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) invalidInput("Koordinate nisu ispravne.");
  if (lat < SERBIA.latMin || lat > SERBIA.latMax || lng < SERBIA.lngMin || lng > SERBIA.lngMax) {
    invalidInput(
      "Središte lokacije mora biti u Srbiji. Proverite da geografska širina i dužina nisu zamenjene.",
    );
  }
}

function sameImage(a: ImageRef | undefined, b: ImageRef | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind === "storage") return b.kind === "storage" && a.storageId === b.storageId;
  return b.kind === "url" && a.url === b.url;
}

async function slugTaken(
  ctx: QueryCtx,
  slug: string,
  self: Id<"locations"> | undefined,
): Promise<boolean> {
  const clash = await ctx.db
    .query("locations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return clash !== null && clash._id !== self;
}

/**
 * An explicit slug must be free (it is a public URL, so it never silently
 * becomes something else). Without one, a new location derives it from the
 * Serbian name and appends `-2`, `-3`… on a clash; an existing one keeps its
 * slug, so renaming a place never moves its page.
 */
async function resolveSlug(
  ctx: QueryCtx,
  requested: string | undefined,
  existing: Doc<"locations"> | null,
  nameSr: string,
): Promise<string> {
  if (requested !== undefined) {
    const slug = slugify(requested);
    if (slug.length < SLUG_MIN || slug === "x") invalidInput("Adresa (slug) mora imati bar dva slova ili broja.");
    if (existing !== null && slug === existing.slug) return slug;
    if (await slugTaken(ctx, slug, existing?._id)) {
      appError("CONFLICT", `Adresa „${slug}” je već zauzeta. Izaberite drugu.`);
    }
    return slug;
  }
  if (existing !== null) return existing.slug;

  const base = slugify(nameSr);
  for (let suffix = 1; suffix <= 30; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    if (!(await slugTaken(ctx, slug, undefined))) return slug;
  }
  return appError("CONFLICT", "Nije moguće napraviti jedinstvenu adresu. Unesite je ručno.");
}

/**
 * Listings store city, municipality and neighborhood separately, so moving a
 * location that listings use (or whose children they use) would leave them
 * pointing at a hierarchy that no longer exists.
 */
async function assertMovable(ctx: QueryCtx, doc: Doc<"locations">): Promise<void> {
  const message =
    "Nadređenu lokaciju nije moguće promeniti dok je koriste nekretnine. Prvo ih prebacite na drugu lokaciju.";
  if (await locationIsReferenced(ctx, doc._id)) invalidInput(message);
  const children = await ctx.db
    .query("locations")
    .withIndex("by_parentId_and_order", (q) => q.eq("parentId", doc._id))
    .take(MAX_SIBLINGS);
  for (const child of children) {
    if (await locationIsReferenced(ctx, child._id)) invalidInput(message);
  }
}

/** Strictly increasing slots from the siblings' current (sorted) orders. */
function orderSlots(sorted: readonly number[]): number[] {
  const slots: number[] = [];
  for (const value of sorted) {
    const previous = slots.at(-1);
    slots.push(previous === undefined ? value : Math.max(value, previous + 1));
  }
  return slots;
}

type DiffEntry = Infer<typeof diffEntryV>;

type Snapshot = {
  parentName?: string | undefined;
  slug: string;
  name: L10n;
  intro?: L10n | undefined;
  facts?: L10nList | undefined;
  cover?: ImageRef | undefined;
  avgPricePerM2Sale?: number | undefined;
  avgPricePerM2Rent?: number | undefined;
  lat: number;
  lng: number;
  featured: boolean;
};

/** Flat, per-locale view for the change log (`name.sr`, `intro.en`, …). */
function flatten(snapshot: Snapshot): Record<string, unknown> {
  const out: Record<string, unknown> = {
    parent: snapshot.parentName,
    slug: snapshot.slug,
    cover:
      snapshot.cover === undefined
        ? undefined
        : snapshot.cover.kind === "url"
          ? snapshot.cover.url
          : `otpremljena slika ${snapshot.cover.storageId}`,
    avgPricePerM2Sale: snapshot.avgPricePerM2Sale,
    avgPricePerM2Rent: snapshot.avgPricePerM2Rent,
    lat: snapshot.lat,
    lng: snapshot.lng,
    featured: snapshot.featured,
  };
  for (const key of L10N_KEYS) {
    out[`name.${key}`] = snapshot.name[key];
    out[`intro.${key}`] = snapshot.intro?.[key];
    out[`facts.${key}`] = snapshot.facts?.[key]?.join(" · ");
  }
  return out;
}

/**
 * `diffFields` compares values cut to 200 characters, so an edit late in a
 * long intro would vanish from the log; such fields are listed as changed.
 */
function snapshotDiff(before: Snapshot, after: Snapshot): DiffEntry[] {
  const from = flatten(before);
  const to = flatten(after);
  const entries = diffFields(from, to);
  const reported = new Set(entries.map((entry) => entry.field));
  for (const field of Object.keys(to)) {
    if (reported.has(field)) continue;
    if (JSON.stringify(from[field]) !== JSON.stringify(to[field])) {
      entries.push({ field, to: "izmenjeno (posle 200. znaka)" });
    }
  }
  return entries;
}

function sameL10n(a: L10n, b: L10n): boolean {
  return L10N_KEYS.every((key) => (a[key] ?? "") === (b[key] ?? ""));
}

/* ----------------------------------------------------------------- queries */

const treeRowV = v.object({
  _id: v.id("locations"),
  /** The index tiebreak after `order`, so the client sorts siblings like the server. */
  _creationTime: v.number(),
  kind: locationKindV,
  parentId: v.optional(v.id("locations")),
  slug: v.string(),
  name: l10nV,
  avgPricePerM2Sale: v.optional(v.number()),
  avgPricePerM2Rent: v.optional(v.number()),
  lat: v.number(),
  lng: v.number(),
  featured: v.boolean(),
  order: v.number(),
  hasCover: v.boolean(),
  saleCount: v.number(),
  rentCount: v.number(),
  isDemo: v.boolean(),
});

/** The whole tree, every kind in sibling order, with the public listing counts. */
export const tree = query({
  args: {},
  returns: v.array(treeRowV),
  handler: async (ctx) => {
    await requireRole(ctx, READERS);
    const out = [];
    for (const kind of KINDS) {
      const docs = await ctx.db
        .query("locations")
        .withIndex("by_kind_and_order", (q) => q.eq("kind", kind))
        .take(MAX_PER_KIND);
      for (const doc of docs) {
        const counts = await countsOf(ctx, doc._id);
        out.push({
          _id: doc._id,
          _creationTime: doc._creationTime,
          kind: doc.kind,
          ...(doc.parentId !== undefined ? { parentId: doc.parentId } : {}),
          slug: doc.slug,
          name: doc.name,
          ...(doc.avgPricePerM2Sale !== undefined ? { avgPricePerM2Sale: doc.avgPricePerM2Sale } : {}),
          ...(doc.avgPricePerM2Rent !== undefined ? { avgPricePerM2Rent: doc.avgPricePerM2Rent } : {}),
          lat: doc.lat,
          lng: doc.lng,
          featured: doc.featured,
          order: doc.order,
          hasCover: doc.cover !== undefined,
          saleCount: counts.sale,
          rentCount: counts.rent,
          isDemo: doc.isDemo,
        });
      }
    }
    return out;
  },
});

/** One location for the editor, with what decides whether it can move or go. */
export const get = query({
  args: { id: v.id("locations") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("locations"),
      kind: locationKindV,
      parentId: v.optional(v.id("locations")),
      slug: v.string(),
      name: l10nV,
      intro: v.optional(l10nV),
      facts: v.optional(l10nListV),
      cover: v.optional(imageV),
      coverUrl: v.optional(v.string()),
      avgPricePerM2Sale: v.optional(v.number()),
      avgPricePerM2Rent: v.optional(v.number()),
      lat: v.number(),
      lng: v.number(),
      featured: v.boolean(),
      order: v.number(),
      isDemo: v.boolean(),
      saleCount: v.number(),
      rentCount: v.number(),
      /** Some listing (any status, drafts included) points at it. */
      inUse: v.boolean(),
      hasChildren: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, CONTENT);
    const doc = await ctx.db.get("locations", args.id);
    if (doc === null) return null;
    const counts = await countsOf(ctx, doc._id);
    const coverUrl = doc.cover !== undefined ? await imageUrl(ctx, doc.cover) : null;
    const children = await ctx.db
      .query("locations")
      .withIndex("by_parentId_and_order", (q) => q.eq("parentId", doc._id))
      .take(1);
    return {
      _id: doc._id,
      kind: doc.kind,
      ...(doc.parentId !== undefined ? { parentId: doc.parentId } : {}),
      slug: doc.slug,
      name: doc.name,
      ...(doc.intro !== undefined ? { intro: doc.intro } : {}),
      ...(doc.facts !== undefined ? { facts: doc.facts } : {}),
      ...(doc.cover !== undefined ? { cover: doc.cover } : {}),
      ...(coverUrl !== null ? { coverUrl } : {}),
      ...(doc.avgPricePerM2Sale !== undefined ? { avgPricePerM2Sale: doc.avgPricePerM2Sale } : {}),
      ...(doc.avgPricePerM2Rent !== undefined ? { avgPricePerM2Rent: doc.avgPricePerM2Rent } : {}),
      lat: doc.lat,
      lng: doc.lng,
      featured: doc.featured,
      order: doc.order,
      isDemo: doc.isDemo,
      saleCount: counts.sale,
      rentCount: counts.rent,
      inUse: await locationIsReferenced(ctx, doc._id),
      hasChildren: children.length > 0,
    };
  },
});

/* --------------------------------------------------------------- mutations */

export const upsert = mutation({
  args: {
    id: v.optional(v.id("locations")),
    kind: locationKindV,
    parentId: v.optional(v.id("locations")),
    /** Omit to keep the current slug (update) or derive it from the name (create). */
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

    const existing = args.id !== undefined ? await ctx.db.get("locations", args.id) : null;
    if (args.id !== undefined && existing === null) locationNotFound();
    if (existing !== null && existing.kind !== args.kind) {
      invalidInput("Vrsta lokacije se ne menja. Dodajte novu lokaciju odgovarajuće vrste.");
    }

    const parent = await validateParent(ctx, args.kind, args.parentId);
    const name = cleanL10n(args.name, NAME_MAX, "Naziv");
    if (name.sr.length < 2) invalidInput("Unesite naziv na srpskom (najmanje 2 znaka).");
    const intro = cleanOptionalL10n(args.intro, INTRO_MAX, "Uvodni tekst");
    const facts = cleanFacts(args.facts);
    const avgPricePerM2Sale = cleanPrice(args.avgPricePerM2Sale, SALE_MAX, "Prosečna cena");
    const avgPricePerM2Rent = cleanPrice(args.avgPricePerM2Rent, RENT_MAX, "Prosečna zakupnina");
    assertInSerbia(args.lat, args.lng);
    if (args.cover !== undefined && !sameImage(existing?.cover, args.cover)) {
      await assertImageRef(ctx, args.cover);
    }
    const slug = await resolveSlug(ctx, args.slug, existing, name.sr);
    if (existing !== null && existing.parentId !== args.parentId) await assertMovable(ctx, existing);

    const fields = {
      kind: args.kind,
      parentId: parent?._id,
      slug,
      name,
      intro,
      facts,
      cover: args.cover,
      avgPricePerM2Sale,
      avgPricePerM2Rent,
      lat: args.lat,
      lng: args.lng,
      featured: args.featured,
    };
    const after: Snapshot = { ...fields, parentName: parent?.name.sr };

    if (existing !== null) {
      const previousParent =
        existing.parentId !== undefined ? await ctx.db.get("locations", existing.parentId) : null;
      await releaseReplacedImage(ctx, existing.cover, args.cover);
      // Editing a seeded location makes it the agency's own content.
      await ctx.db.patch("locations", existing._id, { ...fields, isDemo: false });
      await logActivity(ctx, {
        entity: "location",
        entityId: existing._id,
        action: "location.updated",
        summary: name.sr,
        diff: snapshotDiff({ ...existing, parentName: previousParent?.name.sr }, after),
        by: viewer._id,
      });
      // Listing search text carries every locale of the location names.
      if (!sameL10n(existing.name, name)) {
        await ctx.scheduler.runAfter(0, internal.locationsAdmin.reindexListings, {
          locationId: existing._id,
          step: 0,
          cursor: null,
        });
      }
      return { id: existing._id, slug };
    }

    const id = await ctx.db.insert("locations", {
      ...fields,
      order: await nextOrder(ctx),
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "location",
      entityId: id,
      action: "location.created",
      summary: parent !== null ? `${name.sr} (${parent.name.sr})` : name.sr,
      by: viewer._id,
    });
    return { id, slug };
  },
});

/**
 * Sets the order of one level of the tree: the cities (`parentId` omitted) or
 * the children of one location. `ids` must be exactly that level, so a stale
 * list is refused instead of half-applied. The level keeps its own `order`
 * values, only permuted, so other orderings built on them stay stable.
 */
export const reorder = mutation({
  args: {
    parentId: v.optional(v.id("locations")),
    ids: v.array(v.id("locations")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    if (args.ids.length === 0 || args.ids.length > MAX_SIBLINGS) {
      invalidInput(`Redosled se zadaje za 1 do ${MAX_SIBLINGS} lokacija.`);
    }

    const parent = args.parentId !== undefined ? await ctx.db.get("locations", args.parentId) : null;
    if (args.parentId !== undefined && parent === null) {
      appError("NOT_FOUND", "Nadređena lokacija nije pronađena.");
    }
    const siblings = await siblingsOf(ctx, args.parentId);
    const byId = new Map(siblings.map((doc) => [doc._id, doc]));
    const stale =
      siblings.length > MAX_SIBLINGS ||
      new Set(args.ids).size !== args.ids.length ||
      args.ids.length !== siblings.length ||
      args.ids.some((id) => !byId.has(id));
    if (stale) {
      appError("CONFLICT", "Spisak lokacija se u međuvremenu promenio. Osvežite stranicu i pokušajte ponovo.");
    }

    const slots = orderSlots(siblings.map((doc) => doc.order));
    const names: string[] = [];
    let changed = 0;
    for (const [index, id] of args.ids.entries()) {
      const doc = byId.get(id);
      const slot = slots[index];
      if (doc === undefined || slot === undefined) continue;
      names.push(doc.name.sr);
      if (doc.order !== slot) {
        await ctx.db.patch("locations", id, { order: slot });
        changed += 1;
      }
    }
    if (changed === 0) return null;

    await logActivity(ctx, {
      entity: "location",
      ...(parent !== null ? { entityId: parent._id } : {}),
      action: "location.reordered",
      summary: `${parent !== null ? parent.name.sr : "Gradovi"}: ${names.join(", ")}`.slice(0, 200),
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Deletes a location that nothing uses: no child locations and no listing in
 * any status (drafts and archived ones included, via `locationIsReferenced`).
 */
export const remove = mutation({
  args: { id: v.id("locations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, DELETERS);
    const doc = await ctx.db.get("locations", args.id);
    if (doc === null) locationNotFound();

    const children = await ctx.db
      .query("locations")
      .withIndex("by_parentId_and_order", (q) => q.eq("parentId", args.id))
      .take(1);
    if (children.length > 0) {
      invalidInput("Lokacija ima podređene lokacije. Prvo ih obrišite ili premestite.");
    }
    if (await locationIsReferenced(ctx, args.id)) {
      invalidInput("Lokacija se koristi na nekretninama. Prvo ih prebacite na drugu lokaciju.");
    }

    const counts = await ctx.db
      .query("locationCounts")
      .withIndex("by_locationId", (q) => q.eq("locationId", args.id))
      .unique();
    if (counts !== null) await ctx.db.delete("locationCounts", counts._id);

    // Agents' "areas" hold location ids; the team is small, so a bounded scan.
    const agents = await ctx.db.query("agents").take(MAX_SIBLINGS);
    for (const agent of agents) {
      if (!agent.areas.includes(args.id)) continue;
      await ctx.db.patch("agents", agent._id, {
        areas: agent.areas.filter((areaId) => areaId !== args.id),
      });
    }

    await releaseReplacedImage(ctx, doc.cover, undefined);
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

/* ------------------------------------------------------------------ internal */

async function listingsPage(
  ctx: MutationCtx,
  location: Doc<"locations">,
  scope: string,
  cursor: string | null,
): Promise<PaginationResult<Doc<"listings">>> {
  const opts = { numItems: REINDEX_BATCH, cursor };
  if (location.kind === "city") {
    return await ctx.db
      .query("listings")
      .withIndex("by_scope_and_cityId_and_price", (q) =>
        q.eq("scope", scope).eq("cityId", location._id),
      )
      .paginate(opts);
  }
  if (location.kind === "municipality") {
    return await ctx.db
      .query("listings")
      .withIndex("by_scope_and_municipalityId_and_price", (q) =>
        q.eq("scope", scope).eq("municipalityId", location._id),
      )
      .paginate(opts);
  }
  return await ctx.db
    .query("listings")
    .withIndex("by_scope_and_neighborhoodId_and_publishedAt", (q) =>
      q.eq("scope", scope).eq("neighborhoodId", location._id),
    )
    .paginate(opts);
}

/**
 * After a rename, refreshes `searchText` of every listing that uses the
 * location, one scope and one batch per run, so the text search finds the new
 * name (and newly added translations) without re-saving each listing.
 */
export const reindexListings = internalMutation({
  args: {
    locationId: v.id("locations"),
    step: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const location = await ctx.db.get("locations", args.locationId);
    const scope = ALL_SCOPES[args.step];
    if (location === null || scope === undefined) return null;

    const page = await listingsPage(ctx, location, scope, args.cursor);
    for (const listing of page.page) {
      const names = await locationNamesFor(ctx, listing);
      const { searchText } = applyDerived(listing, names, false);
      if (searchText !== listing.searchText) {
        await ctx.db.patch("listings", listing._id, { searchText });
      }
    }

    const next = page.isDone
      ? { step: args.step + 1, cursor: null }
      : { step: args.step, cursor: page.continueCursor };
    if (next.step < ALL_SCOPES.length) {
      await ctx.scheduler.runAfter(0, internal.locationsAdmin.reindexListings, {
        locationId: location._id,
        ...next,
      });
    }
    return null;
  },
});
