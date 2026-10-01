import { PropertyCard, type CardMortgage } from "@/components/site/PropertyCard";
import type { ListingCard } from "@/convex/lib/dto";

/**
 * Listing cards in the content pages' 3:2 grid (a location's listings, an
 * agent's active and closed listings): one column on phones, two on tablets,
 * three from 1024px, the same card as the search results.
 */
export function ListingGrid({
  listings,
  now,
  mortgage,
}: {
  listings: readonly ListingCard[];
  /** The server's clock, for the "Novo" badge. */
  now: number;
  mortgage?: CardMortgage;
}) {
  return (
    <ul className="grid gap-x-6 gap-y-14 md:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
      {listings.map((listing) => (
        <li key={listing._id}>
          <PropertyCard
            listing={listing}
            ratio="3/2"
            sizes="(min-width: 1440px) 450px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 92vw"
            now={now}
            {...(mortgage !== undefined ? { mortgage } : {})}
          />
        </li>
      ))}
    </ul>
  );
}
