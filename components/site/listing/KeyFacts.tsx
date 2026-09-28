import { getFormatter, getTranslations } from "next-intl/server";
import type { ListingDetail } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { formatArea, formatPrice } from "@/lib/format";
import { floorLabel, structureShort } from "@/lib/listing-text";
import { displayFloor, displayTotalFloors } from "./floor";

/**
 * The key-facts grid (PRD A5). A real `<dl>`, so every figure is announced with
 * its label; rows without data are omitted rather than shown as "—".
 */
export async function KeyFacts({ listing, locale }: { listing: ListingDetail; locale: Locale }) {
  const t = await getTranslations("listing");
  const tUnits = await getTranslations("units");
  const format = await getFormatter();
  const m2 = tUnits("m2");
  const yesNo = (value: boolean) => (value ? t("facts.yes") : t("facts.no"));

  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | undefined) => {
    if (value !== undefined && value.length > 0) rows.push({ label, value });
  };

  push(t("area"), formatArea(listing.areaM2, locale, m2));
  if (listing.registeredAreaM2 !== undefined && listing.registeredAreaM2 !== listing.areaM2) {
    push(t("facts.registeredArea"), formatArea(listing.registeredAreaM2, locale, m2));
  }
  if (listing.plotAreaM2 !== undefined) push(t("facts.plotArea"), formatArea(listing.plotAreaM2, locale, m2));
  if (listing.propertyType !== "land" && listing.propertyType !== "garage") {
    push(t("rooms"), structureShort(t, tUnits, listing.rooms));
  }
  if (listing.bedrooms !== undefined) push(t("facts.bedrooms"), format.number(listing.bedrooms));
  if (listing.bathrooms !== undefined) push(t("facts.bathrooms"), format.number(listing.bathrooms));
  if (listing.propertyType !== "land") {
    push(t("floor"), floorLabel(t, displayFloor(listing.floor, locale), displayTotalFloors(listing.totalFloors, locale)));
  }
  if (listing.yearBuilt !== undefined) push(t("yearBuilt"), String(listing.yearBuilt));
  if (listing.renovatedYear !== undefined) push(t("facts.renovated"), String(listing.renovatedYear));
  if (listing.completionDate !== undefined) {
    push(t("facts.completion"), format.dateTime(new Date(listing.completionDate), { month: "long", year: "numeric" }));
  }
  push(t("facts.construction"), t(`construction.${listing.constructionType}`));
  if (listing.propertyType !== "land") {
    push(t("facts.condition"), t(`condition.${listing.condition}`));
    push(t("furnishing"), t(`furnishingValue.${listing.furnishing}`));
  }
  if (listing.heating.length > 0) {
    push(t("heating"), listing.heating.map((value) => t(`heatingValue.${value}`)).join(", "));
  }
  if (listing.parking.length > 0) {
    push(t("parking"), listing.parking.map((value) => t(`parkingValue.${value}`)).join(", "));
  }
  if (listing.propertyType === "apartment" || listing.propertyType === "office") {
    push(t("facts.elevator"), yesNo(listing.features.elevator));
  }
  if (listing.outdoorAreaM2 !== undefined) push(t("facts.outdoor"), formatArea(listing.outdoorAreaM2, locale, m2));
  if (listing.orientation !== undefined && listing.orientation.length > 0) {
    push(t("facts.orientation"), listing.orientation.map((value) => t(`orientationValue.${value}`)).join(", "));
  }
  if (listing.energyClass !== undefined) push(t("energyClass"), listing.energyClass);
  if (listing.costs !== undefined && (listing.costs.infostan !== undefined || listing.costs.maintenance !== undefined)) {
    push(
      t("facts.bills"),
      t("facts.billsValue", {
        infostan: formatPrice(listing.costs.infostan ?? 0, locale),
        maintenance: formatPrice(listing.costs.maintenance ?? 0, locale),
      }),
    );
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
      <h2 id="facts-heading" className="font-serif text-h2">
        {t("facts.heading")}
      </h2>
      <dl className="mt-8 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="hairline-t flex flex-col gap-1 py-4">
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

