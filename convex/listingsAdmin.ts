import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { normalizeTour360, prepareWalk3d, releaseWalk3dBlobs } from "./lib/tourAssets";
import type { Infer } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { diffFields, logActivity } from "./lib/activity";
import { assertCanEditListing, requireRole } from "./lib/auth";
import type { Viewer } from "./lib/auth";
import {
  assertPublishable,
  checklistBlockers,
  checklistContext,
  publishChecklist,
} from "./lib/checklist";
import { applyCountDelta, statusCounts } from "./lib/counts";
import { deleteListingCascade } from "./lib/listingCascade";
import { applyDerived, locationNamesFor } from "./lib/derive";
import { appError, forbidden, invalidInput, notFound } from "./lib/errors";
import {
  FIRST_REF_NUMBER,
  formatRef,
  listingSlug,
  refNumber,
  slugify,
} from "./lib/slug";
import { isPublicScope, normalizeText } from "./lib/search";
import { optionalPhone, requireEmail } from "./lib/rateLimit";
import { randomToken } from "./lib/tokens";
import {
  addressVisibilityV,
  conditionV,
  constructionTypeV,
  energyClassV,
  featuresV,
  floorV,
  furnishingV,
  heatingV,
  l10nListV,
  l10nV,
  listingStatusV,
  mandateV,
  orientationV,
  parkingV,
  poiV,
  propertyTypeV,
  seoV,
  subtypeV,
  tour360V,
  transactionV,
  visibilityV,
  walk3dV,
  legalV,
} from "./lib/validators";
import { contactSearchText } from "./lib/contactSearch";

const EDITORS = ["admin", "manager", "agent"] as const;
const MANAGERS = ["admin", "manager"] as const;

/** Everything the 9-tab editor can change. All optional: autosave sends patches. */
const listingPatchV = v.object({
  transaction: v.optional(transactionV),
  propertyType: v.optional(propertyTypeV),
  subtype: v.optional(subtypeV),
  visibility: v.optional(visibilityV),
  isExclusive: v.optional(v.boolean()),
  isFeatured: v.optional(v.boolean()),
  agentId: v.optional(v.id("agents")),
  // No `ownerContactId`: the seller is linked only through `setOwner`, so a
  // caller can never point a listing at (and then read or edit) any contact.
  mandate: v.optional(mandateV),

  title: v.optional(l10nV),
  description: v.optional(l10nV),
  highlights: v.optional(l10nListV),

  price: v.optional(v.number()),
  priceOnRequest: v.optional(v.boolean()),
  vatIncluded: v.optional(v.boolean()),
  vatRefundEligible: v.optional(v.boolean()),
  mortgageEligible: v.optional(v.boolean()),
  developerInstallments: v.optional(v.boolean()),
  urgent: v.optional(v.boolean()),
  commissionText: v.optional(l10nV),
  costs: v.optional(
    v.object({
      infostan: v.optional(v.number()),
      maintenance: v.optional(v.number()),
      utilitiesIncluded: v.optional(v.boolean()),
    }),
  ),
  rent: v.optional(
    v.object({
      monthly: v.number(),
      deposit: v.optional(v.number()),
      minLeaseMonths: v.optional(v.number()),
      petsAllowed: v.optional(v.boolean()),
      utilitiesIncluded: v.optional(v.boolean()),
    }),
  ),

  cityId: v.optional(v.id("locations")),
  municipalityId: v.optional(v.id("locations")),
  neighborhoodId: v.optional(v.id("locations")),
  location: v.optional(
    v.object({
      street: v.optional(v.string()),
      streetNo: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      lat: v.number(),
      lng: v.number(),
      addressVisibility: addressVisibilityV,
    }),
  ),

  areaM2: v.optional(v.number()),
  registeredAreaM2: v.optional(v.number()),
  plotAreaM2: v.optional(v.number()),
  rooms: v.optional(v.number()),
  bedrooms: v.optional(v.number()),
  bathrooms: v.optional(v.number()),
  floor: v.optional(floorV),
  totalFloors: v.optional(v.number()),
  isDuplex: v.optional(v.boolean()),
  isPenthouse: v.optional(v.boolean()),

  constructionType: v.optional(constructionTypeV),
  yearBuilt: v.optional(v.number()),
  completionDate: v.optional(v.number()),
  renovatedYear: v.optional(v.number()),
  condition: v.optional(conditionV),
  heating: v.optional(v.array(heatingV)),
  features: v.optional(featuresV),
  outdoorAreaM2: v.optional(v.number()),
  orientation: v.optional(v.array(orientationV)),
  view: v.optional(v.array(v.string())),
  parking: v.optional(v.array(parkingV)),
  furnishing: v.optional(furnishingV),
  energyClass: v.optional(energyClassV),
  legal: v.optional(legalV),
  availableFrom: v.optional(v.number()),
  swapPossible: v.optional(v.boolean()),

  videoUrl: v.optional(v.string()),
  tour360: v.optional(tour360V),
  walk3d: v.optional(walk3dV),
  poi: v.optional(v.array(poiV)),
  seo: v.optional(seoV),
  slug: v.optional(v.string()),
});

/**
 * Optional top-level fields the editor can empty. Convex drops `undefined`
 * inside `patch`, so clearing is an explicit list instead.
 */
const clearableFieldV = v.union(
  v.literal("subtype"),
  v.literal("municipalityId"),
  v.literal("neighborhoodId"),
  v.literal("energyClass"),
  v.literal("registeredAreaM2"),
  v.literal("plotAreaM2"),
  v.literal("outdoorAreaM2"),
  v.literal("bedrooms"),
  v.literal("bathrooms"),
  v.literal("totalFloors"),
  v.literal("yearBuilt"),
  v.literal("renovatedYear"),
  v.literal("completionDate"),
  v.literal("availableFrom"),
  v.literal("commissionText"),
);

const checklistItemV = v.object({
  code: v.string(),
  label: v.string(),
  ok: v.boolean(),
  warning: v.optional(v.boolean()),
});

