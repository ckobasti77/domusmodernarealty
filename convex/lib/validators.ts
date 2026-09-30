/**
 * Shared Convex validators for Mihajlo Estate.
 *
 * Every enum lives here exactly once so schema, function args and DTOs agree.
 * Object validators are composed with `.pick()` / `.omit()` / `.extend()` rather
 * than duplicated (see convex/lib/dto.ts).
 */
import { v } from "convex/values";
import type { Infer } from "convex/values";

/* ------------------------------------------------------------------ locales */

export const LOCALES = ["sr-Latn", "en", "ru", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "sr-Latn";

export const localeV = v.union(
  v.literal("sr-Latn"),
  v.literal("en"),
  v.literal("ru"),
  v.literal("de"),
);

/**
 * Stored localized content uses the field key `sr` for the `sr-Latn` locale:
 * Convex identifiers cannot contain a hyphen. `LOCALE_FIELD` is the only mapping
 * between the two, and `lib/derive.ts::pickLocale` is the only reader.
 */
export const L10N_KEYS = ["sr", "en", "ru", "de"] as const;
export type L10nKey = (typeof L10N_KEYS)[number];

export const LOCALE_FIELD: Record<Locale, L10nKey> = {
  "sr-Latn": "sr",
  en: "en",
  ru: "ru",
  de: "de",
};

export const DEFAULT_L10N_KEY: L10nKey = "sr";

/** Localized string: `sr` is mandatory, the rest fall back to it. */
export const l10nV = v.object({
  sr: v.string(),
  en: v.optional(v.string()),
  ru: v.optional(v.string()),
  de: v.optional(v.string()),
});
export type L10n = Infer<typeof l10nV>;

/** Localized list of short strings (highlights, bullet lists). */
export const l10nListV = v.object({
  sr: v.array(v.string()),
  en: v.optional(v.array(v.string())),
  ru: v.optional(v.array(v.string())),
  de: v.optional(v.array(v.string())),
});
export type L10nList = Infer<typeof l10nListV>;

/* -------------------------------------------------------------------- media */

export const imageV = v.union(
  v.object({ kind: v.literal("storage"), storageId: v.id("_storage") }),
  v.object({ kind: v.literal("url"), url: v.string() }),
);
export type ImageRef = Infer<typeof imageV>;

export const roomTagV = v.union(
  v.literal("living"),
  v.literal("kitchen"),
  v.literal("dining"),
  v.literal("bedroom"),
  v.literal("bathroom"),
  v.literal("office"),
  v.literal("terrace"),
  v.literal("hall"),
  v.literal("exterior"),
  v.literal("building"),
  v.literal("view"),
  v.literal("plan"),
  v.literal("other"),
);
export type RoomTag = Infer<typeof roomTagV>;

export const mediaItemV = v.object({
  id: v.string(),
  image: imageV,
  w: v.optional(v.number()),
  h: v.optional(v.number()),
  blurDataURL: v.optional(v.string()),
  alt: l10nV,
  room: v.optional(roomTagV),
  isCover: v.optional(v.boolean()),
  order: v.number(),
  author: v.optional(v.string()),
  sourcePage: v.optional(v.string()),
});
export type MediaItem = Infer<typeof mediaItemV>;

export const assetFormatV = v.union(
  v.literal("spz"),
  v.literal("sog"),
  v.literal("ply"),
  v.literal("splat"),
  v.literal("ksplat"),
  v.literal("glb"),
);

export const assetV = v.object({
  source: imageV,
  format: assetFormatV,
  bytes: v.optional(v.number()),
  splats: v.optional(v.number()),
});

/* ------------------------------------------------------------ listing enums */

export const listingStatusV = v.union(
  v.literal("draft"),
  v.literal("review"),
  v.literal("published"),
  v.literal("reserved"),
  v.literal("sold"),
  v.literal("rented"),
  v.literal("withdrawn"),
  v.literal("archived"),
);
export type ListingStatus = Infer<typeof listingStatusV>;

/** Statuses whose listings are reachable on the public site. */
export const PUBLIC_STATUSES = ["published", "reserved", "sold", "rented"] as const;

export const visibilityV = v.union(
  v.literal("public"),
  v.literal("unlisted"),
  v.literal("private"),
);
export type Visibility = Infer<typeof visibilityV>;

export const transactionV = v.union(v.literal("sale"), v.literal("rent"));
export type Transaction = Infer<typeof transactionV>;

export const propertyTypeV = v.union(
  v.literal("apartment"),
  v.literal("house"),
  v.literal("commercial"),
  v.literal("office"),
  v.literal("land"),
  v.literal("garage"),
  v.literal("cottage"),
);
export type PropertyType = Infer<typeof propertyTypeV>;

export const subtypeV = v.union(
  v.literal("studio"),
  v.literal("duplex"),
  v.literal("penthouse"),
  v.literal("loft"),
  v.literal("villa"),
  v.literal("townhouse"),
  v.literal("retail"),
  v.literal("warehouse"),
  v.literal("building_plot"),
  v.literal("agricultural"),
);

export const constructionTypeV = v.union(
  v.literal("new"),
  v.literal("old"),
  v.literal("under_construction"),
);
export type ConstructionType = Infer<typeof constructionTypeV>;

export const conditionV = v.union(
  v.literal("original"),
  v.literal("renovated"),
  v.literal("lux"),
  v.literal("needs_renovation"),
);
export type Condition = Infer<typeof conditionV>;

export const heatingV = v.union(
  v.literal("CG"),
  v.literal("EG"),
  v.literal("TA"),
  v.literal("gas"),
  v.literal("floor"),
  v.literal("heat_pump"),
  v.literal("AC"),
  v.literal("pellet"),
  v.literal("other"),
);
export type Heating = Infer<typeof heatingV>;

export const parkingV = v.union(
  v.literal("garage"),
  v.literal("garage_spot"),
  v.literal("parking_spot"),
  v.literal("street_zone"),
);
export type Parking = Infer<typeof parkingV>;

export const furnishingV = v.union(
  v.literal("furnished"),
  v.literal("semi"),
  v.literal("unfurnished"),
);
export type Furnishing = Infer<typeof furnishingV>;

export const energyClassV = v.union(
  v.literal("A+"),
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("D"),
  v.literal("E"),
  v.literal("F"),
  v.literal("G"),
);

/** Serbian floor labels plus a numeric storey. */
export const floorV = v.union(
  v.literal("SUT"),
  v.literal("PSUT"),
  v.literal("PR"),
  v.literal("VPR"),
  v.literal("PK"),
  v.number(),
);
export type Floor = Infer<typeof floorV>;

export const orientationV = v.union(
  v.literal("N"),
  v.literal("E"),
  v.literal("S"),
  v.literal("W"),
);

export const addressVisibilityV = v.union(
  v.literal("exact"),
  v.literal("street"),
  v.literal("area"),
);
export type AddressVisibility = Infer<typeof addressVisibilityV>;

export const featuresV = v.object({
  elevator: v.boolean(),
  terrace: v.boolean(),
  loggia: v.boolean(),
  balcony: v.boolean(),
  frenchBalcony: v.boolean(),
  garden: v.boolean(),
  basement: v.boolean(),
  storage: v.boolean(),
  ac: v.boolean(),
  intercom: v.boolean(),
  videoSurveillance: v.boolean(),
  alarm: v.boolean(),
  pool: v.optional(v.boolean()),
  fireplace: v.optional(v.boolean()),
});
export type Features = Infer<typeof featuresV>;

export const FEATURE_KEYS = [
  "elevator",
  "terrace",
  "loggia",
  "balcony",
  "frenchBalcony",
  "garden",
  "basement",
  "storage",
  "ac",
  "intercom",
  "videoSurveillance",
  "alarm",
  "pool",
  "fireplace",
] as const satisfies readonly (keyof Features)[];

export const registrationV = v.union(
  v.literal("registered"),
  v.literal("in_progress"),
  v.literal("not_registered"),
);

export const legalizationV = v.union(
  v.literal("legal"),
  v.literal("legalized"),
  v.literal("in_progress"),
);

export const legalV = v.object({
  registration: registrationV,
  legalization: legalizationV,
  occupancyPermit: v.optional(v.boolean()),
  encumbrance: v.optional(v.string()),
  ownershipShare: v.optional(v.string()),
  docsVerifiedAt: v.optional(v.number()),
  docsVerifiedBy: v.optional(v.id("users")),
});

export const mandateTypeV = v.union(v.literal("exclusive"), v.literal("open"));

export const mandateV = v.object({
  number: v.string(),
  type: mandateTypeV,
  start: v.number(),
  end: v.number(),
});

export const poiKindV = v.union(
  v.literal("school"),
  v.literal("kindergarten"),
  v.literal("transit"),
  v.literal("park"),
  v.literal("shop"),
  v.literal("health"),
);

export const poiV = v.object({
  kind: poiKindV,
  name: v.string(),
  distanceM: v.number(),
});
export type Poi = Infer<typeof poiV>;

export const tourProviderV = v.union(
  v.literal("self"),
  v.literal("matterport"),
  v.literal("kuula"),
);

export const tour360V = v.object({
  provider: tourProviderV,
  externalId: v.optional(v.string()),
  url: v.optional(v.string()),
  published: v.boolean(),
});

export const walk3dV = v.object({
  desktop: v.optional(assetV),
  mobile: v.optional(assetV),
  collision: v.optional(assetV),
  poster: v.optional(imageV),
  spawn: v.optional(
    v.object({ x: v.number(), y: v.number(), z: v.number(), yaw: v.number() }),
  ),
  eyeHeight: v.optional(v.number()),
  floorPolygon: v.optional(v.array(v.array(v.number()))),
  credits: v.optional(v.string()),
  aiGenerated: v.optional(v.boolean()),
  published: v.boolean(),
});

export const seoV = v.object({
  metaTitle: v.optional(l10nV),
  metaDescription: v.optional(l10nV),
  ogImage: v.optional(imageV),
});

/* ------------------------------------------------------------- people, CRM */

export const roleV = v.union(
  v.literal("admin"),
  v.literal("manager"),
  v.literal("agent"),
  v.literal("editor"),
);
export type Role = Infer<typeof roleV>;

export const ALL_ROLES = ["admin", "manager", "agent", "editor"] as const;

export const userStatusV = v.union(
  v.literal("invited"),
  v.literal("active"),
  v.literal("disabled"),
);
export type UserStatus = Infer<typeof userStatusV>;

export const leadTypeV = v.union(
  v.literal("inquiry"),
  v.literal("viewing"),
  v.literal("valuation"),
  v.literal("seller"),
  v.literal("general"),
);
export type LeadType = Infer<typeof leadTypeV>;

export const leadStatusV = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("qualified"),
  v.literal("viewing"),
  v.literal("offer"),
  v.literal("won"),
  v.literal("lost"),
);
export type LeadStatus = Infer<typeof leadStatusV>;

