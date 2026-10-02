"use client";

import useEmblaCarousel from "embla-carousel-react";
import { Box, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import type { PublicImage } from "@/convex/lib/dto";
import type { Floor, PropertyType } from "@/convex/lib/validators";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography, fixWidows, formatArea, formatPrice } from "@/lib/format";
import { frameLoader } from "@/lib/image-loaders";
import { clipTitle, floorName } from "@/lib/listing-text";
import { pickL10n, type L10nValue } from "@/lib/l10n";
import { computeMortgage } from "@/lib/mortgage";
import { COMPARE_MAX, toggleCompare, useCompareIds } from "@/lib/stores/compare";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";
import { FavoriteButton } from "./FavoriteButton";
import { displayFloor, displayTotalFloors } from "./listing/floor";
import { Price } from "./Price";
import { setHoveredListing, useIsHovered } from "./search/hover-store";

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

/** What the card draws of a photograph; a `PublicImage` passes as is. */
export type CardFrame = Pick<PublicImage, "id" | "url" | "alt" | "blurDataURL">;

/** Only the fields the card renders, so a caller can pass a card DTO directly. */
export type PropertyCardListing = {
  _id: string;
  slug: string;
  ref: string;
  status: string;
  transaction: "sale" | "rent";
  propertyType: PropertyType;
  title: L10nValue;
  locationLabel: L10nValue;
  price: number;
  pricePerM2: number;
  previousPrice?: number;
  areaM2: number;
  rooms: number;
  floor: Floor;
  totalFloors?: number;
  cover?: CardFrame;
  isExclusive: boolean;
  hasTour: boolean;
  publishedAt?: number;
  constructionType?: "new" | "old" | "under_construction";
  registered?: boolean;
  mortgageEligible?: boolean;
};

/** Settings-driven assumptions behind the "Rata od ~X €/mes." line (PRD A4). */
export type CardMortgage = { rate: number; years: number; downPct: number };

/** A listing is "Novo" for a week after it is published. */
const NEW_FOR_MS = 7 * 24 * 3_600_000;
const MAX_BADGES = 2;

export type PropertyCardProps = {
  listing: PropertyCardListing;
  /** Extra gallery frames. With 0 or 1 image the carousel chrome is not rendered. */
  images?: readonly CardFrame[];
  ratio?: "4/5" | "3/2";
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Adds the monthly-rate estimate under a sale price. */
  mortgage?: CardMortgage;
  /**
   * Reference time for the "Novo" badge. Passed in (the server's clock) rather
   * than read here, so the server and the client render the same badge.
   */
  now?: number;
  /** Shows the "Uporedi" toggle (search results). */
  compare?: boolean;
  /** Highlights and reports hover to the results map. */
  hoverSync?: boolean;
};

