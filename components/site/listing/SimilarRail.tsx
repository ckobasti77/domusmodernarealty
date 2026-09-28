"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { ListingCard } from "@/convex/lib/dto";
import { PropertyCard } from "../PropertyCard";

/**
 * Similar listings (PRD A5) as a native scroll-snap row: swipe on touch,
 * arrow buttons on desktop, and every card stays in the normal tab order, so
 * there is no carousel state to keep in sync with focus.
 */
export function SimilarRail({ listings }: { listings: readonly ListingCard[] }) {
  const t = useTranslations("listing.rail");
  const track = useRef<HTMLUListElement>(null);

  const scroll = (direction: 1 | -1) => {
    const node = track.current;
    if (node === null) return;
    const card = node.querySelector("li");
    const step = card !== null ? card.getBoundingClientRect().width + 24 : node.clientWidth * 0.8;
    node.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        data-lenis-prevent=""
        className="-mx-gutter flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-gutter px-gutter pb-4 md:-mx-gutter-md md:scroll-px-gutter-md md:px-gutter-md lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {listings.map((listing) => (
          <li key={listing._id} className="w-[82%] shrink-0 snap-start sm:w-[45%] lg:w-[calc((100%-48px)/3)]">
            <PropertyCard listing={listing} ratio="3/2" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 82vw" />
          </li>
        ))}
      </ul>
      {listings.length > 3 ? (
        <div className="mt-4 hidden justify-end gap-2 lg:flex">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={t("prev")}
            className="inline-flex size-11 items-center justify-center border border-ink/30 transition-colors duration-200 pointer-fine:hover:border-bronze"
          >
            <ChevronLeft aria-hidden="true" strokeWidth={1.25} className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={t("next")}
            className="inline-flex size-11 items-center justify-center border border-ink/30 transition-colors duration-200 pointer-fine:hover:border-bronze"
          >
            <ChevronRight aria-hidden="true" strokeWidth={1.25} className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
