/**
 * The listing editor's form model: the zod schema, the form value type, and the
 * two mappings between a stored listing and the form (`docToForm`, and
 * `formToPatch` / `buildSave` for autosave). Pure: no React, no Convex client,
 * so every rule here is unit-tested in `listing-form.test.ts`.
 *
 * WHY A HAND-WRITTEN MIRROR. The server's rules are Convex validators
 * (`convex/lib/validators.ts` and `listingPatchV` in `convex/listingsAdmin.ts`);
 * no zod↔Convex bridge is installed, so the schema below restates them for the
 * browser. Drift is caught by tsc rather than by discipline:
 * - every enum is built from the keys of an exhaustive `Record<Union, label>`
 *   in `lib/admin/labels.ts` (a literal added to a validator makes that record,
 *   and therefore this schema, fail to compile until it is labelled);
 * - `TAB_OF_KEY` must name exactly the keys of the `update` patch (minus the
 *   owner link, which has its own mutation), and the schema must name exactly
 *   the keys of `TAB_OF_KEY`.
 *
 * WHAT THE FORM HOLDS. Every editable field of the listing except media and
 * floor plans (MediaManager owns them), status (workflow buttons), the owner
 * contact (`setOwner`) and slug history. Values are shaped for inputs: empty
 * strings instead of missing text, `yyyy-mm-dd` strings for dates, `""` for
 * "none" in selects, `null` for an empty number or an unstated yes/no, and
 * `NaN` for a number the user typed but that does not parse (so the schema can
 * say so). `null`, not `undefined`: react-hook-form reads an `undefined` field
 * back as its default value, so an emptied input would spring back.
 *
 * WHAT CANNOT BE CLEARED. Convex drops `undefined` keys from arguments, so an
 * optional TOP-LEVEL field (yearBuilt, subtype, energyClass, municipalityId,
 * commissionText, …) cannot be removed through `listingsAdmin.update`: when the
 * user empties one, the stored value simply stays (the key is treated as saved
 * so autosave does not loop). Nested optionals are fine: the parent object is
 * sent whole without the key. Three top-level fields do have a clearing route
 * and use it (`Unset`): the video URL (`media.setVideoUrl`) and the 360° tour /
 * 3D walkthrough (`toursAdmin.setTour360` / `setWalk3d`).
 */
import type { FunctionArgs } from "convex/server";
import { z } from "zod";
import type { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { ChecklistListing } from "@/convex/lib/checklist";
import { FEATURE_KEYS, L10N_KEYS, type ImageRef, type L10n, type L10nKey, type L10nList } from "@/convex/lib/validators";
import { fromDateInput, toDateInput } from "@/lib/admin/format";
import {
  ADDRESS_VISIBILITY_LABEL,
  CONDITION_LABEL,
  CONSTRUCTION_LABEL,
  FLOOR_LABEL,
  FURNISHING_LABEL,
  HEATING_LABEL,
  LEGALIZATION_LABEL,
  MANDATE_TYPE_LABEL,
  ORIENTATION_LABEL,
  PARKING_LABEL,
  POI_KIND_LABEL,
  PROPERTY_TYPE_LABEL,
  REGISTRATION_LABEL,
  SUBTYPE_LABEL,
  TOUR_PROVIDER_LABEL,
  TRANSACTION_LABEL,
  VISIBILITY_LABEL,
  type EnergyClass,
} from "@/lib/admin/labels";
import { roomsKey } from "@/lib/listing-text";

export type ListingDoc = Doc<"listings">;
export type ListingPatch = FunctionArgs<typeof api.listingsAdmin.update>["patch"];

type Walk3dDoc = NonNullable<ListingDoc["walk3d"]>;
type AssetDoc = NonNullable<Walk3dDoc["desktop"]>;
export type AssetFormat = AssetDoc["format"];

/* ------------------------------------------------------------ constants */

export const TITLE_MAX = 140;
export const DESCRIPTION_MAX = 10_000;
export const HIGHLIGHTS_MAX = 8;
export const HIGHLIGHT_MAX = 90;
export const VIEW_TAGS_MAX = 6;
export const POI_MAX = 12;
export const META_TITLE_SOFT = 60;
export const META_TITLE_MAX = 70;
export const META_DESCRIPTION_SOFT = 155;
export const META_DESCRIPTION_MAX = 170;
/** The publish checklist's minimum for the Serbian description. */
export const DESCRIPTION_MIN_SR = 80;
export const TITLE_MIN_SR = 10;

/** The same test as `listingsAdmin.update` for URLs it stores. */
export const HTTPS_PATTERN = /^https:\/\/\S+$/;
export const VIDEO_URL_PATTERN =
  /^https:\/\/(?:(?:www\.|m\.)?youtube\.com|youtu\.be|(?:www\.|player\.)?vimeo\.com)\/\S+$/;
/** What `slugify` produces: lowercase ASCII words joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;

export const ASSET_FORMAT_LABEL: Record<AssetFormat, string> = {
  spz: "SPZ",
  sog: "SOG",
  ply: "PLY",
  splat: "SPLAT",
  ksplat: "KSPLAT",
  glb: "GLB",
};

/** Exhaustive by type, so a new energy class fails to compile here first. */
const ENERGY_CLASS_KEYS: Record<EnergyClass, true> = {
  "A+": true,
  A: true,
  B: true,
  C: true,
  D: true,
  E: true,
  F: true,
  G: true,
};

/* -------------------------------------------------------------- schema */

const MSG = {
  required: "Obavezno polje.",
  number: "Unesite broj.",
  negative: "Vrednost ne može biti negativna.",
  integer: "Unesite ceo broj.",
  https: "Adresa mora počinjati sa https://",
  date: "Unesite ispravan datum.",
} as const;

function keysOf<K extends string>(record: Record<K, unknown>): [K, ...K[]] {
  return Object.keys(record) as [K, ...K[]];
}

/** A zod enum whose literals are exactly the keys of an exhaustive label map. */
function enumOf<K extends string>(record: Record<K, unknown>) {
  return z.enum(keysOf(record));
}

const groupFmt = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 1 });

