import type { Floor } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";
import { formatArea } from "@/lib/format";
import { pickL10n, type L10nValue } from "@/lib/l10n";

/**
 * Wording shared by the detail page, its metadata and its OG image. Every
 * function takes the translator of the `listing` namespace, so the same code
 * runs in Server Components (`getTranslations`) and client ones
 * (`useTranslations`).
 */
export type ListingTranslator = (key: string, values?: Record<string, string | number>) => string;

const ROOM_KEYS: Record<string, string> = {
  "0.5": "r05",
  "1": "r1",
  "1.5": "r15",
  "2": "r2",
  "2.5": "r25",
  "3": "r3",
  "3.5": "r35",
  "4": "r4",
  "4.5": "r45",
  "5": "r5",
};

/** Message key for a room count, or `null` when there is no word for it (6+ rooms). */
export function roomsKey(rooms: number): string | null {
  if (rooms <= 0.5) return "r05";
  return ROOM_KEYS[String(Math.round(rooms * 2) / 2)] ?? null;
}

/** "Trosoban" / "3-room"; falls back to "6 soba" beyond the named structures. */
export function structureShort(t: ListingTranslator, tUnits: ListingTranslator, rooms: number): string {
  const key = roomsKey(rooms);
  if (key !== null) return t(`structure.${key}`);
  return tUnits("rooms", { count: rooms });
}

type StructureInput = {
  propertyType: string;
  rooms: number;
  areaM2: number;
};

/**
 * "Trosoban stan" for apartments; "Kuća, 240 m²" for everything else, where a
 * room count says little and the area is the headline figure.
 */
export function structureTitle(
  t: ListingTranslator,
  listing: StructureInput,
  locale: Locale,
  m2: string,
): string {
  if (listing.propertyType === "apartment") {
    const key = roomsKey(listing.rooms);
    if (key !== null) return t(`structureApartment.${key}`);
  }
  return t("typeWithArea", {
    type: t(`propertyType.${listing.propertyType}`),
    area: formatArea(listing.areaM2, locale, m2),
  });
}

/** "Prizemlje" or "3", before any "of N" suffix. */
export function floorName(t: ListingTranslator, floor: Floor): string {
  return typeof floor === "number" ? String(floor) : t(`floorValue.${floor}`);
}

/** "3 od 5" / "Prizemlje od 4" / "3". */
export function floorLabel(t: ListingTranslator, floor: Floor, totalFloors?: number): string {
  const name = floorName(t, floor);
  return totalFloors !== undefined ? t("facts.floorOf", { floor: name, total: totalFloors }) : name;
}

type PlaceInput = {
  neighborhood?: { name: L10nValue };
  municipality?: { name: L10nValue };
  city?: { name: L10nValue };
  locationLabel: L10nValue;
};

/** "Neimar, Vračar, Beograd" without repeating a level that has the same name. */
export function placeLine(listing: PlaceInput, locale: Locale): string {
  const parts: string[] = [];
  for (const level of [listing.neighborhood, listing.municipality, listing.city]) {
    if (level === undefined) continue;
    const text = pickL10n(level.name, locale).text;
    if (!parts.includes(text)) parts.push(text);
  }
  return parts.length > 0 ? parts.join(", ") : pickL10n(listing.locationLabel, locale).text;
}

/** The most specific place name: the neighborhood, else the municipality, else the city. */
export function placeShort(listing: PlaceInput, locale: Locale): string {
  return pickL10n(listing.locationLabel, locale).text;
}
