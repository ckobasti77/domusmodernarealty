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