function numberSchema(options: { min?: number; max?: number; integer?: boolean; half?: boolean } = {}) {
  const min = options.min ?? 0;
  let schema = z
    .number({ error: (issue) => (issue.input === null || issue.input === undefined ? MSG.required : MSG.number) })
    .min(min, { error: min === 0 ? MSG.negative : `Najmanje ${groupFmt.format(min)}.` });
  if (options.max !== undefined) {
    schema = schema.max(options.max, { error: `Najviše ${groupFmt.format(options.max)}.` });
  }
  if (options.integer === true) schema = schema.int({ error: MSG.integer });
  if (options.half === true) schema = schema.multipleOf(0.5, { error: "Koristite korake od 0,5." });
  return schema;
}

/** Empty input is `null` and allowed; a non-number (`NaN`) is an error. */
function optionalNumber(options?: Parameters<typeof numberSchema>[0]) {
  return numberSchema(options).nullable();
}

/**
 * `number | null` in the form, so an emptied input is reported, never saved as 0.
 * The explicit `boolean` keeps TS from inferring a type predicate, which would
 * make zod narrow the output to `number` and split the form's input/output types.
 */
function requiredNumber(options?: Parameters<typeof numberSchema>[0]) {
  return numberSchema(options)
    .nullable()
    .refine((value): boolean => value !== null, { error: MSG.required });
}

function text(max: number) {
  return z.string().max(max, { error: `Najviše ${groupFmt.format(max)} znakova.` });
}

const httpsOrEmpty = z
  .string()
  .max(2000, { error: "Adresa je predugačka." })
  .refine((value) => value.trim() === "" || HTTPS_PATTERN.test(value.trim()), { error: MSG.https });

const dateOrEmpty = z
  .string()
  .refine((value) => value === "" || fromDateInput(value) !== undefined, { error: MSG.date });

function idSchema<T extends "agents" | "locations" | "_storage">() {
  return z.custom<Id<T>>((value) => typeof value === "string" && value.length > 0, { error: MSG.required });
}

const storageIdSchema = idSchema<"_storage">();

function l10nSchema(max: number) {
  return z.object({ sr: text(max), en: text(max), ru: text(max), de: text(max) });
}

/**
 * An optional localized text. When any translation is filled, Serbian must be
 * too: it is the fallback every other locale reads when its own text is missing.
 */
function optionalL10nSchema(max: number) {
  return l10nSchema(max).superRefine((value, ctx) => {
    const others = (["en", "ru", "de"] as const).some((key) => value[key].trim() !== "");
    if (others && value.sr.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["sr"],
        message: "Unesite i srpski tekst — on se prikazuje kada prevod nedostaje.",
      });
    }
  });
}

const highlightList = z
  .array(text(HIGHLIGHT_MAX))
  .max(HIGHLIGHTS_MAX, { error: `Najviše ${HIGHLIGHTS_MAX} stavki.` });

const mandateSchema = z
  .object({
    number: text(60),
    type: enumOf(MANDATE_TYPE_LABEL),
    start: dateOrEmpty,
    end: dateOrEmpty,
  })
  .superRefine((mandate, ctx) => {
    const hasNumber = mandate.number.trim() !== "";
    const hasStart = mandate.start !== "";
    const hasEnd = mandate.end !== "";
    if ((hasNumber || hasStart || hasEnd) && !(hasNumber && hasStart && hasEnd)) {
      if (!hasNumber) ctx.addIssue({ code: "custom", path: ["number"], message: "Unesite broj ugovora." });
      if (!hasStart) ctx.addIssue({ code: "custom", path: ["start"], message: "Unesite datum početka." });
      if (!hasEnd) ctx.addIssue({ code: "custom", path: ["end"], message: "Unesite datum isteka." });
    }
    const start = fromDateInput(mandate.start);
    const end = fromDateInput(mandate.end);
    if (start !== undefined && end !== undefined && end <= start) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "Kraj ugovora mora biti posle početka." });
    }
  });

const assetSchema = z.object({
  url: httpsOrEmpty,
  storageId: storageIdSchema.optional(),
  format: enumOf(ASSET_FORMAT_LABEL),
  bytes: z.number().optional(),
  splats: z.number().optional(),
});

const imageRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("storage"), storageId: storageIdSchema }),
  z.object({ kind: z.literal("url"), url: z.string() }),
]);

const poiSchema = z.object({
  kind: enumOf(POI_KIND_LABEL),
  name: z
    .string()
    .max(80, { error: "Najviše 80 znakova." })
    .refine((value) => value.trim() !== "", { error: "Unesite naziv." }),
  distanceM: requiredNumber({ integer: true, max: 100_000 }),
});

/**
 * One entry per editable listing field. Its keys are checked against
 * `TAB_OF_KEY` (and therefore against the `update` patch) by `satisfies`.
 */
