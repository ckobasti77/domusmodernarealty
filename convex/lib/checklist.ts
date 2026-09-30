/**
 * The publish checklist from PRD B3. `listingsAdmin.publish` enforces it; the
 * admin editor renders the same list live (it imports this module and runs it
 * over the unsaved form values).
 *
 * It encodes Serbian brokerage law Art. 18 (agency + registry number are shown
 * sitewide from settings; the listing must carry price, location, area and room
 * structure) plus the "no advertising without a brokerage contract" rule.
 */
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "./errors";

export type ChecklistItem = {
  code: string;
  label: string;
  ok: boolean;
  /** A warning is shown but never blocks publishing. */
  warning?: boolean;
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

/**
 * Facts that live outside the listing document. They are loaded once by
 * `checklistContext` and passed in, so `publishChecklist` stays pure and can run
 * in the browser over unsaved values.
 */
export type ChecklistContext = {
  /** The assigned agent exists and is shown publicly (booking needs them). */
  agentPublic: boolean;
  /** Settings carry a real "Registar posrednika" number, not the demo "000". */
  registryOk: boolean;
  /**
   * The agency's settings are real (no longer the seeded demo values). From
   * then on a missing registry number blocks publishing; on the demo
   * deployment it is only a warning.
   */
  registryRequired: boolean;
};

/** The seeded placeholder: all zeros, or empty. */
export function isPlaceholderRegistry(registryNo: string): boolean {
  return /^0*$/.test(registryNo.trim());
}

/** `now` is passed in so queries never read the wall clock. */
export function publishChecklist(
  listing: ChecklistListing,
  now: number,
  context?: ChecklistContext,
): ChecklistItem[] {
  const cover = listing.media.some((item) => item.isCover === true);
  const needsRooms =
    listing.propertyType !== "land" && listing.propertyType !== "garage";

  const items: ChecklistItem[] = [
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
      label: "Naslov na srpskom (najmanje 10 znakova)",
      ok: listing.title.sr.trim().length >= 10,
    },
    {
      code: "descriptionSr",
      label: "Opis na srpskom (najmanje 80 znakova)",
      ok: listing.description.sr.trim().length >= 80,
    },
    { code: "slug", label: "URL adresa je generisana", ok: listing.slug.length > 0 },
  ];

  if (context !== undefined) {
    items.push({
      code: "agent",
      label: "Dodeljen je agent koji je vidljiv na sajtu",
      ok: context.agentPublic,
    });
    // Art. 18 wants the registry number on every listing. While the settings
    // are still the seeded demo values it is a warning (the demo deployment
    // must stay publishable); once the agency's real data is entered, a
    // placeholder number blocks publishing.
    items.push({
      code: "registry",
      label: "Broj iz Registra posrednika je unet u Podešavanjima",
      ok: context.registryOk,
      ...(context.registryRequired ? {} : { warning: true }),
    });
  }

  return items;
}

export function checklistBlockers(items: readonly ChecklistItem[]): string[] {
  return items.filter((item) => !item.ok && item.warning !== true).map((item) => item.label);
}

/** Loads the facts `publishChecklist` needs from outside the listing. */
export async function checklistContext(
  ctx: QueryCtx,
  listing: Pick<Doc<"listings">, "agentId">,
): Promise<ChecklistContext> {
  const agent = await ctx.db.get("agents", listing.agentId);
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  return {
    agentPublic: agent !== null && agent.isPublic,
    registryOk: settings !== null && !isPlaceholderRegistry(settings.registryNo),
    registryRequired: settings !== null && !settings.isDemo,
  };
}

/** Throws `PUBLISH_BLOCKED` listing every failed reason. */
export function assertPublishable(
  listing: ChecklistListing,
  now: number,
  context?: ChecklistContext,
): void {
  const reasons = checklistBlockers(publishChecklist(listing, now, context));
  if (reasons.length > 0) {
    appError("PUBLISH_BLOCKED", "Objava je blokirana.", { reasons });
  }
}
