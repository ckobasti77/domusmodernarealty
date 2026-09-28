"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useState } from "react";
import type { PublicImage } from "@/convex/lib/dto";
import type { Floor } from "@/convex/lib/validators";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixOrphans, formatArea } from "@/lib/format";
import { pickL10n, type L10nValue } from "@/lib/l10n";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";
import { FavoriteButton } from "./FavoriteButton";
import { Price } from "./Price";

/**
 * The listing card (DESIGN §4). 4:5 on the landing, 3:2 in search. No border, no
 * radius, no shadow — the photograph is the card. The image scales 1.04 → 1 over
 * 700ms on hover, gated behind a fine pointer.
 *
 * The whole card is one link (the title anchor stretched with `after:absolute`)
 * so there is exactly one tab stop for the destination, with the favorite button
 * and the carousel arrows lifted above it. That keeps the tab order short
 * without nesting interactive elements inside an anchor.
 */

/** Only the fields the card renders, so a caller can pass a card DTO directly. */
export type PropertyCardListing = {
  _id: string;
  slug: string;
  ref: string;
  status: string;
  transaction: "sale" | "rent";
  title: L10nValue;
  locationLabel: L10nValue;
  price: number;
  pricePerM2: number;
  priceOnRequest?: boolean;
  previousPrice?: number;
  areaM2: number;
  rooms: number;
  floor: Floor;
  totalFloors?: number;
  cover?: PublicImage;
  photoCount: number;
  isExclusive: boolean;
  hasTour: boolean;
};

export type PropertyCardProps = {
  listing: PropertyCardListing;
  /** Extra gallery frames. With 0 or 1 image the carousel chrome is not rendered. */
  images?: readonly PublicImage[];
  ratio?: "4/5" | "3/2";
  sizes?: string;
  priority?: boolean;
  className?: string;
};