const shape = {
  transaction: enumOf(TRANSACTION_LABEL),
  propertyType: enumOf(PROPERTY_TYPE_LABEL),
  subtype: z.union([enumOf(SUBTYPE_LABEL), z.literal("")]),
  visibility: enumOf(VISIBILITY_LABEL),
  isExclusive: z.boolean(),
  isFeatured: z.boolean(),
  agentId: idSchema<"agents">(),
  mandate: mandateSchema,

  title: l10nSchema(TITLE_MAX),
  description: l10nSchema(DESCRIPTION_MAX),
  highlights: z.object({ sr: highlightList, en: highlightList, ru: highlightList, de: highlightList }),

  price: requiredNumber({ max: 1_000_000_000 }),
  priceOnRequest: z.boolean(),
  vatIncluded: z.boolean(),
  vatRefundEligible: z.boolean(),
  mortgageEligible: z.boolean(),
  developerInstallments: z.boolean(),
  urgent: z.boolean(),
  commissionText: optionalL10nSchema(500),
  costs: z.object({
    infostan: optionalNumber({ max: 100_000 }),
    maintenance: optionalNumber({ max: 100_000 }),
    utilitiesIncluded: z.boolean(),
  }),
  rent: z.object({
    deposit: optionalNumber({ max: 10_000_000 }),
    minLeaseMonths: optionalNumber({ integer: true, max: 240 }),
    petsAllowed: z.boolean().nullable(),
    utilitiesIncluded: z.boolean().nullable(),
  }),

  cityId: idSchema<"locations">(),
  municipalityId: z.union([idSchema<"locations">(), z.literal("")]),
  neighborhoodId: z.union([idSchema<"locations">(), z.literal("")]),
  location: z.object({
    street: text(120),
    streetNo: text(20),
    postalCode: z
      .string()
      .refine((value) => value === "" || /^\d{5}$/.test(value), { error: "Poštanski broj ima 5 cifara." }),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    addressVisibility: enumOf(ADDRESS_VISIBILITY_LABEL),
  }),

  areaM2: requiredNumber({ max: 1_000_000 }),
  registeredAreaM2: optionalNumber({ max: 1_000_000 }),
  plotAreaM2: optionalNumber({ max: 100_000_000 }),
  rooms: requiredNumber({ max: 20, half: true }),
  bedrooms: optionalNumber({ integer: true, max: 50 }),
  bathrooms: optionalNumber({ integer: true, max: 50 }),
  floor: z.union([enumOf(FLOOR_LABEL), z.number().int({ error: MSG.integer }).min(-5).max(200)]),
  totalFloors: optionalNumber({ integer: true, max: 200 }),
  isDuplex: z.boolean(),
  isPenthouse: z.boolean(),

  constructionType: enumOf(CONSTRUCTION_LABEL),
  yearBuilt: optionalNumber({ integer: true, min: 1800, max: 2100 }),
  completionDate: dateOrEmpty,
  renovatedYear: optionalNumber({ integer: true, min: 1800, max: 2100 }),
  condition: enumOf(CONDITION_LABEL),
  heating: z.array(enumOf(HEATING_LABEL)),
  features: z.record(z.enum(FEATURE_KEYS), z.boolean()),
  outdoorAreaM2: optionalNumber({ max: 1_000_000 }),
  orientation: z.array(enumOf(ORIENTATION_LABEL)),
  view: z
    .array(text(40))
    .max(VIEW_TAGS_MAX, { error: `Najviše ${VIEW_TAGS_MAX} oznaka.` }),
  parking: z.array(enumOf(PARKING_LABEL)),
  furnishing: enumOf(FURNISHING_LABEL),
  energyClass: z.union([enumOf(ENERGY_CLASS_KEYS), z.literal("")]),
  legal: z.object({
    registration: enumOf(REGISTRATION_LABEL),
    legalization: enumOf(LEGALIZATION_LABEL),
    occupancyPermit: z.boolean().nullable(),
    encumbrance: text(1000),
    ownershipShare: text(60),
    docsVerifiedAt: z.number().nullable(),
  }),
  availableFrom: dateOrEmpty,
  swapPossible: z.boolean(),

  videoUrl: z
    .string()
    .refine((value) => value.trim() === "" || VIDEO_URL_PATTERN.test(value.trim()), {
      error: "Unesite https adresu videa sa YouTube-a ili Vimeo-a.",
    }),
  tour360: z
    .object({
      provider: z.union([enumOf(TOUR_PROVIDER_LABEL), z.literal("none")]),
      externalId: text(120),
      url: httpsOrEmpty,
      published: z.boolean(),
    })
    .superRefine((tour, ctx) => {
      // `derive.ts`: an external tour is live only with a URL to embed.
      if (tour.published && tour.provider !== "self" && tour.provider !== "none" && tour.url.trim() === "") {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Za objavu unesite adresu ture." });
      }
    }),
  walk3d: z
    .object({
      desktop: assetSchema,
      mobile: assetSchema,
      collision: assetSchema,
      posterUrl: httpsOrEmpty,
      posterStorageId: storageIdSchema.optional(),
      credits: text(300),
      aiGenerated: z.boolean(),
      published: z.boolean(),
      spawn: z.object({ x: z.number(), y: z.number(), z: z.number(), yaw: z.number() }).optional(),
      eyeHeight: z.number().optional(),
      floorPolygon: z.array(z.array(z.number())).optional(),
    })
    .superRefine((walk, ctx) => {
      if (walk.published && !hasAsset(walk.desktop)) {
        ctx.addIssue({ code: "custom", path: ["desktop", "url"], message: "Za objavu je potreban model za desktop." });
      }
    }),
  poi: z.array(poiSchema).max(POI_MAX, { error: `Najviše ${POI_MAX} mesta.` }),
  seo: z.object({
    metaTitle: optionalL10nSchema(META_TITLE_MAX),
    metaDescription: optionalL10nSchema(META_DESCRIPTION_MAX),
    ogImage: z.union([imageRefSchema, z.null()]),
  }),
  slug: z
    .string()
    .min(1, { error: "Unesite URL adresu." })
    .max(SLUG_MAX, { error: `Najviše ${SLUG_MAX} znakova.` })
    .regex(SLUG_PATTERN, { error: "Samo mala slova a–z, cifre i crtice, bez razmaka i dijakritika." }),
} satisfies Record<FormKey, z.ZodType>;

