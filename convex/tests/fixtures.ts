/**
 * Shared fixture builders for the convex-test suites. They write straight to the
 * database through `t.run`, so a test can set up exactly the rows it needs
 * without going through the admin mutations it is trying to test.
 */
import type { Id } from "../_generated/dataModel";
import { applyDerived } from "../lib/derive";
import type { MutationCtx } from "../_generated/server";
import { formatRef, listingSlug } from "../lib/slug";
import type {
  Condition,
  ConstructionType,
  Features,
  Floor,
  Furnishing,
  Heating,
  ListingStatus,
  Parking,
  PropertyType,
  Role,
  Transaction,
} from "../lib/validators";

export const NO_FEATURES: Features = {
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
};

export async function makeLocation(
  ctx: MutationCtx,
  slug: string,
  kind: "city" | "municipality" | "neighborhood" = "city",
  parentId?: Id<"locations">,
): Promise<Id<"locations">> {
  return await ctx.db.insert("locations", {
    kind,
    ...(parentId !== undefined ? { parentId } : {}),
    slug,
    name: { sr: slug, en: slug },
    lat: 44.8,
    lng: 20.45,
    avgPricePerM2Sale: 4000,
    avgPricePerM2Rent: 13,
    featured: false,
    order: 0,
    isDemo: true,
  });
}

export async function makeAgent(
  ctx: MutationCtx,
  slug: string,
): Promise<Id<"agents">> {
  return await ctx.db.insert("agents", {
    slug,
    name: slug,
    role: { sr: "Agent" },
    languages: ["sr"],
    areas: [],
    isPublic: true,
    order: 0,
    availability: [{ weekday: 1, from: "09:00", to: "17:00" }],
    isDemo: true,
  });
}

export async function makeUser(
  ctx: MutationCtx,
  role: Role,
  agentId?: Id<"agents">,
): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    email: `${role}@test.local`,
    name: role,
    role,
    status: "active",
    ...(agentId !== undefined ? { agentId } : {}),
  });
}

export type ListingOverrides = {
  status?: ListingStatus;
  transaction?: Transaction;
  propertyType?: PropertyType;
  price?: number;
  areaM2?: number;
  rooms?: number;
  floor?: Floor;
  totalFloors?: number;
  heating?: Heating[];
  parking?: Parking[];
  furnishing?: Furnishing;
  condition?: Condition;
  constructionType?: ConstructionType;
  features?: Partial<Features>;
  registered?: boolean;
  vatRefundEligible?: boolean;
  mortgageEligible?: boolean;
  isExclusive?: boolean;
  isFeatured?: boolean;
  hasTour?: boolean;
  mediaCount?: number;
  mandateEndsInDays?: number;
  titleSr?: string;
  descriptionSr?: string;
  publishedAt?: number;
  municipalityId?: Id<"locations">;
  neighborhoodId?: Id<"locations">;
};

export async function makeListing(
  ctx: MutationCtx,
  index: number,
  cityId: Id<"locations">,
  agentId: Id<"agents">,
  overrides: ListingOverrides = {},
): Promise<Id<"listings">> {
  const now = Date.now();
  const ref = formatRef(2000 + index);
  const titleSr = overrides.titleSr ?? `Testni stan broj ${index} u Vračaru`;
  const mediaCount = overrides.mediaCount ?? 6;

  const base = {
    ref,
    slug: listingSlug(titleSr, ref),
    status: overrides.status ?? ("published" as ListingStatus),
    visibility: "public" as const,
    transaction: overrides.transaction ?? ("sale" as Transaction),
    propertyType: overrides.propertyType ?? ("apartment" as PropertyType),
    isExclusive: overrides.isExclusive ?? false,
    isFeatured: overrides.isFeatured ?? false,
    isDemo: true,
    agentId,
    mandate: {
      number: `UP-${index}`,
      type: "open" as const,
      start: now - 10 * 86_400_000,
      end: now + (overrides.mandateEndsInDays ?? 180) * 86_400_000,
    },
    title: { sr: titleSr },
    description: {
      sr:
        overrides.descriptionSr ??
        "Detaljan opis testne nekretnine koji ima dovoljno znakova da prođe kontrolnu listu za objavu, sa svim relevantnim podacima o stanu.",
    },
    highlights: { sr: ["Testna stavka"] },
    price: overrides.price ?? 200_000,
    cityId,
    ...(overrides.municipalityId !== undefined
      ? { municipalityId: overrides.municipalityId }
      : {}),
    ...(overrides.neighborhoodId !== undefined
      ? { neighborhoodId: overrides.neighborhoodId }
      : {}),
    location: {
      lat: 44.8,
      lng: 20.45,
      addressVisibility: "area" as const,
    },
    areaM2: overrides.areaM2 ?? 60,
    rooms: overrides.rooms ?? 2,
    floor: overrides.floor ?? 3,
    ...(overrides.totalFloors !== undefined
      ? { totalFloors: overrides.totalFloors }
      : { totalFloors: 5 }),
    constructionType: overrides.constructionType ?? ("old" as ConstructionType),
    condition: overrides.condition ?? ("original" as Condition),
    heating: overrides.heating ?? (["CG"] as Heating[]),
    features: { ...NO_FEATURES, ...overrides.features },
    parking: overrides.parking ?? [],
    furnishing: overrides.furnishing ?? ("unfurnished" as Furnishing),
    legal: {
      registration:
        overrides.registered === false
          ? ("not_registered" as const)
          : ("registered" as const),
      legalization: "legal" as const,
    },
    ...(overrides.vatRefundEligible !== undefined
      ? { vatRefundEligible: overrides.vatRefundEligible }
      : {}),
    ...(overrides.mortgageEligible !== undefined
      ? { mortgageEligible: overrides.mortgageEligible }
      : {}),
    media: Array.from({ length: mediaCount }, (_unused, item) => ({
      id: `m${index}-${item}`,
      image: { kind: "url" as const, url: `https://images.example/${index}-${item}.jpg` },
      alt: { sr: "Testna fotografija" },
      order: item,
      ...(item === 0 ? { isCover: true } : {}),
    })),
    floorPlans: [],
    poi: [],
    // A tour the page can open: published, with scenes (as the seed does).
    ...(overrides.hasTour === true ? { tour360: { provider: "self" as const, published: true } } : {}),
    publishedAt: overrides.publishedAt ?? now - index * 86_400_000,
    updatedAt: now - index * 3600_000,
  };

  const derived = applyDerived(base, ["vracar", "beograd"], overrides.hasTour === true);
  return await ctx.db.insert("listings", { ...base, ...derived });
}