export function PropertyCard({
  listing,
  images,
  ratio = "4/5",
  sizes = "(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 90vw",
  priority = false,
  className,
  mortgage,
  now,
  compare = false,
  hoverSync = false,
}: PropertyCardProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("card");
  const tListing = useTranslations("listing");
  const tUnits = useTranslations("units");

  const title = pickL10n(listing.title, locale);
  // The narrow 4:5 landing card clips at a word boundary (step 05); the wider
  // 3:2 card shows the whole title and lets CSS end line two, since a
  // character count cut there left a one-line title over an empty line.
  const shown = ratio === "4/5" ? clipTitle(title.text) : { text: title.text, clipped: false };
  // House style, as on the listing page: short prepositions stay with the next
  // word and a short last word ("2023.") never sits alone on line two.
  const shownText = fixWidows(fixTypography(shown.text), 16);
  // The same guards as the key facts: a plot or a garage has no rooms (the
  // schema stores 0), and a plot has no storey.
  const hasRooms = listing.propertyType !== "land" && listing.propertyType !== "garage" && listing.rooms > 0;
  const hasFloor = listing.propertyType !== "land";
  // Serbian portals write storeys as codes ("PR / 5"). Other locales get the
  // words the listing page uses, and Russian counts the ground floor as the first.
  const floor = displayFloor(listing.floor, locale);
  const floorText =
    locale === "sr-Latn" || typeof floor === "number"
      ? String(floor)
      : floorName(tListing, floor);
  const totalFloors = displayTotalFloors(listing.totalFloors, locale);
  const location = pickL10n(listing.locationLabel, locale);

  const badges = pickBadges(listing, now).map((badge) =>
    badge === "reserved" || badge === "sold" || badge === "rented" ? (
      <Badge key={badge} tone="status">
        {tListing(badge === "reserved" ? "statusReserved" : badge === "sold" ? "statusSold" : "statusRented")}
      </Badge>
    ) : (
      <Badge key={badge} tone="dark">
        {t(badge)}
      </Badge>
    ),
  );

  const monthly =
    mortgage !== undefined && listing.transaction === "sale"
      ? computeMortgage({ price: listing.price, downPct: mortgage.downPct, years: mortgage.years, ratePct: mortgage.rate })
          .monthlyPayment
      : null;

  const frames: readonly CardFrame[] =
    images !== undefined && images.length > 0
      ? images
      : listing.cover !== undefined
        ? [listing.cover]
        : [];

  return (
    <Hoverable id={listing._id} enabled={hoverSync} className={cn("group/card relative flex h-full flex-col", className)}>
      <div className="relative">
        <Gallery
          slug={listing.slug}
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
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-ink/40 to-transparent"
        />

        {/* At most two badges, most decisive first. Text, not colour, carries the meaning. */}
        {/* One row only: a badge that would wrap (long Russian or German
            words) falls onto a clipped second row and disappears whole. The
            row stops 8px short of the favorite's plate. */}
        <div className="pointer-events-none absolute left-4 right-14 top-4 z-10 flex max-h-[1.625rem] flex-wrap gap-2 overflow-hidden">
          {badges}
        </div>

        {/* The 44px hit box is placed so its 32px plate is centred on the
            badge row and its right edge keeps the badges' 16px inset. */}
        <div className="absolute right-2.5 top-1.5 z-20">
          <FavoriteButton
            listingId={listing._id}
            title={title.text}
            tone="dark"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3">
        {/* Two lines reserved, so cards in a row keep their prices, meta rows
            and references on the same baselines. The 4:5 card's title is
            already clipped to two lines; the 3:2 card may take a third rather
            than cut off the floor, the terrace or the VAT refund. The card
            fills its grid cell (`h-full`) and a shorter title's spare height
            sits under it (`mb-auto`), so the row's baselines still meet. */}
        <h3
          id={`card-title-${listing._id}`}
          className={cn(
            "mb-auto min-h-[2lh] text-pretty font-display text-h3 font-normal",
            ratio === "4/5" ? "line-clamp-2" : "line-clamp-3",
          )}
        >
          <Link
            href={{
              pathname: "/properties/[slug]",
              params: { slug: listing.slug },
            }}
            lang={title.lang === locale ? undefined : title.lang}
            className="after:absolute after:inset-0 after:z-10 after:content-[''] pointer-fine:group-hover/card:text-bronze-text transition-colors duration-200 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-current"
          >
            {shown.clipped ? (
              <>
                {/* The clipped wording is for the eye; assistive technology gets the whole title. */}
                <span aria-hidden="true">{shownText}</span>
                <span className="sr-only">{title.text}</span>
              </>
            ) : (
              shownText
            )}
          </Link>
        </h3>

        <p
          className="text-small text-stone-text"
          lang={location.lang === locale ? undefined : location.lang}
        >
          {location.text}
        </p>

        <div className="flex flex-col gap-1">
          <Price
            price={listing.price}
            pricePerM2={listing.pricePerM2}
            previousPrice={listing.previousPrice}
            transaction={listing.transaction}
            size="md"
          />
          {monthly !== null && mortgage !== undefined ? (
            <p className="text-small text-stone-text" data-testid="card-monthly-rate">
              <span data-numeric>{t("monthlyRate", { amount: formatPrice(monthly, locale) })}</span>
              <span className="sr-only">
                {" "}
                {t("monthlyRateDetails", {
                  down: formatPercent(mortgage.downPct, locale),
                  years: mortgage.years,
                  rate: formatPercent(mortgage.rate, locale),
                })}
              </span>
            </p>
          ) : null}
        </div>

        {/* Meta row, hairline-separated. `divide-x` gives one rule per boundary. */}
        {/* DESIGN 4: "meta row with hairline dividers". `divide-x` needs a
            non-wrapping flex row to draw them, so the row scrolls rather than
            wraps on a narrow card. */}
        <dl className="mt-1 flex items-center divide-x divide-hairline-light text-small text-stone-text">
          <MetaItem label={tListing("area")}>
            {formatArea(listing.areaM2, locale, tUnits("m2"))}
          </MetaItem>
          {hasRooms ? (
            <MetaItem label={tListing("rooms")}>
              {t("rooms", { rooms: listing.rooms })}
            </MetaItem>
          ) : null}
          {hasFloor ? (
            <MetaItem label={tListing("floor")}>
              {totalFloors !== undefined
                ? t("floorOf", { floor: floorText, total: totalFloors })
                : floorText}
            </MetaItem>
          ) : null}
        </dl>

        <div className="flex min-h-11 items-center justify-between gap-4">
          <p className="flex flex-wrap items-center gap-x-3 font-mono text-label uppercase text-stone-text">
            <span>
              {tListing("reference")} {listing.ref}
            </span>
            {listing.hasTour ? (
              <span className="inline-flex items-center gap-1.5 text-bronze-text">
                <Box aria-hidden="true" strokeWidth={1.25} className="size-3.5" />
                {/* Beside the "Uporedi" toggle the word would push a long
                    reference ("Код объекта", "Objektnummer") onto a second
                    line, so that card keeps the cube and names it for
                    assistive technology only. */}
                <span className={compare ? "sr-only" : undefined}>{t("hasTour")}</span>
              </span>
            ) : null}
          </p>
          {compare ? <CompareToggle id={listing._id} title={title.text} /> : null}
        </div>
      </div>
    </Hoverable>
  );
}