export const listingFormSchema = z.object(shape).superRefine(
  (values, ctx) => {
    // Runs even when another field failed (`when`), so it narrows types itself.
    if (
      typeof values.yearBuilt === "number" &&
      typeof values.renovatedYear === "number" &&
      values.renovatedYear < values.yearBuilt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["renovatedYear"],
        message: "Godina renoviranja ne može biti pre godine izgradnje.",
      });
    }
    if (
      typeof values.floor === "number" &&
      typeof values.totalFloors === "number" &&
      values.floor > values.totalFloors
    ) {
      ctx.addIssue({ code: "custom", path: ["floor"], message: "Sprat je iznad ukupne spratnosti zgrade." });
    }
  },
  { when: () => true },
);

export type ListingForm = z.infer<typeof listingFormSchema>;
export type L10nForm = Record<L10nKey, string>;
export type Walk3dForm = ListingForm["walk3d"];
export type AssetForm = Walk3dForm["desktop"];
export type Tour360Form = ListingForm["tour360"];
export type MandateForm = ListingForm["mandate"];

/* ----------------------------------------------------------- key → tab */

export const EDITOR_TABS = [
  "osnovno",
  "lokacija",
  "karakteristike",
  "cena",
  "opis",
  "mediji",
  "3d",
  "pravno",
  "seo",
] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

/**
 * Which tab edits each field (error dots on tab triggers). Must name exactly
 * the keys of the `update` patch, minus `ownerContactId` (`setOwner`).
 */
export const TAB_OF_KEY = {
  transaction: "osnovno",
  propertyType: "osnovno",
  subtype: "osnovno",
  visibility: "osnovno",
  isExclusive: "osnovno",
  isFeatured: "osnovno",
  agentId: "osnovno",
  cityId: "lokacija",
  municipalityId: "lokacija",
  neighborhoodId: "lokacija",
  location: "lokacija",
  poi: "lokacija",
  areaM2: "karakteristike",
  registeredAreaM2: "karakteristike",
  plotAreaM2: "karakteristike",
  outdoorAreaM2: "karakteristike",
  rooms: "karakteristike",
  bedrooms: "karakteristike",
  bathrooms: "karakteristike",
  floor: "karakteristike",
  totalFloors: "karakteristike",
  isDuplex: "karakteristike",
  isPenthouse: "karakteristike",
  constructionType: "karakteristike",
  yearBuilt: "karakteristike",
  completionDate: "karakteristike",
  renovatedYear: "karakteristike",
  condition: "karakteristike",
  furnishing: "karakteristike",
  energyClass: "karakteristike",
  heating: "karakteristike",
  parking: "karakteristike",
  orientation: "karakteristike",
  view: "karakteristike",
  features: "karakteristike",
  availableFrom: "karakteristike",
  swapPossible: "karakteristike",
  price: "cena",
  priceOnRequest: "cena",
  vatIncluded: "cena",
  vatRefundEligible: "cena",
  mortgageEligible: "cena",
  developerInstallments: "cena",
  urgent: "cena",
  costs: "cena",
  rent: "cena",
  commissionText: "cena",
  title: "opis",
  description: "opis",
  highlights: "opis",
  videoUrl: "mediji",
  tour360: "3d",
  walk3d: "3d",
  legal: "pravno",
  mandate: "pravno",
  seo: "seo",
  slug: "seo",
} as const satisfies Record<Exclude<keyof ListingPatch, "ownerContactId">, EditorTab>;

export type FormKey = keyof typeof TAB_OF_KEY;
export const FORM_KEYS = Object.keys(TAB_OF_KEY) as FormKey[];

export function isFormKey(value: unknown): value is FormKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TAB_OF_KEY, value);
}

/* ---------------------------------------------------------- doc → form */

export const EMPTY_TOUR360: Tour360Form = { provider: "none", externalId: "", url: "", published: false };

export function emptyAsset(format: AssetFormat = "spz"): AssetForm {
  return { url: "", format };
}

const EMPTY_MANDATE: MandateForm = { number: "", type: "exclusive", start: "", end: "" };

function l10nIn(value: L10n | undefined): L10nForm {
  return { sr: value?.sr ?? "", en: value?.en ?? "", ru: value?.ru ?? "", de: value?.de ?? "" };
}

function l10nListIn(value: L10nList): Record<L10nKey, string[]> {
  return { sr: [...value.sr], en: [...(value.en ?? [])], ru: [...(value.ru ?? [])], de: [...(value.de ?? [])] };
}

function assetIn(asset: AssetDoc | undefined): AssetForm {
  if (asset === undefined) return emptyAsset();
  const base: AssetForm = {
    url: asset.source.kind === "url" ? asset.source.url : "",
    format: asset.format,
    ...(asset.bytes !== undefined ? { bytes: asset.bytes } : {}),
    ...(asset.splats !== undefined ? { splats: asset.splats } : {}),
  };
  return asset.source.kind === "storage" ? { ...base, storageId: asset.source.storageId } : base;
}