const checklistContextV = v.object({
  agentPublic: v.boolean(),
  registryOk: v.boolean(),
  registryRequired: v.boolean(),
});

/** Preview links live this long; a scheduled job then clears the token. */
const PREVIEW_TTL_MS = 14 * 86_400_000;

const adminRowV = v.object({
  _id: v.id("listings"),
  ref: v.string(),
  slug: v.string(),
  status: listingStatusV,
  visibility: visibilityV,
  transaction: transactionV,
  propertyType: propertyTypeV,
  title: l10nV,
  price: v.number(),
  pricePerM2: v.number(),
  areaM2: v.number(),
  rooms: v.number(),
  coverUrl: v.optional(v.string()),
  photoCount: v.number(),
  agentId: v.id("agents"),
  agentName: v.string(),
  isFeatured: v.boolean(),
  isExclusive: v.boolean(),
  isDemo: v.boolean(),
  views: v.number(),
  leads: v.number(),
  mandateEnd: v.optional(v.number()),
  updatedAt: v.number(),
});

async function toAdminRow(ctx: QueryCtx, doc: Doc<"listings">) {
  const agent = await ctx.db.get("agents", doc.agentId);
  const stats = await ctx.db
    .query("listingStats")
    .withIndex("by_listingId", (q) => q.eq("listingId", doc._id))
    .unique();
  const coverItem = doc.media.find((item) => item.isCover === true) ?? doc.media[0];
  const coverUrl =
    coverItem === undefined
      ? null
      : coverItem.image.kind === "url"
        ? coverItem.image.url
        : await ctx.storage.getUrl(coverItem.image.storageId);

  return {
    _id: doc._id,
    ref: doc.ref,
    slug: doc.slug,
    status: doc.status,
    visibility: doc.visibility,
    transaction: doc.transaction,
    propertyType: doc.propertyType,
    title: doc.title,
    price: doc.price,
    pricePerM2: doc.pricePerM2,
    areaM2: doc.areaM2,
    rooms: doc.rooms,
    ...(coverUrl !== null ? { coverUrl } : {}),
    photoCount: doc.media.length,
    agentId: doc.agentId,
    agentName: agent?.name ?? "—",
    isFeatured: doc.isFeatured,
    isExclusive: doc.isExclusive,
    isDemo: doc.isDemo,
    views: stats?.views ?? 0,
    leads: stats?.leads ?? 0,
    ...(doc.mandateEnd !== undefined ? { mandateEnd: doc.mandateEnd } : {}),
    updatedAt: doc.updatedAt,
  };
}

/** Managers can read the activity log, so no secret may enter a diff. */
function forDiff(doc: Doc<"listings">): Record<string, unknown> {
  const {
    previewToken: _token,
    previewExpiresAt: _expires,
    searchText: _searchText,
    ...rest
  } = doc;
  return rest as unknown as Record<string, unknown>;
}

/** Agents see only their own rows; everyone else sees all. */
function visibleToViewer(viewer: Viewer, doc: Doc<"listings">): boolean {
  if (viewer.role === "agent") {
    return viewer.agentId !== undefined && doc.agentId === viewer.agentId;
  }
  return true;
}

const VIDEO_URL =
  /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|(?:player\.)?vimeo\.com\/)[\w\-?=&/%.]{3,200}$/;

/** The public page embeds only YouTube and Vimeo (`VideoFacade`). */
function isVideoUrl(url: string): boolean {
  return url.length <= 500 && VIDEO_URL.test(url);
}

/**
 * The three place ids must form one chain: the municipality belongs to the
 * city and the neighborhood to the municipality (or to the city when a place
 * has no municipality level). A stale id left behind by a city change would
 * otherwise put the listing in a municipality of another city.
 */
async function assertPlaceChain(
  ctx: MutationCtx,
  ids: Pick<Doc<"listings">, "cityId" | "municipalityId" | "neighborhoodId">,
): Promise<void> {
  if (ids.municipalityId !== undefined) {
    const municipality = await ctx.db.get("locations", ids.municipalityId);
    if (municipality === null || municipality.parentId !== ids.cityId) {
      invalidInput("Opština ne pripada izabranom gradu.");
    }
  }
  if (ids.neighborhoodId !== undefined) {
    const neighborhood = await ctx.db.get("locations", ids.neighborhoodId);
    const parent = ids.municipalityId ?? ids.cityId;
    if (neighborhood === null || neighborhood.parentId !== parent) {
      invalidInput("Naselje ne pripada izabranoj opštini.");
    }
  }
}

/** Search terms for the text index: diacritics folded, at most 8 words. */
function searchNeedle(raw: string): string {
  return normalizeText(raw.slice(0, 120)).split(" ").filter(Boolean).slice(0, 8).join(" ");
}

/**
 * The agent whose listings this viewer may list: an agent is pinned to their own
 * profile whatever filter they send; admin and manager may narrow to anyone.
 */
function scopedAgentId(
  viewer: Viewer,
  requested: Id<"agents"> | undefined,
): Id<"agents"> | null | undefined {
  if (viewer.role === "agent") return viewer.agentId ?? null;
  return requested;
}

