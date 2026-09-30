"use client";

import { ImageOff, Star } from "lucide-react";
import { formatEur, formatEurPerM2 } from "@/lib/admin/format";
import { adminThumb } from "@/lib/admin/images";
import { PROPERTY_TYPE_LABEL, TRANSACTION_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import type { AdminRow } from "./types";

/*
 * Cell pieces shared by the desktop table (`columns.tsx`) and the phone list
 * (`ListingsList.tsx`), so both read a row the same way.
 */

export function editorHref(row: AdminRow): string {
  return `/admin/nekretnine/${row._id}`;
}

export function titleOf(row: AdminRow): string {
  const title = row.title.sr.trim();
  return title.length > 0 ? title : "Bez naslova";
}

/** `Plac · Prodaja` */
export function kindOf(row: AdminRow): string {
  return `${PROPERTY_TYPE_LABEL[row.propertyType]} · ${TRANSACTION_LABEL[row.transaction]}`;
}

const THUMB = {
  table: { w: 56, h: 40, box: "h-10 w-14", request: 160 },
  list: { w: 72, h: 54, box: "h-[54px] w-[72px]", request: 200 },
} as const;

export function Cover({ row, size }: { row: AdminRow; size: keyof typeof THUMB }) {
  const thumb = THUMB[size];
  if (row.coverUrl === undefined) {
    return (
      <span
        className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground", thumb.box)}
        title="Bez naslovne fotografije"
      >
        <ImageOff className="size-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    // Covers are remote (Unsplash) or Convex storage URLs of unknown size; a
    // thumbnail this small gains nothing from the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={adminThumb(row.coverUrl, thumb.request)}
      alt=""
      width={thumb.w}
      height={thumb.h}
      loading="lazy"
      decoding="async"
      // `max-w-none`: preflight's `max-width: 100%` lets an auto-layout table
      // squeeze this cell to zero width.
      className={cn("max-w-none shrink-0 rounded-md bg-muted object-cover", thumb.box)}
    />
  );
}

/** Demo records are flagged in the ref line, never in the status column. */
export function DemoTag() {
  return (
    <span
      className="inline-flex h-3.5 shrink-0 items-center rounded-[3px] border px-1 font-mono text-[10px] leading-none tracking-wide text-muted-foreground uppercase"
      title="Demo sadržaj (briše se jednim klikom na stranici Demo sadržaj)"
    >
      Demo
    </span>
  );
}

/** Bronze star before the title of a featured listing. */
export function FeaturedMark() {
  return (
    <span title="Istaknuto" className="mr-1 inline-block align-[-2px]">
      <Star className="size-3.5 fill-bronze text-bronze" aria-hidden="true" />
      <span className="sr-only">Istaknuto: </span>
    </span>
  );
}

/** `480 € / mes.` over `9 €/m² mes.` for rentals, `62.000 €` over `50 €/m²` for sales. */
export function priceParts(row: AdminRow): { main: string; unit: string | null; perM2: string | null } | null {
  if (row.price <= 0) return null;
  const rent = row.transaction === "rent";
  return {
    main: formatEur(row.price),
    unit: rent ? " / mes." : null,
    perM2: row.pricePerM2 > 0 ? `${formatEurPerM2(row.pricePerM2)}${rent ? " mes." : ""}` : null,
  };
}

/** `Stefan Petrović` → `SP`; one word → its first letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("sr-Latn");
}

/** `Stefan Petrović` → `Stefan P.`; one word stays as it is. */
export function shortNameOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 2) return name.trim();
  return `${words[0]} ${words[words.length - 1]?.charAt(0) ?? ""}.`;
}