function walkIn(walk: Walk3dDoc | undefined): Walk3dForm {
  return {
    desktop: assetIn(walk?.desktop),
    mobile: assetIn(walk?.mobile),
    collision: assetIn(walk?.collision),
    posterUrl: walk?.poster?.kind === "url" ? walk.poster.url : "",
    ...(walk?.poster?.kind === "storage" ? { posterStorageId: walk.poster.storageId } : {}),
    credits: walk?.credits ?? "",
    aiGenerated: walk?.aiGenerated === true,
    published: walk?.published === true,
    // Set by the scene editor, not here; carried along so a save keeps them.
    ...(walk?.spawn !== undefined ? { spawn: { ...walk.spawn } } : {}),
    ...(walk?.eyeHeight !== undefined ? { eyeHeight: walk.eyeHeight } : {}),
    ...(walk?.floorPolygon !== undefined ? { floorPolygon: walk.floorPolygon.map((row) => [...row]) } : {}),
  };
}

function featuresIn(features: ListingDoc["features"]): ListingForm["features"] {
  const out = {} as ListingForm["features"];
  for (const key of FEATURE_KEYS) out[key] = features[key] === true;
  return out;
}

/** The form's view of a stored listing. Run ONCE per editor mount (and for rebasing). */
export function docToForm(doc: ListingDoc): ListingForm {
  return {
    transaction: doc.transaction,
    propertyType: doc.propertyType,
    subtype: doc.subtype ?? "",
    visibility: doc.visibility,
    isExclusive: doc.isExclusive,
    isFeatured: doc.isFeatured,
    agentId: doc.agentId,
    mandate:
      doc.mandate !== undefined
        ? {
            number: doc.mandate.number,
            type: doc.mandate.type,
            start: toDateInput(doc.mandate.start),
            end: toDateInput(doc.mandate.end),
          }
        : { ...EMPTY_MANDATE },

    title: l10nIn(doc.title),
    description: l10nIn(doc.description),
    highlights: l10nListIn(doc.highlights),

    price: doc.price,
    priceOnRequest: doc.priceOnRequest === true,
    // `lib/costs.ts`: a missing flag means the new-build price includes VAT.
    vatIncluded: doc.vatIncluded !== false,
    vatRefundEligible: doc.vatRefundEligible === true,
    mortgageEligible: doc.mortgageEligible === true,
    developerInstallments: doc.developerInstallments === true,
    urgent: doc.urgent === true,
    commissionText: l10nIn(doc.commissionText),
    costs: {
      infostan: doc.costs?.infostan ?? null,
      maintenance: doc.costs?.maintenance ?? null,
      utilitiesIncluded: doc.costs?.utilitiesIncluded === true,
    },
    rent: {
      deposit: doc.rent?.deposit ?? null,
      minLeaseMonths: doc.rent?.minLeaseMonths ?? null,
      petsAllowed: doc.rent?.petsAllowed ?? null,
      utilitiesIncluded: doc.rent?.utilitiesIncluded ?? null,
    },

    cityId: doc.cityId,
    municipalityId: doc.municipalityId ?? "",
    neighborhoodId: doc.neighborhoodId ?? "",
    location: {
      street: doc.location.street ?? "",
      streetNo: doc.location.streetNo ?? "",
      postalCode: doc.location.postalCode ?? "",
      lat: doc.location.lat,
      lng: doc.location.lng,
      addressVisibility: doc.location.addressVisibility,
    },

    areaM2: doc.areaM2,
    registeredAreaM2: doc.registeredAreaM2 ?? null,
    plotAreaM2: doc.plotAreaM2 ?? null,
    rooms: doc.rooms,
    bedrooms: doc.bedrooms ?? null,
    bathrooms: doc.bathrooms ?? null,
    floor: doc.floor,
    totalFloors: doc.totalFloors ?? null,
    isDuplex: doc.isDuplex === true,
    isPenthouse: doc.isPenthouse === true,

    constructionType: doc.constructionType,
    yearBuilt: doc.yearBuilt ?? null,
    completionDate: toDateInput(doc.completionDate),
    renovatedYear: doc.renovatedYear ?? null,
    condition: doc.condition,
    heating: [...doc.heating],
    features: featuresIn(doc.features),
    outdoorAreaM2: doc.outdoorAreaM2 ?? null,
    orientation: [...(doc.orientation ?? [])],
    view: [...(doc.view ?? [])],
    parking: [...doc.parking],
    furnishing: doc.furnishing,
    energyClass: doc.energyClass ?? "",
    legal: {
      registration: doc.legal.registration,
      legalization: doc.legal.legalization,
      occupancyPermit: doc.legal.occupancyPermit ?? null,
      encumbrance: doc.legal.encumbrance ?? "",
      ownershipShare: doc.legal.ownershipShare ?? "",
      docsVerifiedAt: doc.legal.docsVerifiedAt ?? null,
    },
    availableFrom: toDateInput(doc.availableFrom),
    swapPossible: doc.swapPossible === true,

    videoUrl: doc.videoUrl ?? "",
    tour360:
      doc.tour360 !== undefined
        ? {
            provider: doc.tour360.provider,
            externalId: doc.tour360.externalId ?? "",
            url: doc.tour360.url ?? "",
            published: doc.tour360.published,
          }
        : { ...EMPTY_TOUR360 },
    walk3d: walkIn(doc.walk3d),
    poi: (doc.poi ?? []).map((item) => ({ kind: item.kind, name: item.name, distanceM: item.distanceM })),
    seo: {
      metaTitle: l10nIn(doc.seo?.metaTitle),
      metaDescription: l10nIn(doc.seo?.metaDescription),
      ogImage: doc.seo?.ogImage ?? null,
    },
    slug: doc.slug,
  };
}

/* ---------------------------------------------------------- form → patch */

/** A top-level field that is cleared through its own mutation, not `update`. */
export type Unset = "videoUrl" | "tour360" | "walk3d";

