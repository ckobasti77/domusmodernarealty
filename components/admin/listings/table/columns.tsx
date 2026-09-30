"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ImageOff, Star } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime, formatEur, formatEurPerM2, formatRelative } from "@/lib/admin/format";
import { PROPERTY_TYPE_LABEL, TRANSACTION_LABEL } from "@/lib/admin/labels";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RowActions } from "./RowActions";
import type { AdminRow } from "./types";
import { adminThumb } from "@/lib/admin/images";

export type ListingColumnId =
  | "select"
  | "cover"
  | "listing"
  | "type"
  | "price"
  | "status"
  | "agent"
  | "views"
  | "leads"
  | "updatedAt"
  | "actions";

/** Width/alignment per column, shared by the header, body and skeleton cells. */
export const COLUMN_CLASS: Record<ListingColumnId, string> = {
  select: "w-10 pl-3",
  cover: "w-[72px]",
  listing: "",
  type: "min-w-32",
  price: "text-right",
  status: "min-w-32",
  agent: "",
  views: "text-right",
  leads: "text-right",
  updatedAt: "",
  actions: "w-12 pr-3 text-right",
};

export function columnClass(id: string): string {
  return id in COLUMN_CLASS ? COLUMN_CLASS[id as ListingColumnId] : "";
}

function SortHeader({
  column,
  label,
  alignEnd = false,
}: {
  column: Column<AdminRow>;
  label: string;
  alignEnd?: boolean;
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        alignEnd && "flex-row-reverse",
        sorted !== false && "text-foreground",
      )}
    >
      {label}
      <Icon
        className={cn("size-3.5", sorted === false && "text-muted-foreground/60")}
        aria-hidden="true"
      />
    </button>
  );
}

function Cover({ row }: { row: AdminRow }) {
  if (row.coverUrl === undefined) {
    return (
      <span
        className="flex h-10 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground"
        title="Bez naslovne fotografije"
      >
        <ImageOff className="size-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    // Covers are remote (Unsplash) or Convex storage URLs of unknown size; a
    // 56×40 thumbnail gains nothing from the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={adminThumb(row.coverUrl, 160)}
      alt=""
      width={56}
      height={40}
      loading="lazy"
      decoding="async"
      // `max-w-none`: preflight's `max-width: 100%` lets an auto-layout table
      // squeeze this cell to zero width.
      className="h-10 w-14 max-w-none rounded-md bg-muted object-cover"
    />
  );
}

function titleOf(row: AdminRow): string {
  const title = row.title.sr.trim();
  return title.length > 0 ? title : "Bez naslova";
}

function Price({ row }: { row: AdminRow }) {
  if (row.price <= 0) {
    return (
      <span className="text-muted-foreground" title="Cena nije uneta">
        —
      </span>
    );
  }
  return (
    <div className="leading-tight tabular-nums">
      <div className="font-medium">
        {formatEur(row.price)}
        {row.transaction === "rent" ? (
          <span className="font-normal text-muted-foreground"> / mes.</span>
        ) : null}
      </div>
      {row.pricePerM2 > 0 ? (
        <div className="text-xs text-muted-foreground">{formatEurPerM2(row.pricePerM2)}</div>
      ) : null}
    </div>
  );
}

export function buildColumns({
  now,
  selectable,
  canDelete,
}: {
  now: number;
  /** Row selection feeds the bulk bar, which only managers get. */
  selectable: boolean;
  canDelete: boolean;
}): ColumnDef<AdminRow>[] {
  const select: ColumnDef<AdminRow> = {
    id: "select",
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        aria-label="Izaberi sve učitane nekretnine"
        checked={
          table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        data-testid="row-select"
        aria-label={`Izaberi ${row.original.ref}`}
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
      />
    ),
  };

  const columns: ColumnDef<AdminRow>[] = [
    {
      id: "cover",
      enableSorting: false,
      header: () => <span className="sr-only">Naslovna fotografija</span>,
      cell: ({ row }) => <Cover row={row.original} />,
    },
    {
      id: "listing",
      enableSorting: false,
      header: "Nekretnina",
      cell: ({ row }) => (
        <div className="flex max-w-80 min-w-56 flex-col leading-tight">
          <span className="font-mono text-xs text-muted-foreground">{row.original.ref}</span>
          <Link
            href={`/admin/nekretnine/${row.original._id}`}
            title={titleOf(row.original)}
            className="truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {titleOf(row.original)}
          </Link>
        </div>
      ),
    },
    {
      id: "type",
      enableSorting: false,
      header: "Tip",
      cell: ({ row }) => (
        <div className="leading-tight">
          <div>{PROPERTY_TYPE_LABEL[row.original.propertyType]}</div>
          <div className="text-xs text-muted-foreground">
            {TRANSACTION_LABEL[row.original.transaction]}
          </div>
        </div>
      ),
    },
    {
      id: "price",
      accessorKey: "price",
      header: ({ column }) => <SortHeader column={column} label="Cena" alignEnd />,
      cell: ({ row }) => <Price row={row.original} />,
    },
    {
      id: "status",
      enableSorting: false,
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.original.status} />
          {row.original.isFeatured ? (
            <span className="inline-flex items-center gap-0.5 text-xs text-foreground">
              <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
              Istaknuto
            </span>
          ) : null}
          {row.original.isDemo ? (
            <span className="rounded border border-dashed px-1 text-[11px] leading-4 text-muted-foreground">
              Demo
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "agent",
      enableSorting: false,
      header: "Agent",
      cell: ({ row }) => (
        <span className="block max-w-44 truncate" title={row.original.agentName}>
          {row.original.agentName}
        </span>
      ),
    },
    {
      id: "views",
      accessorKey: "views",
      header: ({ column }) => <SortHeader column={column} label="Pregledi" alignEnd />,
      cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.views, "sr-Latn")}</span>,
    },
    {
      id: "leads",
      accessorKey: "leads",
      header: ({ column }) => <SortHeader column={column} label="Upiti" alignEnd />,
      cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.leads, "sr-Latn")}</span>,
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: ({ column }) => <SortHeader column={column} label="Izmenjeno" />,
      cell: ({ row }) => (
        <time
          dateTime={new Date(row.original.updatedAt).toISOString()}
          title={formatDateTime(row.original.updatedAt)}
          className="text-muted-foreground"
        >
          {formatRelative(row.original.updatedAt, now)}
        </time>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Radnje</span>,
      cell: ({ row }) => <RowActions row={row.original} canDelete={canDelete} />,
    },
  ];

  return selectable ? [select, ...columns] : columns;
}