export const LEAD_PIPELINE = [
  "new",
  "contacted",
  "qualified",
  "viewing",
  "offer",
  "won",
  "lost",
] as const satisfies readonly LeadStatus[];

export const leadSourceV = v.union(
  v.literal("web"),
  v.literal("phone"),
  v.literal("email"),
  v.literal("portal"),
  v.literal("walk_in"),
);
export type LeadSource = Infer<typeof leadSourceV>;

/** Free-form form answers, kept to primitive values so nothing is `any`. */
export const answersV = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean()),
);

export const consentV = v.object({
  privacy: v.boolean(),
  marketing: v.boolean(),
  textVersion: v.string(),
  at: v.number(),
  channel: v.optional(v.string()),
});

export const utmV = v.object({
  source: v.optional(v.string()),
  medium: v.optional(v.string()),
  campaign: v.optional(v.string()),
  term: v.optional(v.string()),
  content: v.optional(v.string()),
});
export type Utm = Infer<typeof utmV>;

export const valuationResultV = v.object({
  low: v.number(),
  high: v.number(),
  mid: v.number(),
  pricePerM2: v.number(),
  basis: v.string(),
});

export const viewingStatusV = v.union(
  v.literal("requested"),
  v.literal("confirmed"),
  v.literal("done"),
  v.literal("cancelled"),
  v.literal("no_show"),
);
export type ViewingStatus = Infer<typeof viewingStatusV>;

