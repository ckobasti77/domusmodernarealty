"use client";

import { Images } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { PublicImage } from "@/convex/lib/dto";
import type { RoomTag } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import { cn } from "@/lib/utils";
import { Badge } from "../Badge";
import { roomsIn } from "./media";

const ListingLightbox = dynamic(() => import("./ListingLightbox"), { ssr: false });

/**
 * The editorial hero gallery (PRD A5): one large frame plus up to four smaller
 * ones, a "all photos" button on the last visible frame, and room-filter chips
 * that narrow both the grid and the lightbox. Every frame is a real `<button>`,
 * so the grid is keyboard-operable before the lightbox code has even loaded.
 *
 * Below 768px only the large frame is shown; the lightbox is where a phone
 * swipes through the set.
 *
 * `variant="plans"` reuses the same machinery for floor plans: a plain grid of
 * contained drawings instead of cropped photographs.
 */

export type ListingGalleryProps = {
  images: readonly PublicImage[];
  /** Fallback alt when an image carries none (the listing title). */
  title: string;
  /** "Prodato" / "Izdato" / "Rezervisano" ribbon over the first frame. */
  ribbon?: string;
  variant?: "hero" | "plans";
};

/** Span classes for the small frames, by how many there are (1–4). */
const SMALL_SPANS: Record<number, readonly string[]> = {
  1: ["md:col-span-2 md:row-span-2"],
  2: ["md:col-span-2", "md:col-span-2"],
  3: ["md:col-span-2", "", ""],
  4: ["", "", "", ""],
};

export function ListingGallery({ images, title, ribbon, variant = "hero" }: ListingGalleryProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const [room, setRoom] = useState<RoomTag | "all">("all");
  const [open, setOpen] = useState<number | null>(null);

  const rooms = variant === "hero" ? roomsIn(images) : [];
  const filtered = room === "all" ? images : images.filter((image) => image.room === room);
  const total = filtered.length;
  if (images.length === 0) return null;

  const altOf = (image: PublicImage) => {
    const alt = pickL10n(image.alt, locale);
    return alt.text.length > 0 ? alt.text : title;
  };

  const openLabel = (index: number) => t("galleryUi.open", { index: index + 1, total });

  if (variant === "plans") {
    return (
      <div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                aria-label={openLabel(index)}
                className="group/plan relative block aspect-[4/3] w-full overflow-hidden bg-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bronze"
              >
                <Image
                  src={image.url}
                  alt={altOf(image)}
                  fill
                  sizes="(min-width: 640px) 45vw, 100vw"
                  className="object-contain p-4 transition-transform duration-500 ease-out pointer-fine:group-hover/plan:scale-[1.02]"
                />
              </button>
            </li>
          ))}
        </ul>
        {open !== null ? (
          <ListingLightbox images={filtered} index={open} onClose={() => setOpen(null)} />
        ) : null}
      </div>
    );
  }

  const [lead, ...rest] = filtered;
  const small = rest.slice(0, 4);
  const spans = SMALL_SPANS[small.length] ?? [];
  const hiddenCount = total - 1 - small.length;

  return (
    <div>
      <div
        className={cn(
          "grid gap-2",
          small.length > 0 && "md:grid-cols-4 md:grid-rows-2",
          "md:h-[clamp(420px,62vh,680px)]",
        )}
      >
        {lead !== undefined ? (
          <button
            type="button"
            onClick={() => setOpen(0)}
            aria-label={openLabel(0)}
            className={cn(
              "group/frame relative block aspect-[4/3] w-full overflow-hidden bg-ink-2 md:aspect-auto md:h-full",
              small.length > 0 && "md:col-span-2 md:row-span-2",
              "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bronze",
            )}
          >
            <Image
              src={lead.url}
              alt={altOf(lead)}
              fill
              preload
              sizes={small.length > 0 ? "(min-width: 768px) 50vw, 100vw" : "100vw"}
              placeholder={lead.blurDataURL !== undefined ? "blur" : "empty"}
              blurDataURL={lead.blurDataURL}
              className="object-cover transition-transform duration-700 ease-out pointer-fine:group-hover/frame:scale-[1.02]"
            />
            {ribbon !== undefined ? (
              <span className="absolute left-4 top-4">
                <Badge tone="status" className="px-4 py-2 text-small">
                  {ribbon}
                </Badge>
              </span>
            ) : null}
            {/* Phones see only this frame, so it carries the "all photos" affordance. */}
            <span
              aria-hidden="true"
              className="absolute bottom-3 right-3 inline-flex items-center gap-2 bg-ink/70 px-3 py-2 font-sans text-label uppercase tracking-[0.12em] text-ivory backdrop-blur-[2px] md:hidden"
            >
              <Images strokeWidth={1.25} className="size-4" />
              {t("galleryUi.counter", { index: 1, total })}
            </span>
          </button>
        ) : null}

        {small.map((image, i) => {
          const index = i + 1;
          const isLast = i === small.length - 1 && hiddenCount > 0;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => setOpen(index)}
              aria-label={isLast ? t("galleryUi.showAll", { count: total }) : openLabel(index)}
              className={cn(
                "group/frame relative hidden overflow-hidden bg-ink-2 md:block",
                spans[i],
                "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bronze",
              )}
            >
              <Image
                src={image.url}
                alt={altOf(image)}
                fill
                sizes="25vw"
                className="object-cover transition-transform duration-700 ease-out pointer-fine:group-hover/frame:scale-[1.03]"
              />
              {isLast ? (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/55 font-sans text-small font-medium uppercase tracking-[0.12em] text-ivory transition-colors duration-300 pointer-fine:group-hover/frame:bg-ink/65">
                  {t("galleryUi.showAll", { count: total })}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {rooms.length > 1 ? (
          <div role="group" aria-label={t("galleryUi.filterLabel")} className="flex flex-wrap gap-2">
            {(["all", ...rooms] as const).map((value) => {
              const active = room === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRoom(value)}
                  className={cn(
                    "inline-flex min-h-11 items-center border px-4 font-sans text-label font-medium uppercase tracking-[0.12em]",
                    "transition-colors duration-200 ease-out",
                    active
                      ? "border-ivory bg-ivory text-ink"
                      : "border-ivory/40 text-ivory pointer-fine:hover:border-bronze pointer-fine:hover:text-bronze",
                  )}
                >
                  {value === "all" ? t("galleryUi.all") : t(`room.${value}`)}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="inline-flex min-h-11 items-center gap-2 font-sans text-small uppercase tracking-[0.12em] text-ivory transition-colors duration-200 pointer-fine:hover:text-bronze"
        >
          <Images aria-hidden="true" strokeWidth={1.25} className="size-4" />
          {t("galleryUi.showAll", { count: total })}
        </button>
      </div>

      {open !== null ? (
        <ListingLightbox images={filtered} index={open} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}