type BadgeKey =
  | "reserved"
  | "sold"
  | "rented"
  | "exclusive"
  | "priceReduced"
  | "new"
  | "newBuild"
  | "registered"
  | "mortgage";

/**
 * PRD A4 lists seven badges; seven boxes over a photograph read as noise. The
 * card shows the two that say the most, in this order: a status ribbon, then
 * the agency's own mandate, then news (a cut, a fresh listing, a new build),
 * then the common legal/finance facts. The 3D tour is not a badge: nearly
 * every demo listing has one, so it sits on the reference line instead.
 */
function pickBadges(listing: PropertyCardListing, now: number | undefined): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (listing.status === "reserved" || listing.status === "sold" || listing.status === "rented") {
    out.push(listing.status);
  }
  if (listing.isExclusive) out.push("exclusive");
  if (listing.previousPrice !== undefined && listing.previousPrice > listing.price) out.push("priceReduced");
  if (now !== undefined && listing.publishedAt !== undefined && now - listing.publishedAt < NEW_FOR_MS) {
    out.push("new");
  }
  if (listing.constructionType === "new" || listing.constructionType === "under_construction") out.push("newBuild");
  if (listing.registered === true) out.push("registered");
  if (listing.mortgageEligible === true) out.push("mortgage");
  return out.slice(0, MAX_BADGES);
}

const PERCENT_LOCALE: Record<Locale, string> = { "sr-Latn": "sr-Latn-RS", en: "en-GB", ru: "ru-RU", de: "de-DE" };

/** "5,4" / "5.4": the rate and the down payment enter the sentence already localized. */
function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(PERCENT_LOCALE[locale], { maximumFractionDigits: 2 }).format(value);
}

/**
 * The card root. With `enabled`, pointer and keyboard focus report the card to
 * the results map, and a hover that comes FROM the map draws a bronze hairline
 * around the card so the eye can find it in the grid.
 */
