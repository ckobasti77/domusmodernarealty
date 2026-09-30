/**
 * Serbian (Latin) labels for every enum the admin shows. The admin panel is
 * Serbian-only, so these are literals, not `messages/*` keys
 * (IMPLEMENTATION-PLAN §5). One map per validator in `convex/lib/validators.ts`.
 */
import type { Doc } from "@/convex/_generated/dataModel";
import type {
  AddressVisibility,
  Condition,
  ConstructionType,
  Features,
  Furnishing,
  Heating,
  L10nKey,
  ListingStatus,
  Parking,
  PropertyType,
  Role,
  RoomTag,
  Transaction,
  Visibility,
} from "@/convex/lib/validators";

type Listing = Doc<"listings">;
export type Subtype = NonNullable<Listing["subtype"]>;
export type Orientation = NonNullable<Listing["orientation"]>[number];
export type EnergyClass = NonNullable<Listing["energyClass"]>;
export type Registration = Listing["legal"]["registration"];
export type Legalization = Listing["legal"]["legalization"];
export type MandateType = NonNullable<Listing["mandate"]>["type"];
export type PoiKind = NonNullable<Listing["poi"]>[number]["kind"];
export type TourProvider = NonNullable<Listing["tour360"]>["provider"];
export type FloorLabel = Exclude<Listing["floor"], number>;

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "Nacrt",
  review: "Na pregledu",
  published: "Objavljeno",
  reserved: "Rezervisano",
  sold: "Prodato",
  rented: "Izdato",
  withdrawn: "Povučeno",
  archived: "Arhivirano",
};

/** Status tabs, in the order PRD B3 lists them. */
export const STATUS_ORDER: readonly ListingStatus[] = [
  "draft",
  "review",
  "published",
  "reserved",
  "sold",
  "rented",
  "withdrawn",
  "archived",
];

export const TRANSACTION_LABEL: Record<Transaction, string> = {
  sale: "Prodaja",
  rent: "Izdavanje",
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartment: "Stan",
  house: "Kuća",
  commercial: "Poslovni prostor",
  office: "Kancelarija",
  land: "Plac",
  garage: "Garaža",
  cottage: "Vikendica",
};

export const SUBTYPE_LABEL: Record<Subtype, string> = {
  studio: "Garsonjera",
  duplex: "Dupleks",
  penthouse: "Penthaus",
  loft: "Loft",
  villa: "Vila",
  townhouse: "Kuća u nizu",
  retail: "Lokal",
  warehouse: "Magacin",
  building_plot: "Građevinski plac",
  agricultural: "Poljoprivredno zemljište",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "Javna",
  unlisted: "Skrivena iz pretrage",
  private: "Privatna",
};

export const CONSTRUCTION_LABEL: Record<ConstructionType, string> = {
  new: "Novogradnja",
  old: "Starogradnja",
  under_construction: "U izgradnji",
};

export const CONDITION_LABEL: Record<Condition, string> = {
  original: "Izvorno stanje",
  renovated: "Renovirano",
  lux: "Lux",
  needs_renovation: "Za renoviranje",
};

export const HEATING_LABEL: Record<Heating, string> = {
  CG: "Centralno grejanje",
  EG: "Etažno grejanje",
  TA: "TA peć",
  gas: "Gas",
  floor: "Podno grejanje",
  heat_pump: "Toplotna pumpa",
  AC: "Klima uređaj",
  pellet: "Pelet",
  other: "Ostalo",
};

export const PARKING_LABEL: Record<Parking, string> = {
  garage: "Garaža",
  garage_spot: "Garažno mesto",
  parking_spot: "Parking mesto",
  street_zone: "Parking zona na ulici",
};

export const FURNISHING_LABEL: Record<Furnishing, string> = {
  furnished: "Namešteno",
  semi: "Polunamešteno",
  unfurnished: "Prazno",
};

export const FEATURE_LABEL: Record<keyof Features, string> = {
  elevator: "Lift",
  terrace: "Terasa",
  loggia: "Lođa",
  balcony: "Balkon",
  frenchBalcony: "Francuski balkon",
  garden: "Dvorište / bašta",
  basement: "Podrum",
  storage: "Ostava",
  ac: "Klima",
  intercom: "Interfon",
  videoSurveillance: "Video nadzor",
  alarm: "Alarm",
  pool: "Bazen",
  fireplace: "Kamin",
};

export const ORIENTATION_LABEL: Record<Orientation, string> = {
  N: "Sever",
  E: "Istok",
  S: "Jug",
  W: "Zapad",
};

export const ENERGY_CLASSES: readonly EnergyClass[] = ["A+", "A", "B", "C", "D", "E", "F", "G"];

export const ADDRESS_VISIBILITY_LABEL: Record<AddressVisibility, string> = {
  exact: "Tačna adresa i pin",
  street: "Samo ulica, približan pin",
  area: "Samo naselje, približan pin",
};

export const FLOOR_LABEL: Record<FloorLabel, string> = {
  SUT: "Suteren",
  PSUT: "Polusuteren",
  PR: "Prizemlje",
  VPR: "Visoko prizemlje",
  PK: "Potkrovlje",
};

export const REGISTRATION_LABEL: Record<Registration, string> = {
  registered: "Uknjiženo",
  in_progress: "Uknjižba u toku",
  not_registered: "Nije uknjiženo",
};

export const LEGALIZATION_LABEL: Record<Legalization, string> = {
  legal: "Izgrađeno po dozvoli",
  legalized: "Legalizovano",
  in_progress: "Legalizacija u toku",
};

export const MANDATE_TYPE_LABEL: Record<MandateType, string> = {
  exclusive: "Ekskluzivni",
  open: "Neekskluzivni",
};

export const ROOM_TAG_LABEL: Record<RoomTag, string> = {
  living: "Dnevna soba",
  kitchen: "Kuhinja",
  dining: "Trpezarija",
  bedroom: "Spavaća soba",
  bathroom: "Kupatilo",
  office: "Radna soba",
  terrace: "Terasa",
  hall: "Hodnik",
  exterior: "Spoljašnjost",
  building: "Zgrada",
  view: "Pogled",
  plan: "Plan",
  other: "Ostalo",
};

export const POI_KIND_LABEL: Record<PoiKind, string> = {
  school: "Škola",
  kindergarten: "Vrtić",
  transit: "Javni prevoz",
  park: "Park",
  shop: "Prodavnica",
  health: "Zdravstvo",
};

export const TOUR_PROVIDER_LABEL: Record<TourProvider, string> = {
  self: "Sopstvene 360° panorame",
  matterport: "Matterport",
  kuula: "Kuula",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  manager: "Menadžer",
  agent: "Agent",
  editor: "Urednik",
};

/** Content locales, keyed the way Convex stores them (`sr`, not `sr-Latn`). */
export const L10N_LABEL: Record<L10nKey, string> = {
  sr: "Srpski",
  en: "Engleski",
  ru: "Ruski",
  de: "Nemački",
};

export const L10N_SHORT: Record<L10nKey, string> = {
  sr: "SR",
  en: "EN",
  ru: "RU",
  de: "DE",
};