export const list = query({
  args: {
    status: v.optional(listingStatusV),
    q: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
    transaction: v.optional(transactionV),
    propertyType: v.optional(propertyTypeV),
    onlyDemo: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(adminRowV),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const agentId = scopedAgentId(viewer, args.agentId);
    // An agent account that is not linked to an agent profile owns nothing.
    if (agentId === null) return { page: [], isDone: true, continueCursor: "" };

    const needle = args.q !== undefined ? searchNeedle(args.q) : "";
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 100),
    };

    // Text search goes through the search index (relevance order) with every
    // filter applied inside the index; everything else walks the narrowest
    // `updatedAt` index. What remains are cheap equality checks on the page.
    const result =
      needle.length > 0
        ? await ctx.db
            .query("listings")
            .withSearchIndex("search_text", (q) => {
              let search = q.search("searchText", needle);
              if (agentId !== undefined) search = search.eq("agentId", agentId);
              if (args.status !== undefined) search = search.eq("status", args.status);
              if (args.transaction !== undefined) search = search.eq("transaction", args.transaction);
              if (args.propertyType !== undefined) search = search.eq("propertyType", args.propertyType);
              if (args.onlyDemo === true) search = search.eq("isDemo", true);
              return search;
            })
            .paginate(paginationOpts)
        : agentId !== undefined
          ? args.status !== undefined
            ? await ctx.db
                .query("listings")
                .withIndex("by_agentId_and_status_and_updatedAt", (q) =>
                  q.eq("agentId", agentId).eq("status", args.status!),
                )
                .order("desc")
                .paginate(paginationOpts)
            : await ctx.db
                .query("listings")
                .withIndex("by_agentId_and_updatedAt", (q) => q.eq("agentId", agentId))
                .order("desc")
                .paginate(paginationOpts)
          : args.status !== undefined
            ? await ctx.db
                .query("listings")
                .withIndex("by_status_and_updatedAt", (q) => q.eq("status", args.status!))
                .order("desc")
                .paginate(paginationOpts)
            : await ctx.db.query("listings").order("desc").paginate(paginationOpts);

    const page = [];
    for (const doc of result.page) {
      if (!visibleToViewer(viewer, doc)) continue;
      if (agentId !== undefined && doc.agentId !== agentId) continue;
      if (args.status !== undefined && doc.status !== args.status) continue;
      if (args.transaction !== undefined && doc.transaction !== args.transaction) continue;
      if (args.propertyType !== undefined && doc.propertyType !== args.propertyType) continue;
      if (args.onlyDemo === true && !doc.isDemo) continue;
      page.push(await toAdminRow(ctx, doc));
    }

    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

const STATUSES = [
  "draft",
  "review",
  "published",
  "reserved",
  "sold",
  "rented",
  "withdrawn",
  "archived",
] as const;

/**
 * Status tab badges, from the denormalized `listingStatusCounts` (one indexed
 * read of at most 8 rows): agency-wide, or the agent's own listings for an
 * agent. Exact, not capped.
 */
export const counts = query({
  args: {},
  returns: v.array(v.object({ status: listingStatusV, count: v.number() })),
  handler: async (ctx) => {
    const viewer = await requireRole(ctx, EDITORS);
    const agentId = scopedAgentId(viewer, undefined);
    if (agentId === null) return STATUSES.map((status) => ({ status, count: 0 }));
    const byStatus = await statusCounts(ctx, agentId ?? "all");
    return STATUSES.map((status) => ({ status, count: byStatus[status] ?? 0 }));
  },
});

/** ⌘K palette: jump to a listing by ref ("ME-1042", "1042") or title words. */
export const quickFind = query({
  args: { q: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("listings"),
      ref: v.string(),
      title: v.string(),
      status: listingStatusV,
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const raw = args.q.trim().slice(0, 80);
    if (raw.length === 0) return [];

    const out: { _id: Id<"listings">; ref: string; title: string; status: Doc<"listings">["status"] }[] = [];
    const seen = new Set<string>();
    const push = (doc: Doc<"listings">) => {
      if (seen.has(doc._id) || !visibleToViewer(viewer, doc)) return;
      seen.add(doc._id);
      out.push({ _id: doc._id, ref: doc.ref, title: doc.title.sr, status: doc.status });
    };

    const digits = raw.match(/\d{3,6}/)?.[0];
    if (digits !== undefined) {
      const exact = await ctx.db
        .query("listings")
        .withIndex("by_ref", (q) => q.eq("ref", formatRef(Number(digits))))
        .first();
      if (exact !== null) push(exact);
    }

    const needle = searchNeedle(raw);
    const agentId = scopedAgentId(viewer, undefined);
    if (needle.length > 0 && agentId !== null) {
      const hits = await ctx.db
        .query("listings")
        .withSearchIndex("search_text", (q) => {
          const search = q.search("searchText", needle);
          return agentId !== undefined ? search.eq("agentId", agentId) : search;
        })
        .take(12);
      for (const doc of hits) push(doc);
    }
    return out.slice(0, 8);
  },
});

/** `now` is an argument so the checklist stays pure (queries never read a clock). */
export const get = query({
  args: { id: v.id("listings"), now: v.number() },
  returns: v.union(
    v.object({
      listing: schema.doc("listings"),
      checklist: v.array(checklistItemV),
      checklistContext: checklistContextV,
      agentName: v.string(),
      owner: v.union(
        v.object({
          name: v.string(),
          phone: v.optional(v.string()),
          email: v.optional(v.string()),
        }),
        v.null(),
      ),
      docsVerifiedByName: v.optional(v.string()),
      mediaUrls: v.record(v.string(), v.string()),
      priceHistory: v.array(
        v.object({ at: v.number(), from: v.number(), to: v.number() }),
      ),
      sceneCount: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const doc = await ctx.db.get("listings", args.id);
    if (doc === null) return null;
    assertCanEditListing(viewer, doc);

    const context = await checklistContext(ctx, doc);
    const ownerDoc =
      doc.ownerContactId !== undefined
        ? await ctx.db.get("contacts", doc.ownerContactId)
        : null;
    const verifier =
      doc.legal.docsVerifiedBy !== undefined
        ? await ctx.db.get("users", doc.legal.docsVerifiedBy)
        : null;
    const verifierName = verifier === null ? undefined : (verifier.name ?? "Član tima");

    const agent = await ctx.db.get("agents", doc.agentId);
    const mediaUrls: Record<string, string> = {};
    for (const item of [...doc.media, ...doc.floorPlans]) {
      const url =
        item.image.kind === "url"
          ? item.image.url
          : await ctx.storage.getUrl(item.image.storageId);
      if (url !== null) mediaUrls[item.id] = url;
    }
    const changes = await ctx.db
      .query("priceChanges")
      .withIndex("by_listingId_and_at", (q) => q.eq("listingId", doc._id))
      .order("desc")
      .take(30);
    const scenes = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", doc._id))
      .take(40);

    return {
      listing: doc,
      checklist: publishChecklist(doc, args.now, context),
      checklistContext: context,
      agentName: agent?.name ?? "—",
      owner:
        ownerDoc === null || ownerDoc.anonymizedAt !== undefined
          ? null
          : {
              name: ownerDoc.name,
              ...(ownerDoc.phone !== undefined ? { phone: ownerDoc.phone } : {}),
              ...(ownerDoc.email !== undefined ? { email: ownerDoc.email } : {}),
            },
      ...(verifierName !== undefined ? { docsVerifiedByName: verifierName } : {}),
      mediaUrls,
      priceHistory: changes.map((change) => ({
        at: change.at,
        from: change.from,
        to: change.to,
      })),
      sceneCount: scenes.length,
    };
  },
});

async function nextRef(ctx: MutationCtx): Promise<string> {
  const latest = await ctx.db.query("listings").order("desc").take(200);
  let max = FIRST_REF_NUMBER - 1;
  for (const doc of latest) max = Math.max(max, refNumber(doc.ref));
  return formatRef(max + 1);
}

async function ensureUniqueSlug(
  ctx: MutationCtx,
  candidate: string,
  selfId?: Id<"listings">,
): Promise<string> {
  let slug = candidate;
  let suffix = 2;
  for (;;) {
    const clash = await ctx.db
      .query("listings")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash === null || clash._id === selfId) return slug;
    slug = `${candidate}-${suffix}`;
    suffix += 1;
    if (suffix > 40) return `${candidate}-${Date.now()}`;
  }
}

export const create = mutation({
  args: {
    transaction: transactionV,
    propertyType: propertyTypeV,
    cityId: v.id("locations"),
    agentId: v.optional(v.id("agents")),
    titleSr: v.string(),
  },
  returns: v.object({ id: v.id("listings"), ref: v.string(), slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);

    const agentId =
      args.agentId ??
      viewer.agentId ??
      (await ctx.db
        .query("agents")
        .withIndex("by_isPublic_and_order", (q) => q.eq("isPublic", true))
        .first())?._id;
    if (agentId === undefined) {
      invalidInput("Nema ni jednog agenta. Prvo dodajte agenta u Tim.");
    }
    if (viewer.role === "agent" && agentId !== viewer.agentId) {
      forbidden("dodelu nekretnine drugom agentu");
    }

    const city = await ctx.db.get("locations", args.cityId);
    if (city === null) notFound("Grad");

    const ref = await nextRef(ctx);
    const titleSr = args.titleSr.trim().length > 0 ? args.titleSr.trim() : "Nova nekretnina";
    const slug = await ensureUniqueSlug(ctx, listingSlug(titleSr, ref));
    const now = Date.now();

    const base = {
      ref,
      slug,
      status: "draft" as const,
      visibility: "private" as const,
      transaction: args.transaction,
      propertyType: args.propertyType,
      isExclusive: false,
      isFeatured: false,
      isDemo: false,
      agentId,
      title: { sr: titleSr },
      description: { sr: "" },
      highlights: { sr: [] },
      price: 0,
      cityId: args.cityId,
      location: {
        lat: city.lat,
        lng: city.lng,
        addressVisibility: "area" as const,
      },
      areaM2: 0,
      rooms: 0,
      floor: "PR" as const,
      constructionType: "old" as const,
      condition: "original" as const,
      heating: [],
      features: {
        elevator: false,
        terrace: false,
        loggia: false,
        balcony: false,
        frenchBalcony: false,
        garden: false,
        basement: false,
        storage: false,
        ac: false,
        intercom: false,
        videoSurveillance: false,
        alarm: false,
      },
      parking: [],
      furnishing: "unfurnished" as const,
      legal: {
        registration: "not_registered" as const,
        legalization: "in_progress" as const,
      },
      media: [],
      floorPlans: [],
      updatedAt: now,
      createdBy: viewer._id,
    };

    const derived = applyDerived(base, [...Object.values(city.name).flat()], false);
    const id = await ctx.db.insert("listings", { ...base, ...derived });
    await applyCountDelta(ctx, null, await ctx.db.get("listings", id));

    await logActivity(ctx, {
      entity: "listing",
      entityId: id,
      action: "listing.created",
      summary: `${ref} — ${titleSr}`,
      by: viewer._id,
    });

    return { id, ref, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("listings"),
    patch: listingPatchV,
    unset: v.optional(v.array(clearableFieldV)),
  },
  returns: v.object({ slug: v.string(), checklist: v.array(checklistItemV) }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const before = await ctx.db.get("listings", args.id);
    if (before === null) notFound("Nekretnina");
    assertCanEditListing(viewer, before);

    if (
      args.patch.agentId !== undefined &&
      viewer.role === "agent" &&
      args.patch.agentId !== viewer.agentId
    ) {
      forbidden("prebacivanje nekretnine na drugog agenta");
    }
    if (args.patch.price !== undefined && args.patch.price < 0) {
      invalidInput("Cena ne može biti negativna.");
    }
    if (args.patch.areaM2 !== undefined && args.patch.areaM2 < 0) {
      invalidInput("Kvadratura ne može biti negativna.");
    }
    // An empty string clears the video; anything else must be a YouTube or
    // Vimeo page (the public page embeds only those two players).
    const videoUrl = args.patch.videoUrl?.trim();
    if (videoUrl !== undefined && videoUrl.length > 0 && !isVideoUrl(videoUrl)) {
      invalidInput("Video mora biti YouTube ili Vimeo adresa (https://…).");
    }
    if (args.patch.agentId !== undefined && args.patch.agentId !== before.agentId) {
      const agent = await ctx.db.get("agents", args.patch.agentId);
      if (agent === null) notFound("Agent");
      // A live listing must keep a bookable agent (the publish checklist rule).
      if (!agent.isPublic && isPublicScope(before.scope)) {
        invalidInput("Objavljenu nekretninu možete dodeliti samo agentu koji je vidljiv na sajtu.");
      }
    }

    const now = Date.now();

    // "Documents verified" is attested by the server: the client only says
    // whether the box is ticked. A fresh tick is stamped with this moment and
    // the caller, an unchanged tick keeps the original stamp, and unticking
    // clears both. A client can neither backdate it nor name someone else.
    let legalPatch = args.patch.legal;
    if (legalPatch !== undefined) {
      const {
        docsVerifiedBy: _clientVerifier,
        docsVerifiedAt: clientVerifiedAt,
        ...legalRest
      } = legalPatch;
      const previous = before.legal;
      legalPatch =
        clientVerifiedAt === undefined
          ? legalRest
          : previous.docsVerifiedAt !== undefined
            ? {
                ...legalRest,
                docsVerifiedAt: previous.docsVerifiedAt,
                ...(previous.docsVerifiedBy !== undefined
                  ? { docsVerifiedBy: previous.docsVerifiedBy }
                  : {}),
              }
            : { ...legalRest, docsVerifiedAt: now, docsVerifiedBy: viewer._id };
    }
    // Tour data from the editor's autosave gets the same checks as toursAdmin.
    const tour360 = normalizeTour360(args.patch.tour360);
    const walk3d =
      args.patch.walk3d !== undefined
        ? await prepareWalk3d(ctx, before.walk3d, args.patch.walk3d)
        : undefined;
    const { videoUrl: _rawVideoUrl, ...patchRest } = args.patch;
    const cleanPatch = {
      ...patchRest,
      ...(walk3d !== undefined ? { walk3d } : {}),
      ...(tour360 !== undefined ? { tour360 } : {}),
      ...(legalPatch !== undefined ? { legal: legalPatch } : {}),
      ...(videoUrl !== undefined
        ? { videoUrl: videoUrl.length > 0 ? videoUrl : undefined }
        : {}),
    };
    // Cleared fields are written as `undefined`, which removes them.
    const cleared: Partial<Record<Infer<typeof clearableFieldV>, undefined>> = {};
    for (const field of args.unset ?? []) {
      if (!(field in args.patch)) cleared[field] = undefined;
    }
    const merged = { ...before, ...cleanPatch, ...cleared };
    const placeTouched =
      args.patch.cityId !== undefined ||
      args.patch.municipalityId !== undefined ||
      args.patch.neighborhoodId !== undefined ||
      "municipalityId" in cleared ||
      "neighborhoodId" in cleared;
    if (placeTouched) await assertPlaceChain(ctx, merged);

    // Flipping `visibility` to public is a second route onto the market: a
    // reserved listing with `visibility: "private"` sits in the `hidden` bucket
    // until this patch moves it. It has to clear the same Art. 18 checklist as
    // `publish`, or a price-0, photo-less, mandate-less listing goes live.
    if (args.patch.visibility === "public" && before.visibility !== "public") {
      assertPublishable(merged, now, await checklistContext(ctx, merged));
    }

    // Slug: explicit rename keeps a redirect from the old value.
    let slug = before.slug;
    if (args.patch.slug !== undefined) {
      const candidate = slugify(args.patch.slug);
      if (candidate !== before.slug) {
        slug = await ensureUniqueSlug(ctx, candidate, before._id);
        await ctx.db.insert("slugRedirects", {
          from: before.slug,
          listingId: before._id,
          at: now,
        });
      }
    }

    // Price history + the denormalized previousPrice badge source.
    let previousPrice = before.previousPrice;
    if (args.patch.price !== undefined && args.patch.price !== before.price) {
      await ctx.db.insert("priceChanges", {
        listingId: before._id,
        from: before.price,
        to: args.patch.price,
        at: now,
        by: viewer._id,
      });
      previousPrice = before.price > args.patch.price ? before.price : undefined;
    }

    const names = await locationNamesFor(ctx, {
      cityId: merged.cityId,
      municipalityId: merged.municipalityId,
      neighborhoodId: merged.neighborhoodId,
    });
    const sceneCount = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", before._id))
      .take(1);

    const next = {
      ...merged,
      slug,
      ...(previousPrice !== undefined ? { previousPrice } : {}),
      updatedAt: now,
    };
    const derived = applyDerived(next, names, sceneCount.length > 0);
    const patch = {
      ...cleanPatch,
      ...cleared,
      slug,
      updatedAt: now,
      ...derived,
      // `applyDerived` does not carry `previousPrice`, so write it explicitly.
      // `undefined` is the right value on a price increase: it clears the badge.
      ...(args.patch.price !== undefined && args.patch.price !== before.price
        ? { previousPrice }
        : {}),
    };

    await ctx.db.patch("listings", before._id, patch);
    if (walk3d !== undefined) await releaseWalk3dBlobs(ctx, before.walk3d, walk3d);
    const after = await ctx.db.get("listings", before._id);
    if (after === null) notFound("Nekretnina");

    await applyCountDelta(ctx, before, after);
    await logActivity(ctx, {
      entity: "listing",
      entityId: before._id,
      action: "listing.updated",
      summary: before.ref,
      diff: diffFields(forDiff(before), forDiff(after)),
      by: viewer._id,
    });

    return {
      slug,
      checklist: publishChecklist(after, now, await checklistContext(ctx, after)),
    };
  },
});

export const publish = mutation({
  args: { id: v.id("listings") },
  returns: v.object({ status: listingStatusV, slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const before = await ctx.db.get("listings", args.id);
    if (before === null) notFound("Nekretnina");
    assertCanEditListing(viewer, before);

    const now = Date.now();
    assertPublishable(before, now, await checklistContext(ctx, before));

    const next = {
      ...before,
      status: "published" as const,
      visibility: "public" as const,
    };
    const names = await locationNamesFor(ctx, next);
    const scenes = await ctx.db
      .query("tourScenes")
      .withIndex("by_listingId_and_order", (q) => q.eq("listingId", before._id))
      .take(1);
    const derived = applyDerived(next, names, scenes.length > 0);

    await ctx.db.patch("listings", before._id, {
      status: "published",
      visibility: "public",
      publishedAt: before.publishedAt ?? now,
      updatedAt: now,
      ...derived,
    });
    const after = await ctx.db.get("listings", before._id);
    await applyCountDelta(ctx, before, after);

    await logActivity(ctx, {
      entity: "listing",
      entityId: before._id,
      action: "listing.published",
      summary: before.ref,
      by: viewer._id,
    });

    return { status: "published" as const, slug: before.slug };
  },
});

/**
 * The one place a listing changes status: recomputes `scope` (and therefore
 * public visibility), adjusts the location counters and writes the activity row.
 */
async function changeStatus(
  ctx: MutationCtx,
  before: Doc<"listings">,
  status: Doc<"listings">["status"],
  by: Id<"users">,
): Promise<void> {
  const now = Date.now();
  const visibility =
    status === "draft" || status === "review" || status === "archived"
      ? ("private" as const)
      : before.visibility;

  const next = { ...before, status, visibility };
  const names = await locationNamesFor(ctx, next);
  const scenes = await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", before._id))
    .take(1);
  const derived = applyDerived(next, names, scenes.length > 0);

  await ctx.db.patch("listings", before._id, {
    status,
    visibility,
    updatedAt: now,
    ...derived,
  });
  const after = await ctx.db.get("listings", before._id);
  await applyCountDelta(ctx, before, after);

  await logActivity(ctx, {
    entity: "listing",
    entityId: before._id,
    action: `listing.status.${status}`,
    summary: `${before.ref}: ${before.status} → ${status}`,
    by,
  });
}

export const setStatus = mutation({
  args: { id: v.id("listings"), status: listingStatusV },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const before = await ctx.db.get("listings", args.id);
    if (before === null) notFound("Nekretnina");
    assertCanEditListing(viewer, before);

    if (args.status === "published") {
      appError(
        "INVALID_INPUT",
        "Za objavljivanje koristite dugme Objavi (provera je obavezna).",
      );
    }

    await changeStatus(ctx, before, args.status, viewer._id);
    return null;
  },
});

export const unpublish = mutation({
  args: { id: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const before = await ctx.db.get("listings", args.id);
    if (before === null) notFound("Nekretnina");
    assertCanEditListing(viewer, before);
    await changeStatus(ctx, before, "withdrawn", viewer._id);
    return null;
  },
});

export const duplicate = mutation({
  args: { id: v.id("listings") },
  returns: v.object({ id: v.id("listings"), ref: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const source = await ctx.db.get("listings", args.id);
    if (source === null) notFound("Nekretnina");
    assertCanEditListing(viewer, source);

    const ref = await nextRef(ctx);
    const titleSr = `${source.title.sr} (kopija)`;
    const slug = await ensureUniqueSlug(ctx, listingSlug(titleSr, ref));
    const now = Date.now();

    const {
      _id: _dropId,
      _creationTime: _dropCreation,
      scope: _dropScope,
      searchText: _dropSearch,
      pricePerM2: _dropPpm2,
      floorNum: _dropFloor,
      hasTour: _dropTour,
      mandateEnd: _dropMandateEnd,
      // A copy is a new offer: it needs its own brokerage contract and preview
      // link, and it has no price history to show a "reduced" badge from.
      mandate: _dropMandate,
      previewToken: _dropPreviewToken,
      previewExpiresAt: _dropPreviewExpires,
      previousPrice: _dropPreviousPrice,
      publishedAt: _dropPublishedAt,
      // The seller of the copy is set on the copy; sharing the contact would
      // let `setOwner` on one listing rewrite the other's owner.
      ownerContactId: _dropOwner,
      // Uploaded 3D assets and an uploaded OG image would be shared blobs, and
      // the scenes of a 360° tour belong to the source listing.
      walk3d: _dropWalk3d,
      tour360: sourceTour,
      seo: sourceSeo,
      ...rest
    } = source;

    // Verification attests to the source's documents, not the copy's.
    const {
      docsVerifiedAt: _dropVerifiedAt,
      docsVerifiedBy: _dropVerifiedBy,
      ...legal
    } = source.legal;
    const seo =
      sourceSeo === undefined
        ? undefined
        : sourceSeo.ogImage?.kind === "storage"
          ? { ...sourceSeo, ogImage: undefined }
          : sourceSeo;

    // Two listings must never share a storage blob: deleting a photo from one
    // would break the other. Remote (URL) photos are copied as-is; uploaded
    // ones are duplicated into new blobs by a scheduled action.
    const byUrl = (items: typeof source.media) =>
      items.filter((item) => item.image.kind === "url");
    const stored = (items: typeof source.media) =>
      items.filter((item) => item.image.kind === "storage");

    const base = {
      ...rest,
      ref,
      slug,
      status: "draft" as const,
      visibility: "private" as const,
      isFeatured: false,
      title: { ...source.title, sr: titleSr },
      legal,
      ...(sourceTour !== undefined ? { tour360: { ...sourceTour, published: false } } : {}),
      ...(seo !== undefined ? { seo } : {}),
      media: byUrl(source.media),
      floorPlans: byUrl(source.floorPlans),
      updatedAt: now,
      createdBy: viewer._id,
    };
    const names = await locationNamesFor(ctx, base);
    const derived = applyDerived(base, names, false);
    const id = await ctx.db.insert("listings", { ...base, ...derived });
    await applyCountDelta(ctx, null, await ctx.db.get("listings", id));

    const storedMedia = stored(source.media);
    const storedPlans = stored(source.floorPlans);
    if (storedMedia.length > 0 || storedPlans.length > 0) {
      await ctx.scheduler.runAfter(0, internal.listingsInternal.copyStoredMedia, {
        listingId: id,
        media: storedMedia,
        floorPlans: storedPlans,
      });
    }

    await logActivity(ctx, {
      entity: "listing",
      entityId: id,
      action: "listing.duplicated",
      summary: `${source.ref} → ${ref}`,
      by: viewer._id,
    });

    return { id, ref };
  },
});

export const remove = mutation({
  args: { id: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await ctx.db.get("listings", args.id);
    if (doc === null) notFound("Nekretnina");

    await deleteListingCascade(ctx, doc);
    await logActivity(ctx, {
      entity: "listing",
      entityId: args.id,
      action: "listing.deleted",
      summary: doc.ref,
      by: viewer._id,
    });
    return null;
  },
});


export const bulk = mutation({
  args: {
    ids: v.array(v.id("listings")),
    action: v.union(
      v.literal("publish"),
      v.literal("unpublish"),
      v.literal("archive"),
      v.literal("feature"),
      v.literal("unfeature"),
      v.literal("assign"),
      // Deletes demo listings only; a real listing in the selection is skipped.
      v.literal("deleteDemo"),
    ),
    agentId: v.optional(v.id("agents")),
  },
  returns: v.object({
    done: v.number(),
    skipped: v.array(v.object({ ref: v.string(), reason: v.string() })),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const skipped: { ref: string; reason: string }[] = [];
    let done = 0;
    const now = Date.now();

    const LIMIT = 100;
    for (const [index, id] of args.ids.entries()) {
      const before = await ctx.db.get("listings", id);
      if (before === null) continue;
      if (index >= LIMIT) {
        skipped.push({ ref: before.ref, reason: `Najviše ${LIMIT} nekretnina po radnji` });
        continue;
      }

      if (args.action === "deleteDemo") {
        if (!before.isDemo) {
          skipped.push({ ref: before.ref, reason: "Nije demo nekretnina" });
          continue;
        }
        // One transaction per listing: a cascade can touch hundreds of rows,
        // and several of them in one call could exceed the write limits.
        await ctx.scheduler.runAfter(0, internal.listingsInternal.deleteDemoListing, {
          id,
          by: viewer._id,
        });
        done += 1;
        continue;
      }

      if (args.action === "feature" || args.action === "unfeature") {
        await ctx.db.patch("listings", id, {
          isFeatured: args.action === "feature",
          updatedAt: now,
        });
        done += 1;
        continue;
      }
      if (args.action === "assign") {
        if (args.agentId === undefined) invalidInput("Izaberite agenta.");
        // A stale id would orphan the listing: `toDetail` returns null and the
        // public page 404s.
        const agent = await ctx.db.get("agents", args.agentId);
        if (agent === null) notFound("Agent");
        if (!agent.isPublic && isPublicScope(before.scope)) {
          skipped.push({ ref: before.ref, reason: "Agent nije vidljiv na sajtu, a nekretnina je objavljena" });
          continue;
        }
        await ctx.db.patch("listings", id, { agentId: args.agentId, updatedAt: now });
        // The per-agent status counters follow the listing to its new agent.
        await applyCountDelta(ctx, before, await ctx.db.get("listings", id));
        done += 1;
        continue;
      }

      const status =
        args.action === "publish"
          ? ("published" as const)
          : args.action === "unpublish"
            ? ("withdrawn" as const)
            : ("archived" as const);

      if (status === "published") {
        const blockers = checklistBlockers(
          publishChecklist(before, now, await checklistContext(ctx, before)),
        );
        if (blockers.length > 0) {
          skipped.push({ ref: before.ref, reason: blockers[0] });
          continue;
        }
      }

      const visibility = status === "published" ? ("public" as const) : before.visibility;
      const next = { ...before, status, visibility };
      const names = await locationNamesFor(ctx, next);
      const derived = applyDerived(next, names, before.hasTour);
      await ctx.db.patch("listings", id, {
        status,
        visibility,
        ...(status === "published" ? { publishedAt: before.publishedAt ?? now } : {}),
        updatedAt: now,
        ...derived,
      });
      const after = await ctx.db.get("listings", id);
      await applyCountDelta(ctx, before, after);
      // Per listing, so `activity.list({entityId})` shows the change (PRD B13).
      await logActivity(ctx, {
        entity: "listing",
        entityId: id,
        action: `listing.status.${status}`,
        summary: `${before.ref}: ${before.status} → ${status} (grupno)`,
        by: viewer._id,
      });
      done += 1;
    }

    await logActivity(ctx, {
      entity: "listing",
      action: `listing.bulk.${args.action}`,
      summary: `${done} nekretnina`,
      by: viewer._id,
    });

    return { done, skipped };
  },
});

export const regenerateSlug = mutation({
  args: { id: v.id("listings") },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const doc = await ctx.db.get("listings", args.id);
    if (doc === null) notFound("Nekretnina");
    assertCanEditListing(viewer, doc);

    const candidate = listingSlug(doc.title.sr, doc.ref);
    if (candidate === doc.slug) return { slug: doc.slug };

    const slug = await ensureUniqueSlug(ctx, candidate, doc._id);
    const now = Date.now();
    await ctx.db.insert("slugRedirects", {
      from: doc.slug,
      listingId: doc._id,
      at: now,
    });
    await ctx.db.patch("listings", doc._id, { slug, updatedAt: now });
    await logActivity(ctx, {
      entity: "listing",
      entityId: doc._id,
      action: "listing.slug.regenerated",
      summary: `${doc.slug} → ${slug}`,
      by: viewer._id,
    });
    return { slug };
  },
});

export const rotatePreviewToken = mutation({
  args: { id: v.id("listings") },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const doc = await ctx.db.get("listings", args.id);
    if (doc === null) notFound("Nekretnina");
    assertCanEditListing(viewer, doc);

    const token = randomToken();
    const expiresAt = Date.now() + PREVIEW_TTL_MS;
    await ctx.db.patch("listings", doc._id, {
      previewToken: token,
      previewExpiresAt: expiresAt,
    });
    // `listings.previewBySlug` checks the expiry against a caller-supplied
    // `now`; clearing the token server-side makes the expiry authoritative.
    await ctx.scheduler.runAt(expiresAt, internal.listingsInternal.expirePreviewToken, {
      id: doc._id,
      token,
    });
    await logActivity(ctx, {
      entity: "listing",
      entityId: doc._id,
      action: "listing.previewRotated",
      summary: doc.ref,
      by: viewer._id,
    });
    return { token, expiresAt };
  },
});

/**
 * True when the contact has a lead not assigned to `agentId` (or more leads
 * than are worth checking): editing it would reach into a colleague's client.
 */
async function hasForeignLeads(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  agentId: Id<"agents">,
): Promise<boolean> {
  const leads = await ctx.db
    .query("leads")
    .withIndex("by_contactId", (q) => q.eq("contactId", contactId))
    .take(51);
  return leads.length > 50 || leads.some((lead) => lead.agentId !== agentId);
}

/**
 * The seller's private contact (PRD B3 "Pravno"). Never exposed publicly: the
 * public DTOs do not read `ownerContactId`. Passing `name: ""` unlinks it.
 * Owner contacts are tagged "vlasnik", and public forms never attach to them.
 */
export const setOwner = mutation({
  args: {
    id: v.id("listings"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const doc = await ctx.db.get("listings", args.id);
    if (doc === null) notFound("Nekretnina");
    assertCanEditListing(viewer, doc);

    const name = args.name.trim().slice(0, 120);
    if (name.length === 0) {
      if (doc.ownerContactId !== undefined) {
        await ctx.db.patch("listings", doc._id, { ownerContactId: undefined, updatedAt: Date.now() });
        await logActivity(ctx, {
          entity: "listing",
          entityId: doc._id,
          action: "listing.owner.unlinked",
          summary: doc.ref,
          by: viewer._id,
        });
      }
      return null;
    }
    const phone = optionalPhone(args.phone);
    const email =
      args.email !== undefined && args.email.trim().length > 0
        ? requireEmail(args.email)
        : undefined;

    const fields = {
      name,
      ...(phone !== undefined ? { phone } : {}),
      ...(email !== undefined ? { email } : {}),
    };
    if (doc.ownerContactId !== undefined) {
      const existing = await ctx.db.get("contacts", doc.ownerContactId);
      // An anonymized contact stays erased, and a contact that is also another
      // agent's client (it has leads outside this listing's agent) is not this
      // editor's to rewrite: in both cases the new details get a new contact.
      if (
        existing !== null &&
        existing.anonymizedAt === undefined &&
        !(await hasForeignLeads(ctx, existing._id, doc.agentId))
      ) {
        // `undefined` clears a field the editor emptied.
        await ctx.db.patch("contacts", existing._id, {
          name,
          phone,
          email,
          searchText: contactSearchText({ name, phone, email }),
          tags: existing.tags.includes("vlasnik") ? existing.tags : [...existing.tags, "vlasnik"],
        });
        await logActivity(ctx, {
          entity: "listing",
          entityId: doc._id,
          action: "listing.owner.updated",
          summary: doc.ref,
          by: viewer._id,
        });
        return null;
      }
    }

    const contactId = await ctx.db.insert("contacts", {
      ...fields,
      searchText: contactSearchText(fields),
      tags: ["vlasnik"],
      consents: [],
      isDemo: false,
    });
    await ctx.db.patch("listings", doc._id, { ownerContactId: contactId, updatedAt: Date.now() });
    await logActivity(ctx, {
      entity: "listing",
      entityId: doc._id,
      action: "listing.owner.linked",
      summary: doc.ref,
      by: viewer._id,
    });
    return null;
  },
});

/** Dashboard to-do lists (PRD B2). `now` is an argument: queries stay pure. */
export const todos = query({
  args: { now: v.number() },
  returns: v.object({
    missingPhotos: v.array(v.object({ id: v.id("listings"), ref: v.string(), count: v.number() })),
    missingFloorPlan: v.array(v.object({ id: v.id("listings"), ref: v.string() })),
    missingTranslations: v.array(v.object({ id: v.id("listings"), ref: v.string(), locales: v.array(v.string()) })),
    mandateExpiring: v.array(v.object({ id: v.id("listings"), ref: v.string(), end: v.number() })),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, EDITORS);
    const agentId = scopedAgentId(viewer, undefined);
    // Agents read their own index, so their to-dos are never crowded out by
    // the rest of the agency's 300 most recent listings.
    const docs =
      agentId === null
        ? []
        : agentId !== undefined
          ? await ctx.db
              .query("listings")
              .withIndex("by_agentId_and_status_and_updatedAt", (q) =>
                q.eq("agentId", agentId).eq("status", "published"),
              )
              .order("desc")
              .take(300)
          : await ctx.db
              .query("listings")
              .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "published"))
              .order("desc")
              .take(300);

    const missingPhotos = [];
    const missingFloorPlan = [];
    const missingTranslations = [];
    const mandateExpiring = [];

    for (const doc of docs) {
      if (!visibleToViewer(viewer, doc)) continue;
      if (doc.media.length < 8) {
        missingPhotos.push({ id: doc._id, ref: doc.ref, count: doc.media.length });
      }
      if (doc.floorPlans.length === 0) {
        missingFloorPlan.push({ id: doc._id, ref: doc.ref });
      }
      const missing: string[] = [];
      for (const locale of ["en", "ru", "de"] as const) {
        const title = doc.title[locale];
        const description = doc.description[locale];
        if (
          title === undefined ||
          title.length === 0 ||
          description === undefined ||
          description.length === 0
        ) {
          missing.push(locale);
        }
      }
      if (missing.length > 0) {
        missingTranslations.push({ id: doc._id, ref: doc.ref, locales: missing });
      }
      if (
        doc.mandateEnd !== undefined &&
        doc.mandateEnd > args.now &&
        doc.mandateEnd < args.now + 14 * 86_400_000
      ) {
        mandateExpiring.push({ id: doc._id, ref: doc.ref, end: doc.mandateEnd });
      }
    }

    return {
      missingPhotos: missingPhotos.slice(0, 20),
      missingFloorPlan: missingFloorPlan.slice(0, 20),
      missingTranslations: missingTranslations.slice(0, 20),
      mandateExpiring: mandateExpiring.slice(0, 20),
    };
  },
});

