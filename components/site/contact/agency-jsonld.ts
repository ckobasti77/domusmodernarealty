import type { JsonLd } from "@/lib/jsonld";
import { validSlots, type OfficeSlot } from "./hours";

/**
 * `RealEstateAgent` for the contact page: the agency exactly as the page shows
 * it — name, address, phone, e-mail, the office pin and its hours. Registry
 * and tax numbers are included only once they are real numbers (the demo
 * settings hold instructions to the owner instead).
 */

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

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

const hasDigits = (value: string) => /\d/.test(value);

export function agencyJsonLd(input: {
  id: string;
  url: string;
  name: string;
  legalName: string;
  address: string;
  phone?: string;
  email: string;
  geo?: { lat: number; lng: number };
  hours: readonly OfficeSlot[];
  registryNo: string;
  pib: string;
}): JsonLd {
  const hours = validSlots(input.hours).map((slot) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: `https://schema.org/${DAY[slot.weekday]}`,
    opens: slot.from,
    closes: slot.to,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": input.id,
    name: input.name,
    legalName: input.legalName,
    url: input.url,
    email: input.email,
    ...(input.phone !== undefined ? { telephone: input.phone.replace(/[^\d+]/g, "") } : {}),
    address: postalAddress(input.address),
    ...(input.geo !== undefined
      ? { geo: { "@type": "GeoCoordinates", latitude: input.geo.lat, longitude: input.geo.lng } }
      : {}),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
    ...(hasDigits(input.pib) ? { taxID: input.pib } : {}),
    ...(hasDigits(input.registryNo)
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "Registar posrednika",
            value: input.registryNo,
          },
        }
      : {}),
  };
}