export const viewingModeV = v.union(v.literal("in_person"), v.literal("video"));
export type ViewingMode = Infer<typeof viewingModeV>;

export const availabilitySlotV = v.object({
  weekday: v.number(),
  from: v.string(),
  to: v.string(),
});

/* ----------------------------------------------------------- content, CMS */

export const locationKindV = v.union(
  v.literal("city"),
  v.literal("municipality"),
  v.literal("neighborhood"),
);
export type LocationKind = Infer<typeof locationKindV>;

export const postStatusV = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);
export type PostStatus = Infer<typeof postStatusV>;

export const postCategoryV = v.union(
  v.literal("guide"),
  v.literal("neighborhood"),
  v.literal("market"),
  v.literal("legal"),
  v.literal("interior"),
);
export type PostCategory = Infer<typeof postCategoryV>;

export const pageKeyV = v.union(
  v.literal("home"),
  v.literal("about"),
  v.literal("sell"),
  v.literal("valuation"),
  v.literal("contact"),
  v.literal("privacy"),
  v.literal("terms"),
  v.literal("cookies"),
);
export type PageKey = Infer<typeof pageKeyV>;

/**
 * Editable page content. A small typed union beats `v.any()`: the admin editor
 * and the public renderer both switch on `type`.
 */
export const pageBlockV = v.union(
  v.object({
    type: v.literal("richText"),
    key: v.string(),
    title: v.optional(l10nV),
    body: l10nV,
  }),
  v.object({
    type: v.literal("stats"),
    key: v.string(),
    items: v.array(
      v.object({ value: v.string(), label: l10nV, isDemo: v.boolean() }),
    ),
  }),
  v.object({
    type: v.literal("steps"),
    key: v.string(),
    items: v.array(v.object({ title: l10nV, body: l10nV })),
  }),
  v.object({
    type: v.literal("faq"),
    key: v.string(),
    items: v.array(v.object({ q: l10nV, a: l10nV })),
  }),
  v.object({
    type: v.literal("cta"),
    key: v.string(),
    heading: l10nV,
    sub: v.optional(l10nV),
    label: l10nV,
    href: v.string(),
  }),
  v.object({
    type: v.literal("media"),
    key: v.string(),
    image: imageV,
    caption: v.optional(l10nV),
  }),
  v.object({
    type: v.literal("list"),
    key: v.string(),
    title: v.optional(l10nV),
    items: l10nListV,
  }),
);
export type PageBlock = Infer<typeof pageBlockV>;

