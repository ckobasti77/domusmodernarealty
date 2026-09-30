"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { ListingCard } from "@/convex/lib/dto";
import { PropertyCard, type CardMortgage } from "../PropertyCard";

/**
 * Similar listings (PRD A5) as a native scroll-snap row: swipe on touch,
 * arrow buttons beside the heading on desktop, and every card stays in the
 * normal tab order, so there is no carousel state to keep in sync with focus.
 *
 * The track carries no `data-lenis-prevent`: Lenis already lets horizontal
 * gestures through, and the `overscroll-behavior: contain` its stylesheet adds
 * to such elements would trap a vertical wheel over the cards. Only the x axis
 * is contained, so a sideways flick never triggers the browser's back swipe.
 */
export function SimilarRail({
  heading,
  listings,
  mortgage,
  now,
}: {
  heading: string;
  listings: readonly ListingCard[];
  mortgage?: CardMortgage;
  /** The server's clock, for the "Novo" badge (same as the search results). */
  now: number;
}) {
  const t = useTranslations("listing.rail");
  const track = useRef<HTMLUListElement>(null);

  const scroll = (direction: 1 | -1) => {
    const node = track.current;
    if (node === null) return;
    const card = node.querySelector("li");
    const step = card !== null ? card.getBoundingClientRect().width + 24 : node.clientWidth * 0.8;
    node.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const arrow =
    "inline-flex size-11 items-center justify-center border border-ink/30 transition-colors duration-200 pointer-fine:hover:border-bronze";

  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <h2 id="similar-heading" className="font-display text-h2">
          {heading}
        </h2>
        {listings.length > 3 ? (
          <div className="hidden gap-2 lg:flex">
            <button type="button" onClick={() => scroll(-1)} aria-label={t("prev")} className={arrow}>
              <ChevronLeft aria-hidden="true" strokeWidth={1.25} className="size-5" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label={t("next")} className={arrow}>
              <ChevronRight aria-hidden="true" strokeWidth={1.25} className="size-5" />
            </button>
          </div>
        ) : null}
      </div>
      <ul
        ref={track}
        className="-mx-gutter mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain scroll-px-gutter px-gutter pb-4 md:-mx-gutter-md md:scroll-px-gutter-md md:px-gutter-md lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {listings.map((listing) => (
          <li key={listing._id} className="w-[82%] shrink-0 snap-start sm:w-[45%] lg:w-[calc((100%-48px)/3)]">
            <PropertyCard
              listing={listing}
              ratio="3/2"
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 82vw"
              now={now}
              {...(mortgage !== undefined ? { mortgage } : {})}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