export type SavePlan = {
  patch: ListingPatch;
  unsets: Unset[];
  /** Dirty keys that cannot be saved yet (incomplete or unparsable); they stay dirty. */
  held: FormKey[];
};

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function blank(value: string): boolean {
  return value.trim() === "";
}

/** Blank translations are omitted so the locale falls back to Serbian. */
function l10nOut(value: L10nForm): L10n {
  return {
    sr: value.sr,
    ...(blank(value.en) ? {} : { en: value.en }),
    ...(blank(value.ru) ? {} : { ru: value.ru }),
    ...(blank(value.de) ? {} : { de: value.de }),
  };
}

function hasAnyText(value: L10nForm): boolean {
  return L10N_KEYS.some((key) => !blank(value[key]));
}

/** `undefined` when the optional text is empty (nothing to store). */
function optionalL10nOut(value: L10nForm): L10n | undefined {
  return blank(value.sr) ? undefined : l10nOut(value);
}

function l10nListOut(value: Record<L10nKey, string[]>): L10nList {
  const clean = (lines: string[]) => lines.filter((line) => !blank(line));
  const en = clean(value.en);
  const ru = clean(value.ru);
  const de = clean(value.de);
  return {
    sr: clean(value.sr),
    ...(en.length > 0 ? { en } : {}),
    ...(ru.length > 0 ? { ru } : {}),
    ...(de.length > 0 ? { de } : {}),
  };
}

export function mandateIsEmpty(mandate: MandateForm): boolean {
  return blank(mandate.number) && mandate.start === "" && mandate.end === "";
}

/** The stored contract, or `undefined` until number, start and end are all filled. */
export function mandateOut(mandate: MandateForm): NonNullable<ListingPatch["mandate"]> | undefined {
  const start = fromDateInput(mandate.start);
  const end = fromDateInput(mandate.end);
  if (blank(mandate.number) || start === undefined || end === undefined) return undefined;
  return { number: mandate.number, type: mandate.type, start, end };
}

export function hasAsset(asset: AssetForm): boolean {
  return asset.storageId !== undefined || !blank(asset.url);
}

function assetOut(asset: AssetForm): AssetDoc | undefined {
  const extra = {
    ...(asset.bytes !== undefined ? { bytes: asset.bytes } : {}),
    ...(asset.splats !== undefined ? { splats: asset.splats } : {}),
  };
  if (asset.storageId !== undefined) {
    return { source: { kind: "storage", storageId: asset.storageId }, format: asset.format, ...extra };
  }
  if (blank(asset.url)) return undefined;
  return { source: { kind: "url", url: asset.url.trim() }, format: asset.format, ...extra };
}

/** `null` when nothing is left of the walkthrough (the stored one is then removed). */
export function walkOut(walk: Walk3dForm): Walk3dDoc | null {
  const desktop = assetOut(walk.desktop);
  const mobile = assetOut(walk.mobile);
  const collision = assetOut(walk.collision);
  const poster: ImageRef | undefined =
    walk.posterStorageId !== undefined
      ? { kind: "storage", storageId: walk.posterStorageId }
      : blank(walk.posterUrl)
        ? undefined
        : { kind: "url", url: walk.posterUrl.trim() };
  const empty =
    desktop === undefined &&
    mobile === undefined &&
    collision === undefined &&
    poster === undefined &&
    blank(walk.credits) &&
    !walk.aiGenerated &&
    !walk.published &&
    walk.spawn === undefined &&
    walk.eyeHeight === undefined &&
    walk.floorPolygon === undefined;
  if (empty) return null;
  return {
    ...(desktop !== undefined ? { desktop } : {}),
    ...(mobile !== undefined ? { mobile } : {}),
    ...(collision !== undefined ? { collision } : {}),
    ...(poster !== undefined ? { poster } : {}),
    ...(walk.spawn !== undefined ? { spawn: walk.spawn } : {}),
    ...(walk.eyeHeight !== undefined ? { eyeHeight: walk.eyeHeight } : {}),
    ...(walk.floorPolygon !== undefined ? { floorPolygon: walk.floorPolygon } : {}),
    ...(blank(walk.credits) ? {} : { credits: walk.credits }),
    aiGenerated: walk.aiGenerated,
    published: walk.published,
  };
}

function put<K extends keyof ListingPatch>(patch: ListingPatch, key: K, value: ListingPatch[K]): void {
  patch[key] = value;
}

/**
 * Plans one autosave: the `update` patch for `keys` (the dirty, valid
 * top-level keys), the fields to clear through their own mutations, and the
 * keys that must wait. Nested objects are sent whole.
 *
 * Rentals: `rent.monthly` mirrors `price`, so a save of either (or a switch to
 * "rent") sends both.
 */
