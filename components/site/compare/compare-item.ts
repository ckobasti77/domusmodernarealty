import type { ListingDetail } from "@/convex/lib/dto";

/**
 * The slice of a listing's detail DTO the comparison actually shows. A full
 * `ListingDetail` carries the description in four languages, every gallery
 * frame, the agent and the price history; a shared comparison would ship four
 * of those to the browser just to render a table. The server page and the
 * client island both project through `toCompareItem`, so the two sources can
 * never disagree about a field.
 */
export type CompareItem = Pick<
  ListingDetail,
  | "_id"
  | "slug"
  | "ref"
  | "status"
  | "transaction"
  | "propertyType"
  | "title"
  | "locationLabel"
  | "cover"
  | "price"
  | "pricePerM2"
  | "previousPrice"
  | "areaM2"
  | "rooms"
  | "floor"
  | "totalFloors"
  | "bathrooms"
  | "outdoorAreaM2"
  | "plotAreaM2"
  | "yearBuilt"
  | "renovatedYear"
  | "constructionType"
  | "condition"
  | "furnishing"
  | "heating"
  | "parking"
  | "energyClass"
  | "costs"
  | "mortgageEligible"
  | "vatRefundEligible"
> & {
  elevator: boolean;
  registration: ListingDetail["legal"]["registration"];
  docsVerified: boolean;
};

export function toCompareItem(listing: ListingDetail): CompareItem {
  return {
    _id: listing._id,
    slug: listing.slug,
    ref: listing.ref,
    status: listing.status,
    transaction: listing.transaction,
    propertyType: listing.propertyType,
    title: listing.title,
    locationLabel: listing.locationLabel,
    ...(listing.cover !== undefined ? { cover: listing.cover } : {}),
    price: listing.price,
    pricePerM2: listing.pricePerM2,
    ...(listing.previousPrice !== undefined ? { previousPrice: listing.previousPrice } : {}),
    areaM2: listing.areaM2,
    rooms: listing.rooms,
    floor: listing.floor,
    ...(listing.totalFloors !== undefined ? { totalFloors: listing.totalFloors } : {}),
    ...(listing.bathrooms !== undefined ? { bathrooms: listing.bathrooms } : {}),
    ...(listing.outdoorAreaM2 !== undefined ? { outdoorAreaM2: listing.outdoorAreaM2 } : {}),
    ...(listing.plotAreaM2 !== undefined ? { plotAreaM2: listing.plotAreaM2 } : {}),
    ...(listing.yearBuilt !== undefined ? { yearBuilt: listing.yearBuilt } : {}),
    ...(listing.renovatedYear !== undefined ? { renovatedYear: listing.renovatedYear } : {}),
    constructionType: listing.constructionType,
    condition: listing.condition,
    furnishing: listing.furnishing,
    heating: listing.heating,
    parking: listing.parking,
    ...(listing.energyClass !== undefined ? { energyClass: listing.energyClass } : {}),
    ...(listing.costs !== undefined ? { costs: listing.costs } : {}),
    ...(listing.mortgageEligible !== undefined ? { mortgageEligible: listing.mortgageEligible } : {}),
    ...(listing.vatRefundEligible !== undefined ? { vatRefundEligible: listing.vatRefundEligible } : {}),
    elevator: listing.features.elevator,
    registration: listing.legal.registration,
    docsVerified: listing.legal.docsVerifiedAt !== undefined,
  };
}
