import { createTranslator, type Messages } from "next-intl";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import sr from "@/messages/sr-Latn.json";
import {
  listingMetaDescription,
  listingMetaTitle,
  shareCardVersion,
  sharePhoto,
  type MetaListing,
  type ShareCardListing,
} from "./listing-meta";
import type { ListingTranslator } from "./listing-text";

// Typed as the app's messages, so the translators are the ones `getTranslations` gives the page.
const MESSAGES: Record<Locale, Messages> = { "sr-Latn": sr, en, ru, de };

function translators(locale: Locale): { t: ListingTranslator; tUnits: ListingTranslator } {
  const messages = MESSAGES[locale];
  return {
    t: createTranslator({ locale, messages, namespace: "listing" }),
    tUnits: createTranslator({ locale, messages, namespace: "units" }),
  };
}

function description(listing: MetaListing, locale: Locale): string {
  const { t, tUnits } = translators(locale);
  // Prices and €/m² carry no-break spaces; the expectations are easier to read without them.
  return listingMetaDescription(listing, locale, t, tUnits).replace(/[  ]/g, " ");
}

const APARTMENT: MetaListing = {
  title: { sr: "Trosoban stan u Neimaru, renoviran 2023.", en: "Three-room apartment in Neimar, renovated in 2023." },
  propertyType: "apartment",
  transaction: "sale",
  price: 430_000,
  pricePerM2: 5000,
  areaM2: 86,
  rooms: 3,
  floor: 3,
  totalFloors: 5,
  ref: "ME-1042",
  locationLabel: { sr: "Neimar", ru: "Неймар" },
};

const RENTAL: MetaListing = {
  ...APARTMENT,
  title: {
    sr: "Namešten dvosoban stan na Banjici, 56 m² uz Banjičku šumu.",
    en: "Furnished two-room apartment in Banjica, 56 m² beside the woods.",
  },
  transaction: "rent",
  price: 620,
  pricePerM2: 11.07,
  areaM2: 56,
  rooms: 2,
  floor: 6,
  totalFloors: 9,
  ref: "ME-1057",
};

const PLOT: MetaListing = {
  ...APARTMENT,
  title: { sr: "Građevinski plac od 1.250 m² kod Palićkog jezera", en: "1,250 m² building plot near Lake Palić" },
  propertyType: "land",
  price: 62_000,
  pricePerM2: 49.6,
  areaM2: 1250,
  rooms: 0,
  floor: "PR",
  totalFloors: undefined,
  ref: "ME-1071",
};

describe("listingMetaDescription", () => {
  it("drops only the title's closing full stop, never a final letter", () => {
    expect(description(RENTAL, "en")).toBe(
      "Furnished two-room apartment in Banjica, 56 m² beside the woods. 56 m², 6 of 9. Price €620 per month (€11/m²). Ref. ME-1057.",
    );
    expect(description({ ...APARTMENT, title: { sr: "Dupleks na dva nivoa..  " } }, "sr-Latn")).toBe(
      "Dupleks na dva nivoa. 86 m², 3 od 5. Cena 430.000 € (5.000 €/m²). Šifra ME-1042.",
    );
    expect(description({ ...APARTMENT, title: { sr: "Stan", en: "Four-room duplex over two levels" } }, "en")).toBe(
      "Four-room duplex over two levels. 86 m², 3 of 5. Price €430,000 (€5,000/m²). Ref. ME-1042.",
    );
  });

  it("leaves the floor out for a plot", () => {
    expect(description(PLOT, "en")).toBe(
      "1,250 m² building plot near Lake Palić. 1,250 m². Price €62,000 (€50/m²). Ref. ME-1071.",
    );
    expect(description(PLOT, "sr-Latn")).toBe(
      "Građevinski plac od 1.250 m² kod Palićkog jezera. 1.250 m². Cena 62.000 € (50 €/m²). Šifra ME-1071.",
    );
  });

  it("states a rent per month", () => {
    expect(description(RENTAL, "sr-Latn")).toBe(
      "Namešten dvosoban stan na Banjici, 56 m² uz Banjičku šumu. 56 m², 6 od 9. Cena 620 € mesečno (11 €/m²). Šifra ME-1057.",
    );
    expect(description(RENTAL, "de")).toContain("Preis 620 € monatlich (11 €/m²)");
  });

  it("writes a named floor in lower case mid-sentence, except in German", () => {
    const ground = { ...APARTMENT, floor: "PR" as const, totalFloors: 4 };
    expect(description(ground, "sr-Latn")).toContain(". 86 m², prizemlje od 4. ");
    expect(description(ground, "en")).toContain(". 86 m², ground floor of 4. ");
    expect(description(ground, "de")).toContain(". 86 m², Erdgeschoss von 4. ");
  });

  it("counts floors the Russian way", () => {
    expect(description(APARTMENT, "ru")).toContain(". 86 м², 4 из 6. ");
  });
});

describe("listingMetaTitle", () => {
  it("names the structure, the place and the price", () => {
    const { t, tUnits } = translators("sr-Latn");
    expect(listingMetaTitle(APARTMENT, "sr-Latn", t, tUnits).replace(/ /g, " ")).toBe(
      `${t("structureApartment.r3")}, Neimar — 430.000 €`,
    );
    const ru = translators("ru");
    expect(listingMetaTitle(RENTAL, "ru", ru.t, ru.tUnits).replace(/ /g, " ")).toContain("Неймар — 620 € в месяц");
  });
});

describe("share card", () => {
  const card: ShareCardListing = {
    cover: { id: "c1", url: "https://images.unsplash.com/photo-1?w=1600&q=80&auto=format&fit=crop", alt: { sr: "" } },
    seo: {},
    status: "published",
    transaction: "sale",
    price: 430_000,
    pricePerM2: 5000,
    areaM2: 86,
    rooms: 3,
    propertyType: "apartment",
    locationLabel: { sr: "Neimar" },
  };
  const storage = "https://youthful-avocet-278.eu-west-1.convex.cloud/api/storage/0b6f7e1c";

  it("draws the SEO tab's own picture over the cover, at the card's width on Unsplash", () => {
    expect(sharePhoto(card)).toBe("https://images.unsplash.com/photo-1?w=1200&q=80&auto=format&fit=crop");
    expect(sharePhoto({ ...card, seo: { ogImageUrl: storage } })).toBe(storage);
    expect(sharePhoto({ seo: { ogImageUrl: "https://images.unsplash.com/photo-2" } })).toBe(
      "https://images.unsplash.com/photo-2?w=1200&q=80&auto=format&fit=crop",
    );
    expect(sharePhoto({ seo: {} })).toBeNull();
  });

  it("versions the URL by everything the card draws", () => {
    const base = shareCardVersion(card);
    expect(base).toMatch(/^[0-9a-z]{1,7}$/);
    expect(shareCardVersion({ ...card })).toBe(base);
    const changed = [
      { ...card, seo: { ogImageUrl: storage } },
      { ...card, price: 425_000 },
      { ...card, status: "sold" as const },
      { ...card, areaM2: 87 },
      { ...card, locationLabel: { sr: "Vračar" } },
    ].map(shareCardVersion);
    for (const version of changed) expect(version).not.toBe(base);
    expect(new Set(changed).size).toBe(changed.length);
  });
});
