import { displayFloor, displayTotalFloors } from "@/components/site/listing/floor";
import { isUnsplash, unsplashAt } from "@/components/site/listing/media";
import type { ListingDetail } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { formatArea, formatPrice, formatPricePerM2 } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { floorLabel, placeShort, structureTitle, type ListingTranslator } from "@/lib/listing-text";

/**
 * The listing page's generated `<title>` and meta description and its share
 * card (PRD A5). Plain functions of the public DTO and the `listing` / `units`
 * translators, so `generateMetadata`, the share-image route and the unit tests
 * all run the same code. The SEO tab's own title and description, when set,
 * replace the generated ones in the page.
 */

/** "430.000 €" / "1.200 € mesečno". */
export function priceText(
  listing: Pick<ListingDetail, "price" | "transaction">,
  locale: Locale,
  tUnits: ListingTranslator,
): string {
  const base = formatPrice(listing.price, locale);
  return listing.transaction === "rent" ? `${base} ${tUnits("perMonth")}` : base;
}

export type MetaListing = Pick<
  ListingDetail,
  | "title"
  | "propertyType"
  | "transaction"
  | "price"
  | "pricePerM2"
  | "areaM2"
  | "rooms"
  | "floor"
  | "totalFloors"
  | "ref"
  | "locationLabel"
>;

/** "Trosoban stan, Neimar — 430.000 €". */
export function listingMetaTitle(
  listing: MetaListing,
  locale: Locale,
  t: ListingTranslator,
  tUnits: ListingTranslator,
): string {
  return t("seoTitle", {
    structure: structureTitle(t, listing, locale, tUnits("m2")),
    place: placeShort(listing, locale),
    price: priceText(listing, locale, tUnits),
  });
}

/**
 * "Trosoban stan u Neimaru. 86 m², 3 od 5. Cena 430.000 € (5.000 €/m²).
 * Šifra ME-1042." The title drops its own closing full stop (the pattern adds
 * one). A plot has no floor, as in the key facts and on its card, and a named
 * floor is written in lower case mid-sentence, except in German.
 */
export function listingMetaDescription(
  listing: MetaListing,
  locale: Locale,
  t: ListingTranslator,
  tUnits: ListingTranslator,
): string {
  const m2 = tUnits("m2");
  const facts = [formatArea(listing.areaM2, locale, m2)];
  if (listing.propertyType !== "land") {
    const floor = floorLabel(t, displayFloor(listing.floor, locale), displayTotalFloors(listing.totalFloors, locale));
    facts.push(locale === "de" ? floor : floor.charAt(0).toLocaleLowerCase(locale) + floor.slice(1));
  }
  return t("seoDescription", {
    title: pickL10n(listing.title, locale).text.replace(/[.\s]+$/u, ""),
    facts: facts.join(", "),
    price: priceText(listing, locale, tUnits),
    perM2: formatPricePerM2(listing.pricePerM2, locale, m2),
    ref: listing.ref,
  });
}

export type ShareCardListing = Pick<
  ListingDetail,
  "cover" | "seo" | "status" | "transaction" | "price" | "pricePerM2" | "areaM2" | "rooms" | "propertyType" | "locationLabel"
>;

/**
 * The photograph on the share card: the SEO tab's own share picture when the
 * admin set one, else the cover. Unsplash serves it at the card's width; a
 * Convex storage file has one size only.
 */
export function sharePhoto(listing: Pick<ShareCardListing, "cover" | "seo">): string | null {
  const url = listing.seo.ogImageUrl ?? listing.cover?.url;
  if (url === undefined) return null;
  return isUnsplash(url) ? unsplashAt(url, 1200) : url;
}

/**
 * A short fingerprint of everything the share card draws (photo, status
 * ribbon, price, facts, place) for the `?v=` on its URL: Facebook, Viber and
 * WhatsApp keep a preview per URL, so a new picture needs a new URL.
 */
export function shareCardVersion(listing: ShareCardListing): string {
  const drawn = JSON.stringify([
    sharePhoto(listing),
    listing.status,
    listing.transaction,
    listing.price,
    listing.pricePerM2,
    listing.areaM2,
    listing.rooms,
    listing.propertyType,
    listing.locationLabel,
  ]);
  // FNV-1a, 32 bit: short, stable across servers, and plenty to tell versions apart.
  let hash = 0x811c9dc5;
  for (let index = 0; index < drawn.length; index += 1) {
    hash = Math.imul(hash ^ drawn.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
