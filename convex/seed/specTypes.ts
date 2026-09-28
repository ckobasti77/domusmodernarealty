/** Narrow aliases used by convex/seed/spec.ts, re-exported from the validators. */
import type { Infer } from "convex/values";
import type {
  conditionV,
  constructionTypeV,
  floorV,
  furnishingV,
  heatingV,
  listingStatusV,
  parkingV,
  propertyTypeV,
  roomTagV,
  subtypeV,
  transactionV,
} from "../lib/validators";

export type ListingStatus = Infer<typeof listingStatusV>;
export type Transaction = Infer<typeof transactionV>;
export type PropertyType = Infer<typeof propertyTypeV>;
export type Subtype = Infer<typeof subtypeV>;
export type ConstructionType = Infer<typeof constructionTypeV>;
export type Condition = Infer<typeof conditionV>;
export type Heating = Infer<typeof heatingV>;
export type Parking = Infer<typeof parkingV>;
export type Furnishing = Infer<typeof furnishingV>;
export type Floor = Infer<typeof floorV>;
export type RoomTag = Infer<typeof roomTagV>;

/** The `category` values present in docs/assets/demo-media.json. */
export const PHOTO_CATEGORIES = [
  "living",
  "kitchen",
  "bedroom",
  "bathroom",
  "dining",
  "office",
  "terrace",
  "building",
  "villa",
  "belgrade",
  "novisad",
] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];
