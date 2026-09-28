/**
 * The publish checklist from PRD B3. `listingsAdmin.publish` enforces it; the
 * admin editor renders the same list read-only via `listingsAdmin.get`.
 *
 * It encodes Serbian brokerage law Art. 18 (agency + registry number are shown
 * sitewide from settings; the listing must carry price, location, area and room
 * structure) plus the "no advertising without a brokerage contract" rule.
 */
import type { Doc } from "../_generated/dataModel";
import { appError } from "./errors";

export type ChecklistItem = {
  code: string;
  label: string;
  ok: boolean;
};

export type ChecklistListing = Pick<
  Doc<"listings">,
  | "mandate"
  | "price"
  | "cityId"
  | "location"
  | "areaM2"
  | "rooms"
  | "media"
  | "title"
  | "description"
  | "slug"
  | "propertyType"
>;

/** `now` is passed in so queries never read the wall clock. */
export function publishChecklist(
  listing: ChecklistListing,
  now: number,
): ChecklistItem[] {
  const cover = listing.media.some((item) => item.isCover === true);
  const needsRooms =
    listing.propertyType !== "land" && listing.propertyType !== "garage";

  return [
    {
      code: "mandate",
      label: "Ugovor o posredovanju je unet i važi",
      ok:
        listing.mandate !== undefined &&
        listing.mandate.number.trim().length > 0 &&
        listing.mandate.end > now,
    },
    { code: "price", label: "Cena je uneta", ok: listing.price > 0 },
    {
      code: "location",
      label: "Lokacija i koordinate su unete",
      ok:
        listing.location.lat !== 0 &&
        listing.location.lng !== 0 &&
        listing.cityId !== undefined,
    },
    { code: "area", label: "Kvadratura je uneta", ok: listing.areaM2 > 0 },
    {
      code: "rooms",
      label: "Struktura (broj soba) je uneta",
      ok: !needsRooms || listing.rooms > 0,
    },
    {
      code: "photos",
      label: "Najmanje 5 fotografija",
      ok: listing.media.length >= 5,
    },
    { code: "cover", label: "Naslovna fotografija je izabrana", ok: cover },
    {
      code: "titleSr",
      label: "Naslov na srpskom je unet",
      ok: listing.title.sr.trim().length >= 10,
    },
    {
      code: "descriptionSr",
      label: "Opis na srpskom je unet",
      ok: listing.description.sr.trim().length >= 80,
    },
    { code: "slug", label: "URL adresa je generisana", ok: listing.slug.length > 0 },
  ];
}

export function checklistBlockers(items: readonly ChecklistItem[]): string[] {
  return items.filter((item) => !item.ok).map((item) => item.label);
}

/** Throws `PUBLISH_BLOCKED` listing every failed reason. */
export function assertPublishable(
  listing: ChecklistListing,
  now: number,
): void {
  const reasons = checklistBlockers(publishChecklist(listing, now));
  if (reasons.length > 0) {
    appError("PUBLISH_BLOCKED", "Objava je blokirana.", { reasons });
  }
}
