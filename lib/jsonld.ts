/**
 * JSON-LD builders (ARCHITECTURE §9). They describe only what the page shows:
 * no ratings, no invented availability, and coordinates only when the listing
 * publishes its exact address.
 */

export type JsonLd = Record<string, unknown>;

/**
 * Serializes for a `<script type="application/ld+json">`. `<` is escaped so a
 * listing text containing `</script>` cannot close the tag and inject markup.
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type BreadcrumbItem = { name: string; url: string };

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** schema.org accommodation type per property type; commercial space has no Accommodation subtype. */
const ACCOMMODATION: Record<string, string> = {
  apartment: "Apartment",
  house: "SingleFamilyResidence",
  cottage: "House",
  commercial: "Place",
  office: "Place",
  land: "Place",
  garage: "Place",
};

export type ListingJsonLdInput = {
  url: string;
  name: string;
  description: string;
  inLanguage: string;
  images: readonly string[];
  datePosted?: number;
  ref: string;
  propertyType: string;
  transaction: "sale" | "rent";
  price: number;
  priceOnRequest: boolean;
  closed: boolean;
  areaM2: number;
  rooms: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  floorLevel?: string;
  address: {
    street?: string;
    locality: string;
    region?: string;
  };
  geo?: { lat: number; lng: number };
  agency: { name: string; registryNo: string; url: string };
};

export function listingJsonLd(input: ListingJsonLdInput): JsonLd {
  const address = {
    "@type": "PostalAddress",
    ...(input.address.street !== undefined ? { streetAddress: input.address.street } : {}),
    addressLocality: input.address.locality,
    ...(input.address.region !== undefined ? { addressRegion: input.address.region } : {}),
    addressCountry: "RS",
  };

  const accommodation: JsonLd = {
    "@type": ACCOMMODATION[input.propertyType] ?? "Place",
    name: input.name,
    floorSize: { "@type": "QuantitativeValue", value: input.areaM2, unitCode: "MTK" },
    address,
    ...(input.propertyType !== "land" && input.propertyType !== "garage"
      ? { numberOfRooms: input.rooms }
      : {}),
    ...(input.bedrooms !== undefined ? { numberOfBedrooms: input.bedrooms } : {}),
    ...(input.bathrooms !== undefined ? { numberOfBathroomsTotal: input.bathrooms } : {}),
    ...(input.yearBuilt !== undefined ? { yearBuilt: input.yearBuilt } : {}),
    ...(input.floorLevel !== undefined ? { floorLevel: input.floorLevel } : {}),
    ...(input.geo !== undefined
      ? { geo: { "@type": "GeoCoordinates", latitude: input.geo.lat, longitude: input.geo.lng } }
      : {}),
  };

  const seller = {
    "@type": "RealEstateAgent",
    "@id": agencyId(new URL(input.agency.url).origin),
    name: input.agency.name,
    url: input.agency.url,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "Registar posrednika",
      value: input.agency.registryNo,
    },
  };

  const offer: JsonLd = {
    "@type": "Offer",
    url: input.url,
    businessFunction:
      input.transaction === "rent" ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell",
    availability: input.closed ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    seller,
    ...(input.priceOnRequest
      ? {}
      : input.transaction === "rent"
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: input.price,
              priceCurrency: "EUR",
              unitCode: "MON",
            },
          }
        : { price: input.price, priceCurrency: "EUR" }),
  };

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${input.url}#listing`,
    url: input.url,
    name: input.name,
    description: input.description,
    inLanguage: input.inLanguage,
    identifier: input.ref,
    ...(input.datePosted !== undefined
      ? { datePosted: new Date(input.datePosted).toISOString() }
      : {}),
    ...(input.images.length > 0 ? { image: input.images.slice(0, 8) } : {}),
    about: accommodation,
    offers: offer,
  };
}

/** A neighborhood / city page (PRD A8): what the page shows, nothing more. */
export function placeJsonLd(input: {
  url: string;
  name: string;
  description?: string;
  inLanguage: string;
  image?: string;
  geo: { lat: number; lng: number };
  containedIn?: { name: string; url: string };
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": `${input.url}#place`,
    name: input.name,
    url: input.url,
    ...(input.description !== undefined && input.description.length > 0
      ? { description: input.description }
      : {}),
    ...(input.image !== undefined ? { image: input.image } : {}),
    geo: { "@type": "GeoCoordinates", latitude: input.geo.lat, longitude: input.geo.lng },
    ...(input.containedIn !== undefined
      ? { containedInPlace: { "@type": "Place", name: input.containedIn.name, url: input.containedIn.url } }
      : {}),
    address: { "@type": "PostalAddress", addressLocality: input.name, addressCountry: "RS" },
  };
}

