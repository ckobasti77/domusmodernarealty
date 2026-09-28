import { getTranslations } from "next-intl/server";
import type { ListingDetail } from "@/convex/lib/dto";
import { Badge } from "../Badge";

/**
 * Feature chips grouped Interior / Building / Outdoor / Legal (PRD A5). Only
 * features the listing actually has are shown — a wall of crossed-out "no"
 * chips says nothing a buyer needs.
 */
type Group = "interior" | "building" | "outdoor" | "legal";

export async function FeatureGroups({ listing }: { listing: ListingDetail }) {
  const t = await getTranslations("listing");
  const f = listing.features;

  const groups: Record<Group, string[]> = { interior: [], building: [], outdoor: [], legal: [] };
  const add = (group: Group, on: boolean | undefined, key: string) => {
    if (on === true) groups[group].push(t(`feature.${key}`));
  };

  add("interior", f.ac, "ac");
  add("interior", f.fireplace, "fireplace");
  add("interior", listing.furnishing === "furnished", "furnished");
  add("interior", f.storage, "storage");
  add("building", f.elevator, "elevator");
  add("building", f.intercom, "intercom");
  add("building", f.videoSurveillance, "videoSurveillance");
  add("building", f.alarm, "alarm");
  add("building", f.basement, "basement");
  add("building", listing.parking.length > 0, "parking");
  add("outdoor", f.terrace, "terrace");
  add("outdoor", f.loggia, "loggia");
  add("outdoor", f.balcony, "balcony");
  add("outdoor", f.frenchBalcony, "frenchBalcony");
  add("outdoor", f.garden, "garden");
  add("outdoor", f.pool, "pool");
  add("legal", listing.legal.registration === "registered", "registered");
  add("legal", listing.legal.occupancyPermit, "occupancyPermit");
  add("legal", listing.vatRefundEligible, "vatRefund");
  add("legal", listing.mortgageEligible, "mortgage");
  add("legal", listing.developerInstallments, "installments");
  add("legal", listing.swapPossible, "swap");

  const present = (Object.keys(groups) as Group[]).filter((group) => groups[group].length > 0);
  if (present.length === 0) return null;

  return (
    <section aria-labelledby="features-heading">
      <h2 id="features-heading" className="font-serif text-h2">
        {t("features")}
      </h2>
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {present.map((group) => (
          <div key={group}>
            <h3 className="font-sans text-label font-medium uppercase tracking-[0.12em] text-stone-text">
              {t(`featureGroups.${group}`)}
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {groups[group].map((label) => (
                <li key={label}>
                  <Badge>{label}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
