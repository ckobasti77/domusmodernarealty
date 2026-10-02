/**
 * The ONLY place a stored document becomes public data.
 *
 * Nothing here returns `mandate`, `ownerContactId`, `previewToken`, `createdBy`
 * or exact coordinates for listings whose `addressVisibility` is not "exact".
 * The return validators below make a leak a type error, not a review finding.
 */
import { v } from "convex/values";
import { externalTourEmbedUrl } from "./tours";
import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
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
  orientationV,
  parkingV,
  poiV,
  propertyTypeV,
  registrationV,
  legalizationV,
  roomTagV,
  subtypeV,
  tourProviderV,
  transactionV,
} from "./validators";
import { publicCoords } from "./geo";
import type { AddressVisibility, ImageRef, MediaItem, Poi } from "./validators";

/* ----------------------------------------------------------------- images */

export const publicImageV = v.object({
  id: v.string(),
  url: v.string(),
  alt: l10nV,
  w: v.optional(v.number()),
  h: v.optional(v.number()),
  blurDataURL: v.optional(v.string()),
  room: v.optional(roomTagV),
  author: v.optional(v.string()),
  sourcePage: v.optional(v.string()),
});
export type PublicImage = Infer<typeof publicImageV>;

/** Resolves a storage id to a signed URL; remote URLs pass through. */
export async function imageUrl(
  ctx: QueryCtx,
  image: ImageRef,
): Promise<string | null> {
  if (image.kind === "url") return image.url;
  return await ctx.storage.getUrl(image.storageId);
}

export async function publicImage(
  ctx: QueryCtx,
  item: MediaItem,
): Promise<PublicImage | null> {
  const url = await imageUrl(ctx, item.image);
  if (url === null) return null;
  return {
    id: item.id,
    url,
    alt: item.alt,
    ...(item.w !== undefined ? { w: item.w } : {}),
    ...(item.h !== undefined ? { h: item.h } : {}),
    ...(item.blurDataURL !== undefined ? { blurDataURL: item.blurDataURL } : {}),
    ...(item.room !== undefined ? { room: item.room } : {}),
    ...(item.author !== undefined ? { author: item.author } : {}),
    ...(item.sourcePage !== undefined ? { sourcePage: item.sourcePage } : {}),
  };
}

async function publicImageList(
  ctx: QueryCtx,
  items: readonly MediaItem[],
): Promise<PublicImage[]> {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const out: PublicImage[] = [];
  for (const item of sorted) {
    const resolved = await publicImage(ctx, item);
    if (resolved !== null) out.push(resolved);
  }
  return out;
}

/* ------------------------------------------------------------- location DTO */

export const locationRefV = v.object({
  _id: v.id("locations"),
  slug: v.string(),
  name: l10nV,
});
export type LocationRef = Infer<typeof locationRefV>;

export function locationRef(doc: Doc<"locations">): LocationRef {
  return { _id: doc._id, slug: doc.slug, name: doc.name };
}

/* ---------------------------------------------------------------- agent DTO */

export const agentPublicV = v.object({
  _id: v.id("agents"),
  slug: v.string(),
  name: v.string(),
  role: l10nV,
  bio: v.optional(l10nV),
  photoUrl: v.optional(v.string()),
  /** Initials used when there is no real photo — never a stock face. */
  monogram: v.string(),
  languages: v.array(v.string()),
  phone: v.optional(v.string()),
  viber: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  email: v.optional(v.string()),
  licenseId: v.optional(v.string()),
  areas: v.array(locationRefV),
  availability: v.array(
    v.object({ weekday: v.number(), from: v.string(), to: v.string() }),
  ),
  isDemo: v.boolean(),
});
export type AgentPublic = Infer<typeof agentPublicV>;