export function buildSave(values: ListingForm, keys: readonly FormKey[]): SavePlan {
  const patch: ListingPatch = {};
  const unsets: Unset[] = [];
  const held: FormKey[] = [];
  const keySet = new Set<FormKey>(keys);

  for (const key of keys) {
    switch (key) {
      case "transaction":
      case "propertyType":
      case "visibility":
      case "isExclusive":
      case "isFeatured":
      case "agentId":
      case "cityId":
      case "constructionType":
      case "condition":
      case "furnishing":
      case "floor":
      case "priceOnRequest":
      case "vatIncluded":
      case "vatRefundEligible":
      case "mortgageEligible":
      case "developerInstallments":
      case "urgent":
      case "isDuplex":
      case "isPenthouse":
      case "swapPossible":
      case "heating":
      case "parking":
      case "orientation":
      case "features":
        put(patch, key, values[key]);
        break;

      // Optional top-level selects: "none" cannot be stored (see the file header).
      case "subtype":
      case "municipalityId":
      case "neighborhoodId":
      case "energyClass": {
        const value = values[key];
        if (value !== "") put(patch, key, value);
        break;
      }

      case "view":
        patch.view = values.view.filter((tag) => !blank(tag));
        break;

      case "mandate": {
        const mandate = mandateOut(values.mandate);
        if (mandate !== undefined) patch.mandate = mandate;
        else if (!mandateIsEmpty(values.mandate)) held.push(key);
        break;
      }

      case "title":
      case "description":
        put(patch, key, l10nOut(values[key]));
        break;
      case "highlights":
        patch.highlights = l10nListOut(values.highlights);
        break;
      case "commissionText": {
        const out = optionalL10nOut(values.commissionText);
        if (out !== undefined) patch.commissionText = out;
        else if (hasAnyText(values.commissionText)) held.push(key);
        break;
      }

      case "price":
      case "areaM2":
      case "rooms": {
        const value = values[key];
        if (isNum(value)) put(patch, key, value);
        else held.push(key);
        break;
      }

      case "registeredAreaM2":
      case "plotAreaM2":
      case "outdoorAreaM2":
      case "bedrooms":
      case "bathrooms":
      case "totalFloors":
      case "yearBuilt":
      case "renovatedYear": {
        const value = values[key];
        if (isNum(value)) put(patch, key, value);
        else if (value !== null) held.push(key);
        break;
      }

      case "completionDate":
      case "availableFrom": {
        const ms = fromDateInput(values[key]);
        if (ms !== undefined) put(patch, key, ms);
        else if (values[key] !== "") held.push(key);
        break;
      }

      case "costs": {
        const { infostan, maintenance, utilitiesIncluded } = values.costs;
        if ((infostan !== null && !isNum(infostan)) || (maintenance !== null && !isNum(maintenance))) {
          held.push(key);
          break;
        }
        patch.costs = {
          ...(isNum(infostan) ? { infostan } : {}),
          ...(isNum(maintenance) ? { maintenance } : {}),
          utilitiesIncluded,
        };
        break;
      }

      // Built after the loop: it depends on `price` and `transaction` too.
      case "rent":
        break;

      case "location": {
        const { street, streetNo, postalCode, lat, lng, addressVisibility } = values.location;
        patch.location = {
          ...(blank(street) ? {} : { street }),
          ...(blank(streetNo) ? {} : { streetNo }),
          ...(blank(postalCode) ? {} : { postalCode }),
          lat,
          lng,
          addressVisibility,
        };
        break;
      }

      case "legal": {
        const { registration, legalization, occupancyPermit, encumbrance, ownershipShare, docsVerifiedAt } =
          values.legal;
        patch.legal = {
          registration,
          legalization,
          ...(occupancyPermit !== null ? { occupancyPermit } : {}),
          ...(blank(encumbrance) ? {} : { encumbrance }),
          ...(blank(ownershipShare) ? {} : { ownershipShare }),
          ...(docsVerifiedAt !== null ? { docsVerifiedAt } : {}),
        };
        break;
      }

      case "videoUrl":
        if (blank(values.videoUrl)) unsets.push("videoUrl");
        else patch.videoUrl = values.videoUrl.trim();
        break;

      case "tour360": {
        const tour = values.tour360;
        if (tour.provider === "none") {
          unsets.push("tour360");
          break;
        }
        patch.tour360 = {
          provider: tour.provider,
          ...(blank(tour.externalId) ? {} : { externalId: tour.externalId.trim() }),
          ...(blank(tour.url) ? {} : { url: tour.url.trim() }),
          published: tour.published,
        };
        break;
      }

      case "walk3d": {
        const walk = walkOut(values.walk3d);
        if (walk === null) unsets.push("walk3d");
        else patch.walk3d = walk;
        break;
      }

      case "poi":
        if (values.poi.some((item) => !isNum(item.distanceM))) {
          held.push(key);
          break;
        }
        patch.poi = values.poi.map((item) => ({
          kind: item.kind,
          name: item.name.trim(),
          distanceM: item.distanceM as number,
        }));
        break;

      case "seo": {
        const metaTitle = optionalL10nOut(values.seo.metaTitle);
        const metaDescription = optionalL10nOut(values.seo.metaDescription);
        patch.seo = {
          ...(metaTitle !== undefined ? { metaTitle } : {}),
          ...(metaDescription !== undefined ? { metaDescription } : {}),
          ...(values.seo.ogImage !== null ? { ogImage: values.seo.ogImage } : {}),
        };
        break;
      }

      case "slug":
        if (blank(values.slug)) held.push(key);
        else patch.slug = values.slug.trim();
        break;

      default:
        assertNever(key);
    }
  }

  if (values.transaction === "rent" && (keySet.has("price") || keySet.has("rent") || keySet.has("transaction"))) {
    const { deposit, minLeaseMonths, petsAllowed, utilitiesIncluded } = values.rent;
    const numbersOk =
      (deposit === null || isNum(deposit)) && (minLeaseMonths === null || isNum(minLeaseMonths));
    if (isNum(values.price) && numbersOk) {
      patch.rent = {
        monthly: values.price,
        ...(isNum(deposit) ? { deposit } : {}),
        ...(isNum(minLeaseMonths) ? { minLeaseMonths } : {}),
        ...(petsAllowed !== null ? { petsAllowed } : {}),
        ...(utilitiesIncluded !== null ? { utilitiesIncluded } : {}),
      };
    } else if (keySet.has("rent")) {
      held.push("rent");
    }
  }

  return { patch, unsets, held };
}

