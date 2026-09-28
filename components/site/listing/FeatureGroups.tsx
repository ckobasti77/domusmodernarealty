import { getTranslations } from "next-intl/server";
import type { ListingDetail } from "@/convex/lib/dto";

/**
 * Features grouped Interior / Building / Outdoor / Financing (PRD A5), as quiet
 * sentence-case lists with the bronze dash the highlights use — boxed uppercase
 * tags stay reserved for status (design-critic, step 07). Only features the
 * listing actually has are shown. Registration and the occupancy permit are
 * NOT repeated here: the legal block states them with their exact status.
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
  add("legal", listing.vatRefundEligible, "vatRefund");
  add("legal", listing.mortgageEligible, "mortgage");
  add("legal", listing.developerInstallments, "installments");
  add("legal", listing.swapPossible, "swap");

  const present = (Object.keys(groups) as Group[]).filter((group) => groups[group].length > 0);
  if (present.length === 0) return null;

  return (
    <section aria-labelledby="features-heading">
      <h2 id="features-heading" className="font-display text-h2">
        {t("features")}
      </h2>
      <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
        {present.map((group) => (
          <div key={group}>
            <h3 className="font-sans text-label font-medium uppercase tracking-[0.12em] text-stone-text">
              {t(`featureGroups.${group}`)}
            </h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {groups[group].map((label) => (
                <li key={label} className="flex gap-3 text-body text-ink">
                  <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-bronze-text" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