export const activityEntityV = v.union(
  v.literal("listing"),
  v.literal("lead"),
  v.literal("viewing"),
  v.literal("contact"),
  v.literal("user"),
  v.literal("agent"),
  v.literal("location"),
  v.literal("post"),
  v.literal("page"),
  v.literal("testimonial"),
  v.literal("settings"),
  v.literal("media"),
  v.literal("tour"),
  v.literal("demo"),
);
export type ActivityEntity = Infer<typeof activityEntityV>;

/** A field-level diff, stringified so the log never needs `v.any()`. */
export const diffEntryV = v.object({
  field: v.string(),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
});

/* ------------------------------------------------------------------ search */

export const sortV = v.union(
  v.literal("newest"),
  v.literal("price_asc"),
  v.literal("price_desc"),
  v.literal("ppm2_asc"),
  v.literal("ppm2_desc"),
  v.literal("area_desc"),
  v.literal("relevance"),
);
export type Sort = Infer<typeof sortV>;

export const floorBandV = v.union(
  v.literal("not_ground"),
  v.literal("not_top"),
  v.literal("ground"),
  v.literal("attic"),
);

/** A map viewport in degrees (WGS84). */
export const bboxV = v.object({
  west: v.number(),
  south: v.number(),
  east: v.number(),
  north: v.number(),
});

/**
 * Everything the public search accepts. All optional; absent = no constraint.
 *
 * The three location arrays are ONE multi-select: a listing matches when its
 * city, municipality OR neighborhood is among the selected ids (the search
 * page sends a node from any level of the tree, and "Vračar + Dorćol" must mean
 * both places, not their empty intersection).
 */
export const searchFiltersV = v.object({
  q: v.optional(v.string()),
  /**
   * Required: it is half of the `scope` driver key, so every search resolves to
   * exactly one index range (see lib/search.ts). The UI always has one selected.
   */
  transaction: transactionV,
  propertyType: v.optional(v.array(propertyTypeV)),
  subtype: v.optional(v.array(subtypeV)),
  cityId: v.optional(v.array(v.id("locations"))),
  municipalityId: v.optional(v.array(v.id("locations"))),
  neighborhoodId: v.optional(v.array(v.id("locations"))),
  priceMin: v.optional(v.number()),
  priceMax: v.optional(v.number()),
  areaMin: v.optional(v.number()),
  areaMax: v.optional(v.number()),
  roomsMin: v.optional(v.number()),
  roomsMax: v.optional(v.number()),
  rooms: v.optional(v.array(v.number())),
  floorMin: v.optional(v.number()),
  floorMax: v.optional(v.number()),
  floorBands: v.optional(v.array(floorBandV)),
  heating: v.optional(v.array(heatingV)),
  construction: v.optional(v.array(constructionTypeV)),
  condition: v.optional(v.array(conditionV)),
  furnishing: v.optional(v.array(furnishingV)),
  energyClass: v.optional(v.array(energyClassV)),
  parking: v.optional(v.array(parkingV)),
  features: v.optional(v.array(v.string())),
  registered: v.optional(v.boolean()),
  moveIn: v.optional(v.boolean()),
  vatRefund: v.optional(v.boolean()),
  mortgage: v.optional(v.boolean()),
  exclusive: v.optional(v.boolean()),
  /** Any private outdoor space: terrace, loggia, balcony or French balcony. */
  outdoor: v.optional(v.boolean()),
  hasTour: v.optional(v.boolean()),
  agentId: v.optional(v.id("agents")),
  /** Absolute epoch ms, computed on the client from "added in last N days". */
  publishedAfter: v.optional(v.number()),
  /**
   * "Search as I move the map": tested against the PUBLIC (snapped)
   * coordinates, i.e. exactly where the pin is drawn.
   */
  bbox: v.optional(bboxV),
});
export type SearchFilters = Infer<typeof searchFiltersV>;