/** The `update` patch for `keys`. See `buildSave` for the whole plan. */
export function formToPatch(values: ListingForm, keys: readonly FormKey[]): ListingPatch {
  return buildSave(values, keys).patch;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled listing form key: ${String(value)}`);
}

/* ------------------------------------------------------- dirty tracking */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Structural equality for form values. Keys holding `undefined` count as
 * absent, and `NaN` equals `NaN`, so a doc→form round trip compares equal.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/** Top-level keys whose value differs from the last saved `baseline`. */
export function dirtyKeys(values: ListingForm, baseline: ListingForm): FormKey[] {
  return FORM_KEYS.filter((key) => !deepEqual(values[key], baseline[key]));
}

/** Top-level keys that fail the schema; autosave never sends them. */
export function invalidKeys(values: ListingForm): FormKey[] {
  const result = listingFormSchema.safeParse(values);
  if (result.success) return [];
  const out = new Set<FormKey>();
  for (const issue of result.error.issues) {
    const head = issue.path[0];
    if (isFormKey(head)) out.add(head);
  }
  return [...out];
}

/** `target` with `keys` copied over from `source`. */
export function withKeys(target: ListingForm, source: ListingForm, keys: readonly FormKey[]): ListingForm {
  // Optional keys make ListingForm narrower than a record; the copy keeps its shape.
  const next = { ...target } as Record<FormKey, unknown>;
  for (const key of keys) next[key] = source[key];
  return next as ListingForm;
}

/**
 * What the server would hold for `key` after saving the current `values` on top
 * of `doc`, in form shape. Rebasing compares a server update against it to tell
 * "the echo of my own save" (keep the form as typed) from "someone else changed
 * this field" (show the new value). `undefined` when the key cannot be saved.
 */
export function echoOf(doc: ListingDoc, values: ListingForm, key: FormKey): unknown {
  const plan = buildSave(values, [key]);
  if (plan.held.length > 0) return undefined;
  // Nothing of this key would be written (an emptied optional field, rent terms
  // of a sale): the server's value cannot be an echo of ours.
  const writes = Object.prototype.hasOwnProperty.call(plan.patch, key) || plan.unsets.some((field) => field === key);
  if (!writes) return undefined;
  const merged: ListingDoc = {
    ...doc,
    ...plan.patch,
    ...(plan.unsets.includes("videoUrl") ? { videoUrl: undefined } : {}),
    ...(plan.unsets.includes("tour360") ? { tour360: undefined } : {}),
    ...(plan.unsets.includes("walk3d") ? { walk3d: undefined } : {}),
  };
  return docToForm(merged)[key];
}

/* -------------------------------------------------------- live checklist */

export type ChecklistFormFields = Pick<
  ListingForm,
  | "mandate"
  | "price"
  | "cityId"
  | "location"
  | "areaM2"
  | "rooms"
  | "title"
  | "description"
  | "slug"
  | "propertyType"
>;

/**
 * The listing as the publish checklist should judge it right now: unsaved form
 * values over the stored document (media always comes from the document). A
 * value the form cannot save yet (empty price, half-filled contract) falls back
 * to what is stored, because that is what `publish` will see.
 */
export function checklistListing(doc: ListingDoc, values: ChecklistFormFields): ChecklistListing {
  return {
    mandate: mandateOut(values.mandate) ?? doc.mandate,
    price: isNum(values.price) ? values.price : doc.price,
    cityId: values.cityId,
    location: { ...doc.location, lat: values.location.lat, lng: values.location.lng },
    areaM2: isNum(values.areaM2) ? values.areaM2 : doc.areaM2,
    rooms: isNum(values.rooms) ? values.rooms : doc.rooms,
    media: doc.media,
    title: { ...doc.title, sr: values.title.sr },
    description: { ...doc.description, sr: values.description.sr },
    slug: values.slug.trim(),
    propertyType: values.propertyType,
  };
}

/* ------------------------------------------------------------- helpers */

const STRUCTURE_NAME: Record<string, string> = {
  r05: "garsonjera",
  r1: "jednosoban",
  r15: "jednoiposoban",
  r2: "dvosoban",
  r25: "dvoiposoban",
  r3: "trosoban",
  r35: "troiposoban",
  r4: "četvorosoban",
  r45: "četvoroiposoban",
  r5: "petosoban",
};

/** `2.5` → "dvoiposoban"; `null` for no rooms; "6 soba" beyond the named structures. */
export function structureName(rooms: number | null | undefined): string | null {
  if (!isNum(rooms) || rooms <= 0) return null;
  const key = roomsKey(rooms);
  if (key !== null) {
    const name = STRUCTURE_NAME[key];
    if (name !== undefined) return name;
  }
  return `${groupFmt.format(rooms)} soba`;
}

export type Completeness = "complete" | "partial" | "empty";

/** Per-locale content status: complete = title ≥ 10 and description ≥ 80 characters. */
export function localeCompleteness(title: string, description: string): Completeness {
  const t = title.trim().length;
  const d = description.trim().length;
  if (t >= TITLE_MIN_SR && d >= DESCRIPTION_MIN_SR) return "complete";
  if (t > 0 || d > 0) return "partial";
  return "empty";
}

/** Guesses a splat format from the file extension in a URL. */
export function detectAssetFormat(url: string): AssetFormat | null {
  const path = url.trim().split(/[?#]/)[0]?.toLowerCase() ?? "";
  const match = /\.([a-z0-9]+)$/.exec(path);
  if (match === null) return null;
  const ext = match[1];
  return ext !== undefined && Object.prototype.hasOwnProperty.call(ASSET_FORMAT_LABEL, ext) ? (ext as AssetFormat) : null;
}

/** Whole days from `now` until `ms` (negative once passed). */
export function daysUntil(ms: number, now: number): number {
  return Math.ceil((ms - now) / 86_400_000);
}
