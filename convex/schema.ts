import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  addressVisibilityV,
  answersV,
  assetV,
  availabilitySlotV,
  conditionV,
  consentV,
  constructionTypeV,
  diffEntryV,
  energyClassV,
  featuresV,
  floorV,
  heatingV,
  imageV,
  l10nListV,
  l10nV,
  leadSourceV,
  leadStatusV,
  leadTypeV,
  legalV,
  listingStatusV,
  localeV,
  locationKindV,
  mandateV,
  mediaItemV,
  orientationV,
  pageBlockV,
  pageKeyV,
  parkingV,
  poiV,
  postCategoryV,
  postStatusV,
  propertyTypeV,
  roleV,
  seoV,
  activityEntityV,
  subtypeV,
  tour360V,
  transactionV,
  userStatusV,
  utmV,
  valuationResultV,
  viewingModeV,
  viewingStatusV,
  visibilityV,
  walk3dV,
  furnishingV,
} from "./lib/validators";

/**
 * Fields marked "derived" are recomputed by `convex/lib/derive.ts::applyDerived`
 * on every listing write. They exist so Convex indexes can drive the search
 * (see docs/DECISIONS.md, step 03: search strategy).
 */
export default defineSchema({
  ...authTables,

  users: defineTable({
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: roleV,
    status: userStatusV,
    agentId: v.optional(v.id("agents")),
    lastSeenAt: v.optional(v.number()),
    /**
     * Transient: the Password provider's `profile()` puts the invite token here
     * so `createOrUpdateUser` can verify it. It is NEVER written to a row.
     */
    pendingInviteToken: v.optional(v.string()),
  })
    .index("by_email", { fields: ["email"] })
    .index("by_role", { fields: ["role"] }),

  invites: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    role: roleV,
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdBy: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    agentId: v.optional(v.id("agents")),
  })
    .index("by_email", { fields: ["email"] })
    .index("by_tokenHash", { fields: ["tokenHash"] })
    .index("by_agentId", { fields: ["agentId"] }),

  locations: defineTable({
    kind: locationKindV,
    parentId: v.optional(v.id("locations")),
    slug: v.string(),
    name: l10nV,
    intro: v.optional(l10nV),
    facts: v.optional(l10nListV),
    cover: v.optional(imageV),
    avgPricePerM2Sale: v.optional(v.number()),
    avgPricePerM2Rent: v.optional(v.number()),
    lat: v.number(),
    lng: v.number(),
    featured: v.boolean(),
    order: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_slug", { fields: ["slug"] })
    .index("by_kind_and_order", { fields: ["kind", "order"] })
    .index("by_parentId_and_order", { fields: ["parentId", "order"] })
    .index("by_featured_and_order", { fields: ["featured", "order"] }),

  /** Denormalized listing counts per location; never counted at read time. */
  locationCounts: defineTable({
    locationId: v.id("locations"),
    sale: v.number(),
    rent: v.number(),
  }).index("by_locationId", { fields: ["locationId"] }),

  /**
   * Denormalized listing counts per status: agency-wide (`bucket: "all"`) and
   * per assigned agent. Kept by `lib/counts.ts::applyCountDelta`; rebuilt by
   * `countsMigrations.recountListingStatus`.
   */
  listingStatusCounts: defineTable({
    bucket: v.union(v.literal("all"), v.id("agents")),
    status: listingStatusV,
    count: v.number(),
  }).index("by_bucket_and_status", { fields: ["bucket", "status"] }),

  /** What `listingStatusCounts` currently counts each listing as, so adjustments are idempotent. */
  listingCountKeys: defineTable({
    listingId: v.id("listings"),
    status: listingStatusV,
    agentId: v.id("agents"),
  }).index("by_listingId", { fields: ["listingId"] }),

  agents: defineTable({
    userId: v.optional(v.id("users")),
    slug: v.string(),
    name: v.string(),
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
    order: v.number(),
    availability: v.array(availabilitySlotV),
    isDemo: v.boolean(),
  })
    .index("by_slug", { fields: ["slug"] })
    .index("by_isPublic_and_order", { fields: ["isPublic", "order"] })
    .index("by_userId", { fields: ["userId"] }),

  listings: defineTable({
    ref: v.string(),
    slug: v.string(),
    status: listingStatusV,
    visibility: visibilityV,
    transaction: transactionV,
    propertyType: propertyTypeV,
    subtype: v.optional(subtypeV),
    isExclusive: v.boolean(),
    isFeatured: v.boolean(),
    isDemo: v.boolean(),
    agentId: v.id("agents"),
    ownerContactId: v.optional(v.id("contacts")),
    mandate: v.optional(mandateV),
    /** derived: mandate?.end, so the expiry cron can use an index. */
    mandateEnd: v.optional(v.number()),

    title: l10nV,
    description: l10nV,
    highlights: l10nListV,

    price: v.number(),
    /** derived: price / areaM2 (monthly rent per m² for rentals). */
    pricePerM2: v.number(),
    priceOnRequest: v.optional(v.boolean()),
    /** Last higher asking price, denormalized for the "price reduced" badge. */
    previousPrice: v.optional(v.number()),
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

    /** Location ids are top-level so compound indexes can use them. */
    cityId: v.id("locations"),
    municipalityId: v.optional(v.id("locations")),
    neighborhoodId: v.optional(v.id("locations")),
    location: v.object({
      street: v.optional(v.string()),
      streetNo: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      lat: v.number(),
      lng: v.number(),
      addressVisibility: addressVisibilityV,
    }),

    areaM2: v.number(),
    registeredAreaM2: v.optional(v.number()),
    plotAreaM2: v.optional(v.number()),
    rooms: v.number(),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    floor: floorV,
    /** derived: sortable storey (SUT -1, PSUT -0.5, PR 0, VPR 0.5, PK totalFloors+1). */
    floorNum: v.number(),
    totalFloors: v.optional(v.number()),
    isDuplex: v.optional(v.boolean()),
    isPenthouse: v.optional(v.boolean()),

    constructionType: constructionTypeV,
    yearBuilt: v.optional(v.number()),
    completionDate: v.optional(v.number()),
    renovatedYear: v.optional(v.number()),
    condition: conditionV,
    heating: v.array(heatingV),
    features: featuresV,
    outdoorAreaM2: v.optional(v.number()),
    orientation: v.optional(v.array(orientationV)),
    view: v.optional(v.array(v.string())),
    parking: v.array(parkingV),
    furnishing: furnishingV,
    energyClass: v.optional(energyClassV),
    legal: legalV,
    availableFrom: v.optional(v.number()),
    swapPossible: v.optional(v.boolean()),

    media: v.array(mediaItemV),
    floorPlans: v.array(mediaItemV),
    videoUrl: v.optional(v.string()),
    tour360: v.optional(tour360V),
    walk3d: v.optional(walk3dV),
    /** derived: a published 360° tour, scene set or splat walkthrough exists. */
    hasTour: v.boolean(),
    poi: v.optional(v.array(poiV)),
    seo: v.optional(seoV),

    /** derived: `${status}:${transaction}` — the driver key for every index. */
    scope: v.string(),
    /** derived: diacritic-folded haystack for the search index. */
    searchText: v.string(),

    previewToken: v.optional(v.string()),
    previewExpiresAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_slug", { fields: ["slug"] })
    .index("by_ref", { fields: ["ref"] })
    .index("by_agentId", { fields: ["agentId"] })
    // The admin table for an agent (own listings only) and the agent filter.
    .index("by_agentId_and_updatedAt", { fields: ["agentId", "updatedAt"] })
    .index("by_agentId_and_status_and_updatedAt", {
      fields: ["agentId", "status", "updatedAt"],
    })
    .index("by_status_and_updatedAt", { fields: ["status", "updatedAt"] })
    .index("by_isDemo", { fields: ["isDemo"] })
    .index("by_scope_and_publishedAt", { fields: ["scope", "publishedAt"] })
    .index("by_scope_and_price", { fields: ["scope", "price"] })
    .index("by_scope_and_pricePerM2", { fields: ["scope", "pricePerM2"] })
    .index("by_scope_and_areaM2", { fields: ["scope", "areaM2"] })
    .index("by_scope_and_cityId_and_price", {
      fields: ["scope", "cityId", "price"],
    })
    .index("by_scope_and_municipalityId_and_price", {
      fields: ["scope", "municipalityId", "price"],
    })
    .index("by_scope_and_neighborhoodId_and_publishedAt", {
      fields: ["scope", "neighborhoodId", "publishedAt"],
    })
    .index("by_isFeatured_and_scope", { fields: ["isFeatured", "scope"] })
    .index("by_status_and_mandateEnd", { fields: ["status", "mandateEnd"] })
    .searchIndex("search_text", {
      searchField: "searchText",
      // agentId, status, transaction and isDemo serve the admin table and ⌘K.
      filterFields: [
        "scope",
        "propertyType",
        "cityId",
        "hasTour",
        "agentId",
        "status",
        "transaction",
        "isDemo",
      ],
    }),

  /** 301 targets for renamed slugs. */
  slugRedirects: defineTable({
    from: v.string(),
    listingId: v.id("listings"),
    at: v.number(),
  })
    .index("by_from", { fields: ["from"] })
    .index("by_listingId", { fields: ["listingId"] }),

  priceChanges: defineTable({
    listingId: v.id("listings"),
    from: v.number(),
    to: v.number(),
    at: v.number(),
    by: v.optional(v.id("users")),
  }).index("by_listingId_and_at", { fields: ["listingId", "at"] }),

  tourScenes: defineTable({
    listingId: v.id("listings"),
    order: v.number(),
    title: l10nV,
    pano: imageV,
    panoMobile: v.optional(imageV),
    thumb: v.optional(imageV),
    initialView: v.optional(v.object({ yaw: v.number(), pitch: v.number() })),
    links: v.array(
      v.object({
        toSceneId: v.id("tourScenes"),
        yaw: v.optional(v.number()),
        pitch: v.optional(v.number()),
      }),
    ),
    planXY: v.optional(v.array(v.number())),
  }).index("by_listingId_and_order", { fields: ["listingId", "order"] }),

  splatAssets: defineTable({
    listingId: v.id("listings"),
    label: v.string(),
    asset: assetV,
    credits: v.optional(v.string()),
  }).index("by_listingId", { fields: ["listingId"] }),

  listingStats: defineTable({
    listingId: v.id("listings"),
    views: v.number(),
    favorites: v.number(),
    leads: v.number(),
    viewings: v.number(),
    lastViewedAt: v.optional(v.number()),
  })
    .index("by_listingId", { fields: ["listingId"] })
    .index("by_views", { fields: ["views"] }),

  /** One row per (listing, browser session): makes trackView idempotent. */
  listingViews: defineTable({
    listingId: v.id("listings"),
    sessionKey: v.string(),
    at: v.number(),
  }).index("by_listingId_and_sessionKey", {
    fields: ["listingId", "sessionKey"],
  }),

  dailyStats: defineTable({
    day: v.string(),
    views: v.number(),
    leads: v.number(),
    viewings: v.number(),
    published: v.number(),
  }).index("by_day", { fields: ["day"] }),

  contacts: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    locale: v.optional(localeV),
    tags: v.array(v.string()),
    consents: v.array(consentV),
    note: v.optional(v.string()),
    anonymizedAt: v.optional(v.number()),
    /** Folded name/email/phone words (`contacts.ts::contactSearchText`); absent when anonymized. */
    searchText: v.optional(v.string()),
    isDemo: v.boolean(),
  })
    .index("by_email", { fields: ["email"] })
    .index("by_phone", { fields: ["phone"] })
    .index("by_isDemo", { fields: ["isDemo"] })
    .searchIndex("search_text", { searchField: "searchText" })
    // Fallback for contacts written without `searchText` (diacritics exact).
    .searchIndex("search_name", { searchField: "name" }),

  leads: defineTable({
    type: leadTypeV,
    status: leadStatusV,
    lossReason: v.optional(v.string()),
    listingId: v.optional(v.id("listings")),
    agentId: v.optional(v.id("agents")),
    contactId: v.id("contacts"),
    message: v.optional(v.string()),
    answers: v.optional(answersV),
    valuation: v.optional(valuationResultV),
    /**
     * A phone typed into a public form for an EXISTING contact: kept on the
     * lead, unverified, never copied onto the contact (anyone may type it).
     */
    submittedPhone: v.optional(v.string()),
    source: leadSourceV,
    locale: localeV,
    utm: v.optional(utmV),
    consent: consentV,
    firstResponseAt: v.optional(v.number()),
    nextActionAt: v.optional(v.number()),
    isDemo: v.boolean(),
  })
    .index("by_status_and_creation", { fields: ["status"] })
    .index("by_agentId_and_status", { fields: ["agentId", "status"] })
    // Newest-first inbox of one agent / one type (`_creationTime` follows).
    .index("by_agentId", { fields: ["agentId"] })
    .index("by_type", { fields: ["type"] })
    .index("by_listingId", { fields: ["listingId"] })
    .index("by_type_and_status", { fields: ["type", "status"] })
    .index("by_contactId", { fields: ["contactId"] })
    .index("by_source", { fields: ["source"] })
    .index("by_isDemo", { fields: ["isDemo"] }),

  leadNotes: defineTable({
    leadId: v.id("leads"),
    authorId: v.optional(v.id("users")),
    body: v.string(),
    at: v.number(),
  }).index("by_leadId_and_at", { fields: ["leadId", "at"] }),

  viewings: defineTable({
    listingId: v.id("listings"),
    leadId: v.optional(v.id("leads")),
    agentId: v.id("agents"),
    start: v.number(),
    end: v.number(),
    mode: viewingModeV,
    status: viewingStatusV,
    feedback: v.optional(v.string()),
    isDemo: v.boolean(),
  })
    .index("by_agentId_and_start", { fields: ["agentId", "start"] })
    .index("by_agentId_and_status_and_start", { fields: ["agentId", "status", "start"] })
    .index("by_listingId_and_start", { fields: ["listingId", "start"] })
    // A lead's viewings (lead sheet, anonymization).
    .index("by_leadId_and_start", { fields: ["leadId", "start"] })
    .index("by_status_and_start", { fields: ["status", "start"] })
    .index("by_start", { fields: ["start"] })
    .index("by_isDemo", { fields: ["isDemo"] }),

  posts: defineTable({
    slug: v.string(),
    title: l10nV,
    excerpt: l10nV,
    body: l10nV,
    cover: v.optional(imageV),
    category: postCategoryV,
    tags: v.array(v.string()),
    authorAgentId: v.optional(v.id("agents")),
    status: postStatusV,
    publishedAt: v.optional(v.number()),
    featured: v.boolean(),
    readingMinutes: v.optional(v.number()),
    seo: v.optional(seoV),
    isDemo: v.boolean(),
    /** A draft set to go live at this instant (the scheduler publishes it). */
    scheduledAt: v.optional(v.number()),
    /** The pending `postsAdmin.publishScheduled` run, cancelled on reschedule. */
    scheduledFnId: v.optional(v.id("_scheduled_functions")),
    /** Blobs uploaded into the body; freed when the post is deleted. */
    inlineImages: v.optional(v.array(v.id("_storage"))),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", { fields: ["slug"] })
    .index("by_status_and_publishedAt", { fields: ["status", "publishedAt"] })
    .index("by_category_and_publishedAt", { fields: ["category", "publishedAt"] })
    .index("by_status_and_category_and_publishedAt", {
      fields: ["status", "category", "publishedAt"],
    })
    .index("by_scheduledAt", { fields: ["scheduledAt"] })
    // Removing an agent profile must not orphan the posts it signs.
    .index("by_authorAgentId", { fields: ["authorAgentId"] })
    .index("by_isDemo", { fields: ["isDemo"] }),

  pages: defineTable({
    key: pageKeyV,
    blocks: v.array(pageBlockV),
    seo: v.optional(seoV),
    updatedAt: v.number(),
    /** Who saved it last from the admin; absent on seeded pages. */
    updatedBy: v.optional(v.id("users")),
    isDemo: v.boolean(),
  }).index("by_key", { fields: ["key"] }),

  testimonials: defineTable({
    quote: l10nV,
    author: v.string(),
    context: v.optional(l10nV),
    verified: v.boolean(),
    order: v.number(),
    isDemo: v.boolean(),
  })
    /** The public list: verified, never demo, in the editors' order. */
    .index("by_verified_and_isDemo_and_order", { fields: ["verified", "isDemo", "order"] })
    .index("by_order", { fields: ["order"] })
    .index("by_isDemo", { fields: ["isDemo"] }),

  settings: defineTable({
    key: v.literal("global"),
    companyName: v.string(),
    legalName: v.string(),
    address: v.string(),
    pib: v.string(),
    mb: v.string(),
    registryNo: v.string(),
    insurance: v.optional(v.string()),
    phones: v.array(v.string()),
    email: v.string(),
    viber: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    socials: v.object({
      instagram: v.optional(v.string()),
      facebook: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      youtube: v.optional(v.string()),
    }),
    officeHours: v.array(availabilitySlotV),
    officeLat: v.optional(v.number()),
    officeLng: v.optional(v.number()),
    commissionText: l10nV,
    termsPdf: v.optional(v.id("_storage")),
    mortgage: v.object({
      rate: v.number(),
      years: v.number(),
      downPct: v.number(),
    }),
    eurRsd: v.optional(v.number()),
    stats: v.array(
      v.object({ value: v.string(), label: l10nV, isDemo: v.boolean() }),
    ),
    seo: v.object({
      defaultTitle: l10nV,
      defaultDescription: l10nV,
      ogImage: v.optional(imageV),
    }),
    analytics: v.object({
      plausibleDomain: v.optional(v.string()),
      ga4Id: v.optional(v.string()),
      metaPixelId: v.optional(v.string()),
    }),
    isDemo: v.boolean(),
    updatedAt: v.number(),
  }).index("by_key", { fields: ["key"] }),

  activity: defineTable({
    entity: activityEntityV,
    entityId: v.optional(v.string()),
    action: v.string(),
    summary: v.optional(v.string()),
    diff: v.optional(v.array(diffEntryV)),
    by: v.optional(v.id("users")),
    at: v.number(),
  })
    .index("by_at", { fields: ["at"] })
    .index("by_entity_and_at", { fields: ["entity", "at"] })
    .index("by_entityId_and_at", { fields: ["entityId", "at"] })
    // The activity log's user filter, alone and combined with the entity filter.
    .index("by_by_and_at", { fields: ["by", "at"] })
    .index("by_by_and_entity_and_at", { fields: ["by", "entity", "at"] }),

  /** Prepared for V2 (email alerts); no functions read it yet. */
  savedSearches: defineTable({
    email: v.string(),
    locale: localeV,
    query: v.string(),
    frequency: v.union(v.literal("daily"), v.literal("weekly")),
    lastSentAt: v.optional(v.number()),
    active: v.boolean(),
  }).index("by_email", { fields: ["email"] }),
});
