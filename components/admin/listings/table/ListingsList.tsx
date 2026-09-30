"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Cover, DemoTag, editorHref, FeaturedMark, priceParts, titleOf } from "./cells";
import type { AdminRow } from "./types";

const SKELETON_ROWS = 6;

/**
 * The listings on a phone: one tappable line per listing that opens the
 * editor. No checkboxes or row menus; bulk work is a desktop task.
 * Rendered INSTEAD of the table (never next to it), so each `listing-row`
 * test id exists once.
 */
export function ListingsList({
  rows,
  loading,
  refreshing,
  empty,
}: {
  rows: AdminRow[];
  loading: boolean;
  refreshing: boolean;
  empty: ReactNode;
}) {
  if (loading) {
    return (
      <ul aria-busy="true" aria-label="Nekretnine se učitavaju" className="divide-y">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li key={index} className="flex gap-3 px-3 py-3">
            <Skeleton className="h-[54px] w-[72px] shrink-0" />
            <div className="flex-1 space-y-2 py-0.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (rows.length === 0) return <div className="px-4 py-10 text-center">{empty}</div>;

  return (
    <ul
      aria-label="Nekretnine"
      aria-busy={refreshing}
      className={cn("divide-y transition-opacity duration-150", refreshing && "opacity-60")}
    >
      {rows.map((row) => (
        <ListItem key={row._id} row={row} />
      ))}
    </ul>
  );
}

function ListItem({ row }: { row: AdminRow }) {
  const price = priceParts(row);
  return (
    <li data-testid="listing-row" data-ref={row.ref} data-status={row.status}>
      <Link
        href={editorHref(row)}
        className="flex gap-3 px-3 py-3 transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
      >
        <Cover row={row} size="list" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono">{row.ref}</span>
              {row.isDemo ? <DemoTag /> : null}
            </span>
            <StatusBadge status={row.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-snug font-medium">
            {row.isFeatured ? <FeaturedMark /> : null}
            {titleOf(row)}
          </p>
          <p className="mt-1 text-sm tabular-nums">
            {price === null ? (
              <span className="text-muted-foreground">Cena nije uneta</span>
            ) : (
              <>
                <span className="font-medium">{price.main}</span>
                {price.unit !== null ? <span className="text-muted-foreground">{price.unit}</span> : null}
                {price.perM2 !== null ? (
                  <>
                    {" "}
                    <span className="ml-1 text-xs text-muted-foreground">{price.perM2}</span>
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}