/** A journal article (PRD A11). The author is an agent profile when the post has one, else the agency. */
export function articleJsonLd(input: {
  url: string;
  headline: string;
  description: string;
  inLanguage: string;
  image?: string;
  datePublished?: number;
  author?: { name: string; url: string };
  publisher: { name: string; url: string; logo: string };
}): JsonLd {
  const publisher = {
    "@type": "Organization",
    name: input.publisher.name,
    url: input.publisher.url,
    logo: { "@type": "ImageObject", url: input.publisher.logo },
  };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    headline: input.headline.slice(0, 110),
    description: input.description,
    inLanguage: input.inLanguage,
    ...(input.image !== undefined ? { image: [input.image] } : {}),
    ...(input.datePublished !== undefined
      ? { datePublished: new Date(input.datePublished).toISOString() }
      : {}),
    author:
      input.author !== undefined
        ? { "@type": "Person", name: input.author.name, url: input.author.url }
        : publisher,
    publisher,
  };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type AgencyJsonLdInput = {
  /** The site origin; `@id` is stable across pages and locales so other nodes can point at it. */
  origin: string;
  url: string;
  inLanguage: string;
  name: string;
  legalName: string;
  /** "Street 1, 11000 City" as stored in settings. */
  address: string;
  taxId: string;
  companyId: string;
  registryNo: string;
  phone?: string;
  email: string;
  logo: string;
  image: string;
  geo?: { lat: number; lng: number };
  /** Already validated office hours; weekday 0 = Sunday … 6 = Saturday. */
  hours: ReadonlyArray<{ weekday: number; from: string; to: string }>;
  sameAs: readonly string[];
};

/** `@id` of the agency node, shared by the sitewide block, the contact/about pages and every listing's seller. */
export function agencyId(origin: string): string {
  return `${origin}/#agency`;
}

/** "Njegoševa 1, 11000 Beograd" → street, postal code, locality; anything else stays one line. */
function postalAddress(address: string): JsonLd {
  const match = /^(.+?),\s*(\d{5})\s+(.+)$/.exec(address.trim());
  return match !== null
    ? {
        "@type": "PostalAddress",
        streetAddress: match[1],
        postalCode: match[2],
        addressLocality: match[3],
        addressCountry: "RS",
      }
    : { "@type": "PostalAddress", streetAddress: address.trim(), addressCountry: "RS" };
}

/** Settings fields the owner has not filled in yet hold instructions, not numbers. */
const hasDigits = (value: string) => /\d/.test(value);

/**
 * The agency itself (ARCHITECTURE §9), rendered once on every public page by
 * the locale layout. Brokerage law Art. 18 asks every ad to name the agency
 * and its broker-registry number, so the registry number is the node's
 * `identifier`; the company number (MB) and PIB (`taxID`) follow e-commerce
 * law Art. 6. Pages that talk about the agency (contact, about, an agent's
 * employer, a listing's seller) point at this node by `@id`.
 */
export function agencyJsonLd(input: AgencyJsonLdInput): JsonLd {
  const identifiers = [
    hasDigits(input.registryNo)
      ? { "@type": "PropertyValue", propertyID: "Registar posrednika", value: input.registryNo }
      : null,
    hasDigits(input.companyId) ? { "@type": "PropertyValue", propertyID: "Matični broj", value: input.companyId } : null,
  ].filter((item) => item !== null);
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": agencyId(input.origin),
    name: input.name,
    legalName: input.legalName,
    url: input.url,
    inLanguage: input.inLanguage,
    logo: input.logo,
    image: input.image,
    ...(identifiers.length > 0 ? { identifier: identifiers.length === 1 ? identifiers[0] : identifiers } : {}),
    ...(hasDigits(input.taxId) ? { taxID: input.taxId } : {}),
    address: postalAddress(input.address),
    ...(input.geo !== undefined
      ? { geo: { "@type": "GeoCoordinates", latitude: input.geo.lat, longitude: input.geo.lng } }
      : {}),
    ...(input.phone !== undefined ? { telephone: input.phone.replace(/[^\d+]/g, "") } : {}),
    email: input.email,
    areaServed: [
      { "@type": "City", name: "Beograd" },
      { "@type": "Country", name: "Srbija" },
    ],
    knowsLanguage: ["sr", "en", "ru", "de"],
    currenciesAccepted: "EUR, RSD",
    ...(input.hours.length > 0
      ? {
          openingHoursSpecification: input.hours.map((slot) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${DAYS[slot.weekday]}`,
            opens: slot.from,
            closes: slot.to,
          })),
        }
      : {}),
    ...(input.sameAs.length > 0 ? { sameAs: [...input.sameAs] } : {}),
  };
}

/** A reference to the agency node for `mainEntity`, `worksFor`, `seller`… */
export function agencyRef(origin: string, name: string): JsonLd {
  return { "@type": "RealEstateAgent", "@id": agencyId(origin), name };
}
