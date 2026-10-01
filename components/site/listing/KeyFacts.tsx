import { getFormatter, getTranslations } from "next-intl/server";
import type { ListingDetail } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { formatArea, formatPrice, formatRooms } from "@/lib/format";
import { floorName } from "@/lib/listing-text";
import { displayFloor, displayTotalFloors } from "./floor";

type Row = { label: string; value: string };

/**
 * The key facts (PRD A5): up to four headline figures set large in the display
 * serif (area, rooms, floor, bathrooms or year), then every other fact in a
 * hairline grid. Both are real `<dl>`s, so each figure is announced with its
 * label; rows without data are omitted rather than shown as "—", and nothing
 * is said twice (a renovation year replaces the "Renovirano" condition).
 */
export async function KeyFacts({ listing, locale }: { listing: ListingDetail; locale: Locale }) {
  const t = await getTranslations("listing");
  const tUnits = await getTranslations("units");
  const format = await getFormatter();
  const m2 = tUnits("m2");
  const yesNo = (value: boolean) => (value ? t("facts.yes") : t("facts.no"));

  // Lists of enum values read as "Jug, zapad", like every other value.
  const sentence = (value: string) => value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
  // ...and a list of capitalised labels as one phrase: "Toplotna pumpa, podno,
  // klima uređaj". German nouns keep their capitals, and so does an acronym ("TA peć").
  const phrase = (values: readonly string[]) =>
    sentence(
      values
        .map((value, index) =>
          index === 0 || locale === "de" || /^\p{Lu}{2}/u.test(value)
            ? value
            : value.charAt(0).toLocaleLowerCase(locale) + value.slice(1),
        )
        .join(", "),
    );
  const hasRooms = listing.propertyType !== "land" && listing.propertyType !== "garage";
  const hasFloor = listing.propertyType !== "land";

  const lead: Row[] = [{ label: t("area"), value: formatArea(listing.areaM2, locale, m2) }];
  if (hasRooms) lead.push({ label: t("facts.roomsCount"), value: formatRooms(listing.rooms, locale) });
  if (hasFloor) {
    const floor = floorName(t, displayFloor(listing.floor, locale));
    const total = displayTotalFloors(listing.totalFloors, locale);
    lead.push({ label: t("floor"), value: total !== undefined ? `${floor} / ${total}` : floor });
  }
  const leadBathrooms = listing.bathrooms !== undefined && lead.length < 4;
  if (listing.bathrooms !== undefined && leadBathrooms) {
    lead.push({ label: t("facts.bathrooms"), value: format.number(listing.bathrooms) });
  }
  const leadYear = !leadBathrooms && listing.yearBuilt !== undefined && lead.length < 4;
  if (leadYear) lead.push({ label: t("yearBuilt"), value: String(listing.yearBuilt) });

  const rows: Row[] = [];
  const push = (label: string, value: string | undefined) => {
    if (value !== undefined && value.length > 0) rows.push({ label, value });
  };

  if (listing.registeredAreaM2 !== undefined && listing.registeredAreaM2 !== listing.areaM2) {
    push(t("facts.registeredArea"), formatArea(listing.registeredAreaM2, locale, m2));
  }
  if (listing.plotAreaM2 !== undefined) push(t("facts.plotArea"), formatArea(listing.plotAreaM2, locale, m2));
  if (listing.bedrooms !== undefined) push(t("facts.bedrooms"), format.number(listing.bedrooms));
  if (listing.bathrooms !== undefined && !leadBathrooms) push(t("facts.bathrooms"), format.number(listing.bathrooms));
  if (listing.yearBuilt !== undefined && !leadYear) push(t("yearBuilt"), String(listing.yearBuilt));
  if (listing.renovatedYear !== undefined) push(t("facts.renovated"), String(listing.renovatedYear));
  if (listing.completionDate !== undefined) {
    push(t("facts.completion"), format.dateTime(new Date(listing.completionDate), { month: "long", year: "numeric" }));
  }
  push(t("facts.construction"), t(`construction.${listing.constructionType}`));
  if (listing.propertyType !== "land") {
    if (!(listing.condition === "renovated" && listing.renovatedYear !== undefined)) {
      push(t("facts.condition"), t(`condition.${listing.condition}`));
    }
    push(t("furnishing"), t(`furnishingValue.${listing.furnishing}`));
  }
  if (listing.heating.length > 0) {
    push(t("heating"), phrase(listing.heating.map((value) => t(`heatingValue.${value}`))));
  }
  if (listing.parking.length > 0) {
    push(t("parking"), phrase(listing.parking.map((value) => t(`parkingValue.${value}`))));
  }
  if (listing.propertyType === "apartment" || listing.propertyType === "office") {
    push(t("facts.elevator"), yesNo(listing.features.elevator));
  }
  if (listing.outdoorAreaM2 !== undefined) push(t("facts.outdoor"), formatArea(listing.outdoorAreaM2, locale, m2));
  if (listing.orientation !== undefined && listing.orientation.length > 0) {
    push(t("facts.orientation"), sentence(listing.orientation.map((value) => t(`orientationValue.${value}`)).join(", ")));
  }
  if (listing.energyClass !== undefined) push(t("energyClass"), listing.energyClass);
  // Either cost may be entered on its own; a missing one is left out, never shown as "0 €".
  const infostan = listing.costs?.infostan;
  const maintenance = listing.costs?.maintenance;
  if (infostan !== undefined && maintenance !== undefined) {
    push(
      t("facts.bills"),
      t("facts.billsValue", {
        infostan: formatPrice(infostan, locale),
        maintenance: formatPrice(maintenance, locale),
      }),
    );
  } else if (infostan !== undefined) {
    push(t("facts.bills"), t("facts.billsInfostan", { amount: formatPrice(infostan, locale) }));
  } else if (maintenance !== undefined) {
    push(t("facts.bills"), t("facts.billsMaintenance", { amount: formatPrice(maintenance, locale) }));
  }
  if (listing.rent !== undefined) {
    if (listing.rent.minLeaseMonths !== undefined) {
      push(t("facts.minLease"), t("facts.minLeaseValue", { count: listing.rent.minLeaseMonths }));
    }
    if (listing.rent.petsAllowed !== undefined) push(t("facts.pets"), yesNo(listing.rent.petsAllowed));
    if (listing.rent.utilitiesIncluded !== undefined) {
      push(t("facts.utilitiesIncluded"), yesNo(listing.rent.utilitiesIncluded));
    }
  }
  if (listing.availableFrom !== undefined) {
    push(t("facts.availableFrom"), format.dateTime(new Date(listing.availableFrom), { dateStyle: "medium" }));
  }

  return (
    <section aria-labelledby="facts-heading">
      <h2 id="facts-heading" className="font-display text-h2">
        {t("facts.heading")}
      </h2>
      {/* Both grids share the column lines of the listing's other blocks
          (gap-x-8): the details run in two columns, the 1st and 3rd of the
          figures above, until there is room for all four. */}
      <dl className="hairline-t hairline-b mt-8 grid grid-cols-2 gap-x-8 gap-y-8 py-8 md:grid-cols-4">
        {lead.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-2">
            <dt className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">{item.label}</dt>
            <dd data-numeric className="font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-none text-ink">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="mt-2 grid grid-cols-2 gap-x-8 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="hairline-b flex flex-col gap-1 py-4">
            <dt className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">{row.label}</dt>
            <dd data-numeric className="text-body text-ink">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

