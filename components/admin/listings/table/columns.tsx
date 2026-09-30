"use client";

import type { Column, ColumnDef, SortDirection } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Cover,
  DemoTag,
  editorHref,
  FeaturedMark,
  initialsOf,
  kindOf,
  priceParts,
  shortNameOf,
  titleOf,
} from "./cells";
import { RowActions } from "./RowActions";
import type { AdminRow } from "./types";

export type ListingColumnId =
  | "select"
  | "cover"
  | "listing"
  | "price"
  | "status"
  | "agent"
  | "views"
  | "leads"
  | "updatedAt"
  | "actions";

/**
 * The actions column stays pinned to the right edge while the table scrolls
 * sideways (below ~1220 px). Its background has to be opaque, so the row hover
 * tint is mixed in rather than layered.
 */
const STICKY_END =
  "sticky right-0 z-[1] bg-card shadow-[inset_1px_0_0_var(--border)] group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] group-data-[state=selected]/row:bg-muted";

/**
 * Width/alignment per column, shared by the header, body and skeleton cells.
 * The table is `table-fixed`: every column but "Nekretnina" has a set width
 * and the title column takes the rest, so the table fits its card from
 * ~1220 px up without sideways scrolling.
 */
export const COLUMN_CLASS: Record<ListingColumnId, string> = {
  select: "w-10 pl-3",
  cover: "w-[72px]",
  listing: "",
  price: "w-[116px] text-right",
  status: "w-28",
  agent: "w-[120px]",
  views: "w-[120px] text-right",
  leads: "",
  updatedAt: "w-[100px]",
  actions: cn("w-12 pr-3 text-right", STICKY_END),
};

export function columnClass(id: string): string {
  return id in COLUMN_CLASS ? COLUMN_CLASS[id as ListingColumnId] : "";
}

function SortIcon({ sorted }: { sorted: false | SortDirection }) {
  if (sorted === false) {
    return <ArrowUpDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />;
  }
  const Icon = sorted === "asc" ? ArrowUp : ArrowDown;
  return <Icon className="size-3 shrink-0 text-primary" aria-hidden="true" />;
}

const SORT_BUTTON =
  "inline-flex items-center gap-0.5 rounded-sm transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

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
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(SORT_BUTTON, alignEnd && "flex-row-reverse", sorted !== false && "text-foreground")}
    >
      {label}
      <SortIcon sorted={sorted} />
    </button>
  );
}

/**
 * "Pregledi / upiti": one column, two sort targets. Each word sorts by its own
 * number; the arrow sits next to the active one, and a single muted ⇅ marks
 * the pair as sortable while neither is.
 */
function EngagementHeader({ views, leads }: { views: Column<AdminRow>; leads: Column<AdminRow> | undefined }) {
  const viewsSorted = views.getIsSorted();
  const leadsSorted = leads?.getIsSorted() ?? false;
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <button
        type="button"
        title="Sortiraj po broju pregleda"
        onClick={views.getToggleSortingHandler()}
        className={cn(SORT_BUTTON, viewsSorted !== false && "text-foreground")}
      >
        Pregledi
        {viewsSorted !== false ? <SortIcon sorted={viewsSorted} /> : null}
      </button>
      <span aria-hidden="true">/</span>
      {leads !== undefined ? (
        <button
          type="button"
          title="Sortiraj po broju upita"
          onClick={leads.getToggleSortingHandler()}
          className={cn(SORT_BUTTON, leadsSorted !== false && "text-foreground")}
        >
          upiti
          {leadsSorted !== false ? <SortIcon sorted={leadsSorted} /> : null}
        </button>
      ) : (
        "upiti"
      )}
      {viewsSorted === false && leadsSorted === false ? <SortIcon sorted={false} /> : null}
    </span>
  );
}

function ListingCell({ row }: { row: AdminRow }) {
  const title = titleOf(row);
  return (
    <div className="min-w-0 leading-tight">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0 font-mono">{row.ref}</span>
        {row.isDemo ? <DemoTag /> : null}
        <span className="truncate">
          <span aria-hidden="true">· </span>
          {kindOf(row)}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-sm leading-snug font-medium whitespace-normal">
        {row.isFeatured ? <FeaturedMark /> : null}
        <Link
          href={editorHref(row)}
          title={title}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {title}
        </Link>
      </p>
    </div>
  );
}

function PriceCell({ row }: { row: AdminRow }) {
  const price = priceParts(row);
  if (price === null) {
    return (
      <span className="text-muted-foreground" title="Cena nije uneta">
        —
      </span>
    );
  }
  return (
    <div className="leading-tight tabular-nums">
      <div className="font-medium whitespace-nowrap">
        {price.main}
        {price.unit !== null ? <span className="font-normal text-muted-foreground">{price.unit}</span> : null}
      </div>
      {price.perM2 !== null ? (
        <div className="text-xs whitespace-nowrap text-muted-foreground">{price.perM2}</div>
      ) : null}
    </div>
  );
}

function AgentCell({ name }: { name: string }) {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-2" title={trimmed}>
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground"
      >
        {initialsOf(trimmed)}
      </span>
      <span className="truncate">
        <span aria-hidden="true">{shortNameOf(trimmed)}</span>
        <span className="sr-only">{trimmed}</span>
      </span>
    </span>
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
      cell: ({ row }) => <Cover row={row.original} size="table" />,
    },
    {
      id: "listing",
      enableSorting: false,
      header: "Nekretnina",
      cell: ({ row }) => <ListingCell row={row.original} />,
    },
    {
      id: "price",
      accessorKey: "price",
      header: ({ column }) => <SortHeader column={column} label="Cena" alignEnd />,
      cell: ({ row }) => <PriceCell row={row.original} />,
    },
    {
      id: "status",
      enableSorting: false,
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "agent",
      enableSorting: false,
      header: "Agent",
      cell: ({ row }) => <AgentCell name={row.original.agentName} />,
    },
    {
      id: "views",
      accessorKey: "views",
      sortDescFirst: true,
      header: ({ column, table }) => <EngagementHeader views={column} leads={table.getColumn("leads")} />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatCount(row.original.views, "sr-Latn")}
          <span className="text-muted-foreground"> / </span>
          {formatCount(row.original.leads, "sr-Latn")}
        </span>
      ),
    },
    {
      // Never rendered (see `columnVisibility` in ListingsTable): it only
      // gives the "upiti" half of the merged header something to sort by.
      id: "leads",
      accessorKey: "leads",
      sortDescFirst: true,
      header: "Upiti",
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: ({ column }) => <SortHeader column={column} label="Izmenjeno" />,
      cell: ({ row }) => (
        <time
          dateTime={new Date(row.original.updatedAt).toISOString()}
          title={formatDateTime(row.original.updatedAt)}
          className="text-xs whitespace-nowrap text-muted-foreground"
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