export function monogramOf(name: string): string {
  // Letters and digits only: "Ana (agent)" is AA, not A(.
  const parts = name.split(/[^\p{L}\p{N}]+/u).filter((part) => part.length > 0);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function toAgentPublic(
  ctx: QueryCtx,
  agent: Doc<"agents">,
): Promise<AgentPublic> {
  const photoUrl =
    agent.photo !== undefined ? await imageUrl(ctx, agent.photo) : null;
  const areas: LocationRef[] = [];
  for (const areaId of agent.areas) {
    const location = await ctx.db.get("locations", areaId);
    if (location !== null) areas.push(locationRef(location));
  }
  return {
    _id: agent._id,
    slug: agent.slug,
    name: agent.name,
    role: agent.role,
    ...(agent.bio !== undefined ? { bio: agent.bio } : {}),
    ...(photoUrl !== null ? { photoUrl } : {}),
    monogram: monogramOf(agent.name),
    languages: agent.languages,
    ...(agent.phone !== undefined ? { phone: agent.phone } : {}),
    ...(agent.viber !== undefined ? { viber: agent.viber } : {}),
    ...(agent.whatsapp !== undefined ? { whatsapp: agent.whatsapp } : {}),
    ...(agent.email !== undefined ? { email: agent.email } : {}),
    ...(agent.licenseId !== undefined ? { licenseId: agent.licenseId } : {}),
    areas,
    availability: agent.availability,
    isDemo: agent.isDemo,
  };
}

const AGENCY_ROLE = {
  sr: "Kancelarija agencije",
  en: "Agency office",
  ru: "Офис агентства",
  de: "Büro der Agentur",
} as const;

/**
 * The contact card for a listing whose agent is not public (`isPublic: false`):
 * the agency's own name and channels from settings, never the hidden agent's
 * name, phone, e-mail or licence. Booking stays off (`agents.slots` returns no
 * slots and `viewings.request` refuses a non-public agent); inquiries still
 * reach the assigned agent through the lead.
 */
async function agencyContact(
  ctx: QueryCtx,
  agent: Doc<"agents">,
): Promise<AgentPublic> {
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  const name = settings?.companyName ?? "Mihajlo Estate";
  const phone = settings?.phones[0];
  return {
    _id: agent._id,
    // Hidden profiles get name-based slugs ("ana-babic"); never expose them.
    slug: "agencija",
    name,
    role: AGENCY_ROLE,
    monogram: monogramOf(name),
    languages: [],
    ...(phone !== undefined ? { phone } : {}),
    ...(settings?.viber !== undefined ? { viber: settings.viber } : {}),
    ...(settings?.whatsapp !== undefined ? { whatsapp: settings.whatsapp } : {}),
    ...(settings !== null ? { email: settings.email } : {}),
    areas: [],
    availability: [],
    isDemo: agent.isDemo,
  };
}

/**
 * Nearby places with the exact distance would let anyone triangulate an
 * address the listing hides, so they are rounded to the precision the map
 * shows: 100 m when the street is public, 250 m for an area.
 */
function publicPoi(poi: readonly Poi[], visibility: AddressVisibility): Poi[] {
  if (visibility === "exact") return [...poi];
  const step = visibility === "street" ? 100 : 250;
  return poi.map((item) => ({
    ...item,
    distanceM: Math.max(step, Math.round(item.distanceM / step) * step),
  }));
}

/* -------------------------------------------------------------- listing DTOs */

export const listingCardV = v.object({
  _id: v.id("listings"),
  slug: v.string(),
  ref: v.string(),
  status: listingStatusV,
  transaction: transactionV,
  propertyType: propertyTypeV,
  subtype: v.optional(subtypeV),
  title: l10nV,
  price: v.number(),
  pricePerM2: v.number(),
  previousPrice: v.optional(v.number()),
  areaM2: v.number(),
  rooms: v.number(),
  floor: floorV,
  floorNum: v.number(),
  totalFloors: v.optional(v.number()),
  cover: v.optional(publicImageV),
  /**
   * The first few gallery frames, cover first. Only the search results carry
   * them (PRD A4 card carousel); every other card surface shows the cover.
   */
  images: v.optional(v.array(publicImageV)),
  photoCount: v.number(),
  cityId: v.id("locations"),
  municipalityId: v.optional(v.id("locations")),
  neighborhoodId: v.optional(v.id("locations")),
  locationLabel: l10nV,
  citySlug: v.optional(v.string()),
  areaSlug: v.optional(v.string()),
  isExclusive: v.boolean(),
  isFeatured: v.boolean(),
  isDemo: v.boolean(),
  hasTour: v.boolean(),
  registered: v.boolean(),
  constructionType: constructionTypeV,
  vatRefundEligible: v.optional(v.boolean()),
  mortgageEligible: v.optional(v.boolean()),
  publishedAt: v.optional(v.number()),
  createdAt: v.number(),
  lat: v.number(),
  lng: v.number(),
  coordPrecision: addressVisibilityV,
});
export type ListingCard = Infer<typeof listingCardV>;

/** One map pin plus what its mini-card popup shows. */
export const mapPointV = v.object({
  _id: v.id("listings"),
  slug: v.string(),
  ref: v.string(),
  lat: v.number(),
  lng: v.number(),
  price: v.number(),
  pricePerM2: v.number(),
  transaction: transactionV,
  propertyType: propertyTypeV,
  title: l10nV,
  areaM2: v.number(),
  rooms: v.number(),
  coverUrl: v.optional(v.string()),
});
export type MapPoint = Infer<typeof mapPointV>;

export const listingDetailV = listingCardV.extend({
  description: l10nV,
  highlights: l10nListV,
  media: v.array(publicImageV),
  floorPlans: v.array(publicImageV),
  videoUrl: v.optional(v.string()),
  /** `embedUrl` is the checked player URL of a Matterport/Kuula tour (`externalTourEmbedUrl`). */
  tour360: v.optional(v.object({ provider: tourProviderV, embedUrl: v.optional(v.string()) })),
  hasWalk3d: v.boolean(),
  sceneCount: v.number(),
  bedrooms: v.optional(v.number()),
  bathrooms: v.optional(v.number()),
  registeredAreaM2: v.optional(v.number()),
  plotAreaM2: v.optional(v.number()),
  outdoorAreaM2: v.optional(v.number()),
  isDuplex: v.optional(v.boolean()),
  isPenthouse: v.optional(v.boolean()),
  yearBuilt: v.optional(v.number()),
  renovatedYear: v.optional(v.number()),
  completionDate: v.optional(v.number()),
  condition: conditionV,
  heating: v.array(heatingV),
  features: featuresV,
  orientation: v.optional(v.array(orientationV)),
  view: v.optional(v.array(v.string())),
  parking: v.array(parkingV),
  furnishing: furnishingV,
  energyClass: v.optional(energyClassV),
  legal: v.object({
    registration: registrationV,
    legalization: legalizationV,
    occupancyPermit: v.optional(v.boolean()),
    encumbrance: v.optional(v.string()),
    ownershipShare: v.optional(v.string()),
    docsVerifiedAt: v.optional(v.number()),
  }),
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
  commissionText: v.optional(l10nV),
  vatIncluded: v.optional(v.boolean()),
  developerInstallments: v.optional(v.boolean()),
  urgent: v.optional(v.boolean()),
  availableFrom: v.optional(v.number()),
  swapPossible: v.optional(v.boolean()),
  street: v.optional(v.string()),
  streetNo: v.optional(v.string()),
  poi: v.optional(v.array(poiV)),
  /**
   * The latest `PRICE_HISTORY_MAX` changes since publication, oldest first;
   * `from` is the price before that change.
   */
  priceHistory: v.array(v.object({ at: v.number(), from: v.number(), price: v.number() })),
  agent: agentPublicV,
  city: v.optional(locationRefV),
  municipality: v.optional(locationRefV),
  neighborhood: v.optional(locationRefV),
  seoTitle: v.optional(l10nV),
  seoDescription: v.optional(l10nV),
  seo: v.object({
    /** The admin's share-image override (`seo.ogImage`) as a URL, when one is set. */
    ogImageUrl: v.optional(v.string()),
  }),
});
export type ListingDetail = Infer<typeof listingDetailV>;

/** Location documents one call has already read: a page of cards shares a few places. */
export type LocationCache = Map<Id<"locations">, Doc<"locations"> | null>;

async function locationChain(ctx: QueryCtx, listing: Doc<"listings">, cache?: LocationCache) {
  const read = async (id: Id<"locations">): Promise<Doc<"locations"> | null> => {
    const known = cache?.get(id);
    if (known !== undefined) return known;
    const doc = await ctx.db.get("locations", id);
    cache?.set(id, doc);
    return doc;
  };
  return {
    city: await read(listing.cityId),
    municipality: listing.municipalityId !== undefined ? await read(listing.municipalityId) : null,
    neighborhood: listing.neighborhoodId !== undefined ? await read(listing.neighborhoodId) : null,
  };
}

function labelOf(
  neighborhood: Doc<"locations"> | null,
  municipality: Doc<"locations"> | null,
  city: Doc<"locations"> | null,
) {
  return (neighborhood ?? municipality ?? city)?.name ?? { sr: "Srbija" };
}

export type CardOptions = {
  /** How many gallery frames to attach as `images` (0 = cover only). */
  gallery?: number;
  /** Share one per query call so repeated places are read once. */
  locations?: LocationCache;
};

export async function toCard(
  ctx: QueryCtx,
  listing: Doc<"listings">,
  options: CardOptions = {},
): Promise<ListingCard> {
  const { city, municipality, neighborhood } = await locationChain(ctx, listing, options.locations);
  const ordered = [...listing.media].sort((a, b) => a.order - b.order);
  const coverItem =
    listing.media.find((item) => item.isCover === true) ?? ordered[0];
  const cover =
    coverItem !== undefined ? await publicImage(ctx, coverItem) : null;
  const galleryCount = Math.min(Math.max(options.gallery ?? 0, 0), 8);
  const images: PublicImage[] = [];
  if (galleryCount > 1 && cover !== null) {
    images.push(cover);
    for (const item of ordered) {
      if (images.length >= galleryCount) break;
      if (item.id === coverItem?.id) continue;
      const resolved = await publicImage(ctx, item);
      if (resolved !== null) images.push(resolved);
    }
  }
  const coords = publicCoords(
    listing.location.lat,
    listing.location.lng,
    listing.location.addressVisibility,
  );
  return {
    _id: listing._id,
    slug: listing.slug,
    ref: listing.ref,
    status: listing.status,
    transaction: listing.transaction,
    propertyType: listing.propertyType,
    ...(listing.subtype !== undefined ? { subtype: listing.subtype } : {}),
    title: listing.title,
    price: listing.price,
    pricePerM2: listing.pricePerM2,
    ...(listing.previousPrice !== undefined && listing.previousPrice > listing.price
      ? { previousPrice: listing.previousPrice }
      : {}),
    areaM2: listing.areaM2,
    rooms: listing.rooms,
    floor: listing.floor,
    floorNum: listing.floorNum,
    ...(listing.totalFloors !== undefined ? { totalFloors: listing.totalFloors } : {}),
    ...(cover !== null ? { cover } : {}),
    ...(images.length > 1 ? { images } : {}),
    photoCount: listing.media.length,
    cityId: listing.cityId,
    ...(listing.municipalityId !== undefined
      ? { municipalityId: listing.municipalityId }
      : {}),
    ...(listing.neighborhoodId !== undefined
      ? { neighborhoodId: listing.neighborhoodId }
      : {}),
    locationLabel: labelOf(neighborhood, municipality, city),
    ...(city !== null ? { citySlug: city.slug } : {}),
    ...((neighborhood ?? municipality) !== null
      ? { areaSlug: (neighborhood ?? municipality)!.slug }
      : {}),
    isExclusive: listing.isExclusive,
    isFeatured: listing.isFeatured,
    isDemo: listing.isDemo,
    hasTour: listing.hasTour,
    registered: listing.legal.registration === "registered",
    constructionType: listing.constructionType,
    ...(listing.vatRefundEligible !== undefined
      ? { vatRefundEligible: listing.vatRefundEligible }
      : {}),
    ...(listing.mortgageEligible !== undefined
      ? { mortgageEligible: listing.mortgageEligible }
      : {}),
    ...(listing.publishedAt !== undefined ? { publishedAt: listing.publishedAt } : {}),
    createdAt: listing._creationTime,
    lat: coords.lat,
    lng: coords.lng,
    coordPrecision: coords.precision,
  };
}

export async function toMapPoint(
  ctx: QueryCtx,
  listing: Doc<"listings">,
): Promise<MapPoint> {
  const coords = publicCoords(
    listing.location.lat,
    listing.location.lng,
    listing.location.addressVisibility,
  );
  const coverItem =
    listing.media.find((item) => item.isCover === true) ?? listing.media[0];
  const coverUrl =
    coverItem !== undefined ? await imageUrl(ctx, coverItem.image) : null;
  return {
    _id: listing._id,
    slug: listing.slug,
    ref: listing.ref,
    lat: coords.lat,
    lng: coords.lng,
    price: listing.price,
    pricePerM2: listing.pricePerM2,
    transaction: listing.transaction,
    propertyType: listing.propertyType,
    title: listing.title,
    areaM2: listing.areaM2,
    rooms: listing.rooms,
    ...(coverUrl !== null ? { coverUrl } : {}),
  };
}

/** Price changes the detail page lists. */
const PRICE_HISTORY_MAX = 20;

/**
 * The latest price changes a buyer could have seen, oldest first. Edits made
 * while the listing was a draft are corrections, not price changes, so the
 * index range starts at publication — reading the oldest rows and filtering
 * them afterwards lost every public change behind 20 draft edits.
 */
async function publicPriceChanges(ctx: QueryCtx, listing: Doc<"listings">) {
  const publishedAt = listing.publishedAt;
  if (publishedAt === undefined) return [];
  const latest = await ctx.db
    .query("priceChanges")
    .withIndex("by_listingId_and_at", (q) =>
      q.eq("listingId", listing._id).gte("at", publishedAt),
    )
    .order("desc")
    .take(PRICE_HISTORY_MAX);
  return latest.reverse();
}

export async function toDetail(
  ctx: QueryCtx,
  listing: Doc<"listings">,
): Promise<ListingDetail | null> {
  const card = await toCard(ctx, listing);
  const agentDoc = await ctx.db.get("agents", listing.agentId);
  if (agentDoc === null) return null;

  const { city, municipality, neighborhood } = await locationChain(ctx, listing);
  const scenes = await ctx.db
    .query("tourScenes")
    .withIndex("by_listingId_and_order", (q) => q.eq("listingId", listing._id))
    .take(40);
  const changes = await publicPriceChanges(ctx, listing);
  const ogImage = listing.seo?.ogImage;
  const ogImageUrl = ogImage !== undefined ? await imageUrl(ctx, ogImage) : null;

  const showStreet = listing.location.addressVisibility === "exact";
  const tourPublished = listing.tour360?.published === true;
  const embedUrl =
    listing.tour360 !== undefined && listing.tour360.provider !== "self"
      ? externalTourEmbedUrl(listing.tour360.provider, listing.tour360.url, listing.tour360.externalId)
      : null;

  return {
    ...card,
    description: listing.description,
    highlights: listing.highlights,
    media: await publicImageList(ctx, listing.media),
    floorPlans: await publicImageList(ctx, listing.floorPlans),
    ...(listing.videoUrl !== undefined ? { videoUrl: listing.videoUrl } : {}),
    ...(tourPublished && listing.tour360 !== undefined
      ? {
          tour360:
            listing.tour360.provider === "self"
              ? { provider: "self" as const }
              : {
                  provider: listing.tour360.provider,
                  ...(embedUrl !== null ? { embedUrl } : {}),
                },
        }
      : {}),
    hasWalk3d: listing.walk3d?.published === true,
    sceneCount: tourPublished && listing.tour360?.provider === "self" ? scenes.length : 0,
    ...(listing.bedrooms !== undefined ? { bedrooms: listing.bedrooms } : {}),
    ...(listing.bathrooms !== undefined ? { bathrooms: listing.bathrooms } : {}),
    ...(listing.registeredAreaM2 !== undefined
      ? { registeredAreaM2: listing.registeredAreaM2 }
      : {}),
    ...(listing.plotAreaM2 !== undefined ? { plotAreaM2: listing.plotAreaM2 } : {}),
    ...(listing.outdoorAreaM2 !== undefined
      ? { outdoorAreaM2: listing.outdoorAreaM2 }
      : {}),
    ...(listing.isDuplex !== undefined ? { isDuplex: listing.isDuplex } : {}),
    ...(listing.isPenthouse !== undefined ? { isPenthouse: listing.isPenthouse } : {}),
    ...(listing.yearBuilt !== undefined ? { yearBuilt: listing.yearBuilt } : {}),
    ...(listing.renovatedYear !== undefined
      ? { renovatedYear: listing.renovatedYear }
      : {}),
    ...(listing.completionDate !== undefined
      ? { completionDate: listing.completionDate }
      : {}),
    condition: listing.condition,
    heating: listing.heating,
    features: listing.features,
    ...(listing.orientation !== undefined ? { orientation: listing.orientation } : {}),
    ...(listing.view !== undefined ? { view: listing.view } : {}),
    parking: listing.parking,
    furnishing: listing.furnishing,
    ...(listing.energyClass !== undefined ? { energyClass: listing.energyClass } : {}),
    legal: {
      registration: listing.legal.registration,
      legalization: listing.legal.legalization,
      ...(listing.legal.occupancyPermit !== undefined
        ? { occupancyPermit: listing.legal.occupancyPermit }
        : {}),
      ...(listing.legal.encumbrance !== undefined
        ? { encumbrance: listing.legal.encumbrance }
        : {}),
      ...(listing.legal.ownershipShare !== undefined
        ? { ownershipShare: listing.legal.ownershipShare }
        : {}),
      ...(listing.legal.docsVerifiedAt !== undefined
        ? { docsVerifiedAt: listing.legal.docsVerifiedAt }
        : {}),
    },
    ...(listing.costs !== undefined ? { costs: listing.costs } : {}),
    ...(listing.rent !== undefined ? { rent: listing.rent } : {}),
    ...(listing.commissionText !== undefined
      ? { commissionText: listing.commissionText }
      : {}),
    ...(listing.vatIncluded !== undefined ? { vatIncluded: listing.vatIncluded } : {}),
    ...(listing.developerInstallments !== undefined
      ? { developerInstallments: listing.developerInstallments }
      : {}),
    ...(listing.urgent !== undefined ? { urgent: listing.urgent } : {}),
    ...(listing.availableFrom !== undefined
      ? { availableFrom: listing.availableFrom }
      : {}),
    ...(listing.swapPossible !== undefined
      ? { swapPossible: listing.swapPossible }
      : {}),
    ...(showStreet && listing.location.street !== undefined
      ? { street: listing.location.street }
      : {}),
    ...(showStreet && listing.location.streetNo !== undefined
      ? { streetNo: listing.location.streetNo }
      : {}),
    ...(listing.poi !== undefined
      ? { poi: publicPoi(listing.poi, listing.location.addressVisibility) }
      : {}),
    priceHistory: changes.map((change) => ({
      at: change.at,
      from: change.from,
      price: change.to,
    })),
    agent: agentDoc.isPublic
      ? await toAgentPublic(ctx, agentDoc)
      : await agencyContact(ctx, agentDoc),
    ...(city !== null ? { city: locationRef(city) } : {}),
    ...(municipality !== null ? { municipality: locationRef(municipality) } : {}),
    ...(neighborhood !== null ? { neighborhood: locationRef(neighborhood) } : {}),
    ...(listing.seo?.metaTitle !== undefined
      ? { seoTitle: listing.seo.metaTitle }
      : {}),
    ...(listing.seo?.metaDescription !== undefined
      ? { seoDescription: listing.seo.metaDescription }
      : {}),
    seo: ogImageUrl !== null ? { ogImageUrl } : {},
  };
}