export function PropertyCard({
  listing,
  images,
  ratio = "4/5",
  sizes = "(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 90vw",
  priority = false,
  className,
}: PropertyCardProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("card");
  const tListing = useTranslations("listing");
  const tUnits = useTranslations("units");

  const title = pickL10n(listing.title, locale);
  const location = pickL10n(listing.locationLabel, locale);

  const frames: readonly PublicImage[] =
    images !== undefined && images.length > 0
      ? images
      : listing.cover !== undefined
        ? [listing.cover]
        : [];

  return (
    <article
      className={cn("group/card relative flex flex-col", className)}
      aria-labelledby={`card-title-${listing._id}`}
    >
      <div className="relative">
        <Gallery
          frames={frames}
          ratio={ratio}
          sizes={sizes}
          priority={priority}
          locale={locale}
          alt={title.text}
        />

        {/* DESIGN 5 scrims the bottom 40% of dark-section media, but the badges
            and the favorite sit at the TOP — over whatever the photograph happens
            to be there. This is their scrim. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-ink/60 to-transparent"
        />

        {/* Status and feature badges. Text, not colour, carries the meaning. */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2">
          {listing.status === "reserved" ? (
            <Badge tone="status">{tListing("statusReserved")}</Badge>
          ) : null}
          {listing.status === "sold" ? <Badge tone="status">{tListing("statusSold")}</Badge> : null}
          {listing.status === "rented" ? (
            <Badge tone="status">{tListing("statusRented")}</Badge>
          ) : null}
          {listing.isExclusive ? <Badge tone="dark">{t("exclusive")}</Badge> : null}
          {listing.hasTour ? <Badge tone="dark">{t("hasTour")}</Badge> : null}
        </div>

        <div className="absolute right-4 top-4 z-20">
          <FavoriteButton listingId={listing._id} title={title.text} tone="dark" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <h3 id={`card-title-${listing._id}`} className="font-display text-h3 font-normal">
          <Link
            href={{ pathname: "/properties/[slug]", params: { slug: listing.slug } }}
            prefetch={false}
            lang={title.lang === locale ? undefined : title.lang}
            className="after:absolute after:inset-0 after:z-10 after:content-[''] pointer-fine:group-hover/card:text-bronze-text transition-colors duration-200"
          >
            {fixOrphans(title.text)}
          </Link>
        </h3>

        <p className="text-small text-stone-text" lang={location.lang === locale ? undefined : location.lang}>
          {location.text}
        </p>

        <Price
          price={listing.price}
          pricePerM2={listing.pricePerM2}
          previousPrice={listing.previousPrice}
          priceOnRequest={listing.priceOnRequest}
          transaction={listing.transaction}
          size="md"
        />

        {/* Meta row, hairline-separated. `divide-x` gives one rule per boundary. */}
        {/* DESIGN 4: "meta row with hairline dividers". `divide-x` needs a
            non-wrapping flex row to draw them, so the row scrolls rather than
            wraps on a narrow card. */}
        <dl className="mt-1 flex items-center divide-x divide-hairline-light text-small text-stone-text">
          <MetaItem label={tListing("area")} className="pr-4">
            {formatArea(listing.areaM2, locale, tUnits("m2"))}
          </MetaItem>
          <MetaItem label={tListing("rooms")} className="px-4">
            {t("rooms", { rooms: listing.rooms })}
          </MetaItem>
          <MetaItem label={tListing("floor")} className="pl-4">
            {listing.totalFloors !== undefined
              ? t("floorOf", { floor: String(listing.floor), total: listing.totalFloors })
              : String(listing.floor)}
          </MetaItem>
        </dl>

        <p className="font-mono text-label uppercase text-stone-text">
          {tListing("reference")} {listing.ref}
        </p>
      </div>
    </article>
  );
}

function MetaItem({
  label,
  children,
  className,
  srLabel = true,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  srLabel?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline gap-1 first:pl-0", className)}>
      {srLabel ? <dt className="sr-only">{label}</dt> : null}
      <dd data-numeric>{children}</dd>
    </div>
  );
}

function Gallery({
  frames,
  ratio,
  sizes,
  priority,
  locale,
  alt,
}: {
  frames: readonly PublicImage[];
  ratio: "4/5" | "3/2";
  sizes: string;
  priority: boolean;
  locale: Locale;
  alt: string;
}) {
  const t = useTranslations("common");
  const tCard = useTranslations("card");
  const groupId = useId();
  const [emblaRef, embla] = useEmblaCarousel({ loop: frames.length > 2, align: "start" });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (embla === undefined) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);

  const aspect = ratio === "4/5" ? "aspect-[4/5]" : "aspect-[3/2]";

  if (frames.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center bg-ivory-2 text-stone-text", aspect)}
        role="img"
        aria-label={alt}
      >
        <span className="font-mono text-label uppercase">{tCard("featured")}</span>
      </div>
    );
  }

  const single = frames.length === 1;

  return (
    <div
      className={cn("relative overflow-hidden bg-ivory-2", aspect)}
      aria-roledescription={single ? undefined : "carousel"}
    >
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {frames.map((frame, i) => {
            const frameAlt = pickL10n(frame.alt, locale);
            return (
              <div
                key={frame.id}
                className="relative h-full min-w-0 flex-[0_0_100%]"
                role={single ? undefined : "group"}
                aria-roledescription={single ? undefined : "slide"}
                aria-label={single ? undefined : `${i + 1} / ${frames.length}`}
              >
                <Image
                  src={frame.url}
                  alt={frameAlt.text}
                  fill
                  sizes={sizes}
                  priority={priority && i === 0}
                  placeholder={frame.blurDataURL !== undefined ? "blur" : "empty"}
                  blurDataURL={frame.blurDataURL}
                  className="scale-[1.04] object-cover transition-transform duration-700 ease-out pointer-fine:group-hover/card:scale-100"
                />
              </div>
            );
          })}
        </div>
      </div>

      {single ? null : (
        <>
          <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between">
            <button
              type="button"
              onClick={prev}
              aria-controls={groupId}
              aria-label={t("back")}
              className="inline-flex size-11 items-center justify-center bg-ink/70 text-ivory transition-colors duration-200 pointer-fine:hover:bg-ink"
            >
              <ChevronLeft aria-hidden="true" strokeWidth={1.25} className="size-5" />
            </button>
            <p
              data-numeric
              aria-live="polite"
              className="bg-ink/70 px-2 py-1 font-mono text-label text-ivory"
            >
              {index + 1} / {frames.length}
            </p>
            <button
              type="button"
              onClick={next}
              aria-controls={groupId}
              aria-label={t("more")}
              className="inline-flex size-11 items-center justify-center bg-ink/70 text-ivory transition-colors duration-200 pointer-fine:hover:bg-ink"
            >
              <ChevronRight aria-hidden="true" strokeWidth={1.25} className="size-5" />
            </button>
          </div>
          <span id={groupId} className="sr-only">
            {alt}
          </span>
        </>
      )}
    </div>
  );
}