function Hoverable({
  id,
  enabled,
  className,
  children,
}: {
  id: string;
  enabled: boolean;
  className: string;
  children: ReactNode;
}) {
  const hovered = useIsHovered(id);
  const active = enabled && hovered;
  return (
    <article
      className={cn(
        className,
        // Its own stacking context: the carousel controls (z-20) and the
        // stretched link must not rise above sticky or fixed page chrome.
        "isolate outline-offset-8 transition-[outline-color] duration-200",
        active ? "outline outline-1 outline-bronze" : "outline-transparent",
      )}
      aria-labelledby={`card-title-${id}`}
      data-listing-id={id}
      data-hovered={enabled ? (active ? "true" : "false") : undefined}
      // A mouse only: a tap is not a hover, and the map is not beside a phone list.
      onPointerEnter={enabled ? (event) => event.pointerType === "mouse" && setHoveredListing(id, "list") : undefined}
      onPointerLeave={enabled ? (event) => event.pointerType === "mouse" && setHoveredListing(null, "list") : undefined}
      onFocus={enabled ? () => setHoveredListing(id, "list") : undefined}
      onBlur={
        enabled
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setHoveredListing(null, "list");
            }
          : undefined
      }
    >
      {children}
    </article>
  );
}

/** "Uporedi": a pressed toggle backed by the compare store. */
function CompareToggle({ id, title }: { id: string; title: string }) {
  const t = useTranslations("card");
  const tCompare = useTranslations("compare");
  const selected = useCompareIds().includes(id);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    if (!refused) return;
    const timer = window.setTimeout(() => setRefused(false), 4000);
    return () => window.clearTimeout(timer);
  }, [refused]);

  return (
    <span className="relative z-20 flex shrink-0 flex-col items-end">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={t("compareLabel", { title })}
        onClick={() => setRefused(!toggleCompare(id))}
        data-testid="card-compare"
        className={cn(
          "inline-flex min-h-11 items-center gap-2 font-sans text-label uppercase tracking-[0.12em]",
          "transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text",
          selected ? "text-ink" : "text-stone-text pointer-fine:hover:text-ink",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-4 items-center justify-center border transition-colors duration-200",
            selected ? "border-ink bg-ink" : "border-ink/40",
          )}
        >
          {selected ? <span className="size-1.5 bg-ivory" /> : null}
        </span>
        {t("compare")}
      </button>
      <span role="status" className="absolute right-0 top-full w-56 text-right text-label text-danger">
        {refused ? tCompare("limitReached", { max: COMPARE_MAX }) : null}
      </span>
    </span>
  );
}

function MetaItem({
  label,
  children,
  srLabel = true,
}: {
  label: string;
  children: React.ReactNode;
  srLabel?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1 px-4 first:pl-0 last:pr-0">
      {srLabel ? <dt className="sr-only">{label}</dt> : null}
      <dd data-numeric>{children}</dd>
    </div>
  );
}

