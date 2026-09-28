import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ListingMapLoader } from "@/components/map/ListingMapLoader";
import type { ListingDetail } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { placeLine } from "@/lib/listing-text";

/** ~80 m per minute is the usual planning figure for an unhurried walk. */
const WALK_M_PER_MIN = 80;

/**
 * Location (PRD A5): the place line, the street only when the listing publishes
 * it, the map, the POIs recorded by the agent, and a teaser to the
 * neighbourhood page.
 */
export async function LocationBlock({ listing, locale }: { listing: ListingDetail; locale: Locale }) {
  const t = await getTranslations("listing");
  const tUnits = await getTranslations("units");
  const area = listing.neighborhood ?? listing.municipality;
  const street =
    listing.street !== undefined ? [listing.street, listing.streetNo].filter(Boolean).join(" ") : null;
  const poi = [...(listing.poi ?? [])].sort((a, b) => a.distanceM - b.distanceM);

  return (
    <section aria-labelledby="location-heading">
      <h2 id="location-heading" className="font-serif text-h2">
        {t("location")}
      </h2>
      <p className="mt-3 text-body-l text-ink">
        {street !== null ? `${street}, ` : ""}
        {placeLine(listing, locale)}
      </p>
      <p className="mt-1 text-small text-stone-text">
        {listing.coordPrecision === "exact" ? t("locationBlock.exact") : t("locationBlock.approximate")}
      </p>

      <div className="mt-6">
        <ListingMapLoader lat={listing.lat} lng={listing.lng} precision={listing.coordPrecision} />
        <p className="mt-2 text-label text-stone-text">{t("locationBlock.attribution")}</p>
      </div>

      {poi.length > 0 ? (
        <div className="mt-8">
          <h3 className="font-sans text-label font-medium uppercase tracking-[0.12em] text-stone-text">
            {t("locationBlock.poiHeading")}
          </h3>
          <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {poi.map((item) => (
              <li key={`${item.kind}-${item.name}`} className="hairline-t flex items-baseline justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block font-sans text-label uppercase tracking-[0.12em] text-stone-text">
                    {t(`poi.${item.kind}`)}
                  </span>
                  <span className="text-body text-ink">{item.name}</span>
                </span>
                <span data-numeric className="shrink-0 text-right text-small text-stone-text">
                  {tUnits("distanceM", { meters: formatCount(item.distanceM, locale) })}
                  <br />
                  {tUnits("minutesWalk", { minutes: Math.max(1, Math.round(item.distanceM / WALK_M_PER_MIN)) })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {area !== undefined ? (
        <Link
          href={{ pathname: "/locations/[slug]", params: { slug: area.slug } }}
          prefetch={false}
          className="group/teaser mt-8 flex items-center justify-between gap-6 bg-ink p-6 text-ivory md:p-8"
        >
          <span className="font-serif text-h3">
            {t("locationBlock.neighborhoodCta", { name: pickL10n(area.name, locale).text })}
          </span>
          <ArrowRight
            aria-hidden="true"
            strokeWidth={1.25}
            className="size-6 shrink-0 transition-transform duration-300 ease-out pointer-fine:group-hover/teaser:translate-x-1"
          />
        </Link>
      ) : null}
    </section>
  );
}
