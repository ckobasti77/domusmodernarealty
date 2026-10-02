import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { ListingCard, PublicImage } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "./l10n";
import { coverOf, forLocale, toSearchCard } from "./search-cards";

const LOCALES = ["sr-Latn", "en", "ru", "de"] as const satisfies readonly Locale[];

function photo(id: string, room: string): PublicImage {
  return {
    id,
    url: `https://images.unsplash.com/photo-${id}?ixlib=rb-4.0.3`,
    alt: {
      sr: `${room} — trosoban stan u Neimaru`,
      en: `${room} — three-room flat in Neimar`,
      ru: `${room} — трёхкомнатная квартира в Неймаре`,
      de: `${room} — Dreizimmerwohnung in Neimar`,
    },
    w: 1600,
    h: 1067,
    room: "living",
    author: "Spacejoy",
    sourcePage: `https://unsplash.com/photos/${id}`,
  };
}

const cover = photo("p0-0", "Dnevna soba");

/** A search result exactly as `listings.search` returns it. */
const card: ListingCard = {
  _id: "k17listing" as Id<"listings">,
  slug: "trosoban-stan-neimar-me-1042",
  ref: "ME-1042",
  status: "reserved",
  transaction: "sale",
  propertyType: "apartment",
  // No German title: German pages fall back to the Serbian source.
  title: { sr: "Trosoban stan u Neimaru", en: "Three-room flat in Neimar", ru: "Трёхкомнатная квартира в Неймаре" },
  price: 245_000,
  pricePerM2: 3_500,
  previousPrice: 260_000,
  areaM2: 70,
  rooms: 3,
  floor: 3,
  floorNum: 3,
  totalFloors: 5,
  cover,
  images: [cover, photo("p0-1", "Kuhinja"), photo("p0-2", "Spavaća soba"), photo("p0-3", "Kupatilo"), photo("p0-4", "Terasa")],
  photoCount: 12,
  cityId: "k17city" as Id<"locations">,
  municipalityId: "k17municipality" as Id<"locations">,
  neighborhoodId: "k17neighborhood" as Id<"locations">,
  locationLabel: { sr: "Neimar", en: "Neimar", ru: "Неймар", de: "Neimar" },
  citySlug: "beograd",
  areaSlug: "neimar",
  isExclusive: true,
  isFeatured: false,
  isDemo: true,
  hasTour: true,
  registered: true,
  constructionType: "old",
  vatRefundEligible: false,
  mortgageEligible: true,
  publishedAt: 1_790_000_000_000,
  createdAt: 1_789_000_000_000,
  lat: 44.795,
  lng: 20.47,
  coordPrecision: "area",
};

/** Every field `PropertyCard` reads, and the gallery. */
const DRAWN = new Set([
  "_id",
  "slug",
  "ref",
  "status",
  "transaction",
  "propertyType",
  "title",
  "locationLabel",
  "price",
  "pricePerM2",
  "previousPrice",
  "areaM2",
  "rooms",
  "floor",
  "totalFloors",
  "cover",
  "images",
  "isExclusive",
  "hasTour",
  "publishedAt",
  "constructionType",
  "registered",
  "mortgageEligible",
]);

describe("toSearchCard", () => {
  test("every locale reads the same texts, with the same fallback language", () => {
    for (const locale of LOCALES) {
      const projected = toSearchCard(card, locale);
      expect(pickL10n(projected.title, locale), locale).toEqual(pickL10n(card.title, locale));
      expect(pickL10n(projected.locationLabel, locale), locale).toEqual(pickL10n(card.locationLabel, locale));
      const alts = (projected.images ?? []).map((frame) => pickL10n(frame.alt, locale));
      expect(alts, locale).toEqual((card.images ?? []).map((frame) => pickL10n(frame.alt, locale)));
    }
    expect(pickL10n(toSearchCard(card, "de").title, "de")).toEqual({ text: "Trosoban stan u Neimaru", lang: "sr-Latn" });
  });

  test("carries only what the card draws, the cover once and no photo credits", () => {
    const projected = toSearchCard(card, "sr-Latn");
    expect(Object.keys(projected).filter((key) => !DRAWN.has(key))).toEqual([]);
    expect(projected.cover).toBeUndefined();
    expect(coverOf(projected)?.id).toBe(cover.id);
    expect(projected.images?.map((frame) => frame.id)).toEqual(card.images?.map((frame) => frame.id));
    for (const frame of projected.images ?? []) {
      expect(Object.keys(frame).sort()).toEqual(["alt", "id", "url"]);
    }
    // What the results reconcile on (`signatureOf`) survives.
    expect([projected._id, projected.price, projected.status]).toEqual([card._id, card.price, card.status]);
  });

  test("a Serbian page sends no other language, and well under half the bytes", () => {
    const projected = JSON.stringify(toSearchCard(card, "sr-Latn"));
    for (const other of ["three-room", "Dreizimmer", "квартира", "Неймар"]) {
      expect(projected).not.toContain(other);
    }
    expect(projected.length).toBeLessThan(JSON.stringify(card).length / 2);
  });

  test("a listing with one photo keeps its cover", () => {
    const { images: _images, ...single } = card;
    const projected = toSearchCard(single, "en");
    expect(projected.images).toBeUndefined();
    expect(projected.cover).toEqual({ id: cover.id, url: cover.url, alt: { sr: cover.alt.sr, en: cover.alt.en } });
    expect(coverOf(projected)).toEqual(projected.cover);
  });
});

describe("forLocale", () => {
  test("keeps the Serbian source and the locale's own text only", () => {
    const value = { sr: "Stan", en: "Flat", ru: "Квартира", de: "Wohnung" };
    expect(forLocale(value, "sr-Latn")).toEqual({ sr: "Stan" });
    expect(forLocale(value, "ru")).toEqual({ sr: "Stan", ru: "Квартира" });
  });

  test("an empty translation is a missing one, as for pickL10n", () => {
    const value = { sr: "Stan", en: "" };
    expect(forLocale(value, "en")).toEqual({ sr: "Stan" });
    expect(pickL10n(forLocale(value, "en"), "en")).toEqual(pickL10n(value, "en"));
  });
});