function Gallery({
  slug,
  frames,
  ratio,
  sizes,
  priority,
  locale,
  alt,
}: {
  slug: string;
  frames: readonly CardFrame[];
  ratio: "4/5" | "3/2";
  sizes: string;
  priority: boolean;
  locale: Locale;
  alt: string;
}) {
  const tLightbox = useTranslations("listing.lightbox");
  const tCard = useTranslations("card");
  const router = useRouter();
  const groupId = useId();
  const [emblaRef, embla] = useEmblaCarousel({
    loop: frames.length > 2,
    align: "start",
  });
  const [index, setIndex] = useState(0);
  // Only the first photo is in the server HTML: every frame's srcset, on a
  // page of cards, would outweigh the rest of the page. The others mount
  // once the visitor reaches for the carousel (a pointer over it, a touch,
  // focus on an arrow) into slides that are already there, so Embla keeps
  // its snaps and the swipe that mounts them is not cut short.
  const [engaged, setEngaged] = useState(false);
  const engage = useCallback(() => setEngaged(true), []);

  useEffect(() => {
    if (embla === undefined) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const prev = useCallback(() => {
    setEngaged(true);
    embla?.scrollPrev();
  }, [embla]);
  const next = useCallback(() => {
    setEngaged(true);
    embla?.scrollNext();
  }, [embla]);

  const aspect = ratio === "4/5" ? "aspect-[4/5]" : "aspect-[3/2]";

  if (frames.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-ivory-2 text-stone-text",
          aspect,
        )}
        role="img"
        aria-label={alt}
      >
        <span className="font-mono text-label uppercase">
          {tCard("featured")}
        </span>
      </div>
    );
  }

  const single = frames.length === 1;

  return (
    <div
      className={cn("relative overflow-hidden bg-ivory-2", aspect)}
      aria-roledescription={single ? undefined : "carousel"}
      onPointerEnter={single ? undefined : engage}
      onPointerDown={single ? undefined : engage}
      onFocus={single ? undefined : engage}
    >
      {/* The title's stretched link covers the card, so on a touch screen the
          photos sit above it: a swipe reaches Embla, and a tap (Embla swallows
          the click that ends a drag) still opens the listing. A mouse keeps the
          link on top and uses the arrows. Keyboard users have the title link. */}
      <div
        ref={emblaRef}
        className={cn("h-full overflow-hidden", !single && "relative pointer-coarse:z-[11]")}
        onClick={
          single ? undefined : () => router.push({ pathname: "/properties/[slug]", params: { slug } })
        }
      >
        <div className="flex h-full">
          {frames.map((frame, i) => (
            <div
              key={frame.id}
              // Clips its own photo: the 1.04 hover scale must not show a
              // sliver of the next slide at the card's edge.
              className="relative h-full min-w-0 flex-[0_0_100%] overflow-hidden"
              role={single ? undefined : "group"}
              aria-roledescription={single ? undefined : "slide"}
              aria-label={single ? undefined : `${i + 1} / ${frames.length}`}
            >
              {i === 0 || engaged ? (
                // The featured rail's parallax moves this wrapper, so it never
                // fights the photo's own hover transition.
                <div data-card-parallax="" className="absolute inset-0">
                  <Image
                    data-card-image=""
                    src={frame.url}
                    // Demo photos arrive already cropped to the frame, so a 3:2
                    // source is not enlarged to fill a 4:5 card.
                    loader={frameLoader(
                      frame.url,
                      ratio === "4/5" ? 1.25 : 2 / 3,
                    )}
                    alt={pickL10n(frame.alt, locale).text}
                    fill
                    sizes={sizes}
                    // Next 16 deprecated `priority`; the first frame of a lead card is an LCP candidate.
                    loading={priority && i === 0 ? "eager" : "lazy"}
                    fetchPriority={priority && i === 0 ? "high" : "auto"}
                    placeholder={
                      frame.blurDataURL !== undefined ? "blur" : "empty"
                    }
                    blurDataURL={frame.blurDataURL}
                    className="scale-[1.04] object-cover transition-[scale] duration-700 ease-out pointer-fine:group-hover/card:scale-100"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {single ? null : (
        <>
          {/* On a mouse the chrome appears with the pointer (or keyboard focus)
              so a grid of cards is not a grid of arrows; touch keeps it. */}
          <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between transition-opacity duration-200 pointer-fine:opacity-0 pointer-fine:group-hover/card:opacity-100 pointer-fine:focus-within:opacity-100">
            <button
              type="button"
              onClick={prev}
              aria-controls={groupId}
              aria-label={tLightbox("prev")}
              // Touch swipes the photos; the arrows would only add targets.
              className="inline-flex size-11 items-center justify-center bg-ink/70 text-ivory transition-colors duration-200 pointer-coarse:invisible pointer-fine:hover:bg-ink"
            >
              <ChevronLeft
                aria-hidden="true"
                strokeWidth={1.25}
                className="size-5"
              />
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
              aria-label={tLightbox("next")}
              // Touch swipes the photos; the arrows would only add targets.
              className="inline-flex size-11 items-center justify-center bg-ink/70 text-ivory transition-colors duration-200 pointer-coarse:invisible pointer-fine:hover:bg-ink"
            >
              <ChevronRight
                aria-hidden="true"
                strokeWidth={1.25}
                className="size-5"
              />
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
